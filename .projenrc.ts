import { awscdk, JsonPatch } from "projen"

const tmpDirectories = ["cdk.context.json", ".idea/", "cdk.out/", ".envrc"]

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
  constructsVersion: "10.1.104",
  cdkVersion: "2.41.0",
  disableTsconfig: true,
  tsconfigDev: {
    compilerOptions: {
      esModuleInterop: true,
    },
  },
  eslint: true,
  eslintOptions: {
    dirs: ["src"],
    prettier: true,
  },
  gitignore: tmpDirectories,
  npmignore: tmpDirectories,
  deps: [],
  bundledDeps: [
    "aws-lambda",
    "@aws-sdk/client-secrets-manager",
    "pg",
    "node-pg-format",
    "ms",
    "source-map-support",
  ],
  devDeps: ["@types/ms", "@types/pg", "@types/aws-lambda", "testcontainers", "esbuild"],
  workflowBootstrapSteps: [
    {
      name: "Change permissions on /var/run/docker.sock",
      run: "sudo chown superchain /var/run/docker.sock",
    },
  ],
})
project.addGitIgnore("*~")
if (project.eslint) {
  project.eslint.addRules({
    semi: ["off"],
    quotes: ["error", "double"],
  })
}
const buildWorkflow = project.tryFindObjectFile(".github/workflows/build.yml")
if (buildWorkflow && buildWorkflow.patch) {
  buildWorkflow.patch(JsonPatch.add("/jobs/build/container/options", "--group-add sudo"))
}
project.synth()
