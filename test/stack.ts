import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import { Construct } from "constructs"
import { Provider, Database, Role, Schema, Sql } from "./../src/index"

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId: this.node.tryGetContext("vpc-id"),
    })

    const cluster = new rds.ServerlessCluster(this, "Cluster", {
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(
        this,
        "ParameterGroup",
        "default.aurora-postgresql10"
      ),
      removalPolicy: RemovalPolicy.DESTROY,
      scaling: {
        autoPause: Duration.minutes(60),
        minCapacity: rds.AuroraCapacityUnit.ACU_2,
        maxCapacity: rds.AuroraCapacityUnit.ACU_2,
      },
    })
    cluster.connections.allowDefaultPortFrom(ec2.Peer.ipv4("10.88.64.0/16"))

    const provider = new Provider(this, "Provider", {
      vpc: vpc,
      cluster: cluster,
      secret: cluster.secret!,
    })
    new Schema(this, "Schema", {
      provider: provider,
      schemaName: "myschema",
    })
    const role = new Role(this, "Role", {
      provider: provider,
      roleName: "myrole",
      cluster: cluster,
      databaseName: "mydb2",
    })
    const database = new Database(this, "Database", {
      provider: provider,
      databaseName: "mydb2",
      owner: role,
    })
    new Sql(this, "Sql", {
      provider: provider,
      databaseName: database.databaseName,
      statement: "create table t (i int)",
    })
  }
}
