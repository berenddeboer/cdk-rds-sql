import {
  GetSecretValueCommand,
  type GetSecretValueCommandOutput,
  type SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
import { backOff } from "exponential-backoff"

const startingDelay = 500
const maxDelay = 5000
const timeMultiple = 2
const retryRequestBudget = 10_000

function isAccessDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AccessDeniedException"
  )
}

export function readRolePasswordSecret(
  client: SecretsManagerClient,
  arn: string,
  getRemainingTimeInMillis?: () => number
): Promise<GetSecretValueCommandOutput> {
  const command = new GetSecretValueCommand({ SecretId: arn })
  // Newly granted permissions can take time to propagate even after CloudFormation
  // finishes updating the IAM policy. Bound the retry count and delay.
  return backOff(() => client.send(command), {
    numOfAttempts: 10,
    startingDelay,
    maxDelay,
    timeMultiple,
    jitter: "full",
    retry: (error: unknown, failedAttempts: number) => {
      if (!isAccessDenied(error)) return false
      if (!getRemainingTimeInMillis) return true

      // Check the worst-case delay before jitter and leave time for the next
      // request. Returning false preserves the last denial.
      const nextDelay = Math.min(maxDelay, startingDelay * timeMultiple ** (failedAttempts - 1))
      return getRemainingTimeInMillis() > nextDelay + retryRequestBudget
    },
  })
}
