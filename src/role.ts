import { RemovalPolicy } from "aws-cdk-lib"
import * as kms from "aws-cdk-lib/aws-kms"
import { ServerlessCluster } from "aws-cdk-lib/aws-rds"
import { Secret } from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"
import { Provider } from "./provider"
import { Role as CustomResourceRole } from "./role.custom-resource"

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
   * Database name this user is expected to use.
   */
  readonly databaseName: string

  /**
   * Database cluster to access.
   */
  readonly cluster: ServerlessCluster

  /**
   * A new secret is created for this user.
   *
   * Optionally encrypt it with the given key.
   */
  readonly encryptionKey?: kms.IKey
}

export class Role extends Construct {
  public readonly roleName: string

  constructor(scope: Construct, id: string, props: RoleProps) {
    super(scope, id)
    const secret = new Secret(this, "Secret", {
      encryptionKey: props.encryptionKey,
      description: `Generated secret for postgres role ${props.roleName}`,
      generateSecretString: {
        passwordLength: 30, // Oracle password cannot have more than 30 characters
        secretStringTemplate: JSON.stringify({
          dbClusterIdentifier: props.cluster.clusterIdentifier,
          engine: "postgres",
          host: props.cluster.clusterEndpoint.hostname,
          port: props.cluster.clusterEndpoint.port,
          username: props.roleName,
          dbname: props.databaseName,
        }),
        generateStringKey: "password",
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
      },
      removalPolicy: RemovalPolicy.DESTROY,
    })
    const role = new CustomResourceRole(this, "PostgresRole", {
      provider: props.provider,
      roleName: props.roleName,
      passwordArn: secret.secretArn,
    })
    role.node.addDependency(secret)
    this.roleName = props.roleName
    secret.grantRead(props.provider.handler)
  }
}
