import { CloudFormationCustomResourceEvent } from "aws-lambda"
import { CustomResourceResponse } from "aws-lambda"

export declare function handler(
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse>
