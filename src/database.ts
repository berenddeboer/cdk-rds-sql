import { CustomResource } from "aws-cdk-lib"
import * as dsql from "aws-cdk-lib/aws-dsql"
import { IDatabaseCluster, IDatabaseInstance } from "aws-cdk-lib/aws-rds"
import { Construct } from "constructs"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"
import { Role } from "./role"

/**
 * Helper function to determine if a cluster is a DSQL cluster
 */
function isDsqlCluster(
  cluster: IDatabaseCluster | IDatabaseInstance | dsql.CfnCluster
): cluster is dsql.CfnCluster {
  return cluster instanceof dsql.CfnCluster
}

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
    // Check if using DSQL provider and forbid database creation
    if (isDsqlCluster(props.provider.cluster)) {
      throw new Error(
        "Database creation is not supported with DSQL. DSQL always uses 'postgres' database."
      )
    }

    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.DATABASE,
        ResourceId: props.databaseName,
        ...(props.provider.secret ? { SecretArn: props.provider.secret.secretArn } : {}),
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
