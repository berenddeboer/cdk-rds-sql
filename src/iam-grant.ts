import { CustomResource } from "aws-cdk-lib"
import * as dsql from "aws-cdk-lib/aws-dsql"
import { Construct } from "constructs"
import { RdsSqlResource } from "./enum"
import { Provider } from "./provider"

export interface IamGrantProps {
  /**
   * Provider.
   */
  readonly provider: Provider

  /**
   * Database role name to grant IAM access to.
   */
  readonly roleName: string

  /**
   * IAM resource ARN (role, user, or other IAM principal).
   */
  readonly resourceArn: string
}

/**
 * Helper function to determine if a cluster is a DSQL cluster
 */
function isDsqlCluster(cluster: any): cluster is dsql.CfnCluster {
  return cluster instanceof dsql.CfnCluster
}

export class IamGrant extends CustomResource {
  constructor(scope: Construct, id: string, props: IamGrantProps) {
    // IAM grants are only supported on DSQL
    if (!isDsqlCluster(props.provider.cluster)) {
      throw new Error(
        "IAM grants are only supported with DSQL clusters. Use regular database authentication for RDS/Aurora clusters."
      )
    }

    super(scope, id, {
      serviceToken: props.provider.serviceToken,
      properties: {
        Resource: RdsSqlResource.IAM_GRANT,
        ResourceId: props.roleName,
        ResourceArn: props.resourceArn,
      },
    })
    this.node.addDependency(props.provider)
  }
}
