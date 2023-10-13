import * as ec2 from "aws-cdk-lib/aws-ec2"
import { Construct } from "constructs"

export class Vpc extends Construct {
  vpc: ec2.IVpc

  constructor(scope: Construct, id: string) {
    super(scope, id)

    // Use an existing vpc if passed in, else create one
    const vpc_id = this.node.tryGetContext("vpc-id")
    if (vpc_id) {
      this.vpc = ec2.Vpc.fromLookup(this, "Vpc", {
        vpcId: vpc_id,
      })
    } else {
      this.vpc = new ec2.Vpc(this, "Vpc", {
        vpcName: "cdk-rds-sql",
        ipAddresses: ec2.IpAddresses.cidr("192.168.249.0/24"),
        maxAzs: 2,
        subnetConfiguration: [
          {
            cidrMask: 28,
            name: "rds",
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
        ],
      })
    }
  }
}
