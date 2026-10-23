import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import { createConnection } from "mysql2/promise"
import { GenericContainer, type StartedTestContainer } from "testcontainers"
import { handler } from "./handler"
import { quoteMysqlIdentifier } from "./mysql-quote"
import { createRequest, deleteRequest, updateRequest } from "./util"

jest.mock("@aws-sdk/client-secrets-manager")
const SecretsManagerClientMock = SecretsManagerClient as jest.MockedClass<
  typeof SecretsManagerClient
>
// The automocked command does not keep constructor input, which the password
// dispatch below needs in order to tell a role secret from the cluster secret.
const GetSecretValueCommandMock = GetSecretValueCommand as unknown as jest.Mock

const DB_PORT = 3306
const DB_MASTER_USERNAME = "root"
const DB_MASTER_PASSWORD = "masterpwd"
const DB_DEFAULT_DB = "dummy"
const QUOTED_PASSWORD_ARN = "arn:aws:secretsmanager:us-east-1:123456789:secret:quoted-password"
const QUOTED_PASSWORD = "it's-a\\password"
const BACKSLASH_PASSWORD_ARN =
  "arn:aws:secretsmanager:us-east-1:123456789:secret:backslash-password"
const BACKSLASH_PASSWORD = "back\\slash'quote"

let mysqlContainer: StartedTestContainer
let mysqlHost: string
let mysqlPort: number

beforeAll(async () => {
  process.env.LOGGER = "true"
  process.env.SSL = "false"
  process.env.CONNECTION_TIMEOUT = "5000"
  mysqlContainer = await new GenericContainer("mysql:8")
    .withExposedPorts(DB_PORT)
    .withEnvironment({
      MYSQL_ROOT_PASSWORD: DB_MASTER_PASSWORD,
      MYSQL_DATABASE: DB_DEFAULT_DB,
      MYSQL_INITDB_SKIP_TZINFO: "true",
    })
    .start()
  mysqlHost = mysqlContainer.getHost()
  mysqlPort = mysqlContainer.getMappedPort(DB_PORT)

  // Set up the mock after we have the host and port values
  GetSecretValueCommandMock.mockImplementation((input: unknown) => ({ input }))
  SecretsManagerClientMock.prototype.send.mockImplementation((command: unknown) => {
    const secretId = secretIdOf(command)
    const password = secretId ? rolePasswords[secretId] : undefined
    if (password) {
      return {
        SecretString: JSON.stringify({ password }),
      }
    }
    return {
      SecretString: JSON.stringify({
        host: mysqlHost,
        port: mysqlPort,
        username: DB_MASTER_USERNAME,
        password: DB_MASTER_PASSWORD,
        dbname: DB_DEFAULT_DB,
        engine: "mysql",
        dbClusterIdentifier: "dummy",
      }),
    }
  })
}, 60000)

afterAll(async () => {
  if (mysqlContainer) {
    await mysqlContainer.stop()
  }
})

beforeEach(async () => {
  jest.clearAllMocks()

  // Clean up databases and users created by tests
  const connection = await newConnection()

  try {
    // Drop all databases except system ones and default
    const [databases] = await connection.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys', ?)",
      [DB_DEFAULT_DB]
    )

    for (const db of databases) {
      await connection.query(
        `DROP DATABASE IF EXISTS ${quoteMysqlIdentifier(String(db.SCHEMA_NAME))}`
      )
    }

    // Drop all users except system ones
    const [users] = await connection.query(
      "SELECT User FROM mysql.user WHERE User NOT IN ('mysql.sys', 'mysql.session', 'mysql.infoschema', 'root')"
    )

    for (const user of users) {
      // Identifier quoting is valid for account names and does not depend on SQL mode.
      const account = `${quoteMysqlIdentifier(String(user.User))}@${quoteMysqlIdentifier("%")}`
      await connection.query(`DROP USER IF EXISTS ${account}`)
    }
  } finally {
    await connection.end()
  }
})

