import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from "aws-lambda"
import { Client } from "pg"

export interface ResourceProperties {
  readonly PasswordArn?: string
  readonly DatabaseName?: string
  readonly Owner?: string
  readonly Statement?: string
  readonly RoleName?: string
}

/**
 * Helpers to create CloudFormation requests.
 */
export const createRequest = (
  resource: string,
  resourceId: string,
  props?: ResourceProperties
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
  props?: Record<string, any>
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
      ServiceToken: "",
      Resource: resource,
      ResourceId: oldResourceId,
    },
  }
}

export const deleteRequest = (
  resource: string,
  resourceId: string,
  props?: Record<string, any>
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
      ...props,
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

export const roleGrantedForSchema = async (
  client: Client,
  schema: string,
  role: string
): Promise<boolean> => {
  const sql = `select nspname as schema_name, r.rolname as role_name,\
                      pg_catalog.has_schema_privilege(r.rolname, nspname, 'CREATE') as create_grant,\
                      pg_catalog.has_schema_privilege(r.rolname, nspname, 'USAGE') as usage_grant\
                      from pg_namespace pn,pg_catalog.pg_roles r \
                      where array_to_string(nspacl,',') like '%'||r.rolname||'%' and nspowner > 1 \
                      and nspname = '${schema}' and r.rolname = '${role}'`
  const { rows } = await client.query(sql)
  return (
    rows.length === 1 && rows[0].create_grant === true && rows[0].usage_grant === true
  )
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
