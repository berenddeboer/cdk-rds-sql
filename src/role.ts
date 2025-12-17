import { CustomResource, RemovalPolicy, Stack } from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import * as kms from "aws-cdk-lib/aws-kms"
import { IDatabaseCluster, IDatabaseInstance } from "aws-cdk-lib/aws-rds"
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager"
import * as ssm from "aws-cdk-lib/aws-ssm"
import { Construct } from "constructs"
import { IDatabase } from "./database"
import { RdsSqlResource } from "./enum"
import { IProvider, DatabaseEngine } from "./provider"
import { Role as CustomResourceRole } from "./role.custom-resource"

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
   * Optional database this user is expected to use.
   *
   * If the database exists, connect privileges are granted.
   *
   * Specify one of `database` or `databaseName`. This is the name
   * that will be stored in the role's secret as the database name to
   * use.
   */
  readonly database?: IDatabase

  /**
   * Optional database name this user is expected to use.
   *
   * If the database exists, connect privileges are granted.
   *
   * Specify one of `database` or `databaseName`. This is the name
   * that will be stored in the role's secret as the database name to
   * use.
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

  /**
   * Prefix for SSM parameters to store credentials in Parameter Store.
   * When defined, credentials will also be stored as parameters.
   *
   * The parameter names such as "password" is simply appended to
   * `parameterPrefix`, so make sure the prefix ends with a slash if
   *  you have your parameter names slash separated.
   *
   * Note that the password from the secret is copied just once, they
   * are not kept in sync.
   *
   * @default - credentials are only stored in Secrets Manager
   */
  readonly parameterPrefix?: string

  /**
   * Enable IAM authentication for this role.
   *
   * When enabled, the role will be created without a password and
   * configured for AWS IAM database authentication. No secret will
   * be created for this role.
   *
   * Note: For DSQL clusters, this property is ignored as DSQL always
   * uses IAM authentication.
   *
   * @default false - use password authentication
   */
  readonly enableIamAuth?: boolean
}

// Private Parameters construct (not exported)
class Parameters extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: {
      provider: IProvider
      secretArn: string
      parameterPrefix: string
      passwordArn: string
      providerServiceToken: string
      paramData: Record<string, any>
    }
  ) {
    super(scope, id)

    // Create parameters for each key-value pair
    Object.entries(props.paramData).forEach(([key, value]) => {
      if (value !== undefined) {
        new ssm.StringParameter(this, `Parameter-${key}`, {
          parameterName: `${props.parameterPrefix}${key}`,
          stringValue: value.toString(),
        })
      }
    })

    // For password, use the existing provider to store it in SSM
    const passwordParameterName = `${props.parameterPrefix}password`
    const password_parameter = new CustomResource(this, "PasswordParameter", {
      serviceToken: props.providerServiceToken,
      properties: {
        SecretArn: props.secretArn,
        Resource: RdsSqlResource.PARAMETER_PASSWORD,
        PasswordArn: props.passwordArn,
        ParameterName: passwordParameterName,
      },
    })
    password_parameter.node.addDependency(props.provider)

    const paramArn = `arn:aws:ssm:${Stack.of(this).region}:${
      Stack.of(this).account
    }:parameter${
      passwordParameterName.startsWith("/") ? "" : "/"
    }${passwordParameterName}`

    props.provider.handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:PutParameter", "ssm:AddTagsToResource", "ssm:GetParameters"],
        resources: [paramArn],
      })
    )
  }
}

export class Role extends Construct {
  /**
   * The role name.
   */
  public readonly roleName: string

  /**
   * The generated secret containing connection information and password.
   *
   * This is only available when:
   * - The provider is not a DSQL cluster (DSQL uses IAM authentication)
   * - `enableIamAuth` is not set to `true`
   *
   * When using IAM authentication, no secret is created as the password
   * is generated dynamically using IAM credentials.
   */
  public readonly secret?: ISecret

