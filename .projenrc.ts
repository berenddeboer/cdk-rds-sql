import { awscdk, JsonPatch } from "projen"
import { NodePackageManager } from "projen/lib/javascript"

const tmpDirectories = [
  "cdk.context.json",
  ".idea/",
  "cdk.out/",
  ".envrc",
  ".env",
  "CONVENTIONS.md",
]

const project = new awscdk.AwsCdkConstructLibrary({
  author: "Berend de Boer",
  authorAddress: "berend@pobox.com",
  authorEmail: "berend@pobox.com",
  name: "cdk-rds-sql",
  description:
    "A CDK construct that allows creating roles and databases an on Aurora Serverless Postgresql cluster.",
  defaultReleaseBranch: "main",
  repositoryUrl: "https://github.com/berenddeboer/cdk-rds-sql.git",
  projenrcTs: true,
  packageManager: NodePackageManager.NPM,
  depsUpgrade: true,
  depsUpgradeOptions: {
    workflow: false,
  },
  constructsVersion: "10.3.0",
  cdkVersion: "2.144.0",
  disableTsconfig: true,
  tsconfigDev: {
    compilerOptions: {
      esModuleInterop: true,
      noUnusedLocals: false,
    },
  },
  eslint: true,
  eslintOptions: {
    dirs: ["src"],
    prettier: true,
  },
  gitignore: tmpDirectories,
  npmignore: tmpDirectories,
  docgen: false,
  workflowNodeVersion: "20.x",
  deps: ["exponential-backoff", "@types/aws-lambda"],
  bundledDeps: [
    "@types/aws-lambda",
    "@aws-sdk/client-secrets-manager",
    "pg@^8.13.3",
    "node-pg-format",
    "ms",
    "exponential-backoff",
    "source-map-support",
  ],
  devDeps: ["@types/ms", "@types/pg@^8.11.11", "testcontainers", "esbuild"],
  keywords: ["aws", "aws-cdk", "rds", "aurora"],
  minMajorVersion: 1,
})
project.addGitIgnore("*~")
if (project.eslint) {
  project.eslint.addRules({
    semi: ["off"],
    quotes: ["error", "double"],
  })
}

project.addTask("integ:deploy:serverless", {
  description: "Deploy the Aurora Serverless V2 integration test stack",
  exec: "npx cdk deploy TestRdsSqlServerlessV2Stack --require-approval never",
})

project.addTask("integ:destroy:serverless", {
  description: "Destroy the Aurora Serverless V2 integration test stack",
  exec: "npx cdk destroy TestRdsSqlServerlessV2Stack --force",
})

project.synth()
