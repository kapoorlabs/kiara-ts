# Java Kiara -> browser-first TypeScript

## 1. Outcome and boundaries

Deliver a small, framework-independent, in-memory, read-only database for browser
applications, also usable from Node.js. Developers describe a model, load records,
prepare the store and query it without designing composite indexes.

**No Java feature is intentionally dropped.** The
[feature matrix](feature-parity.md) is the release checklist. "Planned" does not
mean already implemented or proven equivalent. Any unachievable exact behavior
must be documented as a blocker, with a supported alternative and an explicit
release qualification rather than silently being removed.

This request produces plans and configuration only. CRUD transactions, SQL,
joins, built-in durable persistence, vector search and a server API are not
required: these are not features of the inspected Java library. Browser workers
and native array inputs are adaptations, not excuses to defer Java parity.

## 2. Baseline and source of truth

Use the pinned library commit in the [README](../README.md) as the implementation
baseline, not the older generated Javadoc alone. The demo's dependency is
`2.0.10`, whereas the library checkout is `2.0.13-SNAPSHOT`. During milestone M0,
run the demo behavior against its pinned dependency and the selected library
baseline, then record differences explicitly.

Evidence inspected:

- [Model adapter](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/adapters/PojoAdapter.java):
  declared fields, getters/setters, default constructor, enums and annotations.
- [Store and indexes](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/domain/Store.java)
  and [loader](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/loader/StoreLoader.java).
- [Structured search](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/search/StoreSearch.java),
  [keyword search](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/search/KeywordSearch.java)
  and [spelling/prediction](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/util/SpellCheckUtil.java).
- [Numeric conversions](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/util/NumericUtil.java)
  and [range grammar](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/parser/RangeParser.java).
