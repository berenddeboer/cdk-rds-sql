import { Aspects, Fn, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs"
import * as rds from "aws-cdk-lib/aws-rds"
import * as secrets from "aws-cdk-lib/aws-secretsmanager"
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
        version: rds.PostgresEngineVersion.VER_13_4,
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
      functionProps: {
        logGroup: new LogGroup(this, "loggroup", {
          retention: RetentionDays.ONE_WEEK,
          logGroupName: "/aws/lambda/provider",
        }),
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
      statement: `
create table if not exists t (i int);
grant select on t to myrole;
`,
      rollback: `
DO $$BEGIN
   IF EXISTS (select from pg_database WHERE datname = 't') THEN
     IF EXISTS (select from pg_catalog.pg_roles WHERE rolname = 'myrole') THEN
       revoke select  database t from myrole;
    END IF;
    drop table t;
  END IF;
END$$;,
`,
    })
  }
}

export class ImportedInstanceStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, "Vpc")

    const secret = secrets.Secret.fromSecretCompleteArn(
      this,
      "Secret",
      Fn.importValue("secret-arn")
    )

    const instance = rds.DatabaseInstance.fromDatabaseInstanceAttributes(
      this,
      "DatabaseInstance",
      {
        instanceIdentifier: Fn.importValue("instance-identifier"),
        instanceEndpointAddress: Fn.importValue("instance-endpoint"),
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_13_4,
        }),
        port: 5432, // absence of port in import causes an exception
        securityGroups: [
          ec2.SecurityGroup.fromSecurityGroupId(
            this,
            "RdsSecurityGroup",
            "sg-00bbd66b014133c45"
          ),
        ],
      }
    )

    const provider = new Provider(this, "Provider", {
      vpc: vpc.vpc,
      cluster: instance,
      secret: secret,
    })
    Database.fromDatabaseName(this, "DefaultDatabase", "example")

    new Role(this, "Role", {
      provider: provider,
      roleName: "myrole",
      databaseName: "mydb",
    })
  }
}
