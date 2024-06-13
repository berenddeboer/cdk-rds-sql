import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from "@aws-sdk/client-secrets-manager"
import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from "aws-lambda"
import { backOff } from "exponential-backoff"
import { format } from "node-pg-format"
import { Client } from "pg"
import { RdsSqlResource } from "./enum"

interface CustomResourceResponse {
  PhysicalResourceId?: string
  Data?: any
  NoEcho?: boolean
}

type CreateResourceHandler = (
  resourceId: string,
  props?: any
) => Promise<string | string[]>
type UpdateResourceHandler = (
  resourceId: string,
  oldResourceId: string,
  props?: any
) => Promise<string | string[] | void>
type DeleteResourceHandler = (resourceId: string, props?: any) => string | string[] | void

type JumpTable = {
  [key in RdsSqlResource]: {
    Create: CreateResourceHandler
    Update: UpdateResourceHandler
    Delete: DeleteResourceHandler
  }
}

interface RoleProps {
  /**
   * Secret ARN.
   */
  PasswordArn: string

  /**
   * Optional database to which role is granted connect permissions.
   */
  DatabaseName?: string
}

interface DatabaseProps {
  Owner: string
}

interface DatabaseUpdateProps extends DatabaseProps {
  MasterOwner: string
}

const maxAttempts = 20

const jumpTable: JumpTable = {
  sql: {
    Create: (_: string, props?: any) => {
      return props.Statement
    },
    Update: (_: string, __: string, props?: any) => {
      return props.Statement
    },
    Delete: (_: string, __: string, props?: any) => {
      return props.Rollback
    },
  },
  schema: {
    Create: async (resourceId: string) => {
      return format("create schema if not exists %I", resourceId)
    },
    Update: async (resourceId: string, oldResourceId: string) => {
      return format("alter schema %I rename to %I", oldResourceId, resourceId)
    },
    Delete: (resourceId: string) => {
      return format("drop schema if exists %I cascade", resourceId)
    },
  },
  role: {
    Create: async (resourceId: string, props: RoleProps) => {
      if (!props.PasswordArn) throw "No PasswordArn provided"
      const password = await getPassword(props.PasswordArn)
      if (password) {
        const sql = [
          "start transaction",
          format("create role %I with login password %L", resourceId, password),
        ]
        if (props.DatabaseName) {
          // grant connect to database if database already exists
          sql.push(
            format(
              `DO $$
BEGIN
  IF EXISTS (select from pg_database where datname = '%s' and datistemplate = false) THEN
    grant connect on database %I to %I;
  END IF;
END$$;`,
              props.DatabaseName,
              props.DatabaseName,
              resourceId
            )
          )
        }
        sql.push("commit")
        return sql
      } else {
        throw `Cannot parse password from ${props.PasswordArn}`
      }
    },
    Update: async (resourceId: string, oldResourceId: string, props: RoleProps) => {
      // TODO: if database name has changed in OldResourceProperties, revoke connect
      if (props && props.PasswordArn) {
        const password = await getPassword(props.PasswordArn)
        if (password) {
          const sql = ["start transaction"]
          if (oldResourceId !== resourceId) {
            sql.push(format("alter role %I rename to %I", oldResourceId, resourceId))
          }
          sql.push(format("alter role %I with password %L", resourceId, password))
          if (props.DatabaseName) {
            sql.push(
              format("grant connect on database %I to %I", props.DatabaseName, resourceId)
            )
          }
          sql.push("commit")
          return sql
        } else {
          throw `Cannot parse password from ${props.PasswordArn}`
        }
      } else {
        const sql = ["start transaction"]
        if (oldResourceId !== resourceId) {
          sql.push(format("alter role %I rename to %I", oldResourceId, resourceId))
        }
        sql.push(
          format(
            `DO $$
BEGIN
  IF EXISTS (select from pg_database where datname = '%s' and datistemplate = false) THEN
    grant connect on database %I to %I;
  END IF;
END$$;`,
            props.DatabaseName,
            props.DatabaseName,
            resourceId
          )
        )
        sql.push("commit")
        return sql
      }
    },
    Delete: (resourceId: string, props: RoleProps) => {
      // TODO: if user is owner of a database, assign ownership to master user
      // This will require a specified inheritor on role creation
      return [
        "start transaction",
        format(
          `DO $$
BEGIN
  IF EXISTS (select from pg_catalog.pg_roles WHERE rolname = '%s') AND EXISTS (select from pg_database WHERE datname = '%s') THEN
    revoke all privileges on database %I from %I;
  END IF;
END$$;`,
          resourceId,
          props.DatabaseName,
          props.DatabaseName,
          resourceId
        ),
        format("drop role if exists %I", resourceId),
        "commit",
      ]
    },
  },
  database: {
    Create: async (resourceId: string, props: DatabaseProps) => {
      const owner = props.Owner
      if (owner) {
        return [
          format("create database %I", resourceId),
          format("alter database %I owner to %I", resourceId, owner),
        ]
      } else {
        return format("create database %I", resourceId)
      }
    },
    Update: async (
      resourceId: string,
      oldResourceId: string,
      props: DatabaseUpdateProps
    ): Promise<string[]> => {
      const statements: string[] = []
      if (resourceId !== oldResourceId) {
        if (props.MasterOwner) {
          statements.push(
            format("alter database %I owner to %I", oldResourceId, props.MasterOwner)
          )
        }
        statements.push(
          format("alter database %I rename to %I", oldResourceId, resourceId)
        )
      }
      const owner = props.Owner
      if (owner) {
        statements.push(format("alter database %I owner to %I", resourceId, props.Owner))
      }
      return statements
    },
    Delete: (resourceId: string, newOwner: string) => {
      return [
        format(
          "select pg_terminate_backend(pg_stat_activity.pid) from pg_stat_activity where datname = %L",
          resourceId
        ),
        format(
          "DO $$BEGIN\nIF EXISTS (select from pg_database WHERE datname = '%s') THEN alter database %I owner to %I; END IF;\nEND$$;",
          resourceId,
          resourceId,
          newOwner
        ),
        format("drop database if exists %I", resourceId),
      ]
    },
  },
}

