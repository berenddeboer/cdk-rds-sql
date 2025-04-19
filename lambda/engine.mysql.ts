import * as fs from "fs"
import { AbstractEngine, EngineConnectionConfig } from "./engine.abstract"

export class MysqlEngine extends AbstractEngine {
  createDatabase(resourceId: string, props?: any): string[] {
    const sql = [`CREATE DATABASE IF NOT EXISTS \`${resourceId}\``]

    if (props?.Owner) {
      sql.push(`GRANT ALL PRIVILEGES ON \`${resourceId}\`.* TO '${props.Owner}'@'%'`)
      sql.push(`FLUSH PRIVILEGES`)
    }

    return sql
  }

  updateDatabase(): string[] {
    throw new Error("Renaming database is not supported in MySQL.")
  }

  deleteDatabase(resourceId: string, _masterUser: string): string[] {
    return [`DROP DATABASE IF EXISTS \`${resourceId}\``]
  }

  async createRole(resourceId: string, props?: any): Promise<string[]> {
    if (!props.PasswordArn) throw new Error("No PasswordArn provided")
    const password = await this.getPassword(props.PasswordArn)
    if (!password) throw `Cannot parse password from ${props.PasswordArn}`

    const sql = [
      `CREATE USER IF NOT EXISTS '${resourceId}'@'%' IDENTIFIED BY '${password}'`,
    ]

    if (props.DatabaseName) {
      sql.push(
        `GRANT ALL PRIVILEGES ON \`${props.DatabaseName}\`.* TO '${resourceId}'@'%'`
      )
      sql.push(`FLUSH PRIVILEGES`)
    }

    return sql
  }

  async updateRole(
    resourceId: string,
    oldResourceId: string,
    props?: any,
    oldProps?: any
  ): Promise<string[]> {
    const sql: string[] = []

    if (oldResourceId !== resourceId) {
      // MySQL doesn't allow renaming users directly, we need to create a new one and drop the old one
      if (props?.PasswordArn) {
        const password = await this.getPassword(props.PasswordArn)
        if (!password) throw `Cannot parse password from ${props.PasswordArn}`

        sql.push(
          `CREATE USER IF NOT EXISTS '${resourceId}'@'%' IDENTIFIED BY '${password}'`
        )
      } else {
        // If no password is provided, create user with a random password then expire it
        sql.push(`CREATE USER IF NOT EXISTS '${resourceId}'@'%' IDENTIFIED BY UUID()`)
        sql.push(`ALTER USER '${resourceId}'@'%' PASSWORD EXPIRE`)
      }

      // Drop the old user
      sql.push(`DROP USER IF EXISTS '${oldResourceId}'@'%'`)
    } else if (props?.PasswordArn) {
      // Just update the password
      const password = await this.getPassword(props.PasswordArn)
      if (!password) throw `Cannot parse password from ${props.PasswordArn}`

      sql.push(`ALTER USER '${resourceId}'@'%' IDENTIFIED BY '${password}'`)
    }

    // Check if database name has changed
    if (
      oldProps?.DatabaseName &&
      props?.DatabaseName &&
      oldProps.DatabaseName !== props.DatabaseName
    ) {
      // Revoke from old database
      sql.push(
        `REVOKE ALL PRIVILEGES ON \`${oldProps.DatabaseName}\`.* FROM '${resourceId}'@'%'`
      )
    }

    if (props?.DatabaseName) {
      sql.push(
        `GRANT ALL PRIVILEGES ON \`${props.DatabaseName}\`.* TO '${resourceId}'@'%'`
      )
    }

    if (sql.length > 0) {
      sql.push(`FLUSH PRIVILEGES`)
    }

    return sql
  }

  deleteRole(resourceId: string, props?: any): string[] {
    const sql: string[] = []

    if (props?.DatabaseName) {
      sql.push(
        `REVOKE ALL PRIVILEGES ON \`${props.DatabaseName}\`.* FROM '${resourceId}'@'%'`
      )
    }

    sql.push(`DROP USER IF EXISTS '${resourceId}'@'%'`)
    sql.push(`FLUSH PRIVILEGES`)

    return sql
  }

  createSchema(_resourceId: string, _props?: any): string[] {
    throw new Error("Schemas are not supported in MySQL/MariaDB")
  }

  updateSchema(_resourceId: string, _oldResourceId: string, _props?: any): string[] {
    throw new Error("Schemas are not supported in MySQL/MariaDB")
  }

  deleteSchema(_resourceId: string, _props?: any): string[] {
    throw new Error("Schemas are not supported in MySQL/MariaDB")
  }

  createSql(_resourceId: string, props?: any): string {
    return props.Statement
  }

  updateSql(_resourceId: string, _oldResourceId: string, props?: any): string {
    return props.Statement
  }

  deleteSql(_resourceId: string, props?: any): string {
    return props.Rollback
  }

  async executeSQL(sql: string | string[], config: EngineConnectionConfig): Promise<any> {
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

    const connectionConfig = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 30000,
      multipleStatements: true,
      ...sslOptions,
    }

    this.log(
      `Connecting to MySQL/MariaDB host ${connectionConfig.host}:${
        connectionConfig.port
      }${isSslEnabled ? " using a secure connection" : ""}, database ${
        connectionConfig.database
      } as ${connectionConfig.user}`
    )
    this.log("Executing SQL", sql)

    const connection = await createConnection(connectionConfig)
    try {
      if (typeof sql === "string") {
        return connection.query(sql)
      } else if (sql) {
        return Promise.all(sql.map((statement) => connection.query(statement)))
      }
    } finally {
      await connection.end()
    }
  }
}
