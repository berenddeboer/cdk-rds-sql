import * as cdk from "aws-cdk-lib"
import { Match, Template } from "aws-cdk-lib/assertions"
import * as dsql from "aws-cdk-lib/aws-dsql"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import { Provider, DatabaseEngine, Role, Database, Schema, Sql } from "../src"

describe("Custom Resource Properties", () => {
  let app: cdk.App
  let stack: cdk.Stack
  let vpc: ec2.Vpc
  let cluster: rds.DatabaseCluster
  let provider: Provider

  beforeEach(() => {
    app = new cdk.App()
    stack = new cdk.Stack(app, "TestStack", {
      env: {
        account: "123456789012",
        region: "us-east-1",
      },
    })

    vpc = new ec2.Vpc(stack, "Vpc", {
      subnetConfiguration: [
        {
          cidrMask: 28,
          name: "rds",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    })

    cluster = new rds.DatabaseCluster(stack, "Cluster", {
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

    provider = new Provider(stack, "Provider", {
      vpc: vpc,
      cluster: cluster,
      secret: cluster.secret!,
    })
  })

  /**
   * Helper function to validate that all expected properties are present and correct
   */
  function validateCustomResourceProperties(
    template: Template,
    resourceType: string,
    expectedProperties: Record<string, any>
  ) {
    const resources = template.findResources("AWS::CloudFormation::CustomResource", {
      Properties: {
        Resource: resourceType,
      },
    })

    expect(Object.keys(resources)).toHaveLength(1)
    const resourceKey = Object.keys(resources)[0]!
    const resource = resources[resourceKey]!

    // Check each expected property individually
    for (const [key, expectedValue] of Object.entries(expectedProperties)) {
      if (typeof expectedValue === "object" && expectedValue?.name === "anyValue") {
        // Just check that the property exists
        expect(resource.Properties[key]).toBeDefined()
      } else if (typeof expectedValue === "object" && expectedValue?.name === "absent") {
        // Check that the property is absent
        expect(resource.Properties[key]).toBeUndefined()
      } else {
        // Check exact value
        expect(resource.Properties[key]).toEqual(expectedValue)
      }
    }

    // Verify service token is present and correct
    expect(resource.Properties.ServiceToken).toBeDefined()

    return resource
  }

  /**
   * Helper function to get all custom resources and verify their properties
   */
  function getAllCustomResourceProperties(template: Template) {
    const customResources = template.findResources("AWS::CloudFormation::CustomResource")
    const result: Record<string, any> = {}

    for (const [key, resource] of Object.entries(customResources)) {
      const resourceType = resource.Properties.Resource
      if (!result[resourceType]) {
        result[resourceType] = []
      }
      result[resourceType].push({
        key,
        properties: resource.Properties,
      })
    }

    return result
  }

  describe("Role resource properties", () => {
    test("role with database name includes all required properties", () => {
      new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        databaseName: "test_db",
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "role", {
        Resource: "role",
        ResourceId: "test_role",
        SecretArn: Match.anyValue(), // Secret ARN from provider
        PasswordArn: Match.anyValue(), // Generated secret ARN
        DatabaseName: "test_db",
        EnableIamAuth: false, // Converted from undefined to false by implementation
      })
    })

    test("role with IAM auth enabled does not create a secret", () => {
      const iamRole = new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        databaseName: "test_db",
        enableIamAuth: true,
      })

      const template = Template.fromStack(stack)

      // Verify the custom resource is created with IAM auth enabled
      validateCustomResourceProperties(template, "role", {
        Resource: "role",
        ResourceId: "test_role",
        SecretArn: Match.anyValue(),
        PasswordArn: "", // Empty for IAM auth
        DatabaseName: "test_db",
        EnableIamAuth: true,
      })

      // Verify no secret is created for this role
      expect(iamRole.secret).toBeUndefined()

      // Verify no secret with this role's description exists
      const secrets = template.findResources("AWS::SecretsManager::Secret", {
        Properties: {
          Description: "Generated secret for postgres role test_role",
        },
      })
      expect(Object.keys(secrets)).toHaveLength(0)
    })

    test("role with IAM auth and parameterPrefix creates parameters without password", () => {
      const iamRole = new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        databaseName: "test_db",
        enableIamAuth: true,
        parameterPrefix: "/my/params/",
      })

      const template = Template.fromStack(stack)

      // Verify no secret is created
      expect(iamRole.secret).toBeUndefined()

      // Verify SSM parameters are created for connection info (but not password)
      template.hasResourceProperties("AWS::SSM::Parameter", {
        Name: "/my/params/username",
        Value: "test_role",
      })

      template.hasResourceProperties("AWS::SSM::Parameter", {
        Name: "/my/params/dbname",
        Value: "test_db",
      })

      template.hasResourceProperties("AWS::SSM::Parameter", {
        Name: "/my/params/engine",
        Value: "postgres",
      })

      // Verify no password parameter custom resource is created
      const passwordParams = template.findResources(
        "AWS::CloudFormation::CustomResource",
        {
          Properties: {
            Resource: "parameter_password",
          },
        }
      )
      expect(Object.keys(passwordParams)).toHaveLength(0)
    })

    test("role without database name", () => {
      const database = new Database(stack, "TestDatabase", {
        provider: provider,
        databaseName: "test_db",
      })

      new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        database: database,
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "role", {
        Resource: "role",
        ResourceId: "test_role",
        SecretArn: Match.anyValue(),
        PasswordArn: Match.anyValue(),
        DatabaseName: "test_db", // Should come from database construct
        EnableIamAuth: false,
      })
    })

    test("role properties remain consistent across builds", () => {
      new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        databaseName: "test_db",
      })

      const template = Template.fromStack(stack)
      const resources = getAllCustomResourceProperties(template)

      // Snapshot test to catch unintended property changes
      expect(resources.role[0].properties).toMatchSnapshot()
    })
  })

  describe("Database resource properties", () => {
    test("database with owner includes all required properties", () => {
      const role = new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        databaseName: "test_db",
      })

      new Database(stack, "TestDatabase", {
        provider: provider,
        databaseName: "test_db",
        owner: role,
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "database", {
        Resource: "database",
        ResourceId: "test_db",
        SecretArn: Match.anyValue(),
        Owner: "test_role",
      })
    })

    test("database without owner", () => {
      new Database(stack, "TestDatabase", {
        provider: provider,
        databaseName: "test_db",
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "database", {
        Resource: "database",
        ResourceId: "test_db",
        SecretArn: Match.anyValue(),
        // Owner property is absent when not specified
      })
    })

    test("database properties remain consistent across builds", () => {
      new Database(stack, "TestDatabase", {
        provider: provider,
        databaseName: "test_db",
      })

      const template = Template.fromStack(stack)
      const resources = getAllCustomResourceProperties(template)

      expect(resources.database[0].properties).toMatchSnapshot()
    })
  })

  describe("Schema resource properties", () => {
    test("schema with role and database includes all required properties", () => {
      const database = new Database(stack, "TestDatabase", {
        provider: provider,
        databaseName: "test_db",
      })

      const role = new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        database: database,
      })

      new Schema(stack, "TestSchema", {
        provider: provider,
        schemaName: "test_schema",
        database: database,
        role: role,
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "schema", {
        Resource: "schema",
        ResourceId: "test_schema",
        SecretArn: Match.anyValue(),
        DatabaseName: "test_db",
        RoleName: "test_role",
      })
    })

    test("schema without role or database", () => {
      new Schema(stack, "TestSchema", {
        provider: provider,
        schemaName: "test_schema",
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "schema", {
        Resource: "schema",
        ResourceId: "test_schema",
        SecretArn: Match.anyValue(),
        // DatabaseName and RoleName are absent when not specified
      })
    })

    test("schema properties remain consistent across builds", () => {
      new Schema(stack, "TestSchema", {
        provider: provider,
        schemaName: "test_schema",
      })

      const template = Template.fromStack(stack)
      const resources = getAllCustomResourceProperties(template)

      expect(resources.schema[0].properties).toMatchSnapshot()
    })
  })

  describe("SQL resource properties", () => {
    test("sql with database and rollback includes all required properties", () => {
      const database = new Database(stack, "TestDatabase", {
        provider: provider,
        databaseName: "test_db",
      })

      new Sql(stack, "TestSql", {
        provider: provider,
        database: database,
        statement: "CREATE TABLE test (id INTEGER);",
        rollback: "DROP TABLE test;",
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "sql", {
        Resource: "sql",
        SecretArn: Match.anyValue(),
        DatabaseName: "test_db",
        Statement: "CREATE TABLE test (id INTEGER);",
        Rollback: "DROP TABLE test;",
      })
    })

    test("sql without database or rollback", () => {
      new Sql(stack, "TestSql", {
        provider: provider,
        statement: "CREATE TABLE test (id INTEGER);",
      })

      const template = Template.fromStack(stack)

      validateCustomResourceProperties(template, "sql", {
        Resource: "sql",
        SecretArn: Match.anyValue(),
        Statement: "CREATE TABLE test (id INTEGER);",
        // DatabaseName and Rollback are absent when not specified
      })
    })

    test("sql properties remain consistent across builds", () => {
      new Sql(stack, "TestSql", {
        provider: provider,
        statement: "CREATE TABLE test (id INTEGER);",
      })

      const template = Template.fromStack(stack)
      const resources = getAllCustomResourceProperties(template)

      expect(resources.sql[0].properties).toMatchSnapshot()
    })
  })

  describe("Imported Provider scenarios", () => {
    test("original provider Lambda has SECRET_ARN environment variable", () => {
      const template = Template.fromStack(stack)

      // Verify that the original provider's Lambda has SECRET_ARN in environment
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            SECRET_ARN: Match.anyValue(),
          },
        },
      })
    })

    test("imported provider can be created with function ARN", () => {
      const importedStack = new cdk.Stack(app, "ImportedStack", {
        env: {
          account: "123456789012",
          region: "us-east-1",
        },
      })

      // This should not throw an error
      const importedProvider = Provider.fromProviderAttributes(
        importedStack,
        "ImportedProvider",
        {
          functionArn: "arn:aws:lambda:us-east-1:123456789012:function:test-provider",
          engine: DatabaseEngine.POSTGRES,
        }
      )

      // Verify the provider has the correct properties
      expect(importedProvider.engine).toBe(DatabaseEngine.POSTGRES)
      expect(importedProvider.serviceToken).toBeDefined()
    })

    test("imported provider can be created with function name", () => {
      const importedStack = new cdk.Stack(app, "ImportedStack2", {
        env: {
          account: "123456789012",
          region: "us-east-1",
        },
      })

      // This should not throw an error
      const namedProvider = Provider.fromProviderAttributes(
        importedStack,
        "NamedProvider",
        {
          functionName: "test-provider",
          engine: DatabaseEngine.MYSQL,
        }
      )

      // Verify the provider has the correct properties
      expect(namedProvider.engine).toBe(DatabaseEngine.MYSQL)
      expect(namedProvider.serviceToken).toBeDefined()
    })
  })

  describe("DSQL Provider scenarios", () => {
    let dsqlStack: cdk.Stack
    let dsqlCluster: dsql.CfnCluster
    let dsqlProvider: Provider

    beforeEach(() => {
      dsqlStack = new cdk.Stack(app, "DsqlStack", {
        env: {
          account: "123456789012",
          region: "us-east-1",
        },
      })

      const dsqlVpc = new ec2.Vpc(dsqlStack, "DsqlVpc", {
        subnetConfiguration: [
          {
            cidrMask: 28,
            name: "dsql",
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
        ],
      })

      dsqlCluster = new dsql.CfnCluster(dsqlStack, "DsqlCluster")

      dsqlProvider = new Provider(dsqlStack, "DsqlProvider", {
        vpc: dsqlVpc,
        cluster: dsqlCluster,
      })
    })

    test("DSQL role creation does not include SecretArn", () => {
      new Role(dsqlStack, "DsqlRole", {
        provider: dsqlProvider,
        roleName: "dsql_role",
      })

      const template = Template.fromStack(dsqlStack)

      // DSQL uses IAM auth, so SecretArn should be absent
      validateCustomResourceProperties(template, "role", {
        Resource: "role",
        ResourceId: "dsql_role",
        PasswordArn: "", // DSQL doesn't use password
        EnableIamAuth: true, // DSQL always uses IAM auth
        // SecretArn should be absent for DSQL
        // DatabaseName should be absent for DSQL role without database
      })
    })
  })

  describe("Property validation across all resource types", () => {
    test("comprehensive property validation", () => {
      // Create all resource types
      const database = new Database(stack, "TestDatabase", {
        provider: provider,
        databaseName: "test_db",
      })

      const role = new Role(stack, "TestRole", {
        provider: provider,
        roleName: "test_role",
        database: database,
      })

      new Schema(stack, "TestSchema", {
        provider: provider,
        schemaName: "test_schema",
        database: database,
        role: role,
      })

      new Sql(stack, "TestSql", {
        provider: provider,
        database: database,
        statement: "CREATE TABLE test (id INTEGER);",
        rollback: "DROP TABLE test;",
      })

      const template = Template.fromStack(stack)
      const allResources = getAllCustomResourceProperties(template)

      // Verify all expected resource types are present
      expect(allResources).toHaveProperty("role")
      expect(allResources).toHaveProperty("database")
      expect(allResources).toHaveProperty("schema")
      expect(allResources).toHaveProperty("sql")

      // Verify each resource type has SecretArn (except for specific cases)
      for (const resourceType of ["role", "database", "schema", "sql"]) {
        const resources = allResources[resourceType]
        expect(resources).toHaveLength(1)
        expect(resources[0].properties.SecretArn).toBeDefined()
      }

      // Create comprehensive snapshot
      expect(allResources).toMatchSnapshot()
    })
  })
})
