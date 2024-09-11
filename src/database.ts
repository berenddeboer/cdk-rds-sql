import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"
import { Role } from "./role"

interface DatabaseAttributes {
  /**
   * Name of database to create.
   */
  readonly databaseName: string

  /**
   * Optional database owner.
   */
  readonly owner?: Role
}

export interface DatabaseProps extends DatabaseAttributes {
  /**
   * Provider.
   */
  readonly provider: Provider
}

export interface IDatabase {
  readonly databaseName: string
}

class ImportedDatabase extends Construct implements IDatabase {
  public readonly databaseName: string

  constructor(scope: Construct, id: string, props: DatabaseAttributes) {
    super(scope, id)
    this.databaseName = props.databaseName
  }
}

export class Database extends CustomResource implements IDatabase {
  /**
   * Return a Database based upon name only. Use for importing existing databases.
   */
  static fromDatabaseName(scope: Construct, id: string, databaseName: string): IDatabase {
    return new ImportedDatabase(scope, id, {
      databaseName: databaseName,
    })
  }

  public readonly databaseName: string

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.DATABASE,
        ResourceId: props.databaseName,
        SecretArn: props.provider.secret.secretArn,
        Owner: props.owner?.roleName,
        ConnectionProps: props.provider.connectionProps,
      },
    })
    this.node.addDependency(props.provider)
    this.databaseName = props.databaseName
    if (props.owner) {
      this.node.addDependency(props.owner)
    }
  }
}
