# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a projen managed project. It contains a CDK construct library for creating databases, schemas, and roles in Aurora Serverless v2, RDS Database Cluster, or Database Instance. It supports both PostgreSQL and MySQL databases and is designed for enterprise environments with isolated subnets.

## Key Architecture

### Core Components

- **Provider**: Main construct that creates a Lambda function handler to execute database operations
- **Role**: Creates database users/roles with optional IAM authentication
- **Database**: Creates databases with optional ownership assignment
- **Schema**: Creates database schemas with role permissions
- **Sql**: Executes arbitrary SQL statements

### Lambda Handler Architecture

- **Engine Factory Pattern**: `lambda/engine.factory.ts` creates database-specific engines
- **Abstract Engine**: `lambda/engine.abstract.ts` defines common interface
- **Concrete Engines**: `lambda/engine.postgresql.ts` and `lambda/engine.mysql.ts`
- **Main Handler**: `lambda/handler.ts` orchestrates CloudFormation custom resource operations

The Lambda handler supports both PostgreSQL and MySQL databases, auto-detecting the engine type from the cluster/instance configuration.

## Development Commands

### Build and Test

```bash
# After changing .projenrc.ts
pnpm exec projen

# Build the project
pnpm exec projen build

# Run all tests
pnpm exec projen test

# Run tests in watch mode
pnpm exec projen test:watch

# Run typecheck (instead of pnpm exec tsc --noEmit)
pnpm exec projen typecheck

# Run linting
pnpm exec projen biome

# Build only the Lambda handler
pnpm exec projen build:handler
```

### Integration Testing

```bash
# Deploy PostgreSQL serverless test stack
pnpm exec projen integ:deploy:postgresql:serverless

# Deploy MySQL serverless test stack
pnpm exec projen integ:deploy:mysql:serverless

# Destroy test stack
pnpm exec projen integ:destroy:serverless
```

## Testing Setup

- **Framework**: Jest with TypeScript support
- **Test Files**: Located in `test/` and `lambda/` directories
- **Configuration**: See `jestOptions` in `.projenrc.ts`.
- **Coverage**: Enabled with multiple reporters (json, lcov, clover, cobertura, text)

## Database Engine Support

### PostgreSQL

- Uses `pg` library for connections
- Supports schemas, roles, and databases
- IAM authentication supported

### MySQL

- Uses `mysql2` library for connections
- Creates users with '%' host for VPC compatibility
- IAM authentication supported

## Build Process

The project uses projen for build management. Do not change files
managed by projen, but instead change `.projenrc.ts`. After changing
`.projenrc.ts` run `pnpm exec projen`.

In particular:

1. Do not change `package.json`.
2. Do not change any of the github workflow files.

Projen tasks:

1. `pre-compile`: Transpiles Lambda handler using esbuild
2. `compile`: TypeScript compilation
3. `post-compile`: Copies handler to lib directory
4. `biome`: Runs formatting and linting
5. `typecheck`: Runs typecheck

## GitHub Actions checks

`hk.pkl` lints workflows, Dependabot config, and composite actions with
jactionlint. `mise.toml` pins `jactionlint` 2.3.0 and the `shellcheck` 0.11.0
that jactionlint shells out to. Run that pin through mise. A `jactionlint`
already on `PATH` can be another version.

The hk step is `jactionlint --baseline --sarif-hide-baselined --format sarif`.
`.github/jactionlint.yaml` sets `baseline: auto`, so findings recorded in
`.github/jactionlint-baseline.json` are accepted and any other finding fails.
`mise run check` includes the step. To run only it:

```bash
mise exec -- hk check --all --step jactionlint
```

### Refreshing the jactionlint baseline

The baseline matches by fingerprint and context hash, which include the finding
text. After a projen upgrade, a Dependabot action bump, or another
generated-workflow change, an already accepted finding can fail again because
the old entry still names the previous text. The old entry then matches
nothing. Changing `actions/setup-node@v7.0.0` to `v7.0.1` in
`.github/workflows/build.yml` does this for the three baselined `unpinned-uses`
findings in that file.

Re-baseline only for that drift, and only after confirming each new finding is
that stale-baseline effect and not a real regression. Commit the refreshed
`.github/jactionlint-baseline.json` in the same commit or pull request as the
workflow change. Do not refresh the baseline to hide a finding you introduced,
and do not edit the JSON by hand.

1. List findings the baseline does not hide, and compare them with the workflow
   diff. Expected drift is the same rule on the same step, with the message now
   naming the new generated text:

   ```bash
   mise exec -- jactionlint --baseline
   ```

2. List entries that no longer match anything. They are reported as
   `unused-baseline-entry`:

   ```bash
   mise exec -- jactionlint --baseline-check
   ```

3. Rewrite the baseline. Do not pass workflow paths, and do not combine this
   with `--baseline`. File arguments keep every other file's entries.
   `--baseline-write` records every current finding and exits 0 even when new
   findings exist, so review the baseline diff before committing:

   ```bash
   mise exec -- jactionlint --baseline-write
   ```

4. Confirm the hk step is clean:

   ```bash
   mise exec -- hk check --all --step jactionlint
   ```

`.github/jactionlint.yaml` mentions the same `--baseline-write` flag. Use the
mise form so the `mise.toml` pin is the binary that runs. Install tools with
`mise install` if `mise exec` cannot find `jactionlint`.

## SSL/TLS Configuration

- SSL is enabled by default
- Global RDS certificate bundle is automatically downloaded during build
- Can be disabled via `ssl: false` in Provider props

## Code style

- Avoid any.
