# Java test-accounting progress (declaration-level baseline)

Baseline target: **448** Java `@Test` declarations from
`kapoorlabs/kiara@568d1addd15e237a5fa2dfaf7538b193d5564773`.

This ledger is now declaration-level and CI-validated.

## Source of truth

- Declaration ledger: [java-test-accounting-ledger.json](./java-test-accounting-ledger.json)
- Generated summary: [java-test-accounting-summary.json](./java-test-accounting-summary.json)
- Validator script: [java-test-accounting-check.mjs](../scripts/java-test-accounting-check.mjs)

## Current totals

- `covered`: **448**
- `nonportable`: **0**
- `missing`: **0**
- Reconciliation: `covered + nonportable + missing = 448` ✅

> Note: row-level A/Q/F parity in [parity-ledger.md](./parity-ledger.md) is fully
> verified. Declaration-level mapping is now in progress and enforced with CI
> thresholds to prevent regression while remaining classes are mapped.

### First mapped declaration batch

The following Java classes are currently mapped to concrete TypeScript evidence
and marked `covered` in the ledger:

- `MovieTest` (42 declarations)
- `RangeTest` (18 declarations)
- `NullTest` (3 declarations)
- `PojoAdapterTest` (35 declarations)

### Second mapped declaration batch

- `CreateNodeTest` (46 declarations)
- `IndexKeys1_30Test` (28 declarations)
- `IndexKeys31_60Test` (30 declarations)
- `IndexKeys61_90Test` (30 declarations)
- `IndexTest1_30Test` (12 declarations)
- `IndexTest31_60Test` (16 declarations)
- `IndexTest61_90Test` (28 declarations)

### Final mapped declaration batch

- `BooksTest` (13 declarations)
- `ConfigTest` (9 declarations)
- `CongressResignationsTest` (9 declarations)
- `DeathYearTest` (20 declarations)
- `DummyObjectTest` (5 declarations)
- `LoadTableTest` (8 declarations)
- `LogicalUtilTest` (25 declarations)
- `MatchingChildTest` (9 declarations)
- `MovieTestStore` (9 declarations)
- `OrderedKeysTest` (10 declarations)
- `SearchableRangeTest` (9 declarations)
- `SpellCheckUtilTest` (16 declarations)
- `StoreTest` (1 declaration)
- `SurveyTest` (17 declarations)

## How CI enforces drift checks

`npm run accounting:java:check` validates:

1. Source SHA remains pinned to the declared Java baseline.
2. Declaration count remains 448.
3. Class count remains 25.
4. Every declaration has a valid status (`covered` | `nonportable` | `missing`).
5. Status totals reconcile exactly to 448.

`npm run accounting:java:check:ci` adds baseline mapping thresholds:

- `missing <= 0`
- `covered >= 448`

`npm run test:parity:gate` includes the CI thresholded accounting check.

## Next accounting milestones

1. Keep `java-test-accounting-summary.json` updated via:
   - `npm run accounting:java:sync`
2. For any future Java baseline SHA update, regenerate declaration inventory and re-map deltas before changing CI thresholds.
