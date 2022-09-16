import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
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
  readonly databaseName?: string

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
        Database: props.databaseName,
        Statement: props.statement,
      },
    })
    this.node.addDependency(props.provider)
  }
}
