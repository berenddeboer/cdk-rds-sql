import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { IDatabase } from "./database"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"

export interface SqlProps {
  /**
   * Provider.
   */
  readonly provider: Provider

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
}

export class Sql extends CustomResource {
  constructor(scope: Construct, id: string, props: SqlProps) {
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.SQL,
        SecretArn: props.provider.secret.secretArn,
        DatabaseName: props.database ? props.database.databaseName : undefined,
        Statement: props.statement,
      },
    })
    this.node.addDependency(props.provider)
    if (props.database) this.node.addDependency(props.database)
  }
}