  constructor(scope: Construct, id: string, props: RoleProps) {
    if (props.provider.engine !== DatabaseEngine.DSQL) {
      if (props.database && props.databaseName) {
        throw "Specify either database or databaseName"
      }
      if (!props.database && !props.databaseName) {
        // If neither is specified, we might need a default or throw an error depending on desired behavior.
        // For now, let's assume it's allowed but the secret won't have a dbname.
        // If it should be required, uncomment the line below:
        throw "Specify either database or databaseName"
      }
    }
    super(scope, id)

    // Skip secret creation for DSQL (always uses IAM auth) or when enableIamAuth is true
    const useIamAuth =
      props.enableIamAuth || props.provider.engine === DatabaseEngine.DSQL
    if (!useIamAuth) {
      // For imported providers without cluster details, provide helpful error message
      if (!props.provider.cluster) {
        throw new Error(
          "Role creation requires cluster information. When importing a provider with " +
            "Provider.fromProviderAttributes(), include the 'cluster' property if you plan " +
            "to create new roles. Alternatively, use existing roles created with the original provider."
        )
      }

      // For RDS/Aurora clusters and instances, get endpoint details
      const host = (props.provider.cluster as IDatabaseCluster).clusterEndpoint
        ? (props.provider.cluster as IDatabaseCluster).clusterEndpoint.hostname
        : (props.provider.cluster as IDatabaseInstance).instanceEndpoint.hostname

      const port = (props.provider.cluster as IDatabaseCluster).clusterEndpoint
        ? (props.provider.cluster as IDatabaseCluster).clusterEndpoint.port
        : (props.provider.cluster as IDatabaseInstance).instanceEndpoint.port

      const identifier = (props.provider.cluster as IDatabaseCluster).clusterIdentifier
        ? (props.provider.cluster as IDatabaseCluster).clusterIdentifier
        : (props.provider.cluster as IDatabaseInstance).instanceIdentifier

      const secretTemplate = {
        dbClusterIdentifier: identifier,
        engine: props.provider.engine,
        host: host,
        port: port,
        username: props.roleName,
        dbname: props.database ? props.database.databaseName : props.databaseName,
      }

      this.secret = new Secret(this, "Secret", {
        secretName: props.secretName,
        encryptionKey: props.encryptionKey,
        description: `Generated secret for ${props.provider.engine} role ${props.roleName}`,
        generateSecretString: {
          passwordLength: 30, // Oracle password cannot have more than 30 characters
          secretStringTemplate: JSON.stringify(secretTemplate),
          generateStringKey: "password",
          excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
        },
        removalPolicy: RemovalPolicy.DESTROY,
      })

      // Create Parameters if parameterPrefix is provided
      if (props.parameterPrefix) {
        const paramData = {
          dbClusterIdentifier: identifier,
          engine: props.provider.engine,
          host: host,
          port: port,
          username: props.roleName,
          dbname: props.database ? props.database.databaseName : props.databaseName,
        }

        new Parameters(this, "Parameters", {
          secretArn: props.provider.secret?.secretArn || "",
          parameterPrefix: props.parameterPrefix,
          passwordArn: this.secret.secretArn,
          providerServiceToken: props.provider.serviceToken,
          provider: props.provider,
          paramData,
        })
      }
    }

    const role = new CustomResourceRole(this, "PostgresRole", {
      provider: props.provider,
      roleName: props.roleName,
      passwordArn: useIamAuth ? "" : this.secret!.secretArn,
      database: props.database,
      databaseName: props.databaseName,
      enableIamAuth: useIamAuth,
    })

    if (this.secret) {
      role.node.addDependency(this.secret)
      this.secret.grantRead(props.provider.handler)
      if (this.secret.encryptionKey) {
        // It seems we need to grant explicit permission
        this.secret.encryptionKey.grantDecrypt(props.provider.handler)
      }
    }

    this.roleName = props.roleName
  }
}
