import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from "aws-lambda"
import { handler as handlerImpl } from "./handler.js"

export async function handler(
  event:
    | CloudFormationCustomResourceCreateEvent
    | CloudFormationCustomResourceUpdateEvent
    | CloudFormationCustomResourceDeleteEvent
): Promise<any> {
  return handlerImpl(event)
}
