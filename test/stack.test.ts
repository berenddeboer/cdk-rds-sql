import * as cdk from "aws-cdk-lib"
import { Template } from "aws-cdk-lib/assertions"
import { TestStack } from "./stack"

test("stack", () => {
  const app = new cdk.App()
  const stack = new TestStack(app, "TestStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })
  let template = Template.fromStack(stack)
  //console.debug("TEMPLATE", template.toJSON())
  template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
    Resource: "role",
  })
  /*
  template.hasResourceProperties("AWS::SecretsManager::Secret", {
    GenerateSecretString: {
      SecretStringTemplate: "{\"username\":\"myrole\"}",
    },
    })
  */
})
