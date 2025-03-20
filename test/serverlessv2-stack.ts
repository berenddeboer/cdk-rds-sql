import { Duration, Fn, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import { RetentionDays } from "aws-cdk-lib/aws-logs"
import * as rds from "aws-cdk-lib/aws-rds"
import * as secrets from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"
import { Provider, Database, Role, Schema, Sql } from "./../src/index"
import { Vpc } from "./vpc"

export interface TestStackProps extends StackProps {
  ssl?: boolean
}

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: TestStackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, "Vpc")

    const cluster = new rds.DatabaseCluster(this, "Cluster2", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_9,
      }),
      removalPolicy: RemovalPolicy.DESTROY,
      defaultDatabaseName: "example",
      writer: rds.ClusterInstance.serverlessV2("writer", {
        instanceIdentifier: "writer",
        publiclyAccessible: false,
        enablePerformanceInsights: false,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      vpc: vpc.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    })

    const provider = new Provider(this, "Provider", {
      vpc: vpc.vpc,
      cluster: cluster,
      secret: cluster.secret!,
      functionProps: {
        logRetention: RetentionDays.ONE_WEEK,
        timeout: Duration.seconds(30),
      },
      ssl: props.ssl,
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

export class ImportedClusterStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, "Vpc")

    const secret = secrets.Secret.fromSecretCompleteArn(
      this,
      "Secret",
      Fn.importValue("secret-arn")
    )

    const cluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(
      this,
      "DatabaseCluster",
      {
        clusterIdentifier: Fn.importValue("cluster-identifier"),
        clusterEndpointAddress: Fn.importValue("cluster-endpoint"),
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_14_6,
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
      cluster: cluster,
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
