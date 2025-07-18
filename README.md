# About

This CDK construct library makes it possible to create databases,
schemas, and roles in an Aurora Serverless v2, RDS Database Cluster or
Database Instance. Both PostgreSQL and MySQL databases are supported.

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
VPC. Your isolated network must have a VPC endpoint to AWS Secrets Manager
and possibly KMS as well. If you want to use a subnet with egress
access in case you have no such VPC endpoints, specify the subnet as
follows:

```ts
import { Provider } from "cdk-rds-sql"

const provider = new Provider(this, "Provider", {
  vpc: vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
  },
  cluster: cluster,
  secret: cluster.secret!,
})
```

### Disabling SSL

The default connection to RDS is ssl enabled (this used to be disabled
in versions below 4).

You can disable ssl by setting the `ssl` option to `false`:

```ts
const provider = new Provider(this, "Provider", {
  vpc: vpc,
  instance: instance,
  secret: cluster.secret!,
  ssl: false, // default is true
})
```

## Roles

Create a postgres role (or mysql user) for a cluster as follows:

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

If you want to make the role the owner of a new database, just specify
the `databaseName` here, and create the database later.

### IAM Authentication

Instead of password-based authentication, you can create roles that use AWS IAM database authentication. This eliminates the need to store database passwords and provides enhanced security through AWS IAM policies.

```ts
import { Role } from "cdk-rds-sql"

const iamRole = new Role(this, "IamRole", {
  provider: provider,
  roleName: "myiamrole",
  databaseName: "mydb",
  enableIamAuth: true,
})
```

For IAM-authenticated roles, the secret will not contain a password field:

```json
{
  "dbClusterIdentifier": "teststack-clustereb1186t9-sh4wpqfdyfvu",
  "dbname": "mydb",
  "engine": "postgres",
  "port": 5432,
  "host": "teststack-clustereb1186t9-sh4wpqfdyfvu.cluster-cgudolabssna.us-east-1.rds.amazonaws.com",
  "username": "myiamrole"
}
```

**Requirements for IAM Authentication:**

- SSL connections are required (enabled by default in this library)
- Your application must have IAM permissions to connect to the database
- The database user/role name must match the IAM identity

**IAM Policy Example:**

Your application will need an IAM policy like this to connect:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["rds-db:connect"],
      "Resource": [
        "arn:aws:rds-db:region:account-id:dbuser:cluster-resource-id/myiamrole"
      ]
    }
  ]
}
```

Both PostgreSQL and MySQL databases support IAM authentication. For more details, see the [AWS RDS IAM Database Authentication documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html).

### MySQL support

In MySQL users are created with '%' as value for the host. It is hard
to do this better:

- Determine the CIDR blocks used by a VPC is not trivial.
- For imported VPCs you cannot specify the IPv6 CIDR.
- CIDRs might change without the system knowing, meaning applications
  could lose access to the database at random times, such as when a
  container is restarted.

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
`,
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

# Parameters

Some lambda constructs, in particular [Bref](https://bref.sh/), do not
support secrets out of the box. This construct allows you to create
SSM parameters in addition to a secret:

```ts
const role = new Role(this, "Role", {
  provider: provider,
  roleName: "myrole",
  databaseName: "mydb",
  parameterPrefix: "/my-app/",
})
```

This will create `/my-app/username`, `/my-app/password` and such.

To access parameters you will need IAM permissions such as:

```ts
initialPolicy: [
  new iam.PolicyStatement({
	actions: ["ssm:GetParameter", "ssm:GetParameters"],
	resources: [
	  // Grant access to all parameters under the base path
	  `arn:aws:ssm:${this.region}:${this.account}:parameter/my-app/*`,
	],
	effect: iam.Effect.ALLOW,
  })
],
```

Note that your VPC will need an SSM Parameters interface endpoint to support this.

# IPv6

If you use the provider in an IPv6 subnet you probably need these settings:

```ts
import { Provider } from "cdk-rds-sql"

const provider = new Provider(this, "Provider", {
  ...
  functionProps: {
	ipv6AllowedForDualStack: true,
	allowAllIpv6Outbound: true,
  },
}
```

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

    npx projen integ:deploy:serverless

If you want to use an existing vpc:

    npx cdk deploy --context vpc-id=vpc-0123456789 TestServerlessV2Stack

# To do

- Update role: will not revoke connect to previous database if database name has changed.
