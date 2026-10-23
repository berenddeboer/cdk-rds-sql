import { awscdk, Component, github } from "projen"
import {
  Biome,
  NodePackageManager,
  PnpmWorkspaceYamlSchemaNodeLinker,
  TypeScriptModuleResolution,
  UpdateSnapshot,
} from "projen/lib/javascript"

const tmpDirectories = [
  "cdk.context.json",
  ".idea/",
  "cdk.out/",
  ".envrc",
  ".env",
  "CONVENTIONS.md",
  "hk.local.pkl",
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
  pnpmVersion: "12.14.0",
  pnpmOptions: {
    workspaceYamlOptions: {
      nodeLinker: PnpmWorkspaceYamlSchemaNodeLinker.HOISTED,
      allowBuilds: {
        "@parcel/watcher": true,
        "cpu-features": true,
        esbuild: true,
        protobufjs: true,
        ssh2: true,
        "unrs-resolver": true,
      },
    },
  },
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
    updateSnapshot: UpdateSnapshot.NEVER,
    jestConfig: {
      testMatch: ["<rootDir>/@(src|test|lambda)/**/*(*.)@(spec|test).ts"],
      testPathIgnorePatterns: ["/node_modules/", "/cdk.out/", "/.github/", "/dist/"],
      maxConcurrency: 4,
      maxWorkers: "75%",
    },
  },
  typescriptVersion: "~6.0",
  constructsVersion: "10.5.0",
  cdkVersion: "2.273.0",
  jsiiVersion: "~6.0.0",
  tsconfigDevFile: "tsconfig.dev.json",
  tsconfigDev: {
    compilerOptions: {
      esModuleInterop: true,
      noUnusedLocals: true,
      target: "es2022",
      module: "node16",
      moduleResolution: TypeScriptModuleResolution.NODE16,
      noImplicitOverride: true,
      noUncheckedIndexedAccess: true,
    },
    include: ["lambda/**/*.ts"],
  },
  eslint: false,
  prettier: false,
  biome: true,
  biomeOptions: {
    version: "^2.5",
  },
  gitignore: tmpDirectories,
  // Do not ship lock/workspace files (they forced consumers onto pnpm during synth).
  // Include the RDS CA bundle from the prebuilt handler asset directory.
  npmIgnoreOptions: {
    ignorePatterns: [
      ...tmpDirectories,
      "/lambda/",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "hk.pkl",
      "mise.toml",
      "!/lib/**/*.pem",
    ],
  },
  docgen: false,
  workflowNodeVersion: "24.x",
  deps: ["@types/aws-lambda"],
  bundledDeps: ["@types/aws-lambda"],
  devDeps: [
    "@types/node@^24",
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
    "testcontainers@^12.2.1",
  ],
  keywords: ["aws", "aws-cdk", "rds", "aurora", "postgres", "mysql", "dsql"],
  minMajorVersion: 1,
  publishToNuget: {
    dotNetNamespace: "BerenddeBoer.CdkRdsSql",
    packageId: "BerenddeBoer.CdkRdsSql",
    trustedPublishing: true,
  },
  publishToPypi: {
    distName: "cdk-rds-sql",
    module: "cdk_rds_sql",
    trustedPublishing: true,
  },
})
const biome = Biome.of(project)
if (!biome) {
  throw new Error("Expected Biome to be enabled for this project")
}
biome.addFilePattern("lambda/**")
biome.file.addOverride("formatter", {
  enabled: true,
  indentStyle: "space",
  indentWidth: 2,
  lineWidth: 100,
})
biome.file.addOverride("javascript.formatter", {
  semicolons: "asNeeded",
  trailingCommas: "es5",
})
biome.file.addOverride("linter.rules.nursery.noFloatingPromises", "error")
biome.file.addOverride("linter.rules.suspicious.noShadow", "error")
biome.file.addOverride("linter.rules.correctness.noUndeclaredDependencies", "error")

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

