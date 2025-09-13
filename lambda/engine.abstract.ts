import { ConnectionOptions } from "tls"
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager"
import {
  EngineDatabaseProperties,
  EngineRoleProperties,
  EngineSchemaProperties,
  EngineSqlProperties,
  EngineIamGrantProperties,
} from "./types"

export interface EngineConnectionConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl?: boolean | ConnectionOptions
}

export abstract class AbstractEngine {
  protected log: (message?: any, ...optionalParams: any[]) => void

  constructor() {
    this.log =
      process.env.LOGGER === "true"
        ? console.debug
        : (_message?: any, ..._optionalParams: any[]) => {}
  }

  abstract createDatabase(
    resourceId: string,
    props: EngineDatabaseProperties
  ): string | string[]
  abstract updateDatabase(
    resourceId: string,
    oldResourceId: string,
    props: EngineDatabaseProperties
  ): string | string[]
  abstract deleteDatabase(resourceId: string, masterUser: string): string | string[]

  abstract createRole(
    resourceId: string,
    props: EngineRoleProperties
  ): Promise<string | string[]>
  abstract updateRole(
    resourceId: string,
    oldResourceId: string,
    props: EngineRoleProperties,
    oldProps: EngineRoleProperties
  ): Promise<string | string[]>
  abstract deleteRole(resourceId: string, props: EngineRoleProperties): string | string[]

  abstract createSchema(
    resourceId: string,
    props: EngineSchemaProperties
  ): string | string[]
  abstract updateSchema(
    resourceId: string,
    oldResourceId: string,
    props: EngineSchemaProperties
  ): string | string[]
  abstract deleteSchema(
    resourceId: string,
    props: EngineSchemaProperties
  ): string | string[]

  abstract createSql(resourceId: string, props: EngineSqlProperties): string | string[]
  abstract updateSql(
    resourceId: string,
    oldResourceId: string,
    props: EngineSqlProperties
  ): string | string[]
  abstract deleteSql(resourceId: string, props: EngineSqlProperties): string | string[]

  abstract createIamGrant(
    resourceId: string,
    props: EngineIamGrantProperties
  ): string | string[]
  abstract updateIamGrant(
    resourceId: string,
    oldResourceId: string,
    props: EngineIamGrantProperties,
    oldProps: EngineIamGrantProperties
  ): string | string[]
  abstract deleteIamGrant(
    resourceId: string,
    props: EngineIamGrantProperties
  ): string | string[]

  abstract executeSQL(
    sql: string | string[],
    config: EngineConnectionConfig
  ): Promise<any>

  /**
   * Parse password field from secret. Returns void on error or if no password field exists.
   */
  protected async getPassword(arn: string): Promise<string | void> {
    if (!arn) return
    const secrets_client = new SecretsManagerClient({
      requestHandler: {
        connectionTimeout: 5000,
        requestTimeout: 10000,
      },
    })
    const command = new GetSecretValueCommand({
      SecretId: arn,
    })
    const secret = await secrets_client.send(command)
    if (secret.SecretString) {
      const json = JSON.parse(secret.SecretString)
      return json.password
    }
  }
}
