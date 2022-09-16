import { existsSync } from "fs"
import { Duration, Stack } from "aws-cdk-lib"
import { IVpc } from "aws-cdk-lib/aws-ec2"
import { IFunction, Runtime } from "aws-cdk-lib/aws-lambda"
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs"
import { IServerlessCluster } from "aws-cdk-lib/aws-rds"
import { ISecret } from "aws-cdk-lib/aws-secretsmanager"
import * as customResources from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

export interface RdsSqlProps {
  readonly vpc: IVpc
  readonly cluster: IServerlessCluster
  readonly secret: ISecret
}

export class Provider extends Construct {
  public readonly serviceToken: string
  public readonly secret: ISecret
  public readonly handler: IFunction

  constructor(scope: Construct, id: string, props: RdsSqlProps) {
    super(scope, id)
    this.secret = props.secret

    const functionName = "RdsSql" + slugify("28b9e791-af60-4a33-bca8-ffb6f30ef8c5")
    this.handler =
      (Stack.of(this).node.tryFindChild(functionName) as IFunction) ??
      this.newCustomResourceHandler(scope, functionName, props)

    const provider = new customResources.Provider(this, "RdsSql", {
      onEventHandler: this.handler,
    })
    this.serviceToken = provider.serviceToken
    this.secret.grantRead(this.handler)
    props.cluster.connections.allowDefaultPortFrom(this.handler)
    this.node.addDependency(props.cluster)
  }

  protected newCustomResourceHandler(
    scope: Construct,
    id: string,
    props: RdsSqlProps
  ): lambda.NodejsFunction {
    const ts_filename = `${__dirname}/handler.ts`
    const entry = existsSync(ts_filename) ? ts_filename : `${__dirname}/handler.js`
    const fn = new lambda.NodejsFunction(scope, id, {
      vpc: props.vpc,
      entry: entry,
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(300),
      bundling: {
        sourceMap: true,
        externalModules: ["pg-native"],
      },
    })
    return fn
  }
}

function slugify(x: string): string {
  return x.replace(/[^a-zA-Z0-9]/g, "")
}
