import * as cdk from "aws-cdk-lib"
import { Match, Template } from "aws-cdk-lib/assertions"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import * as serverlessInstancev1 from "./instance1-stack"
import * as serverlessInstancev2 from "./instance2-stack"
import { Provider } from "../src/provider"
import { Role } from "../src/role"

test("serverless instance v1", () => {
  const app = new cdk.App()
  const stack = new serverlessInstancev1.TestInstanceStack(app, "TestInstanceStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })
  let template = Template.fromStack(stack)
  template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
    Resource: "role",
  })

  // Check for engine property
  template.hasResourceProperties("AWS::SecretsManager::Secret", {
    GenerateSecretString: {
      SecretStringTemplate: {
        "Fn::Join": [
          "", // First element is an empty string (the separator)
          Match.arrayWith([Match.stringLikeRegexp('"engine":\\s*"postgres"')]), // Second element is the array of strings to join
        ],
      },
    },
  })
})

test("instance role without database", () => {
  const app = new cdk.App()
  const stack = new cdk.Stack(app, "TestInstanceStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })
  const vpc = new ec2.Vpc(stack, "Vpc", {
    subnetConfiguration: [
      {
        cidrMask: 28,
        name: "rds",
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    ],
  })

  const instance = new rds.DatabaseInstance(stack, "Instance", {
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
    engine: rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_15,
    }),
  })

  const provider = new Provider(stack, "Provider", {
    vpc: vpc,
    cluster: instance,
    secret: instance.secret!,
  })

  expect(() => {
    new Role(stack, "Role", {
      provider: provider,
      roleName: "role",
    })
  }).toThrow()
})

test("serverless instance v2", () => {
  const app = new cdk.App()
  const stack = new serverlessInstancev2.TestInstanceStack(app, "TestInstanceStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })
  let template = Template.fromStack(stack)
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
  template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
    FromPort: {
      "Fn::GetAtt": ["InstanceC1063A87", "Endpoint.Port"],
    },
    IpProtocol: "tcp",
    SourceSecurityGroupId: {
      "Fn::GetAtt": [
        "RdsSql28b9e791af604a33bca8ffb6f30ef8c5SecurityGroup60F64508",
        "GroupId",
      ],
    },
  })
})

test("absence of security group is detected", () => {
  const app = new cdk.App()
  const stack = new serverlessInstancev2.ImportedInstanceStack(app, "TestInstanceStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })
  let template = Template.fromStack(stack)
  template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
    Resource: "role",
  })
  template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
    FromPort: 5432,
    IpProtocol: "tcp",
    SourceSecurityGroupId: {
      "Fn::GetAtt": [
        "RdsSql28b9e791af604a33bca8ffb6f30ef8c5SecurityGroup60F64508",
        "GroupId",
      ],
    },
  })
})

test("vpcSubnet selection can be specified", () => {
  const app = new cdk.App()
  const stack = new cdk.Stack(app, "TestInstanceStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })
  const vpc = new ec2.Vpc(stack, "Vpc", {
    subnetConfiguration: [
      {
        cidrMask: 28,
        name: "rds",
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      {
        cidrMask: 28,
        name: "nat",
        subnetType: ec2.SubnetType.PUBLIC,
      },
    ],
  })

  const instance = new rds.DatabaseInstance(stack, "Instance", {
    vpc: vpc,
    // vpcSubnets: {
    //   subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    // },
    engine: rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_15,
    }),
  })

  const provider = new Provider(stack, "Provider", {
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
    cluster: instance,
    secret: instance.secret!,
  })

  expect(() => {
    new Role(stack, "Role", {
      provider: provider,
      roleName: "role",
    })
  }).toThrow()
})

test("mysql database instance engine is set in secret", () => {
  const app = new cdk.App()
  const stack = new cdk.Stack(app, "TestStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })
  const vpc = new ec2.Vpc(stack, "Vpc", {
    subnetConfiguration: [
      {
        cidrMask: 28,
        name: "rds",
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      {
        cidrMask: 28,
        name: "nat",
        subnetType: ec2.SubnetType.PUBLIC,
      },
    ],
  })

  const instance = new rds.DatabaseInstance(stack, "Instance", {
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
    engine: rds.DatabaseInstanceEngine.mariaDb({
      version: rds.MariaDbEngineVersion.VER_11_4_3,
    }),
    databaseName: "example",
    credentials: rds.Credentials.fromGeneratedSecret("admin"),
    instanceType: ec2.InstanceType.of(
      ec2.InstanceClass.BURSTABLE3,
      ec2.InstanceSize.MICRO
    ),
  })

  const provider = new Provider(stack, "Provider", {
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
    cluster: instance,
    secret: instance.secret!,
  })

  new Role(stack, "Role", {
    provider: provider,
    roleName: "myrole",
    databaseName: "mydb",
  })

  const template = Template.fromStack(stack)

  // Check for engine property
  template.hasResourceProperties("AWS::SecretsManager::Secret", {
    GenerateSecretString: {
      SecretStringTemplate: {
        "Fn::Join": [
          "", // First element is an empty string (the separator)
          Match.arrayWith([Match.stringLikeRegexp('"engine":\\s*"mysql"')]), // Second element is the array of strings to join
        ],
      },
    },
  })
})