// Helper functions for MySQL tests
async function databaseExists(connection: any, dbName: string): Promise<boolean> {
  const [rows] = await connection.query(
    "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
    [dbName]
  )
  return rows.length > 0
}

async function userExists(connection: any, username: string): Promise<boolean> {
  const [rows] = await connection.query("SELECT User FROM mysql.user WHERE User = ?", [username])
  return rows.length > 0
}

async function tableExists(connection: any, dbName: string, tableName: string): Promise<boolean> {
  const [rows] = await connection.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    [dbName, tableName]
  )
  return rows.length > 0
}

async function rowCount(connection: any, tableName: string): Promise<number> {
  const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`)
  return rows[0].count
}

const rolePasswords: Record<string, string> = {
  [QUOTED_PASSWORD_ARN]: QUOTED_PASSWORD,
  [BACKSLASH_PASSWORD_ARN]: BACKSLASH_PASSWORD,
}

function secretIdOf(command: unknown): string | undefined {
  if (typeof command !== "object" || command === null || !("input" in command)) {
    return undefined
  }
  const input = command.input
  if (typeof input !== "object" || input === null || !("SecretId" in input)) {
    return undefined
  }
  const secretId = input.SecretId
  return typeof secretId === "string" ? secretId : undefined
}

async function globalSqlMode(
  connection: Awaited<ReturnType<typeof createConnection>>
): Promise<string> {
  const [rows] = await connection.query("SELECT @@GLOBAL.sql_mode AS sqlMode")
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("MySQL did not return a global sql_mode")
  }
  const row: unknown = rows[0]
  if (
    typeof row !== "object" ||
    row === null ||
    !("sqlMode" in row) ||
    typeof row.sqlMode !== "string"
  ) {
    throw new Error("MySQL did not return a global sql_mode")
  }
  return row.sqlMode
}

async function newConnection(config?: any): Promise<any> {
  const conn = await createConnection({
    host: mysqlHost,
    port: mysqlPort,
    database: config && config.database ? config.database : DB_DEFAULT_DB,
    user: config && config.user ? config.user : DB_MASTER_USERNAME,
    password: config && config.password ? config.password : DB_MASTER_PASSWORD,
  })
  return conn
}

test("database", async () => {
  const oldDatabaseName = "mydb"
  const newDatabaseName = "mydb2"
  const create = createRequest("database", oldDatabaseName)
  await handler(create)
  expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(1)
  const connection = await newConnection()
  try {
    expect(await databaseExists(connection, oldDatabaseName)).toEqual(true)

    const update = updateRequest("database", oldDatabaseName, newDatabaseName)
    await expect(handler(update)).rejects.toThrow("Renaming database is not supported in MySQL.")

    const remove = deleteRequest("database", oldDatabaseName)
    await handler(remove)
    expect(await databaseExists(connection, newDatabaseName)).toEqual(false)
  } finally {
    await connection.end()
  }
})

test("database with owner", async () => {
  const databaseName = "mydb"
  const userName = "example"

  // First create user
  const create_role = createRequest("role", userName, {
    PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
  })
  await handler(create_role)

  // Then create database with owner
  const create_db = createRequest("database", databaseName, { Owner: userName })
  await handler(create_db)

  const connection = await newConnection()
  try {
    expect(await databaseExists(connection, databaseName)).toEqual(true)

    // Create a table in the new database
    const create_table = createRequest("sql", "", {
      DatabaseName: databaseName,
      Statement: "CREATE TABLE t(i INT)",
    })
    await handler(create_table)

    // Verify we can login as owner and access the table
    const userConn = await newConnection({
      user: userName,
      database: databaseName,
    })

    try {
      expect(await tableExists(userConn, databaseName, "t")).toEqual(true)
      // Test we can insert data
      await userConn.query("INSERT INTO t VALUES (1), (2), (3)")
      expect(await rowCount(userConn, "t")).toEqual(3)
    } finally {
      await userConn.end()
    }

    // Test database rename
    const oldDatabaseName = databaseName
    const newDatabaseName = "mydb2"

    const update = updateRequest("database", oldDatabaseName, newDatabaseName, {
      Owner: userName,
    })
    await expect(handler(update)).rejects.toThrow("Renaming database is not supported in MySQL.")
  } finally {
    await connection.end()
  }
})

describe("User creation", () => {
  it("can create a user", async () => {
    const oldRoleName = "testuser"
    const newRoleName = "testuser2"

    // Create role. We must specify a database as in mysql you cannot
    // connect without a database.
    const create = createRequest("role", oldRoleName, {
      PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      DatabaseName: DB_DEFAULT_DB,
    })
    await handler(create)
    expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(2)

    const connection = await newConnection()
    try {
      expect(await userExists(connection, oldRoleName)).toEqual(true)

      // Attempt to connect as this user
      const userConn = await newConnection({
        user: oldRoleName,
      })
      await userConn.end()

      // Update role - rename
      const update = updateRequest("role", oldRoleName, newRoleName, {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      })
      await handler(update)

      expect(await userExists(connection, oldRoleName)).toEqual(false)
      expect(await userExists(connection, newRoleName)).toEqual(true)

      // Delete role
      const remove = deleteRequest("role", newRoleName)
      await handler(remove)
      expect(await userExists(connection, newRoleName)).toEqual(false)
    } finally {
      await connection.end()
    }
  })

  it("can change a user's password", async () => {
    const userName = "pwduser"

    // Create user
    const create = createRequest("role", userName, {
      PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      DatabaseName: DB_DEFAULT_DB,
    })
    await handler(create)
    expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(2)

    const connection = await newConnection()
    try {
      expect(await userExists(connection, userName)).toEqual(true)

      // Test we can connect with the initial password
      const userConn = await newConnection({
        user: userName,
      })
      await userConn.end()

      // Update role - change password
      const update = updateRequest("role", userName, userName, {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      })
      await handler(update)

      // Password changed but should still be able to connect
      const userConn2 = await newConnection({
        user: userName,
      })
      await userConn2.end()
    } finally {
      await connection.end()
    }
  })
})

describe("escaped passwords and delimited names", () => {
  const userName = "o'brien"
  const databaseName = "db`tick"

  it("creates a delimited user and database and accepts the raw password", async () => {
    await handler(
      createRequest("role", userName, {
        PasswordArn: QUOTED_PASSWORD_ARN,
      })
    )
    await handler(
      createRequest("database", databaseName, {
        Owner: userName,
      })
    )

    const connection = await newConnection()
    try {
      expect(await userExists(connection, userName)).toEqual(true)
      expect(await databaseExists(connection, databaseName)).toEqual(true)

      const userConn = await newConnection({
        user: userName,
        password: QUOTED_PASSWORD,
        database: databaseName,
      })
      try {
        await userConn.query("CREATE TABLE t(i INT)")
        await userConn.query("INSERT INTO t VALUES (1)")
        expect(await rowCount(userConn, "t")).toEqual(1)
      } finally {
        await userConn.end()
      }

      await handler(
        updateRequest("role", userName, userName, {
          PasswordArn: BACKSLASH_PASSWORD_ARN,
          DatabaseName: databaseName,
        })
      )
      const updatedConn = await newConnection({
        user: userName,
        password: BACKSLASH_PASSWORD,
        database: databaseName,
      })
      await updatedConn.end()

      await handler(
        deleteRequest("role", userName, {
          DatabaseName: databaseName,
        })
      )
      expect(await userExists(connection, userName)).toEqual(false)
    } finally {
      await connection.end()
    }
  })

  it("honors NO_BACKSLASH_ESCAPES for backslashes in passwords and names", async () => {
    const backslashUser = "a\\b"
    const connection = await newConnection()
    const originalMode = await globalSqlMode(connection)
    try {
      await connection.query("SET GLOBAL sql_mode = ?", [`${originalMode},NO_BACKSLASH_ESCAPES`])

      await handler(
        createRequest("role", backslashUser, {
          PasswordArn: QUOTED_PASSWORD_ARN,
          DatabaseName: DB_DEFAULT_DB,
        })
      )

      expect(await userExists(connection, backslashUser)).toEqual(true)
      const userConn = await newConnection({
        user: backslashUser,
        password: QUOTED_PASSWORD,
      })
      await userConn.end()
    } finally {
      await connection.query("SET GLOBAL sql_mode = ?", [originalMode])
      await connection.end()
    }
  })

  it("still quotes backticks and apostrophes when ANSI_QUOTES is enabled", async () => {
    const connection = await newConnection()
    const originalMode = await globalSqlMode(connection)
    try {
      await connection.query("SET GLOBAL sql_mode = ?", [`${originalMode},ANSI_QUOTES`])

      await handler(
        createRequest("role", userName, {
          PasswordArn: QUOTED_PASSWORD_ARN,
        })
      )
      await handler(
        createRequest("database", databaseName, {
          Owner: userName,
        })
      )

      expect(await userExists(connection, userName)).toEqual(true)
      expect(await databaseExists(connection, databaseName)).toEqual(true)
      const userConn = await newConnection({
        user: userName,
        password: QUOTED_PASSWORD,
        database: databaseName,
      })
      await userConn.query("SELECT 1")
      await userConn.end()
    } finally {
      await connection.query("SET GLOBAL sql_mode = ?", [originalMode])
      await connection.end()
    }
  })
})

