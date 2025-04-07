import { awscdk } from "projen"
import { NodePackageManager } from "projen/lib/javascript"

const tmpDirectories = [
  "cdk.context.json",
  ".idea/",
  "cdk.out/",
  ".envrc",
  ".env",
  "CONVENTIONS.md",
  "src/handler/handler.js",
  "lambda/handler.js",
  "*~",
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
  minNodeVersion: "22.14",
  jestOptions: {
    jestVersion: "~29",
    jestConfig: {
      testMatch: ["<rootDir>/@(src|test|lambda)/**/*(*.)@(spec|test).ts"],
      maxConcurrency: 2,
      maxWorkers: 2,
    },
  },
  typescriptVersion: "~5.8",
  constructsVersion: "10.3.0",
  cdkVersion: "2.171.1",
  jsiiVersion: "~5.7.0",
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
  deps: ["@types/aws-lambda"],
  bundledDeps: ["@types/aws-lambda"],
  devDeps: [
    "@aws-sdk/client-secrets-manager",
    "@types/pg@^8.11.11",
    "esbuild",
    "exponential-backoff",
    "mysql2",
    "node-pg-format",
    "pg@^8.13.3",
    "source-map-support",
    "testcontainers@10",
  ],
  keywords: ["aws", "aws-cdk", "rds", "aurora"],
  minMajorVersion: 1,
})
if (project.eslint) {
  project.eslint.addRules({
    semi: ["off"],
    quotes: ["error", "double"],
  })
}

project.addTask("integ:deploy:postgresql:serverless", {
  description: "Deploy the Aurora Serverless V2 integration test stack",
  exec: "npx cdk deploy TestRdsSqlServerlessV2Stack --require-approval never",
})

project.addTask("integ:deploy:mysql:serverless", {
  description: "Deploy the Aurora Serverless V2 integration test stack",
  exec: "npx cdk deploy TestRdsSqlServerlessV2Stack --context engine=mysql --require-approval never",
})

project.addTask("integ:destroy:serverless", {
  description: "Destroy the Aurora Serverless V2 integration test stack",
  exec: "npx cdk destroy TestRdsSqlServerlessV2Stack --force",
})

// Add build tasks for transpiling the Lambda handler
project.addTask("build:handler", {
  description: "Transpile the Lambda handler to JavaScript",
  exec: "esbuild lambda/handler.ts --bundle --platform=node --target=node20 --external:aws-sdk --external:@aws-sdk/* --outfile=src/handler/handler.js",
})

project.addTask("copy:handler", {
  description: "Copy transpiled handler into lib",
  exec: "cp src/handler/handler.js lib/handler/handler.js",
})

// Hook these tasks into the build process
project.tasks.tryFind("pre-compile")?.spawn(project.tasks.tryFind("build:handler")!)
project.tasks.tryFind("compile")?.spawn(project.tasks.tryFind("copy:handler")!)

project.synth()
