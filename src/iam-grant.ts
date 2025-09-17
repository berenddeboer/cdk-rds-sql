import { CustomResource } from "aws-cdk-lib"
import { Construct } from "constructs"
import { RdsSqlResource } from "./enum"
import { IProvider, DatabaseEngine } from "./provider"
import * as crypto from "crypto"

export interface IamGrantProps {
  /**
   * Provider.
   */
  readonly provider: IProvider

  /**
   * Database role name to grant IAM access to.
   */
  readonly roleName: string

  /**
   * IAM resource ARN (role, user, or other IAM principal).
   */
  readonly resourceArn: string
}

export class IamGrant extends CustomResource {
  private static createUniqueResourceId(roleName: string, resourceArn: string): string {
    const hash = crypto
      .createHash("sha256")
      .update(resourceArn)
      .digest("hex")
      .substring(0, 8)
    return `${roleName}:${hash}`
  }

  constructor(scope: Construct, id: string, props: IamGrantProps) {
    // IAM grants are only supported on DSQL
    if (props.provider.engine !== DatabaseEngine.DSQL) {
      throw new Error(
        "IAM grants are only supported with DSQL clusters. Use regular database authentication for RDS/Aurora clusters."
      )
    }

    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      resourceType: "Custom::DsqlIamGrant",
      properties: {
        Resource: RdsSqlResource.IAM_GRANT,
        ResourceId: IamGrant.createUniqueResourceId(props.roleName, props.resourceArn),
        RoleName: props.roleName,
        ResourceArn: props.resourceArn,
      },
    })
    this.node.addDependency(props.provider)
  }
}
