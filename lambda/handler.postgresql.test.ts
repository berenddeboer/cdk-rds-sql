import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import { Client, ClientConfig } from "pg"
import { GenericContainer, StartedTestContainer } from "testcontainers"
import { handler } from "./handler"
import {
  createRequest,
  updateRequest,
  deleteRequest,
  schemaExists,
  roleExists,
  databaseExists,
  databaseOwnerIs,
  rowCount,
  roleGrantedForSchema,
} from "./util"

jest.mock("@aws-sdk/client-secrets-manager")
const SecretsManagerClientMock = SecretsManagerClient as jest.MockedClass<
  typeof SecretsManagerClient
>
SecretsManagerClientMock.prototype.send.mockImplementation(() => {
  return {
    SecretString: JSON.stringify({
      host: pgHost,
      port: pgPort,
      username: DB_MASTER_USERNAME,
      password: DB_MASTER_PASSWORD,
      dbname: DB_DEFAULT_DB,
      engine: "postgres",
      dbClusterIdentifier: "dummy",
    }),
  }
})

const DB_PORT = 5432
const DB_MASTER_USERNAME = "pgroot"
const DB_MASTER_PASSWORD = "masterpwd"
const DB_DEFAULT_DB = "dummy"

let pgContainer: StartedTestContainer
let pgHost: string
let pgPort: number

beforeAll(async () => {
  process.env.LOGGER = "true"
  process.env.SSL = "false"
  process.env.CONNECTION_TIMEOUT = "5000"
  pgContainer = await new GenericContainer("postgres:15")
    .withExposedPorts(DB_PORT)
    .withEnvironment({
      POSTGRES_USER: DB_MASTER_USERNAME,
      POSTGRES_PASSWORD: DB_MASTER_PASSWORD,
      POSTGRES_DB: DB_DEFAULT_DB,
    })
    .start()
  pgHost = pgContainer.getHost()
  pgPort = pgContainer.getMappedPort(DB_PORT)
}, 60000)

afterAll(async () => {
  if (pgContainer) {
    await pgContainer.stop()
  }
})

beforeEach(async () => {
  jest.clearAllMocks()

  // Clean up databases, schemas, and roles created by tests
  const client = new Client({
    host: pgHost,
    port: pgPort,
    database: DB_DEFAULT_DB,
    user: DB_MASTER_USERNAME,
    password: DB_MASTER_PASSWORD,
  })

  await client.connect()

  try {
    // Drop all databases except system ones and default
    const databases = await client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != $1",
      [DB_DEFAULT_DB]
    )

    for (const db of databases.rows) {
      await client.query(`DROP DATABASE IF EXISTS "${db.datname}"`)
    }

    // Drop all schemas except system ones
    const schemas = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public')"
    )

    for (const schema of schemas.rows) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema.schema_name}" CASCADE`)
    }

    // Drop all roles except system ones
    const roles = await client.query(
      "SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg_%' AND rolname != $1",
      [DB_MASTER_USERNAME]
    )

    for (const role of roles.rows) {
      await client.query(`DROP ROLE IF EXISTS "${role.rolname}"`)
    }
  } finally {
    await client.end()
  }
})

//jest.setTimeout(ms("15s"))

test("schema", async () => {
  const oldSchemaName = "test"
  const newSchemaName = "test2"
  const create = createRequest("schema", oldSchemaName)
  await handler(create)
  expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(1)

  const client = await newClient()
  try {
    expect(await schemaExists(client, oldSchemaName)).toEqual(true)
    const update = updateRequest("schema", oldSchemaName, newSchemaName)
    await handler(update)
    expect(await schemaExists(client, oldSchemaName)).toEqual(false)
    expect(await schemaExists(client, newSchemaName)).toEqual(true)

    // CloudFormation will send a delete afterward, so test that too
    const remove = deleteRequest("schema", newSchemaName)
    await handler(remove)
    expect(await schemaExists(client, newSchemaName)).toEqual(false)

    // create role for testing
    const roleName = "schematest"
    const createRole = createRequest("role", roleName, {
      PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      DatabaseName: "postgres",
    })
    await handler(createRole)

    const createWithRole = createRequest("schema", oldSchemaName, {
      RoleName: roleName,
    })
    await handler(createWithRole)
    expect(await roleGrantedForSchema(client, oldSchemaName, roleName)).toEqual(true)
    const updateWithRole = updateRequest("schema", oldSchemaName, newSchemaName, {
      RoleName: roleName,
    })
    await handler(updateWithRole)
    expect(await roleGrantedForSchema(client, oldSchemaName, roleName)).toEqual(false)
    expect(await roleGrantedForSchema(client, newSchemaName, roleName)).toEqual(true)
    const removeWithRole = deleteRequest("schema", newSchemaName, {
      RoleName: roleName,
    })
    await handler(removeWithRole)
    expect(await roleGrantedForSchema(client, newSchemaName, roleName)).toEqual(false)

    const removeRole = deleteRequest("role", roleName, {
      DatabaseName: "postgres",
    })
    await handler(removeRole)
  } finally {
    await client.end()
  }
})

