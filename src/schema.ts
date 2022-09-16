import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"

export interface SchemaProps {
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
  readonly schemaName: string
}

export class Schema extends CustomResource {
  public readonly schemaName: string

  constructor(scope: Construct, id: string, props: SchemaProps) {
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.SCHEMA,
        ResourceId: props.schemaName,
        SecretArn: props.provider.secret.secretArn,
        Database: props.databaseName,
      },
    })
    this.node.addDependency(props.provider)
    this.schemaName = props.schemaName
  }
}
