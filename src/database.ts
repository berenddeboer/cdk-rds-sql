import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"
import { Role } from "./role"

export interface DatabaseProps {
  /**
   * Provider.
   */
  readonly provider: Provider

  /**
   * Name of database to create.
   */
  readonly databaseName: string

  /**
   * Optional database owner.
   */
  readonly owner?: Role
}

export class Database extends CustomResource {
  public readonly databaseName: string

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.DATABASE,
        ResourceId: props.databaseName,
        SecretArn: props.provider.secret.secretArn,
        Owner: props.owner?.roleName,
      },
    })
    this.node.addDependency(props.provider)
    this.databaseName = props.databaseName
    if (props.owner) {
      this.node.addDependency(props.owner)
    }
  }
}
