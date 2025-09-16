import { existsSync } from "fs"
import * as path from "path"
import { Duration, Stack } from "aws-cdk-lib"
import * as dsql from "aws-cdk-lib/aws-dsql"
import { IVpc, SubnetType, SubnetSelection } from "aws-cdk-lib/aws-ec2"
import * as iam from "aws-cdk-lib/aws-iam"
import { Function, IFunction, Runtime } from "aws-cdk-lib/aws-lambda"
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs"
import { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs"
import { IDatabaseCluster, IDatabaseInstance } from "aws-cdk-lib/aws-rds"
import { ISecret } from "aws-cdk-lib/aws-secretsmanager"
import * as customResources from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

/**
 * Helper function to determine if a cluster is a DSQL cluster
 */
function isDsqlCluster(
  cluster: IDatabaseCluster | IDatabaseInstance | dsql.CfnCluster
): cluster is dsql.CfnCluster {
  return cluster instanceof dsql.CfnCluster
}

export interface RdsSqlProps {
  /**
   * VPC network to place the provider lambda.
   *
   * Normally this is the VPC of your database.
   * Required when your database is only accessible in a VPC.
   * Not required for DSQL as it uses public endpoints with IAM authentication.
   *
   * @default - Function is not placed within a VPC.
   */
  readonly vpc?: IVpc

  /**
   * Where to place the network provider lambda within the VPC.
   *
   * @default - the isolated subnet if not specified
   */
  readonly vpcSubnets?: SubnetSelection

  /**
   * Your database cluster or instance.
   * Supports both traditional RDS/Aurora clusters and DSQL clusters.
   * - For RDS/Aurora: security groups will be configured to allow access
   * - For DSQL: IAM authentication will be used instead of secrets
   */
  readonly cluster: IDatabaseCluster | IDatabaseInstance | dsql.CfnCluster

  /**
   * Secret that grants access to your database.
   *
   * Usually this is your cluster's master secret.
   * Not required when relying on IAM authentication (such as DSQL).
   *
   * @default - undefined for DSQL clusters using IAM authentication
   */
  readonly secret?: ISecret

  /**
   * Timeout for lambda to do its work.
   *
   * @default - 5 minutes
   */
  readonly timeout?: Duration

  /**
   * Log SQL statements. This includes passwords. Use only for debugging.
   *
   * @default - false
   */
  readonly logger?: boolean

  /**
   * Additional function customization.
   *
   * This enables additional function customization such as the log group. However,
   * lambda function properties controlled by other {RdsSqlProps} parameters will trump
   * opions set via this parameter.
   *
   * @default - empty
   */
  readonly functionProps?: NodejsFunctionProps

  /**
   * Use SSL?
   *
   * @default - true
   */
  readonly ssl?: boolean
}

/**
 * Supported database engines
 */
export enum DatabaseEngine {
  POSTGRES = "postgres",
  MYSQL = "mysql",
  DSQL = "dsql",
}

export interface IProvider {
  readonly serviceToken: string
  readonly handler: IFunction
  readonly secret?: ISecret
  readonly engine: string
  readonly cluster?: IDatabaseCluster | IDatabaseInstance | dsql.CfnCluster
}

export interface ProviderAttributes {
  /**
   * Either the ARN or name of the Lambda function.
   * Use functionArn for cross-account or cross-region scenarios.
   * Use functionName for same-account, same-region scenarios.
   */
  readonly functionArn?: string
  readonly functionName?: string
  readonly engine: DatabaseEngine
  /**
   * Optional cluster information for role creation.
   *
   * When importing a provider, cluster details are often not available.
   * However, some operations like role creation require cluster endpoint
   * information to build connection secrets.
   *
   * If you plan to create roles with the imported provider, you must
   * provide the cluster reference. If you only plan to use existing
   * roles, databases, schemas, or SQL operations, this can be omitted.
   */
  readonly cluster?: IDatabaseCluster | IDatabaseInstance | dsql.CfnCluster
}

export class Provider extends Construct implements IProvider {
  /**
   * Import an existing provider Lambda function
   */
  static fromProviderAttributes(
    scope: Construct,
    id: string,
    attrs: ProviderAttributes
  ): IProvider {
    return new ImportedProvider(scope, id, attrs)
  }

  public readonly serviceToken: string
  public readonly secret?: ISecret
  public readonly handler: IFunction
  public readonly cluster?: IDatabaseCluster | IDatabaseInstance | dsql.CfnCluster

  /**
   * The engine like "postgres" or "mysql"
   *
   * @default - if we cannot determine this "postgres"
   */
  public readonly engine: string

  constructor(scope: Construct, id: string, props: RdsSqlProps) {
    super(scope, id)

    // Validate configuration
    const isDsql = isDsqlCluster(props.cluster)
    if (!isDsql && !props.secret) {
      throw new Error(
        "Either secret (for traditional RDS) or cluster with DSQL must be provided"
      )
    }
    if (!isDsql && !props.vpc) {
      throw new Error("VPC is required for traditional RDS databases")
    }
    if (isDsql && props.secret) {
      throw new Error(
        "secret should not be provided when using DSQL cluster (uses IAM authentication)"
      )
    }

    this.secret = props.secret
    this.cluster = props.cluster

    // Determine engine from cluster/instance instead of hardcoding
    if (isDsql) {
      // DSQL is always PostgreSQL-compatible
      this.engine = DatabaseEngine.DSQL
    } else if ("clusterIdentifier" in props.cluster) {
      // It's a DatabaseCluster
      const clusterEngine = (props.cluster as IDatabaseCluster).engine
      this.engine =
        clusterEngine && clusterEngine.engineFamily === "MYSQL"
          ? DatabaseEngine.MYSQL
          : DatabaseEngine.POSTGRES
    } else if ("instanceIdentifier" in props.cluster) {
      // It's a DatabaseInstance
      const instanceEngine = (props.cluster as IDatabaseInstance).engine
      this.engine =
        instanceEngine && instanceEngine.engineFamily === "MYSQL"
          ? DatabaseEngine.MYSQL
          : DatabaseEngine.POSTGRES
    } else {
      // Fallback to postgres if engine hasn't been provided
      this.engine = DatabaseEngine.POSTGRES
    }

    const functionName = "RdsSql" + slugify("28b9e791-af60-4a33-bca8-ffb6f30ef8c5")
    this.handler =
      (Stack.of(this).node.tryFindChild(functionName) as IFunction) ??
      this.newCustomResourceHandler(scope, functionName, props)

    const provider = new customResources.Provider(this, "RdsSql", {
      onEventHandler: this.handler,
    })
    this.serviceToken = provider.serviceToken

    // Handle database connection setup
    if (isDsql) {
      // For DSQL, grant IAM permissions instead of VPC security groups
      const dsqlCluster = props.cluster as dsql.CfnCluster
      this.handler.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["dsql:DbConnectAdmin"],
          resources: [dsqlCluster.attrResourceArn],
        })
      )
    } else {
      // Traditional RDS setup with security groups and secrets
      this.secret!.grantRead(this.handler)
      if (this.secret!.encryptionKey) {
        // It seems we need to grant explicit permission
        this.secret!.encryptionKey.grantDecrypt(this.handler)
      }
      if (props.cluster.connections.securityGroups.length === 0) {
        throw new Error("Cluster does not have a security group.")
      } else {
        const securityGroup = props.cluster.connections.securityGroups[0]!
        this.handler.node.defaultChild?.node.addDependency(securityGroup)
      }
    }
    this.node.addDependency(props.cluster)
  }

  protected newCustomResourceHandler(
    scope: Construct,
    id: string,
    props: RdsSqlProps
  ): lambda.NodejsFunction {
    const isDsql = isDsqlCluster(props.cluster)
    const handlerDir = path.join(__dirname, "handler")
    const index_ts = path.join(handlerDir, "index.ts")
    const index_js = path.join(handlerDir, "index.js")
    let entry: string

    if (existsSync(index_ts)) {
      entry = index_ts
    } else if (existsSync(index_js)) {
      entry = index_js
    } else {
      // Ugly hack to support SST (possibly caused by my hack to make SST work with CommonJS libraries)
      entry = path.join(
        path.dirname(process.env.npm_package_json || process.cwd()),
        "node_modules/cdk-rds-sql/lib/handler/index.js"
      )
    }
    let ssl_options: Record<string, string> | undefined
    if (props.ssl !== undefined && !props.ssl) {
      ssl_options = {
        SSL: JSON.stringify(props.ssl),
      }
    }
    const logger = props.logger ?? false

    // Build environment variables
    const environment: Record<string, string> = {
      LOGGER: logger.toString(),
      ...ssl_options,
    }

    // Add DSQL-specific environment variables
    if (isDsql) {
      const dsqlCluster = props.cluster as dsql.CfnCluster
      const clusterId = dsqlCluster.attrIdentifier
      const region = Stack.of(scope).region
      environment.DSQL_ENDPOINT = `${clusterId}.dsql.${region}.on.aws`
      environment.DSQL_PORT = "5432"
    } else if (props.secret) {
      // Add secret ARN to environment for traditional RDS
      environment.SECRET_ARN = props.secret.secretArn
    }

    const deleteParameterPolicy = new iam.PolicyStatement({
      actions: ["ssm:DeleteParameter"],
      resources: [
        `arn:aws:ssm:${Stack.of(scope).region}:${Stack.of(scope).account}:parameter/*`,
      ],
      conditions: {
        StringEquals: {
          "ssm:ResourceTag/created-by": "cdk-rds-sql",
        },
      },
    })

    const fn = new lambda.NodejsFunction(scope, id, {
      ...props.functionProps,
      // Only configure VPC for traditional RDS
      ...(isDsql
        ? {}
        : {
            vpc: props.vpc,
            vpcSubnets: props.vpcSubnets ?? {
              subnetType: SubnetType.PRIVATE_ISOLATED,
            },
          }),
      entry: entry,
      runtime: Runtime.NODEJS_22_X,
      timeout: props.timeout ?? props.functionProps?.timeout ?? Duration.seconds(300),
      bundling: {
        // Include the migrations directory in the bundle
        commandHooks: {
          beforeBundling(_: string, outputDir: string): string[] {
            return [
              `curl --silent -fL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o ${path.join(
                outputDir,
                "global-bundle.pem"
              )}`,
            ]
          },
          afterBundling(): string[] {
            return []
          },
          beforeInstall(): string[] {
            return []
          },
        },
      },
      environment,
      initialPolicy: [
        deleteParameterPolicy,
        ...(props.functionProps?.initialPolicy ?? []),
      ],
    })

    // Only configure security groups for traditional RDS (not DSQL)
    if (
      !isDsql &&
      (!props.functionProps?.securityGroups ||
        props.functionProps?.securityGroups.length === 0)
    ) {
      const rdsCluster = props.cluster as IDatabaseCluster | IDatabaseInstance
      rdsCluster.connections.allowDefaultPortFrom(
        fn,
        "Allow the rds sql handler to connect to db"
      )
    }

    return fn
  }
}

