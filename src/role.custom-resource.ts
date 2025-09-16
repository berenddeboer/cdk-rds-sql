import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { IDatabase } from "./database"
import { RdsSqlResource } from "./enum"
import { IProvider } from "./provider"

export interface RoleProps {
  /**
   * Provider.
   */
  readonly provider: IProvider

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
   * Optional database this user is expected to use.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly database?: IDatabase

  /**
   * Optional database name this user is expected to use.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly databaseName?: string

  /**
   * Enable IAM authentication for this role.
   *
   * @default false - use password authentication
   */
  readonly enableIamAuth?: boolean
}

export class Role extends CustomResource {
  constructor(scope: Construct, id: string, props: RoleProps) {
    if (props.database && props.databaseName) {
      throw "Specify either database or databaseName"
    }
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.ROLE,
        ResourceId: props.roleName,
        ...(props.provider.secret ? { SecretArn: props.provider.secret.secretArn } : {}),
        PasswordArn: props.passwordArn,
        DatabaseName: props.database ? props.database.databaseName : props.databaseName,
        EnableIamAuth: props.enableIamAuth,
      },
    })
    this.node.addDependency(props.provider)
    if (props.database) this.node.addDependency(props.database)
  }
}
