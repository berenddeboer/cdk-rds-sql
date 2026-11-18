import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import { AddTagsToResourceCommand, SSMClient } from "@aws-sdk/client-ssm"
import { RdsSqlResource } from "../src/enum"
import { PostgresqlEngine } from "./engine.postgresql"
import { handler } from "./handler"
import { createRequest } from "./util"

const masterArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:master"
const passwordArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:role"
const parameterName = "/test/password"
const roleSecretRead = jest.fn<Promise<{ SecretString: string }>, []>()

function accessDenied() {
  return Object.assign(new Error("Cannot read role secret"), { name: "AccessDeniedException" })
}

beforeEach(() => {
  jest.useFakeTimers()
  roleSecretRead.mockReset()
  jest.spyOn(SecretsManagerClient.prototype, "send").mockImplementation(async (command) => {
    if (command instanceof GetSecretValueCommand) {
      switch (command.input.SecretId) {
        case masterArn:
          return { SecretString: JSON.stringify({ engine: "postgresql" }) }
        case passwordArn:
          return roleSecretRead()
      }
    }
    throw new Error("Unexpected Secrets Manager command")
  })
  jest.spyOn(PostgresqlEngine.prototype, "executeSQL").mockResolvedValue(undefined)
  jest.spyOn(SSMClient.prototype, "send").mockImplementation(async () => ({}))
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe.each([RdsSqlResource.ROLE, RdsSqlResource.PARAMETER_PASSWORD])("%s", (resource) => {
  function create(timeoutMs?: number) {
    const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs
    return handler(
      createRequest(resource, "testrole", {
        SecretArn: masterArn,
        PasswordArn: passwordArn,
        ParameterName: parameterName,
      }),
      deadline === undefined ? undefined : { getRemainingTimeInMillis: () => deadline - Date.now() }
    )
  }

  test("uses the password after a transient access denial", async () => {
    roleSecretRead
      .mockRejectedValueOnce(accessDenied())
      .mockResolvedValueOnce({ SecretString: JSON.stringify({ password: "role-password" }) })

    const result = expect(create(15_000)).resolves.toEqual({ PhysicalResourceId: "testrole" })
    await jest.runAllTimersAsync()
    await result

    expect(roleSecretRead).toHaveBeenCalledTimes(2)
    if (resource === RdsSqlResource.ROLE) {
      expect(PostgresqlEngine.prototype.executeSQL).toHaveBeenCalledWith(
        expect.arrayContaining(["create role testrole with login password 'role-password'"]),
        expect.anything()
      )
    } else {
      expect(SSMClient.prototype.send).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          input: expect.objectContaining({
            Name: parameterName,
            Value: "role-password",
            Type: "SecureString",
          }),
        })
      )
      expect(SSMClient.prototype.send).toHaveBeenNthCalledWith(
        2,
        expect.any(AddTagsToResourceCommand)
      )
    }
  })

  test("rethrows the last denial after a bounded number of attempts", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99999)
    const start = Date.now()
    const lastDenial = accessDenied()
    roleSecretRead.mockImplementation(async () => {
      throw roleSecretRead.mock.calls.length === 10 ? lastDenial : accessDenied()
    })

    const result = expect(create()).rejects.toBe(lastDenial)
    await jest.runAllTimersAsync()
    await result

    expect(roleSecretRead).toHaveBeenCalledTimes(10)
    expect(Date.now() - start).toBeLessThanOrEqual(32_500)
    expect(PostgresqlEngine.prototype.executeSQL).not.toHaveBeenCalled()
    expect(SSMClient.prototype.send).not.toHaveBeenCalled()
  })

  test("does not retry a missing secret", async () => {
    const notFound = Object.assign(new Error("Role secret not found"), {
      name: "ResourceNotFoundException",
    })
    roleSecretRead.mockRejectedValue(notFound)

    const result = expect(create()).rejects.toBe(notFound)
    await jest.runAllTimersAsync()
    await result

    expect(roleSecretRead).toHaveBeenCalledTimes(1)
    expect(PostgresqlEngine.prototype.executeSQL).not.toHaveBeenCalled()
    expect(SSMClient.prototype.send).not.toHaveBeenCalled()
  })

  test("rethrows the last denial when the next retry would run too close to the Lambda deadline", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99999)
    const start = Date.now()
    const lastDenial = accessDenied()
    roleSecretRead
      .mockRejectedValueOnce(accessDenied())
      .mockRejectedValueOnce(accessDenied())
      .mockRejectedValueOnce(accessDenied())
      .mockRejectedValue(lastDenial)

    const result = expect(create(15_000)).rejects.toBe(lastDenial)
    await jest.runAllTimersAsync()
    await result

    expect(roleSecretRead).toHaveBeenCalledTimes(4)
    expect(Date.now() - start).toBe(3500)
    expect(PostgresqlEngine.prototype.executeSQL).not.toHaveBeenCalled()
    expect(SSMClient.prototype.send).not.toHaveBeenCalled()
  })
})
