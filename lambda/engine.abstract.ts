import { ConnectionOptions } from "tls"
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager"

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

  abstract createDatabase(resourceId: string, props?: any): string | string[]
  abstract updateDatabase(
    resourceId: string,
    oldResourceId: string,
    props?: any
  ): string | string[]
  abstract deleteDatabase(resourceId: string, masterUser: string): string | string[]

  abstract createRole(resourceId: string, props?: any): Promise<string | string[]>
  abstract updateRole(
    resourceId: string,
    oldResourceId: string,
    props?: any,
    oldProps?: any
  ): Promise<string | string[]>
  abstract deleteRole(resourceId: string, props?: any): string | string[]

  abstract createSchema(resourceId: string, props?: any): string | string[]
  abstract updateSchema(
    resourceId: string,
    oldResourceId: string,
    props?: any
  ): string | string[]
  abstract deleteSchema(resourceId: string, props?: any): string | string[]

  abstract createSql(resourceId: string, props?: any): string | string[]
  abstract updateSql(
    resourceId: string,
    oldResourceId: string,
    props?: any
  ): string | string[]
  abstract deleteSql(resourceId: string, props?: any): string | string[]

  abstract executeSQL(
    sql: string | string[],
    config: EngineConnectionConfig
  ): Promise<any>

  /**
   * Parse password field from secret. Returns void on error.
   */
  protected async getPassword(arn: string): Promise<string | void> {
    const secrets_client = new SecretsManagerClient({})
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
