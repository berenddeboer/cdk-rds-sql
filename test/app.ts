#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import * as serverlessv2 from "./serverlessv2-stack"

const app = new cdk.App()

new serverlessv2.TestStack(app, "TestRdsSqlServerlessV2Stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Feel free to delete",
})