- [Java tests](https://github.com/kapoorlabs/kiara/tree/568d1addd15e237a5fa2dfaf7538b193d5564773/src/test/java/com/kapoorlabs/kiara)
  and the supplied [usage guide](https://www.kapoorlabs.com/#/projects/kiara-usage).

Source behavior and executable fixtures outrank prose where they disagree.
Existing Java bugs are not automatically desirable TypeScript defaults, but any
behavior change needs a named compatibility decision and a regression fixture.

## 3. Developer experience: two front doors, one engine

### Recommended Java-like path: decorated classes

Provide standard TypeScript decorators, rather than requiring legacy
`experimentalDecorators` or `emitDecoratorMetadata`.

- An `@Entity` class decorator finalizes the schema.
- Explicit typed field decorators, provisionally `@Text`, `@NumberField`,
  `@BooleanField`, `@LongField` and `@EnumField`, register stored fields.
- The 17 Java annotation equivalents compose with those fields. Type-specific
  annotations such as a date/list annotation may themselves register the field
  so developers do not need redundant type decorators.
- Preserve familiar annotation names; offer correctly spelled `CommaSeparated...`
  exports and deprecated `CommaSeperated...` aliases for easy Java migration.
- Direct property access replaces mandatory getters/setters. An explicit
  accessor/factory mapping handles existing encapsulated domain classes.
- `Store<Model>`, `StoreLoader<Model>`, `Condition`, `Operator` and `StoreSearch`
  provide a recognizable migration surface. A convenience factory may combine
  schema registration, loading and preparation without hiding errors.
- Model instances returned by the class path use a validated constructor/factory,
  not an unsafe type assertion that turns plain data into a claimed class.

**Important limitation:** TypeScript types and interfaces disappear at runtime.
A class alone cannot reveal all undeclared/uninitialized fields or distinguish
Java int/long/float semantics. Explicit metadata is unavoidable without a custom
compiler transform. Do not infer a schema from the first row; that breaks empty
stores, nullable fields and heterogeneous input.

Use standard decorator `context.metadata`, namespaced per library, and collect
field descriptors at class-definition time. An explicit decorator entry point
must initialize `Symbol.metadata` where needed before decorated classes evaluate.
Do not mark that initialization as tree-shakeable. Test empty classes, reversed
decorator stacking, inheritance isolation and bundler evaluation order. A class
must be registrable before any instances are constructed; instance initializers
alone are insufficient.

Reference: [TypeScript decorator metadata](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#decorator-metadata).

### Equally supported path: typed schemas and plain objects

Provide `defineSchema<T>` with field descriptors and options corresponding
one-for-one to decorators. This is essential for existing interfaces, JSON,
JavaScript consumers and frameworks whose toolchains use legacy decorators.
Both paths compile to the exact same ordered schema and run through the same
normalization and indexing pipeline.

Use `keyof T`-checked fields, field-appropriate operators, discriminated condition
types and typed projections. Schema field order must be explicit and stable:
it determines trie shape, not just presentation.

Reject unknown fields, invalid operator/type combinations and conflicting
annotations with actionable schema/query errors. Legacy callers that previously
received warnings or ignored projection fields get equivalent diagnostics in
the compatibility adapter, not silent omission.

### Learning path

The eventual quick start should take a new developer from install to a useful
query in ten minutes: define three fields, load a small local array, query two
conditions, add a list annotation, then show autocomplete. No backend, DI
container, ORM, custom Babel plugin or compulsory worker is required.

Documentation must show decorated-class and plain-object equivalents side by
side. An API method reference and Java-to-TypeScript name table are required.
Runnable examples are future implementation work, not included in this plan.

## 4. Engine architecture

Start with a faithful algorithmic port. Do not replace Kiara with a linear
`Array.filter` engine and call that parity.

| Layer | Responsibility |
|---|---|
| Schema | Ordered fields, scalar/secondary type metadata, aliases, normalization flags, enum values, accessors and factories |
| Normalization | Java-compatible scalar/list/date/range parsing; explicit null and numeric policies |
| Storage | Deduplicated field-level trie, parent/child links, DFS bounds and result reconstruction |
| Indexes | String and numeric inverted indexes, sorted key lists, collection-full-key indexes and prefix-partitioned interval trees |
| Query | Normalize a copy of conditions, validate, intersect/merge qualifying nodes, reconstruct full records or projections and apply limits |
| Text | English Snowball-compatible stemming, dictionary trie, one-edit correction, prefix prediction, keyword best/minimum matching |
| Compatibility | Familiar Java entry points, legacy string-map projection, legacy normalization and trie diagnostic serialization |
| Worker adapter | Own store inside one worker; async typed requests, cancellation, progress and error envelopes |

Use native `Map`/`Set` initially. Preserve ordered-key comparisons and trie
traversal semantics deliberately; JS insertion order is not Java `HashMap`
ordering. Optimize to packed arrays/typed arrays only after parity tests pass.
Avoid deep recursion where large schemas or dictionaries could exceed JS stacks.

Indexes contain node IDs/references, not independent copies of entire records.
Preserve trie deduplication and verify duplicate-row output multiplicity against
Java. Reconstruct results without exposing mutable index state.

Loading state is explicit: loading -> preparing -> ready, or failed. The safe
convenience API publishes only a complete store. Reloading builds a replacement
and swaps it atomically; do not add unsupported in-place mutation under the name
of Java compatibility. Test repeat preparation, search-before-prepare and
post-prepare loading; report any legacy-state differences.

## 5. Compatibility policy and blockers

Ship a documented `java` semantic profile as the migration default. Keep
intentional modern semantics explicit; do not silently repair numeric results
while claiming exact parity. Avoid many independent feature flags: one profile,
explicit schema types and a short documented deviation registry are sufficient.

| Issue | Status / effect | Plan and acceptance gate |
|---|---|---|
| Runtime field reflection | **Exact Java mechanism blocked** by erased TS types | Explicit decorators or typed schema; same developer capability, modest extra type metadata. No compiler plugin required. |
| Decimal and long behavior | **High-risk compatibility work**, not missing support | Java nodes parse numbers as `Double`; numeric index keys convert to `long`, truncating fractions. Reproduce this in `java` mode, including saturation, NaN/null, signed zero and bounds. Native mode keeps real numeric comparisons and `bigint` long values explicitly separate. |
| Long precision | A JS `number` cannot exactly represent every signed Java long | Use `bigint`/decimal-string input for exact long fields. Golden JSON encodes longs as tagged strings, not JSON numbers. Java itself loses precision through its Double path; distinguish Java-result parity from mathematical accuracy. |
| Dates and Java format patterns | **Full-pattern parity unproven; release blocker until scoped and tested** | Preserve default patterns, ISO parsing fallback, epoch days and UTC epoch seconds. Build a compatibility formatter/parser; test all patterns exercised by Java fixtures, then audit Java formatter features, locales, optional sections and resolver behavior. Unsupported patterns must throw a named error and appear on a release limitation list. Do not claim all arbitrary Java patterns are supported merely because the default works. |
| English stemming | JVM OpenNLP dependency cannot run directly in browser JS | Select/license-audit a browser-capable English Snowball implementation or port the algorithm. Require a golden vocabulary corpus; a generic Porter stemmer is not assumed equivalent. No runtime JVM/server fallback. |
| Java default-locale case conversion and formatting | Exact behavior depends on source JVM locale | Pin an oracle locale, record it, test Turkish I/non-ASCII and numeric formatting. Specify supported locale behavior; do not rely accidentally on the user's browser locale. |
| Null and string normalization | Legacy conflates null, blanks, text "null", and numeric sentinel cases | Preserve characterized Java behavior in migration mode. Native mode may use a collision-free internal sentinel. Verify actual null in output, not the string "null". Define absent/undefined explicitly as a TS adaptation. |
| Java collections/tie ordering | Hash-based traversal can affect ties and limited results | Capture actual guarantees; compare unordered sets only where order is unspecified. Define stable TS tie-breaking where JVM order is not portable, document the deviation, and test limited queries separately. |
| Keyword growth | Combination search can explode; factorial arithmetic can overflow | Port semantics before optimizing; use safe counting and explicit capacity diagnostics. Keep caller-configurable maximum keywords, report truncation, support worker cancellation. Do not silently cap all core queries at the demo's ten keywords. |
| Browser memory and responsiveness | **Arbitrary Java heap-sized datasets cannot be guaranteed in a tab** | Benchmark representative browsers/devices. Worker ownership, limited transfers and atomic reload; publish tested limits, fail clearly on configured budgets. Workers do not eliminate memory use or its limits. |
| Legacy trie serialization | Existing method is not a complete durable database format | Preserve diagnostic output, delimiters and two-decimal numeric formatting under the pinned locale. No Java deserializer was found in the production inventory. Durable snapshots/IndexedDB are optional future work, not a promised missing Java feature. |
| Worker class instances | Structured clone drops prototypes/functions | Pass schema identifiers and serializable data; register factories on each side or hydrate on the UI thread. Never clone decorators, constructors or a live Map/node graph as the public protocol. |
| Demo data redistribution | **Public hosting blocked until dataset rights are checked** | Both code repos have Apache-2.0 licenses, but movie/airport data provenance needs separate verification. Use clearly licensed or synthetic fixture data if necessary; disclose that it is not the full original dataset. |
| Repository location and remote | Local Git initialization completed in the generated, exportable scaffold | Repository is on `main` with no commits or remote. It can be extracted into a chosen folder. Dependency installation/lockfile belong to implementation bootstrap; GitHub publication is optional and requires an owner/name/visibility decision. |

There is no identified blocker to implementing the database capabilities in
TypeScript. There are real limits to identical reflection, arbitrary memory
capacity and an unqualified claim of exact behavior across all Java locales,
date patterns and ordering quirks.

## 6. Concrete Java behavior that must be characterized

- `CaseInsensitive` lowercases stored strings, so legacy results can contain
  normalized rather than original text. `isCaseSensitive` is misleadingly named
  internally; follow actual behavior, not that name.
- `Predictable` and `OneEditAway` both set the same dictionary-capability flag.
- `removeStopWords` strips/replaces punctuation. It is not a linguistic
  stop-word dictionary. Do not silently remove words such as "the".
- `getOneEditKeyword` returns a single candidate and declines strings of length
  three or less; do not substitute an arbitrary full fuzzy-search algorithm.
- Range `CONTAINS_EITHER` performs point containment using the parsed query's
  lower endpoint. Range `EQUAL` uses normalized range equality. Neither is an
  undocumented general interval-overlap query.
- `NOT_EQUAL` over a collection's indexed tokens is not interchangeable with
  `NOT_CONTAINS`, which excludes full collection keys containing a forbidden value.
- Structured search rejects absent/empty conditions. Do not turn that into
  "return everything" without an explicit new API.
- The Java search mutates condition objects during normalization. TS should
  normalize copies for reliable reuse; document this intentional side-effect
  improvement while retaining the result semantics.
- `getMinimumMatch` first obtains the best match, then compares its matched
  keyword count with a set of non-null, nonnumeric field values. It is not a
  generic rules-priority engine and is not just "match the fewest tokens".
- Java may ignore unknown projection fields or unsupported POJO fields; provide
  structured warnings in compatibility adapters and strict errors in new typed APIs.
- Java loader/demo error paths can partially load or skip rows. The TS default
  must not publish silent partial success. Expose row-level errors and an
  explicit opt-in skip-invalid-rows policy, recording it as a safety deviation.

## 7. Packaging and dependency choices

- Provisional repository name: `kiaradb-typescript`; provisional package name:
  `kiaradb` or an available owner-scoped name.
- One package initially, with logical modules rather than a multi-package monorepo.
- ESM and generated declarations first; explicit entry points for core,
  decorators/metadata setup, Java compatibility and worker adapter.
- Runtime core has no Node built-ins, DOM globals, filesystem access, network
  requests, `eval` or required server. Keep the core usable in a worker.
- TypeScript is a development dependency. The prepared config pins 5.9.3 as a
  conservative baseline, not a claim that it is the latest release.
- Select a stemming/date dependency only after parity, license and bundle-size
  evaluation. Avoid compulsory reflection and heavyweight NLP frameworks.
- Add Vitest for engine and API tests; Playwright for real-browser and demo tests;
  a browser bundle build and type-only consumer checks during implementation.
- Use a separate build configuration for emitting declarations and JS; the
  current config is intentionally type-check-oriented.
- Packaging gates: tarball consumer tests, exported entry points resolving,
  no Java reference datasets bundled accidentally, SPDX/license notices,
  declaration maps where useful and source maps without private input data.

## 8. Sequenced implementation plan

| Milestone | Prerequisites | Work | Exit criterion |
|---|---|---|---|
| M0: oracle and contract | Repository moved/attached to the chosen development workspace | Install development tooling in the initialized repository; preserve licenses; run Java on a compatible JDK/Maven setup; inventory all tests/public APIs; capture fixtures for demo 2.0.10 and selected baseline | Every one of the 448 source test declarations accounted for as executed, blocked or intentionally nonportable; baseline failures recorded, not labeled TS failures |
| M1: schema and adapters | M0 contract | Typed schema, standard decorators, metadata initialization, enums, factories, normalization and error taxonomy | Same schema/validation from class and object paths; empty-store and type-level tests pass |
| M2: storage and indexes | M1 | Trie loading/dedup, DFS bounds, all inverted/full-key indexes, ordered keys, interval structures and diagnostic serialization | Loader/index/range/serialization fixtures match Java; no silently skipped rows |
| M3: structured search | M2 | All 11 operators, condition overload mappings, null/range rules, projections and result limits | Complete operator x field-kind test matrix, including expected rejections, passes |
| M4: text and rules | M3 plus M0 text fixtures | Stemming, punctuation handling, one-edit, prediction, best match, preconditions, minimum match | Java text/config fixtures pass; tie and capacity behavior documented |
| M5: browser adapter and performance | M4 | Worker protocol, hydration, cancellation, progress, reload lifecycle, bundle validation | Real Chromium/Firefox/WebKit parity; main-thread responsiveness and memory measurements published |
| M6: demo and onboarding | M3 for movie UI; M4 for text/rules; M5 for final integration | Implement the separate [demo plan](demo-plan.md), API docs and migration guide | Guided examples, data provenance, accessibility and no-backend tests pass |
| M7: release qualification | M0-M6 | Full differential suite, package consumer tests, limitations review and versioning | Every parity row passes or has an explicitly accepted blocker; no unqualified "full parity" claim with open blockers |

Keep M0 and the high-risk numeric/date/decorator prototypes before large-scale
implementation. Do not defer these decisions until after writing the engine.

## 9. Validation strategy

1. Build a Java fixture exporter in the future test harness, not production
   code. Record source SHA, dependency version, Java version, locale/time zone,
   input schema/options, rows, conditions, projection, limits, matched keywords,
   output and exception category. Store long values as strings.
2. Map all 448 Java test declarations to TypeScript behavioral tests or a
   documented nonportable Java-only reflection assertion. Preserve intent when
   replacing Java reflection with explicit schema validation.
3. Run the same fixtures through decorators and plain schemas; then run the
   same query suite on the main thread and in a real worker.
4. Compare result values, normalization, nulls, cardinality, projection key case,
   numeric string formatting, keyword sets and error categories. Do not simply
   compare result counts. Compare ordering where it is promised.
5. Add adversarial cases: negative/fractional/large numbers, NaN/infinity,
   Java long boundaries, blank/list-null inputs, duplicate tokens/rows, Unicode,
   range endpoints/prefixes, leap dates and bad formats, conflicting metadata,
   stale/reused conditions, limits of zero/negative/one and keyword overflow.
6. Run randomized differential queries over small generated fixtures, followed
   by the checked-in movie and airport data where lawful to use.
7. Type-level tests must reject invalid field names, wrong value/operator
   combinations and wrong projection result types without casts to `any`.
8. Browser tests must run built distribution artifacts, not just source
   transpilation under Node. Check no Node polyfills or accidental DOM dependency
   in the core, and smoke-test a plain ESM consumer.

Java test groups to cover: PojoAdapterTest, StoreTest, CreateNodeTest,
MatchingChildTest, LoadTableTest, IndexTest1_30Test, IndexTest31_60Test,
IndexTest61_90Test, IndexKeys1_30Test, IndexKeys31_60Test, IndexKeys61_90Test,
OrderedKeysTest, SearchableRangeTest, LogicalUtilTest,
SpellCheckUtilTest, BooksTest, ConfigTest, CongressResignationsTest,
DeathYearTest, DummyObjectTest, MovieTest, MovieTestStore, NullTest, RangeTest
and SurveyTest.

### Proposed performance targets, not measured claims

Baseline the real 5,043-row movie and 7,698-row airport fixtures, then synthetic
10k/100k/1m sets where the device permits. Record browser/version, CPU, memory,
dataset checksum, repetitions, cold/warm state, bundle bytes and result size.

- On an agreed reference laptop: p95 warm selective query <= 25 ms at 100k
  rows, up to five conditions and at most 100 results.
- p95 airport predictions <= 16 ms for ten suggestions on the reference data.
- No main-thread task > 50 ms attributable to worker-based preparation;
  distinguish parsing, indexing, transfer and UI rendering.
- Provisional compressed core budget <= 75 KiB; report optional text/metadata
  entry-point sizes separately. Revisit through an explicit recorded decision
  if full compatibility cannot fit.
- Record peak memory and reload's old-plus-new-store peak; require no retained
  growth over ten create/dispose cycles beyond a measured 10% tolerance after
  supported GC stabilization. Do not claim a universal browser memory limit.

These are implementation acceptance targets, not evidence collected now.
Indexing, distinct-key counts, broad negative queries, keyword combinations and
result materialization all affect cost. Do not repeat an unconditional
"constant-time regardless of database size" claim.