const log =
  process.env.LOGGER === "true"
    ? console.debug
    : (_message?: any, ..._optionalParams: any[]) => {}

export const handler = async (
  event:
    | CloudFormationCustomResourceCreateEvent
    | CloudFormationCustomResourceUpdateEvent
    | CloudFormationCustomResourceDeleteEvent
): Promise<any> => {
  log(event)

  const requestType = event.RequestType
  const resource: RdsSqlResource = event.ResourceProperties.Resource
  const resourceId = event.ResourceProperties.ResourceId
  const databaseName = event.ResourceProperties.DatabaseName

  if (!Object.keys(jumpTable).includes(event.ResourceProperties.Resource)) {
    throw `Resource type '${resource}' not recognised.`
  }

  const secrets_client = new SecretsManagerClient({})
  const command = new GetSecretValueCommand({
    SecretId: event.ResourceProperties.SecretArn,
  })
  // As the IAM credentials can be cached, an update makde very recent
  // could not yet be available.
  // So we retry this a bit.
  log("Fetching secret")
  const secret: GetSecretValueCommandOutput = await backOff(
    async () => {
      try {
        const result = await secrets_client.send(command)
        return result
      } catch (e) {
        log("Error fetching secret %o", e)
        throw e
      }
    },
    {
      numOfAttempts: 10,
      startingDelay: 500,
    }
  )
  if (!secret.SecretString) throw "No secret string"
  const secretValues = JSON.parse(secret.SecretString)

  let sql: string | string[] | void
  switch (requestType) {
    case "Create": {
      sql = await jumpTable[resource][requestType](resourceId, event.ResourceProperties)
      break
    }
    case "Update": {
      const oldResourceId = (event as CloudFormationCustomResourceUpdateEvent)
        .PhysicalResourceId
      sql = await jumpTable[resource][requestType](resourceId, oldResourceId, {
        ...event.ResourceProperties,
        MasterOwner: secretValues.username,
      })
      break
    }
    case "Delete": {
      if (resource === RdsSqlResource.DATABASE) {
        sql = jumpTable[resource][requestType](resourceId, secretValues.username)
      } else {
        sql = jumpTable[resource][requestType](resourceId, event.ResourceProperties)
      }
      break
    }
  }

  if (sql) {
    let database: string
    if (resource === RdsSqlResource.ROLE) {
      database = secretValues.dbname
    } else {
      database = databaseName ?? secretValues.dbname // connect to given database if possible, else to database mentioned in secret
    }
    const params = {
      host: secretValues.host,
      port: secretValues.port,
      user: secretValues.username,
      password: secretValues.password,
      database: database,
      connectionTimeoutMillis: 2000, // return an error if a connection could not be established within 2 seconds
    }
    log(
      `Connecting to host ${params.host}: ${params.port}, database ${params.database} as ${params.user}`
    )
    log("Executing SQL", sql)
    const pg_client = new Client(params)
    await pg_client.connect()
    try {
      await backOff(
        async () => {
          if (typeof sql === "string") {
            return pg_client.query(sql)
          } else {
            if (sql) {
              return Promise.all(
                sql.map((statement) => {
                  return pg_client.query(statement)
                })
              )
            } else {
              return
            }
          }
        },
        {
          retry: errorFilter,
          numOfAttempts: maxAttempts,
        }
      )
    } finally {
      await pg_client.end()
    }
  }

  let response: CustomResourceResponse = {}
  // Except for the SQL resource, return the new resource id. This
  // will cause a delete to be send for the old resource.
  if (resource !== RdsSqlResource.SQL) {
    response.PhysicalResourceId = resourceId
  }

  return response
}

// Custom error filter, mainly to retry role creation.
// Frequently see "tuple concurrently updated", and adding
// dependencies is very hard to make work.
const errorFilter = (error: any, nextAttemptNumber: number) => {
  // Retry only if the error message contains "tuple concurrently"
  // This will cover concurrent updates and deletes
  const willRetry = error.message.includes("tuple concurrently")
  log(
    "Encountered an error on attempt %d/%d retry=%s error=[%o]",
    nextAttemptNumber - 1,
    maxAttempts,
    willRetry,
    error
  )
  return willRetry
}

/**
 * Parse password field from secret. Returns void on error.
 */
const getPassword = async (arn: string): Promise<string | void> => {
  const secrets_client = new SecretsManagerClient({})
  const command = new GetSecretValueCommand({
    SecretId: arn,
  })
  const secret = await secrets_client.send(command)
  if (secret.SecretString) {
    const json = JSON.parse(secret.SecretString)
    return json.password
  }
}
