import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { IDatabase } from "./database"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"

export interface RoleProps {
  /**
   * Provider.
   */
  readonly provider: Provider

  /**
   * SQL.
   */
  readonly roleName: string

  /**
   * A new secret is created for this user.
   *
   * Optionally encrypt it with the given key.
   */
  readonly passwordArn: string

  /**
   * Database to which this user gets access.
   *
   * @default no database connect is granted
   */
  readonly database?: IDatabase
}

export class Role extends CustomResource {
  constructor(scope: Construct, id: string, props: RoleProps) {
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.ROLE,
        ResourceId: props.roleName,
        SecretArn: props.provider.secret.secretArn,
        PasswordArn: props.passwordArn,
        DatabaseName: props.database ? props.database.databaseName : undefined,
      },
    })
    this.node.addDependency(props.provider)
    if (props.database) this.node.addDependency(props.database)
  }
}
