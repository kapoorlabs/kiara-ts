# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-10-18

### Added
- Full Java baseline parity accounting workflow:
  - declaration ledger ([docs/java-test-accounting-ledger.json](./docs/java-test-accounting-ledger.json))
  - generated summary ([docs/java-test-accounting-summary.json](./docs/java-test-accounting-summary.json))
  - CI accounting validator ([scripts/java-test-accounting-check.mjs](./scripts/java-test-accounting-check.mjs))
- Strict CI parity gate with accounting thresholds and benchmark checks.
- Expanded imported Java fixture corpus and differential suites, including:
  - collection contrast semantics
  - null-inclusive collection behavior
  - date/locale contract fixtures
  - scale differential suites (10k/50k rows)
- Demo output accounting snapshot in [examples/demo-repo/run-demo.mjs](./examples/demo-repo/run-demo.mjs).

### Changed
- Package metadata hardened for public npm publication:
  - package renamed to `@kapoorlabs/kiara-ts`
  - `private` disabled
  - MIT license metadata
  - ESM entry points/exports and type declarations wired to `dist/`
  - explicit publish access and packed files list
- Benchmark CI check is non-mutating; history recording is manual via
  `npm run bench:record-history`.

### Validation
- `npm run test:parity:gate`
- `npm test`
- `npm run demo:repo`
- `npm run accounting:java:check:ci`
