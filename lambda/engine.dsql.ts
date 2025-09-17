import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { format as pgFormat } from "node-pg-format"
import { Client, ClientConfig } from "pg"
import { AbstractEngine, EngineConnectionConfig } from "./engine.abstract"
import {
  EngineDatabaseProperties,
  EngineRoleProperties,
  EngineSchemaProperties,
  EngineSqlProperties,
  EngineIamGrantProperties,
} from "./types"

export class DsqlEngine extends AbstractEngine {
  createDatabase(
    _resourceId: string,
    _props: EngineDatabaseProperties
  ): string | string[] {
    throw new Error(
      "DSQL does not support creating databases. Database is always 'postgres'."
    )
  }

  updateDatabase(
    _resourceId: string,
    _oldResourceId: string,
    _props: EngineDatabaseProperties
  ): string[] {
    throw new Error(
      "DSQL does not support database operations. Database is always 'postgres'."
    )
  }

  deleteDatabase(_resourceId: string, _masterUser: string): string | string[] {
    throw new Error(
      "DSQL does not support deleting databases. Database is always 'postgres'."
    )
  }

  async createRole(resourceId: string, props: EngineRoleProperties): Promise<string[]> {
    return this.generateCreateRoleSql(resourceId, props?.DatabaseName)
  }

  async updateRole(
    resourceId: string,
    oldResourceId: string,
    props: EngineRoleProperties,
    oldProps: EngineRoleProperties
  ): Promise<string[]> {
    const sql: string[] = []

    if (oldResourceId !== resourceId) {
      // DSQL doesn't support RENAME, so we create new role and drop old one
      // Create new role with old database permissions first
      sql.push(...this.generateCreateRoleSql(resourceId, oldProps?.DatabaseName))

      // Drop old role
      sql.push(...this.generateDropRoleSql(oldResourceId))

      // If database changed as well, grant new database permissions
      if (props?.DatabaseName && props.DatabaseName !== oldProps?.DatabaseName) {
        sql.push("BEGIN")
        sql.push(
          pgFormat("GRANT CONNECT ON DATABASE %I TO %I", props.DatabaseName, resourceId)
        )
        sql.push("COMMIT")
      }
    } else {
      // Only permissions are changing (no rename)
      sql.push("BEGIN")

      // Handle database permission changes
      if (
        oldProps?.DatabaseName &&
        props?.DatabaseName &&
        oldProps.DatabaseName !== props.DatabaseName
      ) {
        // Revoke from old database and grant to new
        sql.push(
          pgFormat(
            "REVOKE CONNECT ON DATABASE %I FROM %I",
            oldProps.DatabaseName,
            resourceId
          )
        )
        sql.push(
          pgFormat("GRANT CONNECT ON DATABASE %I TO %I", props.DatabaseName, resourceId)
        )
      } else if (props?.DatabaseName && !oldProps?.DatabaseName) {
        // Grant to new database
        sql.push(
          pgFormat("GRANT CONNECT ON DATABASE %I TO %I", props.DatabaseName, resourceId)
        )
      } else if (!props?.DatabaseName && oldProps?.DatabaseName) {
        // Revoke from old database
        sql.push(
          pgFormat(
            "REVOKE CONNECT ON DATABASE %I FROM %I",
            oldProps.DatabaseName,
            resourceId
          )
        )
      }

      sql.push("COMMIT")
    }

    return sql
  }

  deleteRole(resourceId: string, props: EngineRoleProperties): string | string[] {
    return this.generateDropRoleSql(resourceId, props?.DatabaseName)
  }

  createSchema(resourceId: string, props: EngineSchemaProperties): string | string[] {
    const sql: string[] = [pgFormat("CREATE SCHEMA IF NOT EXISTS %I", resourceId)]
    if (props?.RoleName) {
      this.grantRoleForSchema(resourceId, props.RoleName).forEach((stmt) =>
        sql.push(stmt)
      )
    }
    return sql
  }

  updateSchema(
    resourceId: string,
    oldResourceId: string,
    props: EngineSchemaProperties
  ): string | string[] {
    const statements: string[] = []
    if (props?.RoleName) {
      this.revokeRoleFromSchema(oldResourceId, props.RoleName).forEach((stmt) =>
        statements.push(stmt)
      )
    }
    if (resourceId !== oldResourceId) {
      statements.push(pgFormat("ALTER SCHEMA %I RENAME TO %I", oldResourceId, resourceId))
    }
    if (props?.RoleName) {
      this.grantRoleForSchema(resourceId, props.RoleName).forEach((stmt) =>
        statements.push(stmt)
      )
    }
    return statements
  }

  deleteSchema(resourceId: string, props: EngineSchemaProperties): string | string[] {
    const statements: string[] = []
    if (props?.RoleName) {
      this.revokeRoleFromSchema(resourceId, props.RoleName).forEach((stmt) =>
        statements.push(stmt)
      )
    }
    statements.push(pgFormat("DROP SCHEMA IF EXISTS %I CASCADE", resourceId))
    return statements
  }

