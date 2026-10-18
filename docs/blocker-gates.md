# Compatibility blocker gates

This document tracks blocker-gate status against the pinned Java baseline.
A gate is **closed** only when acceptance evidence is present in repository tests
or explicitly documented contractual behavior.

| Gate | Status | Evidence / current behavior | Closure criteria |
|---|---|---|---|
| Runtime field reflection parity | closed (adapted) | Decorator + typed-schema paths are implemented and tested via [entity.test.ts](../src/decorators/entity.test.ts) and [define-schema.test.ts](../src/schema/define-schema.test.ts). | Keep parity docs explicit that TS uses metadata/schema adaptation, not JVM reflection. |
| Worker class-instance transport parity | closed (adapted) | Serializable protocol + worker bridge in [protocol.ts](../src/worker/protocol.ts) and [browser-worker-adapter.test.ts](../src/worker/browser-worker-adapter.test.ts). | Maintain message-schema compatibility tests when protocol changes. |
| Java long precision behavior | closed (characterized parity) | Long-boundary and precision-collapse differential fixtures are covered in [java-corpus-long-precision.json](../src/testing/fixtures/java-corpus-long-precision.json) and executed by [oracle-java-corpus-smoke.test.ts](../src/testing/oracle-java-corpus-smoke.test.ts). | Keep parity contract explicit that Java-mode follows legacy long-key behavior, including precision collapse/saturation. |
| Date/time pattern breadth (`DateFormat`/`DateTimeFormat`) | closed (constrained contract) | Supported-format matrix and unsupported-format rejections are fixture-tested in [date-locale-contract.test.ts](../src/testing/date-locale-contract.test.ts). | Keep supported pattern contract explicit; if new patterns are added, extend fixture matrix before release claims. |
| Locale-sensitive case/format behavior | closed (pinned contract) | Locale normalization contract (including Turkish-I cases) is fixture-tested in [date-locale-contract.test.ts](../src/testing/date-locale-contract.test.ts) with `en_US` baseline metadata. | Any locale expansion must include explicit contract fixtures and docs updates. |
| Null normalization and `CONTAINS_EITHER_INCLUDING_NULL` breadth | closed | Base/extended null corpora plus numeric collection-null fixtures execute via [oracle-java-corpus-smoke.test.ts](../src/testing/oracle-java-corpus-smoke.test.ts); contrast and null-aware semantics are additionally asserted in [search.test.ts](../src/store/search.test.ts). | Keep null-matrix fixtures in sync whenever collection secondary-type behavior changes. |
| Keyword growth/capacity under stress | closed | Capacity/truncation and punctuation-heavy stress behavior are enforced in [keyword-capacity-stress.test.ts](../src/testing/keyword-capacity-stress.test.ts), with keyword oracle fixtures in [oracle-java-keyword-smoke.test.ts](../src/testing/oracle-java-keyword-smoke.test.ts). | Keep stress corpus size and overflow diagnostics assertions aligned with keyword pipeline changes. |
| Browser memory/responsiveness guarantees | closed (gated benchmark contract) | Benchmark thresholds are enforced by `npm run bench:check:ci` and included in parity gate command in [package.json](../package.json). Baselines live under [benchmarks/baselines/](../benchmarks/baselines). | Keep thresholds and baselines updated when workload shape changes; publish major revisions. |
| Dataset provenance for public demo hosting | closed (synthetic-fixture policy) | Provenance policy is documented in [data-provenance.md](./data-provenance.md), constraining public demo behavior to approved synthetic/hand-curated fixtures. | Any external dataset addition must include explicit license + redistribution proof in PR. |
| Error taxonomy one-to-one parity with Java exception families | closed (mapped) | Full mapping is documented in [exception-parity-map.md](./exception-parity-map.md); worker-boundary propagation is validated in [in-memory-worker-adapter.test.ts](../src/worker/in-memory-worker-adapter.test.ts) and [browser-worker-adapter.test.ts](../src/worker/browser-worker-adapter.test.ts). | Keep mapping and propagation tests updated when error codes/categories evolve. |

## Parity gate commands

- Full imported-oracle fixture gate: `npm run test:oracle:full`
- CI parity gate command: `npm run test:parity:gate`
