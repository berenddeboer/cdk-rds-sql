import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import { MysqlEngine } from "./engine.mysql"
import { PostgresqlEngine } from "./engine.postgresql"
import { handler } from "./handler"
import { createRequest, updateRequest } from "./util"

// Mock the secrets manager client
jest.mock("@aws-sdk/client-secrets-manager")
const SecretsManagerClientMock = SecretsManagerClient as jest.MockedClass<
  typeof SecretsManagerClient
>

// Mock the database engines
jest.mock("./engine.mysql")
jest.mock("./engine.postgresql")

const MockedMysqlEngine = MysqlEngine as jest.MockedClass<typeof MysqlEngine>
const MockedPostgresqlEngine = PostgresqlEngine as jest.MockedClass<typeof PostgresqlEngine>

describe("Handler CloudFormation Property Conversion", () => {
  let mockMysqlEngine: jest.Mocked<MysqlEngine>
  let mockPostgresqlEngine: jest.Mocked<PostgresqlEngine>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock the engine instances
    mockMysqlEngine = {
      createRole: jest.fn(),
      updateRole: jest.fn(),
      executeSQL: jest.fn(),
    } as any

    mockPostgresqlEngine = {
      createRole: jest.fn(),
      executeSQL: jest.fn(),
    } as any

    MockedMysqlEngine.mockImplementation(() => mockMysqlEngine)
    MockedPostgresqlEngine.mockImplementation(() => mockPostgresqlEngine)

    // Mock secrets manager to return MySQL engine
    SecretsManagerClientMock.prototype.send.mockImplementation(() => {
      return Promise.resolve({
        SecretString: JSON.stringify({
          host: "localhost",
          port: 3306,
          username: "root",
          password: "password",
          dbname: "test",
          engine: "mysql",
        }),
      })
    })
  })

  describe("EnableIamAuth property conversion", () => {
    it("should convert string 'false' to boolean false", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      // Create a request with EnableIamAuth as string 'false' (simulating CloudFormation)
      const request = createRequest("role", "testuser", {
        EnableIamAuth: "false",
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      })

      await handler(request)

      // Verify that createRole was called with boolean false, not string 'false'
      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          EnableIamAuth: false, // Should be converted to boolean false
          PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
        })
      )
    })

    it("should convert string 'true' to boolean true", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      // Create a request with EnableIamAuth as string 'true' (simulating CloudFormation)
      const request = createRequest("role", "testuser", {
        EnableIamAuth: "true", // CloudFormation passes boolean as string
      })

      await handler(request)

      // Verify that createRole was called with boolean true, not string 'true'
      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          EnableIamAuth: true, // Should be converted to boolean true
        })
      )
    })

    it("should handle number 0 correctly", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      // Create a request with EnableIamAuth as actual boolean false
      const request = createRequest("role", "testuser", {
        EnableIamAuth: "0",
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      })

      await handler(request)

      // Verify that createRole was called with boolean false
      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          EnableIamAuth: false,
          PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
        })
      )
    })

    it("should handle number 1 correctly", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      // Create a request with EnableIamAuth as actual boolean true
      const request = createRequest("role", "testuser", {
        EnableIamAuth: "1",
      })

      await handler(request)

      // Verify that createRole was called with boolean true
      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          EnableIamAuth: true,
        })
      )
    })

    it("should handle undefined EnableIamAuth correctly", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      // Create a request without EnableIamAuth property
      const request = createRequest("role", "testuser", {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      })

      await handler(request)

      // Verify that createRole was called without EnableIamAuth
      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
          EnableIamAuth: false,
        })
      )
    })
  })

  describe("MaxUserConnections property conversion", () => {
    it("should convert a numeric string to a number", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      const request = createRequest("role", "testuser", {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
        MaxUserConnections: "5",
      })

      await handler(request)

      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          MaxUserConnections: 5,
        })
      )
    })

    it("should accept a numeric MaxUserConnections value", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      const request = createRequest("role", "testuser", {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
        MaxUserConnections: 0,
      })

      await handler(request)

      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          MaxUserConnections: 0,
        })
      )
    })

    it("should leave MaxUserConnections unset when omitted", async () => {
      mockMysqlEngine.createRole.mockResolvedValue(["CREATE USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      const request = createRequest("role", "testuser", {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
      })

      await handler(request)

      expect(mockMysqlEngine.createRole).toHaveBeenCalledWith(
        "testuser",
        expect.objectContaining({
          MaxUserConnections: undefined,
        })
      )
    })

    it("should convert old and new limits on update", async () => {
      mockMysqlEngine.updateRole.mockResolvedValue(["ALTER USER test"])
      mockMysqlEngine.executeSQL.mockResolvedValue({})

      const request = updateRequest("role", "testuser", "testuser", {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
        MaxUserConnections: "3",
      })
      request.OldResourceProperties = {
        ...request.OldResourceProperties,
        MaxUserConnections: "10",
      }

      await handler(request)

      expect(mockMysqlEngine.updateRole).toHaveBeenCalledWith(
        "testuser",
        "testuser",
        expect.objectContaining({ MaxUserConnections: 3 }),
        expect.objectContaining({ MaxUserConnections: 10 })
      )
    })

    it("should reject a non-integer MaxUserConnections value", async () => {
      const request = createRequest("role", "testuser", {
        PasswordArn: "arn:aws:secretsmanager:us-east-1:123456789:secret:dummy",
        MaxUserConnections: "5; DROP USER 'root'",
      })

      await expect(handler(request)).rejects.toThrow("non-negative integer")
      expect(mockMysqlEngine.createRole).not.toHaveBeenCalled()
    })
  })
})
