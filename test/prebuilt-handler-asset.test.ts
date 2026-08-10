import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as cdk from "aws-cdk-lib"
import { Template } from "aws-cdk-lib/assertions"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as rds from "aws-cdk-lib/aws-rds"
import { Provider } from "../src/provider"

/**
 * Regression for https://github.com/berenddeboer/cdk-rds-sql/issues/84:
 * the provider must use a prebuilt handler asset (no synth-time NodejsFunction /
 * pnpm-lock.yaml bundling) that already contains the RDS CA bundle.
 */
test("provider lambda uses prebuilt handler asset with CA bundle", () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-rds-sql-asset-"))
  const app = new cdk.App({ outdir })
  const stack = new cdk.Stack(app, "TestStack", {
    env: {
      account: "123456789",
      region: "us-east-1",
    },
  })

  const vpc = new ec2.Vpc(stack, "Vpc", {
    subnetConfiguration: [
      {
        cidrMask: 28,
        name: "rds",
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    ],
  })

  const cluster = new rds.DatabaseCluster(stack, "Cluster", {
    engine: rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_15_10,
    }),
    writer: rds.ClusterInstance.serverlessV2("writer"),
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  })

  new Provider(stack, "Provider", {
    vpc,
    cluster,
    secret: cluster.secret!,
  })

  const template = Template.fromStack(stack)
  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.handler",
    Runtime: "nodejs22.x",
  })

  // Force asset staging so we can inspect the packaged handler directory.
  app.synth()

  let foundHandlerAsset = false
  for (const entry of fs.readdirSync(outdir)) {
    const assetPath = path.join(outdir, entry)
    if (!fs.statSync(assetPath).isDirectory()) {
      continue
    }
    const indexJs = path.join(assetPath, "index.js")
    const caBundle = path.join(assetPath, "global-bundle.pem")
    if (fs.existsSync(indexJs) && fs.existsSync(caBundle)) {
      foundHandlerAsset = true
      // Prebuilt bundle of the handler + deps, not a thin re-export wrapper.
      expect(fs.statSync(indexJs).size).toBeGreaterThan(50_000)
      expect(fs.statSync(caBundle).size).toBeGreaterThan(1_000)
      // Source-tree marker must not be packaged into the Lambda asset.
      expect(fs.existsSync(path.join(assetPath, ".gitkeep"))).toBe(false)
      // Must not ship package-manager lockfiles that force consumer pnpm bundling.
      expect(fs.existsSync(path.join(assetPath, "pnpm-lock.yaml"))).toBe(false)
      expect(fs.existsSync(path.join(assetPath, "pnpm-workspace.yaml"))).toBe(false)
      break
    }
  }

  expect(foundHandlerAsset).toBe(true)

  fs.rmSync(outdir, { recursive: true, force: true })
})

test("prebuilt handler files exist next to compiled provider", () => {
  // When tests run via projen, build:handler has already populated src/handler.
  // When the package is published, the same files live under lib/handler.
  const candidates = [
    path.join(__dirname, "..", "src", "handler"),
    path.join(__dirname, "..", "lib", "handler"),
  ]

  const handlerDir = candidates.find(
    (dir) =>
      fs.existsSync(path.join(dir, "index.js")) &&
      fs.existsSync(path.join(dir, "global-bundle.pem"))
  )

  expect(handlerDir).toBeDefined()
})
