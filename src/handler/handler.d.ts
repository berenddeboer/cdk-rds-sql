import { CloudFormationCustomResourceEvent } from "aws-lambda"
import { CdkCustomResourceResponse } from "aws-lambda"

export declare function handler(
  event: CloudFormationCustomResourceEvent
): Promise<CdkCustomResourceResponse>
