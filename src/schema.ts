import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { IDatabase } from "./database"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"
import { Role } from "./role"

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
  readonly database?: IDatabase

  /**
   * Schema name.
   */
  readonly schemaName: string

  /**
   * Optional role which will be granted usage and create permissions
   * to this schema. This way the role can read its own tables, but
   * cannot see or access tables created by others.
   */
  readonly role?: Role
}

export class Schema extends CustomResource {
  public readonly schemaName: string

  constructor(scope: Construct, id: string, props: SchemaProps) {
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.SCHEMA,
        ResourceId: props.schemaName,
        ...(props.provider.secret ? { SecretArn: props.provider.secret.secretArn } : {}),
        DatabaseName: props.database ? props.database.databaseName : undefined,
        RoleName: props.role ? props.role.roleName : undefined,
      },
    })
    this.node.addDependency(props.provider)
    this.schemaName = props.schemaName
    if (props.database) this.node.addDependency(props.database)
    if (props.role) this.node.addDependency(props.role)
  }
}
