import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from "aws-lambda"
import { Client } from "pg"

/**
 * Helpers to create CloudFormation requests.
 */
export const createRequest = (
  resource: string,
  resourceId: string,
  props?: {
    [Key: string]: any
  }
): CloudFormationCustomResourceCreateEvent => {
  return {
    ServiceToken: "",
    ResponseURL: "",
    StackId: "",
    RequestId: "",
    LogicalResourceId: "",
    ResourceType: "",
    ResourceProperties: {
      ServiceToken: "",
      Resource: resource,
      ResourceId: resourceId,
      ...props,
    },
    RequestType: "Create",
  }
}

export const updateRequest = (
  resource: string,
  oldResourceId: string,
  newResourceId: string,
  props?: {
    [Key: string]: any
  }
): CloudFormationCustomResourceUpdateEvent => {
  return {
    ServiceToken: "",
    ResponseURL: "",
    StackId: "",
    RequestId: "",
    LogicalResourceId: "",
    ResourceType: "",
    ResourceProperties: {
      ServiceToken: "",
      Resource: resource,
      ResourceId: newResourceId,
      ...props,
    },
    RequestType: "Update",
    PhysicalResourceId: oldResourceId,
    OldResourceProperties: {
      Resource: resource,
      ResourceId: oldResourceId,
    },
  }
}

export const deleteRequest = (
  resource: string,
  resourceId: string
): CloudFormationCustomResourceDeleteEvent => {
  return {
    ServiceToken: "",
    ResponseURL: "",
    StackId: "",
    RequestId: "",
    LogicalResourceId: "",
    ResourceType: "",
    ResourceProperties: {
      ServiceToken: "",
      Resource: resource,
      ResourceId: resourceId,
    },
    RequestType: "Delete",
    PhysicalResourceId: resourceId,
  }
}

/**
 * Database helpers.
 */
export const schemaExists = async (client: Client, schema: string): Promise<boolean> => {
  const schemas = await getSchemas(client)
  return schemas.find((s) => s === schema) !== undefined
}

const getSchemas = async (client: Client): Promise<string[]> => {
  const { rows } = await client.query(
    "select schema_name from information_schema.schemata"
  )
  return rows.map((r) => r.schema_name)
}

export const roleExists = async (client: Client, role: string): Promise<boolean> => {
  const roles = await getRoles(client)
  return roles.find((r) => r === role) !== undefined
}

const getRoles = async (client: Client): Promise<string[]> => {
  const { rows } = await client.query("select rolname from pg_roles")
  return rows.map((r) => r.rolname)
}

export const databaseExists = async (
  client: Client,
  database: string
): Promise<boolean> => {
  const databases = await getDatabases(client)
  return databases.find((r) => r === database) !== undefined
}

const getDatabases = async (client: Client): Promise<string[]> => {
  const { rows } = await client.query(
    "select datname from pg_database where datistemplate = false"
  )
  return rows.map((r) => r.datname)
}

export const databaseOwnerIs = async (
  client: Client,
  database: string,
  user_name: string
): Promise<boolean> => {
  const databases = await getDatabasesWithOwner(client, user_name)
  return databases.find((r) => r === database) !== undefined
}

const getDatabasesWithOwner = async (
  client: Client,
  user_name: string
): Promise<string[]> => {
  const { rows } = await client.query(
    `select datname from pg_database where datistemplate = false and pg_catalog.pg_get_userbyid(datdba) = '${user_name}'`
  )
  return rows.map((r) => r.datname)
}

export const rowCount = async (client: Client, table_name: string): Promise<number> => {
  const { rows } = await client.query(`select count(*) from ${table_name}`)
  return parseInt(rows[0].count)
}
