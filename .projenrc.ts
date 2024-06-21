import { awscdk, JsonPatch } from "projen"
import { NodePackageManager } from "projen/lib/javascript"

const tmpDirectories = ["cdk.context.json", ".idea/", "cdk.out/", ".envrc"]

const project = new awscdk.AwsCdkConstructLibrary({
  author: "Emmanuel N Kyeyune",
  authorAddress: "emmanuelnk.spam@gmail.com",
  authorEmail: "emmanuelnk.spam@gmail.com",
  name: "@emmanuelnk/cdk-rds-sql",
  description:
    "A CDK construct that allows creating roles and databases an on Aurora Serverless Postgresql cluster.",
  defaultReleaseBranch: "main",
  repositoryUrl: "https://github.com/emmanuelnk/cdk-rds-sql.git",
  projenrcTs: true,
  packageManager: NodePackageManager.NPM,
  depsUpgrade: true,
  depsUpgradeOptions: {
    workflow: false,
  },
  constructsVersion: "10.3.0",
  cdkVersion: "2.147.0",
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
  deps: ["exponential-backoff", "@types/aws-lambda"],
  bundledDeps: [
    "@types/aws-lambda",
    "@aws-sdk/client-secrets-manager",
    "pg",
    "node-pg-format",
    "ms",
    "exponential-backoff",
    "source-map-support",
  ],
  devDeps: ["@types/ms", "@types/pg", "testcontainers", "esbuild"],
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
// const buildWorkflow = project.tryFindObjectFile(".github/workflows/build.yml")
// if (buildWorkflow && buildWorkflow.patch) {
//   buildWorkflow.patch(JsonPatch.add("/jobs/build/container/options", "--group-add sudo"))
// }
// const releaseWorkflow = project.tryFindObjectFile(".github/workflows/release.yml")
// if (releaseWorkflow && releaseWorkflow.patch) {
//   releaseWorkflow.patch(
//     JsonPatch.add("/jobs/release/container/options", "--group-add sudo")
//   )
// }
project.synth()