test("sql execution", async () => {
  const databaseName = "sqltest"

  // Create database
  const create_db = createRequest("database", databaseName)
  await handler(create_db)

  // Execute SQL to create table
  const create_table = createRequest("sql", "", {
    DatabaseName: databaseName,
    Statement: "CREATE TABLE test_table (id INT, name VARCHAR(50))",
  })
  await handler(create_table)

  // Execute multiple SQL statements
  const create_multiple_tables = createRequest("sql", "", {
    DatabaseName: databaseName,
    Statement: "CREATE TABLE t1 (id INT); CREATE TABLE t2 (id INT);",
  })
  await handler(create_multiple_tables)

  const connection = await newConnection({ database: databaseName })
  try {
    expect(await tableExists(connection, databaseName, "test_table")).toEqual(true)

    // Execute SQL to insert data
    const insert_data = createRequest("sql", "", {
      DatabaseName: databaseName,
      Statement: "INSERT INTO test_table VALUES (1, 'Test 1'), (2, 'Test 2')",
    })
    await handler(insert_data)

    expect(await rowCount(connection, "test_table")).toEqual(2)

    // Execute SQL with rollback for deletion test
    const update_sql = updateRequest("sql", "dummy", "dummy", {
      DatabaseName: databaseName,
      Statement: "UPDATE test_table SET name = 'Updated' WHERE id = 1",
      Rollback: "UPDATE test_table SET name = 'Test 1' WHERE id = 1",
    })
    await handler(update_sql)

    // Verify update happened
    const [rows] = await connection.query("SELECT name FROM test_table WHERE id = 1")
    expect(rows[0].name).toEqual("Updated")

    // Test rollback on delete
    const delete_sql = deleteRequest("sql", "dummy", {
      DatabaseName: databaseName,
      Rollback: "UPDATE test_table SET name = 'Rollback test' WHERE id = 1",
    })
    await handler(delete_sql)

    // Verify rollback executed
    const [updated] = await connection.query("SELECT name FROM test_table WHERE id = 1")
    expect(updated[0].name).toEqual("Rollback test")
  } finally {
    await connection.end()
  }
})
