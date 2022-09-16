# About

This CDK construct library makes it possible create databases,
schemas, and roles to an Aurora Serverless database created in that
stack.

This construct library is intended to be used in enterprise
environments, and works in isolated subnets.

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
    "default.aurora-postgresql10"
  ),
  removalPolicy: RemovalPolicy.DESTROY,
  scaling: {
    autoPause: Duration.minutes(60),
    minCapacity: rds.AuroraCapacityUnit.ACU_2,
    maxCapacity: rds.AuroraCapacityUnit.ACU_2,
  },
})
```

Then create a provider which will connect to your database:

```ts
import { Provider } from "cdk-rds-sql"

const provider = new Provider(this, "Provider", {
  vpc: vpc,
  cluster: cluster,
  secret: cluster.secret!,
})
```

The provider will setup a lambda, which will live in the same VPC, or
at minimum in a VPC that can get access to the database. The provider
will automatically setup a connection to the given cluster.

# Roles

Create a postgres role (user) as follows:

```ts
import { Role } from "cdk-rds-sql"

const role = new Role(this, "Role", {
  provider: provider,
  roleName: "myrole",
  cluster: cluster,
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

# Database

Create a datdabse as follows:

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

# Schema

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

# To do

- Add `.from()` functions to make everything more type-safe, and make
  it impossible to import database from other stacks or created
  outside the stack.

# Notes

- Lambda times out after 5 minutes, so any SQL needs to finish in less
  than 5 minutes.

- It is unknown how large any SQL can be.

- Note that your SQL will execute randomly unless you specify dependencies.

# Test

You can run the sample stack with:

    npx cdk synth --context vpc-id=vpc-0123456789
