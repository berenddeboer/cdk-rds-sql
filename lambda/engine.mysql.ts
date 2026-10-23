import * as fs from "fs"
import { AbstractEngine, type EngineConnectionConfig } from "./engine.abstract"
import { quoteMysqlIdentifier, quoteMysqlString } from "./mysql-quote"
import type {
  EngineDatabaseProperties,
  EngineRoleProperties,
  EngineSchemaProperties,
  EngineSqlProperties,
} from "./types"

export class MysqlEngine extends AbstractEngine {
  /**
   * Session SQL mode used to quote literals. Empty means MySQL's default
   * (backslash escapes enabled) so unit tests can render SQL without a
   * connection. Production replaces this from @@SESSION.sql_mode.
   */
  private sqlMode = ""

  /** Visible to tests. Production sets this from the live session in prepare(). */
  setSqlMode(sqlMode: string): void {
    this.sqlMode = sqlMode
  }

  override async prepare(config: EngineConnectionConfig): Promise<void> {
    const connection = await this.openConnection(config)
    try {
      const [rows] = await connection.query("SELECT @@SESSION.sql_mode AS sqlMode")
      this.sqlMode = readSqlMode(rows)
      this.log(`MySQL session sql_mode is ${this.sqlMode === "" ? "(empty)" : this.sqlMode}`)
    } finally {
      await connection.end()
    }
  }

  createDatabase(resourceId: string, props: EngineDatabaseProperties): string[] {
    const sql = [`CREATE DATABASE IF NOT EXISTS ${quoteMysqlIdentifier(resourceId)}`]

    if (props.Owner) {
      sql.push(this.grantDatabase(resourceId, props.Owner))
      sql.push("FLUSH PRIVILEGES")
    }

    return sql
  }

  updateDatabase(): string[] {
    throw new Error("Renaming database is not supported in MySQL.")
  }

  deleteDatabase(resourceId: string, _masterUser: string): string[] {
    return [`DROP DATABASE IF EXISTS ${quoteMysqlIdentifier(resourceId)}`]
  }

  async createRole(resourceId: string, props: EngineRoleProperties): Promise<string[]> {
    const sql: string[] = []

    if (props.EnableIamAuth) {
      // Create user for IAM authentication
      sql.push(this.iamUser(resourceId, true))
    } else {
      // Create user with password authentication
      if (!props.PasswordArn) throw new Error("No PasswordArn provided")
      const password = await this.getPassword(props.PasswordArn)
      if (!password) throw `Cannot parse password from ${props.PasswordArn}`

      sql.push(this.passwordUser(resourceId, password, true))
    }

    if (props.DatabaseName) {
      sql.push(this.grantDatabase(props.DatabaseName, resourceId))
    }

    appendMaxUserConnections(sql, this.account(resourceId), props.MaxUserConnections)

    sql.push("FLUSH PRIVILEGES")
    return sql
  }

  async updateRole(
    resourceId: string,
    oldResourceId: string,
    props: EngineRoleProperties,
    oldProps: EngineRoleProperties
  ): Promise<string[]> {
    const sql: string[] = []

    if (oldResourceId !== resourceId) {
      // MySQL doesn't allow renaming users directly, we need to create a new one and drop the old one
      if (props.EnableIamAuth) {
        // Create new user with IAM auth
        sql.push(this.iamUser(resourceId, true))
      } else if (props?.PasswordArn) {
        // Create new user with password auth
        const password = await this.getPassword(props.PasswordArn)
        if (!password) throw `Cannot parse password from ${props.PasswordArn}`

        sql.push(this.passwordUser(resourceId, password, true))
      } else {
        // If no password is provided, create user with a random password then expire it
        sql.push(`CREATE USER IF NOT EXISTS ${this.account(resourceId)} IDENTIFIED BY UUID()`)
        sql.push(`ALTER USER ${this.account(resourceId)} PASSWORD EXPIRE`)
      }

      // Drop the old user
      sql.push(`DROP USER IF EXISTS ${this.account(oldResourceId)}`)
    } else {
      // Handle authentication method changes for existing user
      if (props?.EnableIamAuth && !oldProps?.EnableIamAuth) {
        // Switching from password to IAM auth - need to recreate user
        sql.push(`DROP USER IF EXISTS ${this.account(resourceId)}`)
        sql.push(this.iamUser(resourceId, false))
      } else if (!props?.EnableIamAuth && oldProps?.EnableIamAuth) {
        // Switching from IAM to password auth - need to recreate user
        sql.push(`DROP USER IF EXISTS ${this.account(resourceId)}`)
        if (props?.PasswordArn) {
          const password = await this.getPassword(props.PasswordArn)
          if (!password) throw `Cannot parse password from ${props.PasswordArn}`
          sql.push(this.passwordUser(resourceId, password, false))
        }
      } else if (!props?.EnableIamAuth && props?.PasswordArn) {
        // Just update the password for password auth
        const password = await this.getPassword(props.PasswordArn)
        if (!password) throw `Cannot parse password from ${props.PasswordArn}`
        sql.push(`ALTER USER ${this.account(resourceId)} IDENTIFIED BY ${this.literal(password)}`)
      }
    }

    // Check if database name has changed
    if (
      oldProps?.DatabaseName &&
      props?.DatabaseName &&
      oldProps.DatabaseName !== props.DatabaseName
    ) {
      // Revoke from old database
      sql.push(this.revokeDatabase(oldProps.DatabaseName, resourceId))
    }

    if (props?.DatabaseName) {
      sql.push(this.grantDatabase(props.DatabaseName, resourceId))
    }

    appendMaxUserConnections(sql, this.account(resourceId), props.MaxUserConnections)

    if (sql.length > 0) {
      sql.push("FLUSH PRIVILEGES")
    }

    return sql
  }

