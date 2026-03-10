# Testing and validation

## Table of Contents
- [Typecheck](#typecheck)
- [Checks and tests](#checks-and-tests)
- [Test artifacts](#test-artifacts)
- [Quality expectations](#quality-expectations)

## Typecheck

- `pnpm typecheck`
- `pnpm lint`

## Checks and tests

- `pnpm test`
- `pnpm test:watch`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:a11y`
- `pnpm test:e2e`
- `pnpm test:perf`
- `pnpm test:deep`

## Test artifacts

- `bash scripts/test-with-artifacts.sh all`
- `pnpm test:artifacts`

For flaky reproduction, keep artifact outputs stable:
- `artifacts/test/summary-*.json`
- `artifacts/test/test-output-*.log`
- `artifacts/test/junit-*.xml`
- `artifacts/test/*-results.json`
- `artifacts/test/artifact-manifest.json`

Optional targeted artifact modes:
- `pnpm test:artifacts:unit`
- `pnpm test:artifacts:integration`
- `pnpm test:artifacts:e2e`

## Quality expectations

- Run `pnpm test` before completing workflow changes.
- For behavior changes in runtime or high-risk paths, run `pnpm test:deep`.
