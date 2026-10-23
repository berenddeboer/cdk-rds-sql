import { CustomResource } from "aws-cdk-lib"
import type { Construct } from "constructs"
import type { IDatabase } from "./database"
import { RdsSqlResource } from "./enum"
import type { IProvider } from "./provider"

export interface SqlProps {
  /**
   * Provider.
   */
  readonly provider: IProvider

  /**
   * Optional database.
   *
   * @default - use default database
   */
  readonly database?: IDatabase

  /**
   * SQL.
   */
  readonly statement?: string

  /**
   * Optional statment to be executed when the resource is deleted
   */
  readonly rollback?: string
}

export class Sql extends CustomResource {
  constructor(scope: Construct, id: string, props: SqlProps) {
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.SQL,
        ...(props.provider.secret ? { SecretArn: props.provider.secret.secretArn } : {}),
        DatabaseName: props.database ? props.database.databaseName : undefined,
        Statement: props.statement,
        Rollback: props.rollback,
      },
    })
    this.node.addDependency(props.provider)
    if (props.database) this.node.addDependency(props.database)
  }
}
