import { existsSync } from "fs"
import * as path from "path"
import { Duration, Stack } from "aws-cdk-lib"
import { IVpc, SubnetType, SubnetSelection } from "aws-cdk-lib/aws-ec2"
import { IFunction, Runtime } from "aws-cdk-lib/aws-lambda"
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs"
import { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs"
import {
  IDatabaseCluster,
  IServerlessCluster,
  IDatabaseInstance,
} from "aws-cdk-lib/aws-rds"
import { ISecret } from "aws-cdk-lib/aws-secretsmanager"
import * as customResources from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

export interface RdsSqlProps {
  /**
   * VPC network to place the provider lambda.
   *
   * Normally this is the VPC of your database.
   *
   * @default - Function is not placed within a VPC.
   */
  readonly vpc: IVpc

  /**
   * Where to place the network provider lambda within the VPC.
   *
   * @default - the isolated subnet if not specified
   */
  readonly vpcSubnets?: SubnetSelection

  /**
   * Your database.
   */
  readonly cluster: IServerlessCluster | IDatabaseCluster | IDatabaseInstance

  /**
   * Secret that grants access to your database.
   *
   * Usually this is your cluster's master secret.
   */
  readonly secret: ISecret

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
   * @default - false
   */
  readonly ssl?: boolean
}

export class Provider extends Construct {
  public readonly serviceToken: string
  public readonly secret: ISecret
  public readonly handler: IFunction
  public readonly cluster: IServerlessCluster | IDatabaseCluster | IDatabaseInstance

  constructor(scope: Construct, id: string, props: RdsSqlProps) {
    super(scope, id)
    this.secret = props.secret
    this.cluster = props.cluster

    const functionName = "RdsSql" + slugify("28b9e791-af60-4a33-bca8-ffb6f30ef8c5")
    this.handler =
      (Stack.of(this).node.tryFindChild(functionName) as IFunction) ??
      this.newCustomResourceHandler(scope, functionName, props)

    const provider = new customResources.Provider(this, "RdsSql", {
      onEventHandler: this.handler,
    })
    this.serviceToken = provider.serviceToken
    this.secret.grantRead(this.handler)
    if (this.secret.encryptionKey) {
      // It seems we need to grant explicit permission
      this.secret.encryptionKey.grantDecrypt(this.handler)
    }
    if (props.cluster.connections.securityGroups.length === 0) {
      throw new Error("Cluster does not have a security group.")
    } else {
      this.handler.node.defaultChild?.node.addDependency(
        props.cluster.connections.securityGroups[0]
      )
    }
    this.node.addDependency(props.cluster)
  }

  protected newCustomResourceHandler(
    scope: Construct,
    id: string,
    props: RdsSqlProps
  ): lambda.NodejsFunction {
    const ts_filename = `${__dirname}/handler.ts`
    const js_filename = `${__dirname}/handler.js`
    let entry: string
    if (existsSync(ts_filename)) {
      entry = ts_filename
    } else if (existsSync(js_filename)) {
      entry = js_filename
    } else {
      // Ugly hack to support SST (possibly caused by my hack to make SST work with CommonJS libraries)
      entry = path.join(
        path.dirname(process.env.npm_package_json || process.cwd()),
        "node_modules/cdk-rds-sql/lib/handler.js"
      )
    }
    let ssl_options: Record<string, string> | undefined
    if (props.ssl !== undefined && !props.ssl) {
      ssl_options = {
        SSL: JSON.stringify(props.ssl),
      }
    }
    const logger = props.logger ?? false
    const fn = new lambda.NodejsFunction(scope, id, {
      ...props.functionProps,
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets ?? {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      entry: entry,
      runtime: Runtime.NODEJS_20_X,
      timeout: props.timeout ?? props.functionProps?.timeout ?? Duration.seconds(300),
      bundling: {
        sourceMap: true,
        externalModules: ["pg-native"],
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
      environment: {
        LOGGER: logger.toString(),
        NODE_OPTIONS: "--enable-source-maps",
        ...ssl_options,
      },
    })

    if (
      !props.functionProps?.securityGroups ||
      props.functionProps?.securityGroups.length === 0
    ) {
      props.cluster.connections.allowDefaultPortFrom(
        fn,
        "Allow the rds sql handler to connect to db"
      )
    }

    return fn
  }
}

function slugify(x: string): string {
  return x.replace(/[^a-zA-Z0-9]/g, "")
}
