import { Aspects, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import { Construct } from "constructs"
import { Provider, Database, Role, Schema, Sql } from "./../src/index"
import { Vpc } from "./vpc"

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, "Vpc")

    const cluster = new rds.DatabaseCluster(this, "Cluster2", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_5,
      }),
      removalPolicy: RemovalPolicy.DESTROY,
      defaultDatabaseName: "example",
      instances: 1,
      instanceProps: {
        vpc: vpc.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        instanceType: new ec2.InstanceType("serverless"),
        enablePerformanceInsights: false,
      },
    })

    Aspects.of(cluster).add({
      // <-- cluster is an instance of DatabaseCluster
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: 0.5,
            maxCapacity: 1,
          }
        }
      },
    })

    const provider = new Provider(this, "Provider", {
      vpc: vpc.vpc,
      cluster: cluster,
      secret: cluster.secret!,
    })
    Database.fromDatabaseName(this, "DefaultDatabase", "example")

    new Schema(this, "Schema", {
      provider: provider,
      schemaName: "myschema",
    })
    const role = new Role(this, "Role", {
      provider: provider,
      roleName: "myrole",
      databaseName: "mydb",
    })
    const database = new Database(this, "Database", {
      provider: provider,
      databaseName: "mydb",
      owner: role,
    })
    new Sql(this, "Sql", {
      provider: provider,
      database: database,
      statement: `
create table if not exists t (i int);
grant select on t to myrole;
`,
    })
  }
}
