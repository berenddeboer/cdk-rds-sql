import { YamlFile, awscdk, github } from "projen"
import { NodePackageManager } from "projen/lib/javascript"

const tmpDirectories = [
  "cdk.context.json",
  ".idea/",
  "cdk.out/",
  ".envrc",
  ".env",
  "CONVENTIONS.md",
  // Prebuilt Lambda handler assets (produced by build:handler)
  "src/handler/index.js",
  "src/handler/global-bundle.pem",
  "*~",
  ".claude/hooks/.edited",
]

const project = new awscdk.AwsCdkConstructLibrary({
  author: "Berend de Boer",
  authorAddress: "berend@pobox.com",
  authorEmail: "berend@pobox.com",
  name: "cdk-rds-sql",
  description:
    "A CDK construct that allows creating roles or users and databases on Aurora Serverless PostgreSQL or MySQL/MariaDB clusters, as well as AWS DSQL clusters.",
  defaultReleaseBranch: "main",
  repositoryUrl: "https://github.com/berenddeboer/cdk-rds-sql.git",
  projenrcTs: true,
  packageManager: NodePackageManager.PNPM,
  pnpmVersion: "10.32.1",
  buildWorkflowOptions: {
    // Keep the PR build mutable so projen self-mutation can surface generated-file drift.
    mutableBuild: true,
  },
  depsUpgrade: true,
  depsUpgradeOptions: {
    cooldown: 3,
    workflow: false,
  },
  minNodeVersion: "22.14",
  githubOptions: {
    pullRequestLintOptions: {
      semanticTitleOptions: {
        types: ["feat", "fix", "chore", "test", "vendor"],
      },
    },
  },
  jestOptions: {
    jestVersion: "~30",
    jestConfig: {
      testMatch: ["<rootDir>/@(src|test|lambda)/**/*(*.)@(spec|test).ts"],
      testPathIgnorePatterns: ["/node_modules/", "/cdk.out/", "/.github/", "/dist/"],
      maxConcurrency: 4,
      maxWorkers: "75%",
    },
  },
  typescriptVersion: "~5.9",
  constructsVersion: "10.4.2",
  cdkVersion: "2.214.0",
  jsiiVersion: "~5.9.0",
  tsconfigDev: {
    compilerOptions: {
      esModuleInterop: true,
      noUnusedLocals: true,
      target: "es2022",
      noImplicitOverride: true,
      noUncheckedIndexedAccess: true,
    },
    include: ["lambda/**/*.ts"],
  },
  eslint: true,
  eslintOptions: {
    dirs: ["src", "lambda"],
    prettier: true,
  },
  gitignore: tmpDirectories,
  // Do not ship lock/workspace files (they forced consumers onto pnpm during synth).
  // Include the RDS CA bundle from the prebuilt handler asset directory.
  npmignore: [
    ...tmpDirectories,
    "/lambda/",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "!/lib/**/*.pem",
  ],
  docgen: false,
  workflowNodeVersion: "24.x",
  deps: ["@types/aws-lambda"],
  bundledDeps: ["@types/aws-lambda"],
  devDeps: [
    "@aws-sdk/client-secrets-manager",
    "@aws-sdk/client-ssm",
    "@aws-sdk/dsql-signer",
    "@types/pg@^8.11.11",
    "esbuild",
    "exponential-backoff",
    "mysql2",
    "node-pg-format",
    "pg@^8.13.3",
    "source-map-support",
    "testcontainers@11",
  ],
  keywords: ["aws", "aws-cdk", "rds", "aurora", "postgres", "mysql", "dsql"],
  minMajorVersion: 1,
  publishToPypi: {
    distName: "cdk-rds-sql",
    module: "cdk_rds_sql",
    trustedPublishing: true,
  },
})
if (project.eslint) {
  project.eslint.addRules({
    semi: ["off"],
    quotes: ["error", "double"],
  })

  // Add an override for lambda directory to disable import/no-extraneous-dependencies
  project.eslint.addOverride({
    files: ["lambda/*.ts"],
    rules: {
      "import/no-extraneous-dependencies": "off",
    },
  })
}