// Local `projen build` packages every language. Pre-commit runs that build, and
// most machines have no .NET SDK. Skip the NuGet pack locally unless
// `dotnet --list-sdks` prints a version. In CI always run it, so a missing SDK
// fails the pack instead of publishing nothing.
const packageDotnet = project.tasks.tryFind("package:dotnet")
if (!packageDotnet) {
  throw new Error("Expected package:dotnet task")
}
packageDotnet.addCondition(
  "sh -c 'if [ -n \"$CI\" ]; then exit 0; fi; dotnet --list-sdks 2>/dev/null | grep -q .'"
)
// Node16 preserves dynamic import(), which needs VM module support inside Jest.
for (const task of ["test", "test:watch", "test:update"]) {
  // Unit tests synthesize stacks that load the prebuilt handler asset.
  project.tasks.tryFind(task)?.prependSpawn(buildHandler)
  project.tasks.tryFind(task)?.env("NODE_OPTIONS", "--experimental-vm-modules")
}

// Release jobs are populated during preSynthesize; apply overrides after that.
class NpmTrustedPublishing extends Component {
  override preSynthesize() {
    const releaseWorkflow = project.github?.tryFindWorkflow("release")
    const npmJob = releaseWorkflow?.getJob("release_npm")
    if (!releaseWorkflow?.file || !npmJob || !("steps" in npmJob)) {
      throw new Error("Expected release_npm to contain npm publishing steps")
    }
    const publishSteps = npmJob.steps.filter((step) => step.run?.includes("publib-npm"))
    if (publishSteps.length !== 1 || publishSteps[0]?.id !== "release") {
      throw new Error("Expected exactly one publib-npm step with id 'release' in release_npm")
    }
    const env: Record<string, string> = {
      ...publishSteps[0].env,
      NPM_TRUSTED_PUBLISHER: "true",
    }
    delete env.NPM_TOKEN
    releaseWorkflow.patchStep("release_npm", "release", { env })
  }
}
new NpmTrustedPublishing(project)

const githubProject = project.github
if (!githubProject) {
  throw new Error("Expected GitHub workflows to be enabled")
}

// Same jactionlint step as hk.pkl, with hk/jactionlint/shellcheck versions from mise.toml.
// pull_request (not pull_request_target) also runs for Dependabot and other bot PRs, with a
// read-only token, and checks out the PR so workflow edits are linted rather than executed.
const workflowChecks = new github.GithubWorkflow(githubProject, "workflow-checks", {
  limitConcurrency: true,
  concurrencyOptions: {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not a JS template
    group: "${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    cancelInProgress: true,
  },
})
workflowChecks.on({
  pullRequest: {},
})
workflowChecks.addJob("jactionlint", {
  runsOn: ["ubuntu-latest"],
  timeoutMinutes: 10,
  permissions: {
    contents: github.workflows.JobPermission.READ,
  },
  steps: [
    {
      name: "Checkout",
      uses: github.ActionRefs.ACTIONS_CHECKOUT,
      with: {
        // Projen does not kebab-case keys under `with`.
        "persist-credentials": false,
      },
    },
    {
      name: "Install pinned workflow tools",
      // jdx/mise-action v5.2.2. Tool versions come from mise.toml, not this pin.
      uses: "jdx/mise-action@8418fedb1110381a0d3ba51a7a415d7c1b884550",
      with: {
        cache: false,
        install_args: "hk jactionlint shellcheck",
      },
    },
    {
      name: "jactionlint",
      run: "hk check --all --step jactionlint",
    },
  ],
})

const dependabot = githubProject.addDependabot()
if (dependabot) {
  dependabot.config.updates = [
    {
      "package-ecosystem": "github-actions",
      directory: "/",
      schedule: {
        interval: github.DependabotScheduleInterval.WEEKLY,
      },
      // Projen owns the generated workflow action versions; upgrade projen to update them.
      allow: [{ "dependency-name": "anthropics/claude-code-action" }],
    },
  ]
}

project.synth()
