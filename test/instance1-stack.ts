import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import { Construct } from "constructs"
import { Vpc } from "./vpc"
import { Provider, Database, Role, Schema, Sql } from "../src/index"

export class TestInstanceStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, "Vpc")

    const instance = new rds.DatabaseInstance(this, "Instance", {
      vpc: vpc.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17_2,
      }),
      databaseName: "example",
      credentials: rds.Credentials.fromGeneratedSecret("pgroot"),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO
      ),
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const provider = new Provider(this, "Provider", {
      vpc: vpc.vpc,
      cluster: instance,
      secret: instance.secret!,
      timeout: Duration.seconds(10),
      functionProps: {
        allowPublicSubnet: true,
      },
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
