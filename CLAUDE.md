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
npx projen

# Build the project
npx projen build

# Run all tests
npx projen test

# Run tests in watch mode
npx projen test:watch

# Run typecheck (instead of npx tsc --noEmit)
npx projen typecheck

# Run linting
npx projen eslint

# Build only the Lambda handler
npx projen build:handler
```

### Integration Testing

```bash
# Deploy PostgreSQL serverless test stack
npx projen integ:deploy:postgresql:serverless

# Deploy MySQL serverless test stack
npx projen integ:deploy:mysql:serverless

# Destroy test stack
npx projen integ:destroy:serverless
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
`.projenrc.ts` run `npx projen`.

In particular:

1. Do not change `package.json`.
2. Do not change any of the github workflow files.

Projen tasks:

1. `pre-compile`: Transpiles Lambda handler using esbuild
2. `compile`: TypeScript compilation
3. `post-compile`: Copies handler to lib directory
4. `eslint`: Runs linter
5. `typecheck`: Runs typecheck

## SSL/TLS Configuration

- SSL is enabled by default
- Global RDS certificate bundle is automatically downloaded during build
- Can be disabled via `ssl: false` in Provider props

## Code style

- Avoid any.
