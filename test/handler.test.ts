import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import ms from "ms"
import { Client, ClientConfig } from "pg"
import { GenericContainer, StartedTestContainer } from "testcontainers"
import {
  createRequest,
  updateRequest,
  deleteRequest,
  schemaExists,
  roleExists,
  databaseExists,
  databaseOwnerIs,
  rowCount,
} from "./util"
import { handler } from "../src/handler"

jest.mock("@aws-sdk/client-secrets-manager")
const SecretsManagerClientMock = SecretsManagerClient as jest.MockedClass<
  typeof SecretsManagerClient
>

const DB_PORT = 5432
const DB_MASTER_USERNAME = "pgroot"
const DB_MASTER_PASSWORD = "masterpwd"
const DB_DEFAULT_DB = "dummy"

let pgContainer: StartedTestContainer
let pgHost: string
let pgPort: number

beforeEach(async () => {
  process.env.SSL = "false"
  pgContainer = await new GenericContainer("postgres")
    .withExposedPorts(DB_PORT)
    .withEnv("POSTGRES_USER", DB_MASTER_USERNAME)
    .withEnv("POSTGRES_PASSWORD", DB_MASTER_PASSWORD)
    .withEnv("POSTGRES_DB", DB_DEFAULT_DB)
    .withStartupTimeout(ms("90s"))
    .start()
  pgHost = pgContainer.getHost()
  pgPort = pgContainer.getMappedPort(DB_PORT)
}, ms("5m"))

afterEach(async () => {
  jest.clearAllMocks()
  await pgContainer.stop()
})

//jest.setTimeout(ms("15s"))

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

test("schema", async () => {
  const oldSchemaName = "test"
  const newSchemaName = "test2"
  const create = createRequest("schema", oldSchemaName)
  await handler(create)
  expect(SecretsManagerClientMock).toHaveBeenCalledTimes(1)
  const client = await newClient()
  try {
    expect(await schemaExists(client, oldSchemaName)).toEqual(true)
    const update = updateRequest("schema", oldSchemaName, newSchemaName)
    await handler(update)
    expect(await schemaExists(client, oldSchemaName)).toEqual(false)
    expect(await schemaExists(client, newSchemaName)).toEqual(true)

    // CloudFormation will send a delete afterward, so test that too
    const remove = deleteRequest("schema", oldSchemaName)
    await handler(remove)
    expect(await schemaExists(client, oldSchemaName)).toEqual(false)
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
  expect(SecretsManagerClientMock).toHaveBeenCalledTimes(2)
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
  expect(SecretsManagerClientMock).toHaveBeenCalledTimes(2)
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
  expect(SecretsManagerClientMock).toHaveBeenCalledTimes(2)
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
  expect(SecretsManagerClientMock).toHaveBeenCalledTimes(1)
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
