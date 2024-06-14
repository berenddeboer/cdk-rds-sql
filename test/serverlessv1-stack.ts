import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import { Construct } from "constructs"
import { Provider, Database, Role, Schema, Sql } from "./../src/index"
import { Vpc } from "./vpc"

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, "Vpc")

    const cluster = new rds.ServerlessCluster(this, "Cluster", {
      vpc: vpc.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_9,
      }),
      defaultDatabaseName: "example",
      enableDataApi: true,
      removalPolicy: RemovalPolicy.DESTROY,
      scaling: {
        autoPause: Duration.minutes(30),
        minCapacity: rds.AuroraCapacityUnit.ACU_2,
        maxCapacity: rds.AuroraCapacityUnit.ACU_2,
      },
      credentials: {
        username: "pgroot",
        secretName: "pgroot",
      },
    })
    // Allow connections from jump host to test things
    //cluster.connections.allowDefaultPortFrom(ec2.Peer.ipv4("10.88.64.0/16"))

    const provider = new Provider(this, "Provider", {
      vpc: vpc.vpc,
      cluster: cluster,
      secret: cluster.secret!,
      timeout: Duration.seconds(10),
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
      statement: "create table t (i int)",
      rollback: "drop table t",
    })
  }
}
