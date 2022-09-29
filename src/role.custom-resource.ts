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
   * Optional database this user is expected to use.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly database?: IDatabase

  /**
   * Ootional database name this user is expected to use.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly databaseName?: string
}

export class Role extends CustomResource {
  constructor(scope: Construct, id: string, props: RoleProps) {
    if (props.database && props.databaseName)
      throw "Specify either database or databaseName"
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.ROLE,
        ResourceId: props.roleName,
        SecretArn: props.provider.secret.secretArn,
        PasswordArn: props.passwordArn,
        DatabaseName: props.database ? props.database.databaseName : props.databaseName,
      },
    })
    this.node.addDependency(props.provider)
    if (props.database) this.node.addDependency(props.database)
  }
}