  createSql(_resourceId: string, props: EngineSqlProperties): string | string[] {
    if (!props.Statement) {
      throw new Error("Statement is required for SQL resource")
    }
    return props.Statement
  }

  updateSql(
    _resourceId: string,
    _oldResourceId: string,
    props: EngineSqlProperties
  ): string | string[] {
    if (!props.Statement) {
      throw new Error("Statement is required for SQL resource")
    }
    return props.Statement
  }

  deleteSql(_resourceId: string, props: EngineSqlProperties): string | string[] {
    if (props.Rollback) {
      return props.Rollback
    }
    return []
  }

  createIamGrant(resourceId: string, props: EngineIamGrantProperties): string | string[] {
    if (!props.ResourceArn) {
      throw new Error("ResourceArn is required for IAM grant")
    }
    return pgFormat("AWS IAM GRANT %I TO %L", resourceId, props.ResourceArn)
  }

  updateIamGrant(
    resourceId: string,
    oldResourceId: string,
    props: EngineIamGrantProperties,
    oldProps: EngineIamGrantProperties
  ): string | string[] {
    const statements: string[] = []

    // Revoke old grant if resource ARN or role name changed
    if (oldProps.ResourceArn) {
      statements.push(
        pgFormat("AWS IAM REVOKE %I FROM %L", oldResourceId, oldProps.ResourceArn)
      )
    }

    // Grant new permissions
    if (props.ResourceArn) {
      statements.push(pgFormat("AWS IAM GRANT %I TO %L", resourceId, props.ResourceArn))
    }

    return statements
  }

  deleteIamGrant(resourceId: string, props: EngineIamGrantProperties): string | string[] {
    if (!props.ResourceArn) {
      throw new Error("ResourceArn is required for IAM grant deletion")
    }
    return pgFormat("AWS IAM REVOKE %I FROM %L", resourceId, props.ResourceArn)
  }

  async executeSQL(sql: string | string[], config: EngineConnectionConfig): Promise<any> {
    this.log("Connecting to DSQL cluster...")

    // For DSQL, we need to generate an IAM auth token
    const region = process.env.AWS_REGION
    if (!region) {
      throw new Error("AWS_REGION environment variable is required for DSQL")
    }

    const signer = new DsqlSigner({
      hostname: config.host,
      region: region,
    })
    const authToken = await signer.getDbConnectAdminAuthToken()

    const clientConfig: ClientConfig = {
      host: config.host,
      port: config.port,
      user: "admin", // DSQL always uses 'admin' user
      password: authToken, // Use IAM auth token as password
      database: "postgres", // DSQL always uses 'postgres' database
      ssl: {
        //ca: fs.readFileSync(`${process.env.LAMBDA_TASK_ROOT}/global-bundle.pem`),
        rejectUnauthorized: true,
      },
      connectionTimeoutMillis: 30000,
      query_timeout: 30000,
      //statement_timeout: 30000, // not supported on DSQL
    }

    const client = new Client(clientConfig)

    try {
      await client.connect()
      this.log("Connected to DSQL cluster")

      const statements = Array.isArray(sql) ? sql : [sql]
      const results = []

      for (const statement of statements) {
        if (statement.trim()) {
          this.log(`Executing SQL: ${statement}`)
          const result = await client.query(statement)
          results.push(result)
        }
      }

      this.log("SQL execution completed")
      return results.length === 1 ? results[0] : results
    } catch (error) {
      this.log(`Error executing SQL: ${error}`)
      throw error
    } finally {
      try {
        await client.end()
        this.log("Disconnected from DSQL cluster")
      } catch (error) {
        this.log(`Error disconnecting: ${error}`)
      }
    }
  }

  private grantRoleForSchema(schema: string, roleName: string): string[] {
    return [
      pgFormat("GRANT USAGE ON SCHEMA %I TO %I", schema, roleName),
      pgFormat("GRANT CREATE ON SCHEMA %I TO %I", schema, roleName),
    ]
  }

  private revokeRoleFromSchema(schema: string, roleName: string): string[] {
    return [
      pgFormat("REVOKE CREATE ON SCHEMA %I FROM %I", schema, roleName),
      pgFormat("REVOKE ALL ON SCHEMA %I FROM %I", schema, roleName),
    ]
  }

  private generateCreateRoleSql(roleName: string, databaseName?: string): string[] {
    const sql = ["BEGIN"]
    sql.push(pgFormat("CREATE ROLE %I WITH LOGIN", roleName))

    if (databaseName) {
      sql.push(pgFormat("GRANT CONNECT ON DATABASE %I TO %I", databaseName, roleName))
    }

    sql.push("COMMIT")
    return sql
  }

  private generateDropRoleSql(roleName: string, databaseName?: string): string[] {
    const sql = ["BEGIN"]

    if (databaseName) {
      sql.push(
        pgFormat("REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I", databaseName, roleName)
      )
    }

    sql.push(pgFormat("DROP ROLE IF EXISTS %I", roleName))
    sql.push("COMMIT")
    return sql
  }
}
