import * as cdk from "aws-cdk-lib"
import { Match, Template } from "aws-cdk-lib/assertions"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import * as serverlessv1 from "./serverlessv1-stack"
import * as serverlessv2 from "./serverlessv2-stack"
import { Provider } from "../src/provider"
import { Role } from "../src/role"

test("serverless v1", () => {
  const app = new cdk.App()
  const stack = new serverlessv1.TestStack(app, "TestStack", {
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

test("role without database", () => {
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
    ],
  })

  const cluster = new rds.ServerlessCluster(stack, "Cluster", {
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_11_13,
    }),
  })

  const provider = new Provider(stack, "Provider", {
    vpc: vpc,
    cluster: cluster,
    secret: cluster.secret!,
  })

  expect(() => {
    new Role(stack, "Role", {
      provider: provider,
      roleName: "role",
    })
  }).toThrowError()
})

test("serverless v2", () => {
  const app = new cdk.App()
  const stack = new serverlessv2.TestStack(app, "TestStack", {
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
  template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
    FromPort: {
      "Fn::GetAtt": ["Cluster2720FF351", "Endpoint.Port"],
    },
    IpProtocol: "tcp",
    SourceSecurityGroupId: {
      "Fn::GetAtt": [
        "RdsSql28b9e791af604a33bca8ffb6f30ef8c5SecurityGroup60F64508",
        "GroupId",
      ],
    },
  })
  template.hasResourceProperties("AWS::Lambda::Function", {
    Runtime: "nodejs20.x",
    Environment: {
      Variables: {
        LOGGER: "false",
        SSL: Match.absent(),
      },
    },
  })
})

test("absence of security group is detected", () => {
  const app = new cdk.App()
  const stack = new serverlessv2.ImportedClusterStack(app, "TestStack", {
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
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      {
        cidrMask: 28,
        name: "nat",
        subnetType: ec2.SubnetType.PUBLIC,
      },
    ],
  })

  const cluster = new rds.ServerlessCluster(stack, "Cluster", {
    vpc: vpc,
    // vpcSubnets: {
    //   subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    // },
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_11_13,
    }),
  })

  const provider = new Provider(stack, "Provider", {
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
    cluster: cluster,
    secret: cluster.secret!,
  })

  expect(() => {
    new Role(stack, "Role", {
      provider: provider,
      roleName: "role",
    })
  }).toThrowError()
})

test("ssl can be disabled", () => {
  const app = new cdk.App()
  const stack = new serverlessv2.TestStack(app, "TestStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
    ssl: false,
  })
  const template = Template.fromStack(stack)
  template.hasResourceProperties("AWS::Lambda::Function", {
    Runtime: "nodejs20.x",
    Environment: {
      Variables: {
        LOGGER: "false",
        SSL: "false",
      },
    },
  })
})
