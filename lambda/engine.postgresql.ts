import * as fs from "fs"
import { ConnectionOptions } from "tls"
import { format as pgFormat } from "node-pg-format"
import { Client, ClientConfig } from "pg"
import { AbstractEngine, EngineConnectionConfig } from "./engine.abstract"

export class PostgresqlEngine extends AbstractEngine {
  async createDatabase(resourceId: string, props?: any): Promise<string | string[]> {
    const owner = props?.Owner
    if (owner) {
      return [
        pgFormat("create database %I", resourceId),
        pgFormat("alter database %I owner to %I", resourceId, owner),
      ]
    } else {
      return pgFormat("create database %I", resourceId)
    }
  }

  async updateDatabase(
    resourceId: string,
    oldResourceId: string,
    props?: any
  ): Promise<string[]> {
    const statements: string[] = []
    if (resourceId !== oldResourceId) {
      if (props?.MasterOwner) {
        statements.push(
          pgFormat("alter database %I owner to %I", oldResourceId, props.MasterOwner)
        )
      }
      statements.push(
        pgFormat("alter database %I rename to %I", oldResourceId, resourceId)
      )
    }
    const owner = props?.Owner
    if (owner) {
      statements.push(pgFormat("alter database %I owner to %I", resourceId, props.Owner))
    }
    return statements
  }

  deleteDatabase(resourceId: string, masterUser: string): string[] {
    return [
      pgFormat(
        "select pg_terminate_backend(pg_stat_activity.pid) from pg_stat_activity where datname = %L",
        resourceId
      ),
      pgFormat(
        "DO $$BEGIN\nIF EXISTS (select from pg_database WHERE datname = '%s') THEN alter database %I owner to %I; END IF;\nEND$$;",
        resourceId,
        resourceId,
        masterUser
      ),
      pgFormat("drop database if exists %I", resourceId),
    ]
  }

  async createRole(resourceId: string, props?: any): Promise<string[]> {
    if (!props.PasswordArn) throw "No PasswordArn provided"
    const password = await this.getPassword(props.PasswordArn)
    if (password) {
      const sql = [
        "start transaction",
        pgFormat("create role %I with login password %L", resourceId, password),
      ]
      if (props.DatabaseName) {
        sql.push(
          pgFormat(
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
  }

  async updateRole(
    resourceId: string,
    oldResourceId: string,
    props?: any
  ): Promise<string[]> {
    if (props?.PasswordArn) {
      const password = await this.getPassword(props.PasswordArn)
      if (password) {
        const sql = ["start transaction"]
        if (oldResourceId !== resourceId) {
          sql.push(pgFormat("alter role %I rename to %I", oldResourceId, resourceId))
        }
        sql.push(pgFormat("alter role %I with password %L", resourceId, password))
        if (props.DatabaseName) {
          sql.push(
            pgFormat("grant connect on database %I to %I", props.DatabaseName, resourceId)
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
        sql.push(pgFormat("alter role %I rename to %I", oldResourceId, resourceId))
      }
      sql.push(
        pgFormat(
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
  }

  deleteRole(resourceId: string, props?: any): string[] {
    return [
      "start transaction",
      pgFormat(
        `DO $$
BEGIN
  IF EXISTS (select from pg_catalog.pg_roles WHERE rolname = '%s') AND EXISTS (select from pg_database WHERE datname = '%s') THEN
    revoke all privileges on database %I from %I;
  END IF;
END$$;`,
        resourceId,
        props?.DatabaseName,
        props?.DatabaseName,
        resourceId
      ),
      pgFormat("drop role if exists %I", resourceId),
      "commit",
    ]
  }

  async createSchema(resourceId: string, props?: any): Promise<string[]> {
    const sql: string[] = [pgFormat("create schema if not exists %I", resourceId)]
    if (props?.RoleName) {
      this.grantRoleForSchema(resourceId, props.RoleName).forEach((stmt) =>
        sql.push(stmt)
      )
    }
    return sql
  }

  async updateSchema(
    resourceId: string,
    oldResourceId: string,
    props?: any
  ): Promise<string[]> {
    const sql: string[] = []
    if (props?.RoleName) {
      this.revokeRoleFromSchema(oldResourceId, props.RoleName).forEach((stmt) =>
        sql.push(stmt)
      )
    }
    sql.push(pgFormat("alter schema %I rename to %I", oldResourceId, resourceId))
    if (props?.RoleName) {
      this.grantRoleForSchema(resourceId, props.RoleName).forEach((stmt) =>
        sql.push(stmt)
      )
    }
    return sql
  }

  deleteSchema(resourceId: string, props?: any): string[] {
    const sql: string[] = []
    if (props?.RoleName) {
      this.revokeRoleFromSchema(resourceId, props.RoleName).forEach((stmt) =>
        sql.push(stmt)
      )
    }
    sql.push(pgFormat("drop schema if exists %I cascade", resourceId))
    return sql
  }

  async createSql(_resourceId: string, props?: any): Promise<string> {
    return props.Statement
  }

  async updateSql(
    _resourceId: string,
    _oldResourceId: string,
    props?: any
  ): Promise<string> {
    return props.Statement
  }

  deleteSql(_resourceId: string, props?: any): string {
    return props.Rollback
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

  async executeSQL(sql: string | string[], config: EngineConnectionConfig): Promise<any> {
    const isSslEnabled = process.env.SSL ? JSON.parse(process.env.SSL) : true
    const ssl: ConnectionOptions | false = isSslEnabled
      ? {
          ca: fs.readFileSync(`${process.env.LAMBDA_TASK_ROOT}/global-bundle.pem`),
          rejectUnauthorized: true,
        }
      : false

    const params: ClientConfig = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionTimeoutMillis: Number(process.env.CONNECTION_TIMEOUT) ?? 30000,
      ssl,
    }

    this.log(
      `Connecting to PostgreSQL host ${params.host}:${params.port}${
        ssl ? " using a secure connection" : ""
      }, database ${params.database} as ${params.user}`
    )
    this.log("Executing SQL", sql)

    const pg_client = new Client(params)
    await pg_client.connect()
    try {
      if (typeof sql === "string") {
        await pg_client.query(sql)
      } else if (sql) {
        await Promise.all(
          sql.map((statement) => {
            return pg_client.query(statement)
          })
        )
      }
    } finally {
      await pg_client.end()
    }
  }
}
