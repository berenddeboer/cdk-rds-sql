import { Duration, Fn, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import { RetentionDays } from "aws-cdk-lib/aws-logs"
import * as rds from "aws-cdk-lib/aws-rds"
import * as secrets from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"
import { Provider, Database, Role, Schema, Sql } from "./../src/index"
import { Vpc } from "./vpc"

export interface TestStackProps extends StackProps {
  /**
   * Print SQL statements being executed.
   *
   * @default true
   */
  logger?: boolean

  /**
   * @default true
   */
  ssl?: boolean

  /**
   * Database engine to use
   *
   * @default Aurora PostgreSQL 14.9
   */
  engine?: rds.IClusterEngine
}

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: TestStackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, "Vpc")

    // Use provided engine or default to PostgreSQL 14.9
    const engine =
      props.engine ||
      rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_9,
      })

    // Create a custom parameter group based on engine type
    const isMySql = engine.engineFamily === "MYSQL"
    const parameterGroup = new rds.ParameterGroup(this, "ClusterParameterGroup", {
      engine: engine,
      parameters:
        props.ssl !== false
          ? {
              // Set SSL enforcement parameter based on engine type
              ...(isMySql
                ? { require_secure_transport: "ON" }
                : {
                    "rds.force_ssl": "1",
                  }),
            }
          : {},
      description: "Parameter group to enforce SSL connections",
    })

    const cluster = new rds.DatabaseCluster(this, "Cluster2", {
      engine: engine,
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
      parameterGroup: parameterGroup, // Use our custom parameter group
    })

    const provider = new Provider(this, "Provider", {
      vpc: vpc.vpc,
      cluster: cluster,
      secret: cluster.secret!,
      functionProps: {
        logRetention: RetentionDays.ONE_WEEK,
        timeout: Duration.seconds(30),
      },
      logger: props.logger,
      ssl: props.ssl,
    })

    Database.fromDatabaseName(this, "DefaultDatabase", "example")

    const is_postgress = !props.engine || props.engine.engineFamily !== "MYSQL"

    if (is_postgress) {
      new Schema(this, "Schema", {
        provider: provider,
        schemaName: "myschema",
      })
    }

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
    const statement = is_postgress
      ? `
create table t (i int);
grant select on t to myrole;
`
      : `
create table if not exists t (i int);
grant select on mydb.t to 'myrole'@'%';
`
    const rollback = is_postgress
      ? `
DO $$BEGIN
   IF EXISTS (select from pg_database WHERE datname = 't') THEN
     IF EXISTS (select from pg_catalog.pg_roles WHERE rolname = 'myrole') THEN
       revoke select on database t from myrole;
    END IF;
    drop table t;
  END IF;
END$$;
`
      : `
      revoke select on table t from myrole;
      drop table t;
`
    new Sql(this, "Sql", {
      provider: provider,
      database: database,
      statement,
      rollback,
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