project.addTask("integ:deploy:postgresql:serverless", {
  description: "Deploy the Aurora Serverless V2 integration test stack",
  exec: "pnpm exec cdk deploy TestRdsSqlServerlessV2Stack --require-approval never",
})

project.addTask("integ:deploy:mysql:serverless", {
  description: "Deploy the Aurora Serverless V2 integration test stack",
  exec: "pnpm exec cdk deploy TestRdsSqlServerlessV2Stack --context engine=mysql --require-approval never",
})

project.addTask("integ:destroy:serverless", {
  description: "Destroy the Aurora Serverless V2 integration test stack",
  exec: "pnpm exec cdk destroy TestRdsSqlServerlessV2Stack --force",
})

project.addTask("integ:deploy:dsql", {
  description: "Deploy the DSQL integration test stack",
  exec: "pnpm exec cdk deploy TestRdsSqlDsqlStack --require-approval never",
})

project.addTask("integ:destroy:dsql", {
  description: "Destroy the DSQL integration test stack",
  exec: "pnpm exec cdk destroy TestRdsSqlDsqlStack --force",
})

// Build a self-contained Lambda asset (bundle + RDS CA) so consumers never run
// NodejsFunction/esbuild against this package's lockfile at synth time.
const buildHandler = project.addTask("build:handler", {
  description: "Bundle the Lambda handler and download the RDS CA certificate",
})
buildHandler.exec("mkdir -p src/handler")
buildHandler.exec(
  "esbuild lambda/handler.ts --bundle --platform=node --target=node22 --external:aws-sdk --external:@aws-sdk/* --outfile=src/handler/index.js"
)
buildHandler.exec(
  "curl --silent -fL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o src/handler/global-bundle.pem"
)

const copyHandler = project.addTask("copy:handler", {
  description: "Copy prebuilt handler asset into lib for packaging",
})
copyHandler.exec("mkdir -p lib/handler")
copyHandler.exec("cp src/handler/index.js src/handler/global-bundle.pem lib/handler/")

project.addTask("typecheck", {
  description: "Typecheck typescript",
  exec: "pnpm exec tsc --project tsconfig.dev.json --noEmit",
})

// Hook these tasks into the build process
project.tasks.tryFind("pre-compile")?.spawn(buildHandler)
project.tasks.tryFind("compile")?.spawn(copyHandler)
// Unit tests synthesize stacks that load the prebuilt handler asset.
project.tasks.tryFind("test")?.prependSpawn(buildHandler)

// Override release workflow to remove NPM_TOKEN and add NPM_TRUSTED_PUBLISHER
const releaseNpmPublishStepIndex = 10
const releaseWorkflow = project.github?.tryFindWorkflow("release")
if (releaseWorkflow?.file) {
  // The generated pnpm setup step shifts the npm publish step to index 10.
  // If projen changes the step order, this override path needs updating.
  releaseWorkflow.file.addOverride(
    `jobs.release_npm.steps.${releaseNpmPublishStepIndex}.env`,
    {
      NPM_TRUSTED_PUBLISHER: "true",
      NPM_TOKEN: undefined,
    }
  )
}

const dependabot = project.github?.addDependabot()
if (dependabot) {
  dependabot.config.updates = [
    {
      "package-ecosystem": "github-actions",
      directory: "/",
      schedule: {
        interval: github.DependabotScheduleInterval.WEEKLY,
      },
      allow: [{ "dependency-name": "anthropics/claude-code-action" }],
    },
  ]
}

// pnpm 10.15+ / 11 require explicit approval for dependency build scripts.
// Without this, `pnpm exec` (used by CDK NodejsFunction local bundling in tests)
// fails with ERR_PNPM_IGNORED_BUILDS.
new YamlFile(project, "pnpm-workspace.yaml", {
  obj: {
    nodeLinker: "hoisted",
    allowBuilds: {
      "cpu-features": true,
      esbuild: true,
      protobufjs: true,
      ssh2: true,
      "unrs-resolver": true,
    },
  },
})

project.synth()
