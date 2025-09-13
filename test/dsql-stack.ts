import { Duration, Stack, StackProps } from "aws-cdk-lib"
import * as dsql from "aws-cdk-lib/aws-dsql"
import * as iam from "aws-cdk-lib/aws-iam"
import { Runtime } from "aws-cdk-lib/aws-lambda"
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs"
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs"
import { Construct } from "constructs"
import { Provider, Role, Schema, Sql, IamGrant } from "./../src/index"

export interface TestDsqlStackProps extends StackProps {
  /**
   * Print SQL statements being executed.
   *
   * @default true
   */
  logger?: boolean
}

export class TestDsqlStack extends Stack {
  constructor(scope: Construct, id: string, props: TestDsqlStackProps) {
    super(scope, id, props)

    // Create DSQL cluster - no VPC needed as it uses public endpoint
    const dsqlCluster = new dsql.CfnCluster(this, "DsqlCluster", {
      deletionProtectionEnabled: false,
    })

    const provider = new Provider(this, "Provider", {
      cluster: dsqlCluster,
      functionProps: {
        logGroup: new LogGroup(this, "ProviderLogGroup", {
          retention: RetentionDays.ONE_WEEK,
        }),
        timeout: Duration.seconds(30),
      },
      logger: props.logger,
    })

    const role = new Role(this, "Role", {
      provider: provider,
      roleName: "testrole",
    })

    const schema = new Schema(this, "Schema", {
      provider: provider,
      schemaName: "myschema",
      role,
    })

    // DSQL doesn't support DDL and DML in the same transaction
    // Create table first (DDL)
    const createTableSql = new Sql(this, "CreateTable", {
      provider: provider,
      statement: `
        create table if not exists myschema.test_table (
          id uuid primary key default gen_random_uuid(),
          name varchar(100) not null,
          created_at timestamp default current_timestamp
        );
      `,
      rollback: `
        drop table if exists myschema.test_table;
      `,
    })
    createTableSql.node.addDependency(schema)

    const grantPermissionsSql = new Sql(this, "GrantTablePermission", {
      provider: provider,
      statement: `
        grant select on myschema.test_table to testrole;
      `,
      rollback: `
        drop table if exists myschema.test_table;
      `,
    })
    grantPermissionsSql.node.addDependency(createTableSql)

    // Then insert data (DML) - depends on table creation
    const insertDataSql = new Sql(this, "InsertData", {
      provider: provider,
      statement: `
        insert into myschema.test_table (name) values ('test_data');
      `,
    })
    insertDataSql.node.addDependency(createTableSql)

    // Create a Lambda function that queries the DSQL table using our role
    const clusterId = dsqlCluster.attrIdentifier
    const region = Stack.of(this).region
    const dsqlEndpoint = `${clusterId}.dsql.${region}.on.aws`

    const queryLambda = new lambda.NodejsFunction(this, "QueryLambda", {
      runtime: Runtime.NODEJS_22_X,
      handler: "handler",
      entry: "test/query-lambda.ts",
      environment: {
        PGHOST: dsqlEndpoint,
        PGDATABASE: "postgres",
        PGUSER: role.roleName,
      },
      timeout: Duration.seconds(30),
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["dsql:DbConnect"],
          resources: [
            `arn:aws:dsql:${region}:${Stack.of(this).account}:cluster/${clusterId}`,
          ],
        }),
      ],
    })

    // Grant the Lambda's execution role access to the DSQL role
    new IamGrant(this, "LambdaIamGrant", {
      provider: provider,
      roleName: role.roleName,
      resourceArn: queryLambda.role!.roleArn,
    })
  }
}