test("role with existing database", async () => {
  const oldRoleName = "example"
  const newRoleName = "example2"
  const create = createRequest("role", oldRoleName, {
    PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
    DatabaseName: "postgres",
  })
  await handler(create)
  expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(2)
  const client = await newClient()
  try {
    expect(await roleExists(client, oldRoleName)).toEqual(true)

    // Attempt to connect as this role
    const client2 = await newClient({
      user: oldRoleName,
    })
    await client2.end()

    const update = updateRequest("role", oldRoleName, newRoleName, {
      PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      DatabaseName: "postgres",
    })
    await handler(update)
    expect(await roleExists(client, oldRoleName)).toEqual(false)
    expect(await roleExists(client, newRoleName)).toEqual(true)

    // CloudFormation will send a delete afterward as we change the
    // physical id, so test that too
    const remove = deleteRequest("role", oldRoleName, {
      DatabaseName: "postgres",
    })
    await handler(remove)
    expect(await roleExists(client, oldRoleName)).toEqual(false)
  } finally {
    await client.end()
  }
})

test("role without database", async () => {
  const roleName = "example"
  const create = createRequest("role", roleName, {
    PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
  })
  await handler(create)
  expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(2)
  const client = await newClient()
  try {
    expect(await roleExists(client, roleName)).toEqual(true)
  } finally {
    await client.end()
  }
})

test("change role password", async () => {
  const roleName = "example"
  const create = createRequest("role", roleName, {
    PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
  })
  await handler(create)
  expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(2)
  const client = await newClient()
  try {
    expect(await roleExists(client, roleName)).toEqual(true)
    const update = updateRequest("role", roleName, roleName, {
      PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
    })
    await handler(update)
  } finally {
    await client.end()
  }
})

test("database", async () => {
  const oldDatabaseName = "mydb"
  const newDatabaseName = "mydb2"
  const create = createRequest("database", oldDatabaseName)
  await handler(create)
  expect(SecretsManagerClientMock.prototype.send).toHaveBeenCalledTimes(1)
  const client = await newClient()
  try {
    expect(await databaseExists(client, oldDatabaseName)).toEqual(true)
    expect(await databaseOwnerIs(client, oldDatabaseName, DB_MASTER_USERNAME)).toEqual(
      true
    )
    const update = updateRequest("database", oldDatabaseName, newDatabaseName)
    await handler(update)
    expect(await databaseExists(client, oldDatabaseName)).toEqual(false)
    expect(await databaseExists(client, newDatabaseName)).toEqual(true)

    // CloudFormation will send a delete afterward, so test that too
    const remove = deleteRequest("database", oldDatabaseName)
    await handler(remove)
    expect(await databaseExists(client, oldDatabaseName)).toEqual(false)
  } finally {
    await client.end()
  }
})

test("database with owner", async () => {
  const databaseName = "mydb"
  const roleName = "example"
  const create_role = createRequest("role", roleName, {
    PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
    DatabaseName: "mydb", // database does not exist yet
  })
  await handler(create_role)
  const create_db = createRequest("database", databaseName, { Owner: "example" })
  await handler(create_db)
  const client = await newClient()
  try {
    expect(await databaseExists(client, databaseName)).toEqual(true)
    expect(await databaseOwnerIs(client, databaseName, roleName)).toEqual(true)
    const create_table = createRequest("sql", "", {
      DatabaseName: databaseName,
      Statement: "create table t(i int)",
    })
    await handler(create_table)

    // Verify we can login as owner
    {
      const client2 = await newClient({
        user: roleName,
        database: databaseName,
      })
      try {
        expect(await rowCount(client2, "t")).toEqual(0)
      } finally {
        await client2.end()
      }
    }

    const oldDatabaseName = "mydb"
    const newDatabaseName = "mydb2"
    const update = updateRequest("database", oldDatabaseName, newDatabaseName, {
      Owner: "example",
    })
    await handler(update)
    expect(await databaseExists(client, oldDatabaseName)).toEqual(false)
    expect(await databaseExists(client, newDatabaseName)).toEqual(true)

    // Verify we can login as owner against renamed database
    {
      const client2 = await newClient({
        user: roleName,
        database: newDatabaseName,
      })
      try {
        expect(await rowCount(client2, "t")).toEqual(0)
      } finally {
        await client2.end()
      }
    }
  } finally {
    await client.end()
  }
})

const newClient = async (config?: ClientConfig): Promise<Client> => {
  const client = new Client({
    host: pgHost,
    port: pgPort,
    database: config && config.database ? config.database : DB_DEFAULT_DB,
    user: DB_MASTER_USERNAME,
    password: DB_MASTER_PASSWORD,
  })
  await client.connect()
  return client
}
