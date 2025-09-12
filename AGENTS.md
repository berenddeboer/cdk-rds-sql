AGENTS Guide for cdk-rds-sql (Projen-managed; edit `.projenrc.ts` and run `npx projen`.)

- Build: `npx projen build` (full), `npx projen run build:handler` (Lambda only).
- Test: `npx projen test`; watch: `npx projen test:watch`; typecheck: `npx projen typecheck`.
- Single test file: `npx projen test -- lambda/engine.postgresql.test.ts`.
- Single test by name: `npx projen test -- -t "creates schema"` (Jest 29).
- Lint: `npx projen eslint`; format via Prettier pre-commit; fix: `npx eslint . --fix`.
- Node: `>=22.14`; module: CommonJS; TS strict mode enabled.
- Imports: use ES `import` (no `require`); order builtin→external; alphabetize A→Z.
- Formatting: Prettier—no semicolons; double quotes; width 90; arrow-parens always; trailing commas es5; 2-space indent.
- Types: enable `strict`; no implicit any; no unused locals/params; explicit types on public APIs.
- Promises: no floating promises; use `await`; enforce `return-await`.
- Naming: classes/interfaces PascalCase; functions/vars camelCase; constants UPPER_SNAKE only when truly constant.
- Errors: throw `Error` with clear message; avoid silent catches; use narrow catches and rethrow with context.
- Import hygiene: no duplicate imports; no unresolved or extraneous deps (tests/projen files allowed).
- Member order: static first, then fields, constructor, methods (ESLint member-ordering).
- CDK constructs: keep immutable props; avoid side effects in constructors.
- Lambda handler: keep engine-specific logic in `lambda/engine.*`; handler orchestrates only.
- Git hooks: pre-commit runs Prettier, `tsc --noEmit`, `projen compile`, and `jest` (coverage off).
- Integration: deploy via `npx projen integ:deploy:postgresql:serverless` / `npx projen integ:deploy:mysql:serverless`; destroy: `npx projen integ:destroy:serverless`.
