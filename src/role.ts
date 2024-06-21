import { RemovalPolicy } from "aws-cdk-lib"
import * as kms from "aws-cdk-lib/aws-kms"
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"
import { IDatabase } from "./database"
import { ClusterProvider, InstanceProvider } from "./provider"
import { Role as CustomResourceRole } from "./role.custom-resource"

export interface ClusterPostgresRoleProps {
  /**
   * Provider.
   */
  readonly provider: ClusterProvider

  /**
   * SQL.
   */
  readonly roleName: string

  /**
   * Optional database this user is expected to use.
   *
   * If the database exists, connect privileges are granted.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly database?: IDatabase

  /**
   * Optional database name this user is expected to use.
   *
   * If the database exists, connect privileges are granted.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly databaseName?: string

  /**
   * A new secret is created for this user.
   *
   * Optionally encrypt it with the given key.
   */
  readonly encryptionKey?: kms.IKey

  /**
   * A new secret is created for this user.
   *
   * Optionally add secret name to the secret.
   */
  readonly secretName?: string
}

export interface InstancePostgresRoleProps {
  /**
   * Provider.
   */
  readonly provider: InstanceProvider

  /**
   * SQL.
   */
  readonly roleName: string

  /**
   * Optional database this user is expected to use.
   *
   * If the database exists, connect privileges are granted.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly database?: IDatabase

  /**
   * Optional database name this user is expected to use.
   *
   * If the database exists, connect privileges are granted.
   *
   * Specify none of `database` or `databaseName` or only one of them.
   *
   * @default no connection to any database is granted
   */
  readonly databaseName?: string

  /**
   * A new secret is created for this user.
   *
   * Optionally encrypt it with the given key.
   */
  readonly encryptionKey?: kms.IKey

  /**
   * A new secret is created for this user.
   *
   * Optionally add secret name to the secret.
   */
  readonly secretName?: string
}

export class ClusterPostgresRole extends Construct {
  /**
   * The role name.
   */
  public readonly roleName: string

  /**
   * The generated secret.
   */
  public readonly secret: ISecret

  constructor(scope: Construct, id: string, props: ClusterPostgresRoleProps) {
    if (
      (props.database && props.databaseName) ||
      (!props.database && !props.databaseName)
    )
      throw "Specify either database or databaseName"
    super(scope, id)
    this.secret = new Secret(this, "Secret", {
      secretName: props.secretName,
      encryptionKey: props.encryptionKey,
      description: `Generated secret for postgres role ${props.roleName}`,
      generateSecretString: {
        passwordLength: 30, // Oracle password cannot have more than 30 characters
        secretStringTemplate: JSON.stringify({
          dbClusterIdentifier: props.provider.cluster.clusterIdentifier,
          engine: "postgres",
          host: props.provider.cluster.clusterEndpoint.hostname,
          port: props.provider.cluster.clusterEndpoint.port,
          username: props.roleName,
          dbname: props.database ? props.database.databaseName : props.databaseName,
        }),
        generateStringKey: "password",
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
      },
      removalPolicy: RemovalPolicy.DESTROY,
    })
    const role = new CustomResourceRole(this, "ClusterPostgresRole", {
      provider: props.provider,
      roleName: props.roleName,
      passwordArn: this.secret.secretArn,
      database: props.database,
      databaseName: props.databaseName,
    })
    role.node.addDependency(this.secret)
    this.roleName = props.roleName
    this.secret.grantRead(props.provider.handler)
    if (this.secret.encryptionKey) {
      // It seems we need to grant explicit permission
      this.secret.encryptionKey.grantDecrypt(props.provider.handler)
    }
  }
}

export class InstancePostgresRole extends Construct {
  /**
   * The role name.
   */
  public readonly roleName: string

  /**
   * The generated secret.
   */
  public readonly secret: ISecret

  constructor(scope: Construct, id: string, props: InstancePostgresRoleProps) {
    if (
      (props.database && props.databaseName) ||
      (!props.database && !props.databaseName)
    )
      throw "Specify either database or databaseName"
    super(scope, id)
    this.secret = new Secret(this, "Secret", {
      secretName: props.secretName,
      encryptionKey: props.encryptionKey,
      description: `Generated secret for postgres role ${props.roleName}`,
      generateSecretString: {
        passwordLength: 30, // Oracle password cannot have more than 30 characters
        secretStringTemplate: JSON.stringify({
          dbClusterIdentifier: props.provider.instance.instanceIdentifier,
          engine: "postgres",
          host: props.provider.instance.instanceEndpoint.hostname,
          port: props.provider.instance.instanceEndpoint.port,
          username: props.roleName,
          dbname: props.database ? props.database.databaseName : props.databaseName,
        }),
        generateStringKey: "password",
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
      },
      removalPolicy: RemovalPolicy.DESTROY,
    })
    const role = new CustomResourceRole(this, "InstancePostgresRole", {
      provider: props.provider,
      roleName: props.roleName,
      passwordArn: this.secret.secretArn,
      database: props.database,
      databaseName: props.databaseName,
    })
    role.node.addDependency(this.secret)
    this.roleName = props.roleName
    this.secret.grantRead(props.provider.handler)
    if (this.secret.encryptionKey) {
      // It seems we need to grant explicit permission
      this.secret.encryptionKey.grantDecrypt(props.provider.handler)
    }
  }
}
