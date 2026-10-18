# Kiara TS (`@kapoorlabs/kiara-ts`)

Browser-first TypeScript search/query engine with Java-Kiara-compatible behavior,
strong parity validation, and zero runtime dependencies.

## Install

```bash
npm install @kapoorlabs/kiara-ts
```

## Table of contents

- [Why Kiara TS](#why-kiara-ts)
- [Quick start (5 minutes)](#quick-start-5-minutes)
  - [1) Create a schema and load data](#1-create-a-schema-and-load-data)
  - [2) Run structured queries](#2-run-structured-queries)
  - [3) Add keyword search with typo correction](#3-add-keyword-search-with-typo-correction)
  - [4) Use projections and limits](#4-use-projections-and-limits)
- [Decorator quick start](#decorator-quick-start)
- [Worker quick start](#worker-quick-start)
- [Feature reference and detailed docs](#feature-reference-and-detailed-docs)
- [Validation, quality gates, and CI checks](#validation-quality-gates-and-ci-checks)
- [Release and package info](#release-and-package-info)

## Why Kiara TS

- Typed schema API and decorator API (pick either style).
- Rich operators (`EQUAL`, `BETWEEN`, `CONTAINS_*`, `NOT_*`, etc.).
- Secondary types for collections, ranges, dates, and date-times.
- Keyword search with stemming, typo correction (`one edit away`), predictions, and caps.
- Worker adapters for isolated/background execution paths.
- Strong parity + differential validation against Java baseline behavior.

## Quick start (5 minutes)

### 1) Create a schema and load data

```ts
import {
  Store,
  defineSchema,
  textField,
  numberField,
  NormalizationProfile,
} from "@kapoorlabs/kiara-ts";

type Movie = {
  title: string;
  year: number;
  actors: string;
  rating: number;
};

const movieSchema = defineSchema<Movie>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
  textField("actors", {
    secondaryType: "commaSeparatedStrings",
    caseInsensitive: true,
  }),
  numberField("rating"),
]);

const store = new Store(movieSchema, { normalizationProfile: NormalizationProfile.JAVA });

store.loadRow({ title: "Cast Away", year: 2000, actors: "Tom Hanks, Helen Hunt", rating: 8.1 });
store.loadRow({ title: "Apollo 13", year: 1995, actors: "Tom Hanks, Bill Paxton", rating: 7.6 });
store.loadRow({ title: "Big", year: 1988, actors: "Tom Hanks", rating: 7.3 });
store.prepare();
```

### 2) Run structured queries

```ts
import { createCondition, Operator } from "@kapoorlabs/kiara-ts";

const results = store.search([
  createCondition<Movie, "year">({
    field: "year",
    operator: Operator.BETWEEN,
    lowerValue: 1990,
    upperValue: 2001,
  }),
  createCondition<Movie, "actors">({
    field: "actors",
    operator: Operator.CONTAINS_EITHER,
    values: ["tom hanks"],
  }),
]);

console.log(results.map((row) => row.title));
// ["Cast Away", "Apollo 13"]
```

### 3) Add keyword search with typo correction

```ts
import { KeywordSearch } from "@kapoorlabs/kiara-ts";

const keywordSearch = new KeywordSearch(store);
const keywordResult = keywordSearch.bestMatch("apolo mission", { limit: 5 });

console.log(keywordResult.correctedKeywords);
// { apolo: "apollo" }
```

### 4) Use projections and limits

```ts
const typedProjection = store.searchProjection(
  [createCondition<Movie, "actors">({ field: "actors", values: ["tom hanks"] })],
  ["title", "rating"],
  2,
);

const legacyProjection = store.searchLegacyProjection(
  [createCondition<Movie, "actors">({ field: "actors", values: ["tom hanks"] })],
  ["title", "year"],
  2,
);
```

See runnable end-to-end output in [examples/demo-repo/run-demo.mjs](./examples/demo-repo/run-demo.mjs).

## Decorator quick start

If you prefer Java-style decorators instead of schema builders:

```ts
import { Entity, Text, NumberField, CaseInsensitive, Store, getEntitySchema } from "@kapoorlabs/kiara-ts";

@Entity
class MovieEntity {
  @Text()
  @CaseInsensitive()
  title = "";

  @NumberField()
  year = 0;
}

const schema = getEntitySchema(MovieEntity);
const store = new Store(schema);
```

Decorator behavior and compatibility coverage:
[src/decorators/entity.test.ts](./src/decorators/entity.test.ts)

## Worker quick start

Use the in-memory worker adapter when you want request/response execution
through the worker protocol shape:

```ts
import { InMemoryWorkerAdapter } from "@kapoorlabs/kiara-ts";

const worker = new InMemoryWorkerAdapter(store);
// Use worker.execute(...) with WorkerRequest payloads from the protocol exports.
```

Worker protocol and adapters:
- [src/worker/protocol.ts](./src/worker/protocol.ts)
- [src/worker/in-memory-worker-adapter.ts](./src/worker/in-memory-worker-adapter.ts)
- [src/worker/browser-worker-adapter.ts](./src/worker/browser-worker-adapter.ts)

## Feature reference and detailed docs

Use this section as your map from feature area to detailed documentation.

### Core feature matrix (complete capability list)

- Full feature inventory (operators, annotations, capabilities):
  [docs/feature-parity.md](./docs/feature-parity.md)
- Row-level implementation/evidence status:
  [docs/parity-ledger.md](./docs/parity-ledger.md)
- Compatibility gate closure criteria:
  [docs/blocker-gates.md](./docs/blocker-gates.md)

### Query and data semantics

- Operator compatibility and behavior:
  [src/query/operator-parity-matrix.test.ts](./src/query/operator-parity-matrix.test.ts)
- Date, date-time, range semantics:
  [src/store/date-range.test.ts](./src/store/date-range.test.ts),
  [src/store/numeric-range.test.ts](./src/store/numeric-range.test.ts),
  [src/testing/date-locale-contract.test.ts](./src/testing/date-locale-contract.test.ts)
- Null and collection semantics:
  [src/store/search.test.ts](./src/store/search.test.ts),
  [src/testing/fixtures/java-corpus-number-collection-null.json](./src/testing/fixtures/java-corpus-number-collection-null.json)

### Keyword and text features

- Keyword matching/minimum matching:
  [src/query/keyword-search.test.ts](./src/query/keyword-search.test.ts)
- Dictionary, prediction, one-edit correction:
  [src/text/dictionary-trie.test.ts](./src/text/dictionary-trie.test.ts)
- Stemming:
  [src/text/stemming.test.ts](./src/text/stemming.test.ts)
- Stress/capacity behavior:
  [src/testing/keyword-capacity-stress.test.ts](./src/testing/keyword-capacity-stress.test.ts)

### Differential/oracle validation

- Imported Java-oracle corpus runner:
  [src/testing/oracle-java-corpus-smoke.test.ts](./src/testing/oracle-java-corpus-smoke.test.ts)
- Imported keyword oracle runner:
  [src/testing/oracle-java-keyword-smoke.test.ts](./src/testing/oracle-java-keyword-smoke.test.ts)
- Scale differential suites:
  [src/testing/oracle-scale-differential.test.ts](./src/testing/oracle-scale-differential.test.ts)

### Error handling and API compatibility

- Error taxonomy mapping:
  [docs/exception-parity-map.md](./docs/exception-parity-map.md)
- Public API exports:
  [src/index.ts](./src/index.ts)

### Governance and planning docs

- Migration architecture and release strategy:
  [docs/migration-plan.md](./docs/migration-plan.md)
- Demo architecture and behavior:
  [docs/demo-plan.md](./docs/demo-plan.md)
- Data provenance policy:
  [docs/data-provenance.md](./docs/data-provenance.md)
- Java declaration-level accounting:
  [docs/java-test-accounting.md](./docs/java-test-accounting.md)

## Validation, quality gates, and CI checks

Run these locally before publishing/releasing:

```bash
npm run test:parity:gate
npm test
npm run demo:repo
```

CI/protection details:
[docs/ci-required-checks.md](./docs/ci-required-checks.md)

## Release and package info

- Package: `@kapoorlabs/kiara-ts`
- Module type: ESM (`type: module`)
- Entry points: `dist/index.js` + `dist/index.d.ts`
- License: MIT ([LICENSE](./LICENSE))

Release notes:
[CHANGELOG.md](./CHANGELOG.md)
