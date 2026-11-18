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
const responseMargin = 250

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
  let lastDenial: unknown
  let retryTimedOut = false

  async function read() {
    // Keep the first request and callers without a Lambda context unchanged.
    if (!getRemainingTimeInMillis || !lastDenial) return client.send(command)

    const requestBudget = Math.min(retryRequestBudget, getRemainingTimeInMillis() - responseMargin)
    if (requestBudget <= 0) {
      retryTimedOut = true
      throw lastDenial
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), requestBudget)
    try {
      return await client.send(command, { abortSignal: controller.signal })
    } catch (error) {
      if (!controller.signal.aborted) throw error
      retryTimedOut = true
      throw lastDenial
    } finally {
      clearTimeout(timeout)
    }
  }

  // Newly granted permissions can take time to propagate even after CloudFormation
  // finishes updating the IAM policy. Bound the retry count and delay.
  return backOff(read, {
    numOfAttempts: 10,
    startingDelay,
    maxDelay,
    timeMultiple,
    delayFirstAttempt: false,
    jitter: "full",
    retry: (error: unknown, failedAttempts: number) => {
      if (retryTimedOut || !isAccessDenied(error)) return false
      if (!getRemainingTimeInMillis) return true

      // Check the worst-case delay before jitter and leave time for the next
      // request. Match exponential-backoff's skipped first delay: after one
      // failure the retry waits startingDelay (exponent 0) before jitter.
      // Returning false preserves the last denial.
      const nextDelay = Math.min(maxDelay, startingDelay * timeMultiple ** (failedAttempts - 1))
      if (getRemainingTimeInMillis() <= nextDelay + retryRequestBudget + responseMargin) {
        return false
      }
      lastDenial = error
      return true
    },
  })
}