class ImportedProvider extends Construct implements IProvider {
  public readonly serviceToken: string
  public readonly handler: IFunction
  public readonly secret?: ISecret
  public readonly engine: string
  public readonly cluster?: IDatabaseCluster | IDatabaseInstance | dsql.CfnCluster

  constructor(scope: Construct, id: string, attrs: ProviderAttributes) {
    super(scope, id)

    // Validate that either functionArn or functionName is provided
    if (!attrs.functionArn && !attrs.functionName) {
      throw new Error("Either functionArn or functionName must be provided")
    }
    if (attrs.functionArn && attrs.functionName) {
      throw new Error("Provide either functionArn or functionName, not both")
    }

    // Import the existing Lambda function
    this.handler = attrs.functionArn
      ? Function.fromFunctionArn(this, "Handler", attrs.functionArn)
      : Function.fromFunctionName(this, "Handler", attrs.functionName!)

    // Derive serviceToken by wrapping in custom resource provider
    const provider = new customResources.Provider(this, "Provider", {
      onEventHandler: this.handler,
    })
    this.serviceToken = provider.serviceToken

    this.engine = attrs.engine
    this.secret = undefined // Imported providers get secret from environment
    this.cluster = attrs.cluster // Optional cluster for role creation
  }
}

function slugify(x: string): string {
  return x.replace(/[^a-zA-Z0-9]/g, "")
}
