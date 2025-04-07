#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import * as rds from "aws-cdk-lib/aws-rds"
import * as serverlessv2 from "./serverlessv2-stack"

const app = new cdk.App()

// Determine engine based on context
let engine: rds.IClusterEngine
const engineType = app.node.tryGetContext("engine")

switch (engineType?.toLowerCase()) {
  case "mysql":
    engine = rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
    })
    console.log("Using MySQL engine")
    break
  case "postgresql":
    engine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_15_3,
    })
    console.log("Using PostgreSQL engine")
    break
  default:
    // Default to PostgreSQL
    engine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_15_3,
    })
    console.log("Using default PostgreSQL engine")
}

new serverlessv2.TestStack(app, "TestRdsSqlServerlessV2Stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Feel free to delete",
  logger: true,
  ssl: true,
  engine: engine,
})
