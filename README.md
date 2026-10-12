# Kiara DB for TypeScript: migration proposal

**Status: in-progress implementation on `main`.**

**Dependency posture:** zero runtime dependencies for the core library (tooling/test dependencies only).

The intended deliverable is a browser-first TypeScript library that retains all
Java Kiara capabilities, with class decorators for Java-like ergonomics and an
equally capable, decorator-free schema API.

## Progress: next recommended steps

1. **Demo repo first (current focus):** expand the runnable demo track in [examples/demo-repo/](./examples/demo-repo/) and keep it executable via `npm run demo:repo`.
2. Expand imported Java-derived corpus docs to mirror more Java test clusters (broader operator matrix and multi-condition combinations).
3. Add a parity CI gate for a designated full imported-oracle fixture set (fail build on any mismatch).
4. Add higher-volume differential runs (beyond smoke-size fixtures) to validate correctness under larger row counts.

## Read the plans

1. [Migration plan](docs/migration-plan.md): architecture, developer experience,
   compatibility risks, milestones, validation and release gates.
2. [Feature parity matrix](docs/feature-parity.md): all 11 Java operators, all
   17 annotations, remaining capabilities, and the complete production-class inventory.
3. [Demo plan](docs/demo-plan.md): browser-only movie search, airport suggestions,
   keyword search, configuration rules, and a feature playground.

## What was and was not created

- Prepared npm package metadata, strict TypeScript configuration and Git ignore
  rules.
- Started milestone M1 implementation:
  - typed schema definition and field factories
  - standard decorator metadata initialization and entity/field decorators,
    including Java annotation-style decorators and `CommaSeperated*` aliases
  - Java-vs-native numeric normalization primitives (including Java long-key conversion)
  - M2 scaffolding: trie snapshot, field indexes and indexed structured search execution
  - initial oracle fixture runner scaffolding for Java-vs-TS differential scenarios
  - initial numeric range parser for prefixed `lower->upper` values
  - date/date-time secondary-type normalization and indexing support
  - explicit operator x field-kind compatibility validation
  - initial range-family query semantics (`numericRange`, `commaSeparatedNumericRanges`, `dateRange`, `commaSeparatedDateRanges`, `dateTimeRange`, `commaSeparatedDateTimeRanges`) for EQUAL/NOT_EQUAL/CONTAINS/NOT_CONTAINS
  - projection APIs: typed selected-field projection and Java-compatible uppercase string-map projection
  - diagnostic trie serialization helper with Java-style marker formatting (`#` node IDs, `~` row markers, BFS order, two-decimal numeric rendering)
  - executable operator x field compatibility matrix tests
  - oracle fixture suite runner with aggregate pass/fail reporting
  - imported oracle differential runner failure summaries grouped by feature category
  - keyword/text primitives: punctuation cleanup, tokenization, dictionary trie prediction and one-edit lookup
  - baseline English stemming utility integrated into keyword search for `stemmedIndex` fields
  - fixture-driven stemming regression tests (Porter-style baseline cases + idempotence)
  - oracle fixture JSON import/validation parser for metadata and fixture IDs
  - initial keyword search module (`bestMatch`, `minimumMatch`, preconditions, correction reporting)
  - `ignoreIndex` enforcement for structured and keyword search paths
  - imported-oracle differential suite runner bridge
  - in-memory worker adapter skeleton with typed request/response protocol, progress events and cancellation checks
  - browser-worker message bridge (`BrowserWorkerClient` + `attachBrowserWorkerHost`) with smoke tests for request/progress/cancellation
  - worker bridge transport smoke against real `MessageChannel` ports (worker-equivalent runtime messaging)
  - Playwright browser-worker smoke test against built `dist` artifacts (`npm run test:playwright`)
  - cross-browser Playwright matrix (Chromium/Firefox/WebKit) for worker smoke parity
  - deeper cross-browser worker scenarios: larger dataset query, cancellation stress and repeated worker lifecycle runs
  - tiered browser stress (10k/50k rows), concurrent in-flight batches and cancellation-race coverage
  - imported oracle batch runner with cross-document mismatch summaries (`failedByCategory`, `mismatchSummary`)
  - JSON ingestion path for imported oracle batch runs (`runImportedOracleBatchFromJson`)
  - tabular mismatch report formatter for imported batch runs (`formatOracleBatchMismatchReport`)
  - committed sample imported-oracle JSON documents for ingestion/report regression tests
  - committed java-derived corpus and expectation fixtures for batch differential, stemming and trie diagnostics
  - additional java-derived corpus packs covering operator/collection/range/date and keyword smoke scenarios
  - null-focused java-derived corpus pack for `null` and `CONTAINS_EITHER_INCLUDING_NULL` semantics
  - datetime-focused java-derived corpus pack for `dateTimeFormat` and `commaSeparatedDateTimes` queries
  - date-range-focused java-derived corpus pack for `dateRange` / `commaSeparatedDateRanges` and date-time range collections
  - benchmark harness script for load/prepare/query and worker round-trip latency (`npm run bench:smoke`)
  - benchmark baseline assertion workflow (`npm run bench:check`) with regression-factor + absolute caps
  - per-environment benchmark baselines and persisted history tracking (`benchmarks/baselines/`, `benchmarks/history/`)
  - CI-strict benchmark profile checks (`npm run bench:check:ci`) with dedicated baseline
  - schema, decorator and query validation error taxonomy
  - initial condition/operator model with validation
  - store lifecycle states and loader-based preparation flow
  - Vitest test suite for the implemented behavior
- Wrote the plans using the Java library, its tests, the supplied usage guide
  and the Java demo as evidence.
- Initialized this generated scaffold as an exportable local Git repository on
  `main`. The downloadable archive includes its Git metadata. No separate
  workspace was attached or modified.
- Did not create a GitHub repository, configure a remote, or create a commit.
- Full Java parity for trie/index loading, structured search, keyword scoring/stemming
  edge cases and worker/browser integration is still in progress.
- Java fixture export/oracle validation and browser demo remain pending per
  [migration plan](docs/migration-plan.md).

The package name is provisional: npm availability and ownership have not been
established. Publishing is disabled. `UNLICENSED` is a temporary scaffold setting;
the release plan calls for Apache-2.0 with the applicable upstream notices, not
removal of the upstream license obligations.

## Using this repository

Extract the archive into your chosen folder, retaining the included `.git`
directory. Git is already initialized on `main`; there is no initial commit.
Install dependencies with npm before running checks. A GitHub remote is
optional and should be created only after choosing its owner/name and visibility.

Current validation commands:

- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run demo:repo`
- `npm run demo:decorators`

The TypeScript configuration remains core-focused; DOM and Web Worker types will
be added in separate adapter/demo configurations, not injected into the core.

## Evidence baseline

Research date: 2026-10-11.

- Java library: [kapoorlabs/kiara](https://github.com/kapoorlabs/kiara),
  `develop`, commit `568d1addd15e237a5fa2dfaf7538b193d5564773`,
  Maven version `2.0.13-SNAPSHOT`.
- Java demo: [kapoorlabs/kiara-demo](https://github.com/kapoorlabs/kiara-demo),
  `master`, commit `37b36c4031c8163a27293d044ca57fc84f53b8d7`,
  depending on Kiara `2.0.10`.
- [Usage guide](https://www.kapoorlabs.com/#/projects/kiara-usage).

Inventory: 57 production Java files, including 17 annotations and 9 exception
classes; 448 source `@Test` declarations in 25 test classes. These are static
inventory counts, not executed/passing test counts. Core implementation paths
and representative tests were inspected; the implementation phase must run and
account for the entire test suite.
