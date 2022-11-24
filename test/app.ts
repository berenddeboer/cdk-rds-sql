#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import * as serverlessv1 from "./serverlessv1-stack"
import * as serverlessv2 from "./serverlessv2-stack"

const app = new cdk.App()

new serverlessv1.TestStack(app, "TestServerlessV1Stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Feel free to delete",
})

new serverlessv2.TestStack(app, "TestServerlessV2Stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Feel free to delete",
})