  async deleteRole(resourceId: string, props: EngineRoleProperties): Promise<string[]> {
    const sql: string[] = []

    if (props?.DatabaseName) {
      sql.push(this.revokeDatabase(props.DatabaseName, resourceId))
    }

    sql.push(`DROP USER IF EXISTS ${this.account(resourceId)}`)
    sql.push("FLUSH PRIVILEGES")

    return sql
  }

  createSchema(_resourceId: string, _props: EngineSchemaProperties): string[] {
    throw new Error("Schemas are not supported in MySQL/MariaDB")
  }

  updateSchema(
    _resourceId: string,
    _oldResourceId: string,
    _props: EngineSchemaProperties
  ): string[] {
    throw new Error("Schemas are not supported in MySQL/MariaDB")
  }

  deleteSchema(_resourceId: string, _props: EngineSchemaProperties): string[] {
    throw new Error("Schemas are not supported in MySQL/MariaDB")
  }

  createSql(_resourceId: string, props: EngineSqlProperties): string {
    return props?.Statement || ""
  }

  updateSql(_resourceId: string, _oldResourceId: string, props: EngineSqlProperties): string {
    return props?.Statement || ""
  }

  deleteSql(_resourceId: string, props: EngineSqlProperties): string {
    return props?.Rollback || ""
  }

  createIamGrant(_roleName: string, _iamArn: string): string | string[] {
    throw new Error("IAM grants are only supported with DSQL clusters")
  }

  updateIamGrant(
    _roleName: string,
    _oldRoleName: string,
    _iamArn: string,
    _oldIamArn: string
  ): string | string[] {
    throw new Error("IAM grants are only supported with DSQL clusters")
  }

  deleteIamGrant(_roleName: string, _iamArn: string): string | string[] {
    throw new Error("IAM grants are only supported with DSQL clusters")
  }

  async executeSQL(sql: string | string[], config: EngineConnectionConfig): Promise<any> {
    const isSslEnabled = process.env.SSL ? JSON.parse(process.env.SSL) : true
    const connection = await this.openConnection(config)

    this.log(
      `Connecting to MySQL/MariaDB host ${config.host}:${config.port}${
        isSslEnabled ? " using a secure connection" : ""
      }, database ${config.database} as ${config.user}`
    )
    this.log("Executing SQL", sql)

    try {
      if (typeof sql === "string") {
        return await connection.query(sql)
      } else if (sql) {
        return await Promise.all(sql.map((statement) => connection.query(statement)))
      }
    } finally {
      await connection.end()
    }
  }

  private literal(value: string): string {
    return quoteMysqlString(value, this.sqlMode)
  }

  /** Account name as a string literal. The host is the fixed VPC wildcard. */
  private account(user: string): string {
    return `${this.literal(user)}@'%'`
  }

  private iamUser(user: string, ifNotExists: boolean): string {
    const exists = ifNotExists ? "IF NOT EXISTS " : ""
    const account = this.account(user)
    return `CREATE USER ${exists}${account} IDENTIFIED WITH AWSAuthenticationPlugin as 'RDS'`
  }

  private passwordUser(user: string, password: string, ifNotExists: boolean): string {
    const exists = ifNotExists ? "IF NOT EXISTS " : ""
    const account = this.account(user)
    return `CREATE USER ${exists}${account} IDENTIFIED BY ${this.literal(password)}`
  }

  private grantDatabase(databaseName: string, user: string): string {
    const database = quoteMysqlIdentifier(databaseName)
    return `GRANT ALL PRIVILEGES ON ${database}.* TO ${this.account(user)}`
  }

  private revokeDatabase(databaseName: string, user: string): string {
    const database = quoteMysqlIdentifier(databaseName)
    return `REVOKE ALL PRIVILEGES ON ${database}.* FROM ${this.account(user)}`
  }

  private async openConnection(config: EngineConnectionConfig) {
    // Dynamic import to avoid bundling issues
    const { createConnection } = await import("mysql2/promise")

    const isSslEnabled = process.env.SSL ? JSON.parse(process.env.SSL) : true

    const sslOptions = isSslEnabled
      ? {
          ssl: {
            ca: fs.readFileSync(`${process.env.LAMBDA_TASK_ROOT}/global-bundle.pem`),
            rejectUnauthorized: true,
          },
        }
      : {}

    return createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 30000,
      multipleStatements: true,
      ...sslOptions,
    })
  }
}

/**
 * Append the proven MariaDB/MySQL connection cap. Unset means no clause.
 * 0 is valid and means the server default (unlimited unless the global
 * max_user_connections is set).
 *
 * `account` is an already-quoted user@host expression.
 */
function appendMaxUserConnections(
  sql: string[],
  account: string,
  maxUserConnections: number | undefined
): void {
  if (maxUserConnections === undefined) {
    return
  }
  if (!Number.isInteger(maxUserConnections) || maxUserConnections < 0) {
    throw new Error(`MaxUserConnections must be a non-negative integer, got ${maxUserConnections}`)
  }
  sql.push(`ALTER USER ${account} WITH MAX_USER_CONNECTIONS ${maxUserConnections}`)
}

function readSqlMode(rows: unknown): string {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("MySQL did not return a session sql_mode")
  }
  const row: unknown = rows[0]
  if (!isSqlModeRow(row)) {
    throw new Error("MySQL did not return a session sql_mode")
  }
  return row.sqlMode
}

function isSqlModeRow(row: unknown): row is { sqlMode: string } {
  return (
    typeof row === "object" && row !== null && "sqlMode" in row && typeof row.sqlMode === "string"
  )
}
