import * as cdk from "aws-cdk-lib"
import { Match, Template } from "aws-cdk-lib/assertions"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import * as serverlessv2 from "./serverlessv2-stack"
import { Provider } from "../src/provider"
import { Role } from "../src/role"

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

  const cluster = new rds.DatabaseCluster(stack, "Cluster2", {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_15_10,
    }),
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    defaultDatabaseName: "example",
    writer: rds.ClusterInstance.serverlessV2("writer", {
      instanceIdentifier: "writer",
      publiclyAccessible: false,
      enablePerformanceInsights: false,
    }),
    serverlessV2MinCapacity: 0.5,
    serverlessV2MaxCapacity: 1,
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
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
  }).toThrow()
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
  template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
    Resource: "role",
  })

  // Check for engine property
  template.hasResourceProperties("AWS::SecretsManager::Secret", {
    GenerateSecretString: {
      SecretStringTemplate: {
        "Fn::Join": [
          "", // First element is an empty string (the separator)
          Match.arrayWith([Match.stringLikeRegexp('"engine":s*"postgres"')]), // Second element is the array of strings to join
        ],
      },
    },
  })

  // Verify no parameters are created
  template.resourceCountIs("AWS::SSM::Parameter", 0)

  // Verify no custom resource for password parameter is created
  template.resourceCountIs("Custom::SecretParameter", 0)

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
  template.hasResourceProperties("AWS::Lambda::Function", {
    Timeout: 900,
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

test("credentials stored in parameters", () => {
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

  const cluster = new rds.DatabaseCluster(stack, "Cluster", {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_14_5,
    }),
    writer: rds.ClusterInstance.serverlessV2("writer"),
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  })

  const provider = new Provider(stack, "Provider", {
    vpc: vpc,
    cluster: cluster,
    secret: cluster.secret!,
  })

  new Role(stack, "RoleWithParams", {
    provider: provider,
    roleName: "role-with-params",
    databaseName: "mydb",
    parameterPrefix: "/my/params/path/",
  })

  const template = Template.fromStack(stack)
  // Verify secret is created
  template.hasResourceProperties("AWS::SecretsManager::Secret", {
    Description: "Generated secret for postgres role role-with-params",
  })

  // Verify parameters are created
  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/my/params/path/engine",
    Value: "postgres",
  })

  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/my/params/path/username",
    Value: "role-with-params",
  })

  template.hasResourceProperties("AWS::SSM::Parameter", {
    Name: "/my/params/path/dbname",
    Value: "mydb",
  })

  // Verify custom resource for password parameter is created
  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.handler",
    Runtime: "nodejs20.x",
  })

  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: ["ssm:PutParameter", "ssm:AddTagsToResource", "ssm:GetParameters"],
          Effect: "Allow",
          Resource: "arn:aws:ssm:us-east-1:123456789:parameter/my/params/path/password",
        }),
      ]),
    },
  })

  template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
    Resource: "parameter_password",
    ParameterName: "/my/params/path/password",
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

  const cluster = new rds.DatabaseCluster(stack, "MySqlCluster", {
    engine: rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_08_0,
    }),
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    defaultDatabaseName: "example",
    writer: rds.ClusterInstance.serverlessV2("writer", {
      instanceIdentifier: "writer",
      publiclyAccessible: false,
      enablePerformanceInsights: false,
    }),
    serverlessV2MinCapacity: 0.5,
    serverlessV2MaxCapacity: 1,
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
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
  }).toThrow()
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

test("timeout can be set on main properties", () => {
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

  const cluster = new rds.DatabaseCluster(stack, "Cluster", {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_14_5,
    }),
    writer: rds.ClusterInstance.serverlessV2("writer"),
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  })

  new Provider(stack, "Provider", {
    vpc: vpc,
    cluster: cluster,
    secret: cluster.secret!,
    timeout: cdk.Duration.seconds(400),
  })
  const template = Template.fromStack(stack)
  template.hasResourceProperties("AWS::Lambda::Function", {
    Timeout: 400,
  })
})

test("timeout can be set on function properties", () => {
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

  const cluster = new rds.DatabaseCluster(stack, "Cluster", {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_14_5,
    }),
    writer: rds.ClusterInstance.serverlessV2("writer"),
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  })

  new Provider(stack, "Provider", {
    vpc: vpc,
    cluster: cluster,
    secret: cluster.secret!,
    functionProps: {
      timeout: cdk.Duration.seconds(200),
    },
  })
  const template = Template.fromStack(stack)
  template.hasResourceProperties("AWS::Lambda::Function", {
    Timeout: 200,
  })
})

test("mysql cluster engine is set in secret", () => {
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

  const cluster = new rds.DatabaseCluster(stack, "MySqlCluster", {
    engine: rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_08_0,
    }),
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    defaultDatabaseName: "example",
    writer: rds.ClusterInstance.serverlessV2("writer", {
      instanceIdentifier: "writer",
      publiclyAccessible: false,
      enablePerformanceInsights: false,
    }),
    serverlessV2MinCapacity: 0.5,
    serverlessV2MaxCapacity: 1,
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
  })

  const provider = new Provider(stack, "Provider", {
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
    cluster: cluster,
    secret: cluster.secret!,
  })

  new Role(stack, "Role", {
    provider: provider,
    roleName: "myrole",
    databaseName: "mydb",
  })

  let template = Template.fromStack(stack)

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
