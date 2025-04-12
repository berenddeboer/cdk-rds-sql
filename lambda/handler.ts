import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from "@aws-sdk/client-secrets-manager"
import {
  SSMClient,
  PutParameterCommand,
  DeleteParameterCommand,
} from "@aws-sdk/client-ssm"
import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from "aws-lambda"
import { backOff } from "exponential-backoff"
import { EngineFactory } from "./engine.factory"
import { EngineConnectionConfig } from "./engine.abstract"
import { RdsSqlResource } from "../src/enum"

interface CustomResourceResponse {
  PhysicalResourceId?: string
  Data?: any
  NoEcho?: boolean
}

const maxAttempts = 20

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

  if (!Object.values(RdsSqlResource).includes(resource)) {
    throw `Resource type '${resource}' not recognised.`
  }

  const secrets_client = new SecretsManagerClient({})
  const command = new GetSecretValueCommand({
    SecretId: event.ResourceProperties.SecretArn,
  })

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

  // Determine the database engine type
  const engine = secretValues.engine || "postgresql" // Default to postgresql if not specified
  const dbEngine = EngineFactory.createEngine(engine)

  let sql: string | string[] | undefined
  switch (requestType) {
    case "Create": {
      switch (resource) {
        case RdsSqlResource.DATABASE:
          sql = dbEngine.createDatabase(resourceId, event.ResourceProperties)
          break
        case RdsSqlResource.ROLE:
          sql = await dbEngine.createRole(resourceId, event.ResourceProperties)
          break
        case RdsSqlResource.SCHEMA:
          sql = dbEngine.createSchema(resourceId, event.ResourceProperties)
          break
        case RdsSqlResource.SQL:
          sql = dbEngine.createSql(resourceId, event.ResourceProperties)
          break
        case RdsSqlResource.PARAMETER_PASSWORD:
          await handleParameterPassword(event.ResourceProperties)
          break
      }
      break
    }
    case "Update": {
      const oldResourceId = (event as CloudFormationCustomResourceUpdateEvent)
        .PhysicalResourceId
      switch (resource) {
        case RdsSqlResource.DATABASE:
          sql = dbEngine.updateDatabase(resourceId, oldResourceId, {
            ...event.ResourceProperties,
            MasterOwner: secretValues.username,
          })
          break
        case RdsSqlResource.ROLE:
          sql = await dbEngine.updateRole(
            resourceId,
            oldResourceId,
            event.ResourceProperties
          )
          break
        case RdsSqlResource.SCHEMA:
          sql = dbEngine.updateSchema(resourceId, oldResourceId, event.ResourceProperties)
          break
        case RdsSqlResource.SQL:
          sql = dbEngine.updateSql(resourceId, oldResourceId, event.ResourceProperties)
          break
        case RdsSqlResource.PARAMETER_PASSWORD:
          await handleParameterPassword(event.ResourceProperties)
          sql = undefined // No SQL to execute
          break
      }
      break
    }
    case "Delete": {
      switch (resource) {
        case RdsSqlResource.DATABASE:
          sql = dbEngine.deleteDatabase(resourceId, secretValues.username)
          break
        case RdsSqlResource.ROLE:
          sql = dbEngine.deleteRole(resourceId, event.ResourceProperties)
          break
        case RdsSqlResource.SCHEMA:
          sql = dbEngine.deleteSchema(resourceId, event.ResourceProperties)
          break
        case RdsSqlResource.SQL:
          sql = dbEngine.deleteSql(resourceId, event.ResourceProperties)
          break
        case RdsSqlResource.PARAMETER_PASSWORD:
          await deleteParameterPassword(event.ResourceProperties)
          break
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

    const config: EngineConnectionConfig = {
      host: secretValues.host,
      port: secretValues.port,
      user: secretValues.username,
      password: secretValues.password,
      database: database,
    }

    try {
      await backOff(
        async () => {
          return dbEngine.executeSQL(sql as string | string[], config)
        },
        {
          retry: errorFilter,
          numOfAttempts: maxAttempts,
        }
      )
    } catch (error) {
      log("Error executing SQL: %o", error)
      throw error
    }
  }

  let response: CustomResourceResponse = {}
  // Except for the SQL resource, return the new resource id. This
  // will cause a delete to be sent for the old resource.
  if (resource !== RdsSqlResource.SQL) {
    response.PhysicalResourceId = resourceId
  }

  return response
}

// Custom error filter, mainly to retry role creation.
const errorFilter = (error: any, nextAttemptNumber: number) => {
  // Retry only if the error message includes "tuple concurrently"
  // This will cover concurrent updates and deletes
  const willRetry = error.message && error.message.includes("tuple concurrently")
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
 * Copy password generated in secret to our password parameter.
 */
async function handleParameterPassword(props: any): Promise<void> {
  const secretArn = props.SecretArn
  const parameterName = props.ParameterName

  // Get the secret
  const secrets_client = new SecretsManagerClient({})
  const secretData = await secrets_client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  )

  if (!secretData.SecretString) throw "No secret string for parameter"
  const secretObj = JSON.parse(secretData.SecretString)

  // Put the password in SSM
  const ssmClient = new SSMClient({})
  await ssmClient.send(
    new PutParameterCommand({
      Name: parameterName,
      Value: secretObj.password,
      Type: "SecureString",
      Overwrite: true,
    })
  )
}

/**
 * Cleanup: remove generated password parameter.
 */
async function deleteParameterPassword(props: any): Promise<void> {
  const parameterName = props.ParameterName
  const ssmClient = new SSMClient({})
  await ssmClient.send(
    new DeleteParameterCommand({
      Name: parameterName,
    })
  )
}
