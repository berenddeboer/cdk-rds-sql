# About

This CDK construct library makes it possible to create databases,
schemas, and roles in an Aurora Serverless (v1 and v2 are supported), RDS Database Cluster or Database Instance created
in that stack.

This construct library is intended to be used in enterprise
environments, and works in isolated subnets.

<p align="left">
  <a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release" alt=semantic-release: angular"></a>
  <a href="https://github.com/berenddeboer/cdk-rds-sql/actions/workflows/release.yml"><img src="https://github.com/berenddeboer/cdk-rds-sql/actions/workflows/release.yml/badge.svg" alt="Release badge"></a>
</p>

# Requirements

- CDK v2.

# Installation

     npm i cdk-rds-sql

# Usage

## Provider

First setup your VPC and create your cluster:

```ts
import { Duration, RemovalPolicy } from "aws-cdk-lib"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"

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
    "default.aurora-postgresql11"
  ),
  removalPolicy: RemovalPolicy.DESTROY,
  scaling: {
    autoPause: Duration.minutes(60),
    minCapacity: rds.AuroraCapacityUnit.ACU_2,
    maxCapacity: rds.AuroraCapacityUnit.ACU_2,
  },
})
```

Then create a provider which will connect to your database. For a cluster:

```ts
import { Provider } from "cdk-rds-sql"

const provider = new Provider(this, "Provider", {
  vpc: vpc,
  cluster: cluster,
  secret: cluster.secret!,
})
```

For an instance:
```ts
import { Provider } from "cdk-rds-sql"

const provider = new Provider(this, "Provider", {
  vpc: vpc,
  instance: instance,
  secret: cluster.secret!,
})
```

The provider will setup a lambda, which normally lives in the same VPC
as the database. You can give a different VPC, as long as that VPC has
access to the VPC of the database. Only the provider lambda will talk
to your database.

The provider will by default use the private isolated subnet of the
VPC. This is a breaking change from the past, where the provider used
the default strategy, which may not have been the private isolated
subnet. But from an enterprise security point of view having third
party code run in an isolated network by default is better.

Your isolated network must have a VPC endpoint to AWS Secrets Manager
and possibly KMS as well. If you want to use a subnet with egress
access in case you have no such VPC endpoints, specify the subnet as
follows:

```ts
import { Provider } from "cdk-rds-sql"

const provider = new Provider(this, "Provider", {
  vpc: vpc,
  vpcSubnet: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
  },
  cluster: cluster,
  secret: cluster.secret!,
})
```

## Roles

Create a postgres role (user) for a cluster as follows:

```ts
import { Role } from "cdk-rds-sql"

const role = new Role(this, "Role", {
  provider: provider,
  roleName: "myrole",
  databaseName: "mydb",
})
```

This will automatically create a secret just like `ServerlessCluster`
does, with all the connection info needed for this user. It's secret value is a JSON like:

```json
{
  "dbClusterIdentifier": "teststack-clustereb1186t9-sh4wpqfdyfvu",
  "password": "very-long-and-boring",
  "dbname": "mydb",
  "engine": "postgres",
  "port": 5432,
  "host": "teststack-clustereb1186t9-sh4wpqfdyfvu.cluster-cgudolabssna.us-east-1.rds.amazonaws.com",
  "username": "myrole"
}
```

You can access the secret via `role.secret`.

Instead of `databaseName` you can also specify `database` to reference
an existing database. The role will not be created until the database
has been created.

## Database

Create a database as follows:

```ts
import { Database } from "cdk-rds-sql"

const database = new Database(this, "Database", {
  provider: provider,
  databaseName: "mydb",
})
```

You can provide an owner, which makes it easy to create database owned
by a new user:

```ts
const database = new Database(this, "Database", {
  provider: provider,
  databaseName: "mydb",
  owner: role,
})
```

## Schema

Create a schema in the default database as follows:

```ts
import { Schema } from "cdk-rds-sql"

new Schema(this, "Schema", {
  provider: provider,
  schemaName: "myschema",
})
```

Or in another database:

```ts
const database = new Database(this, "Database", {
  provider: provider,
  databaseName: "mydb",
})

new Schema(this, "Schema", {
  provider: provider,
  schemaName: "myschema",
  databaseName: database.databaseName,
})
```

One may need a role permitted for using schema:

```ts
new Schema(this, "Schema", {
  provider: provider,
  schemaName: "myschema",
  databaseName: database.databaseName,
  role: role,
})
```

## Sql

You can insert arbitrary SQL into your database with the `Sql` construct:

```ts
import { Sql } from "cdk-rds-sql"

const sql = new Sql(this, "Sql", {
  provider: provider,
  database: database,
  statement: "create table t (i int)",
})
```

Create a table if it does not exist, and grant a role privileges:

```ts
const sql = new Sql(this, "Sql", {
  provider: provider,
  database: database,
  statement: `
create table if not exists t (i int);
grant select on t to myrole;
`,
})
```

Rollback sql on stack deletion:

```ts
const sql = new Sql(this, "Sql", {
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
      revoke select t from myrole;
    END IF;
    drop table t;
  END IF;
END$$;
`
})
```


Note that there is no synchronisation between various `Sql`
constructs, in particular the order in your code does not determine
the order in which your SQL is executed. This happens in parallel,
unless you specify an explicit dependency via `sql.node.addDepency()`.

There are a lot of concerns when using `Sql`:

- When you update your Sql, your previous Sql is not "rolled back",
  the new Sql is simply executed again.
- When you delete your `Sql` construct the rollback is executed if specified
- When permission are granted via `Sql` they must be removed via rollback to succesfully remove the role
- Currently the `Sql` constructs has less than 5 minutes to execute
  its work.
- It is unknown how large your SQL can be.

## Dependencies

This library manages dependencies, there is no need to specify
dependencies except possibly for `Sql` constructs.

# Working on this code

This code is managed by
[projen](https://github.com/projen/projen/blob/main/README.md). In
addition [pre-commit](https://pre-commit.com/) is used.

So after git clone and `npm ci` you would do:

```
pre-commit install --install-hooks --hook-type commit-msg --hook-type pre-commit
```

to install the pre-commit hooks.

## Testing

Test code via projen with:

    npx projen test

You can run the sample stack with:

    npx cdk deploy --context vpc-id=vpc-0123456789 TestServerlessV1Stack

Or for v2:

    npx cdk deploy TestServerlessV2Stack

If you want to use an existing vpc:

    npx cdk deploy --context vpc-id=vpc-0123456789 TestServerlessV2Stack

# To do

- Update role: will not revoke connect to previous database if database name has changed.
- If the cluster is configured for autopausing, wake cluster up before doing any SQL operations.
- We rename roles and database on update: is that actually the best
  thing? More change to get us into an irrecoverable situation??
