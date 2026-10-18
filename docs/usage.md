# Kiara TS usage guide

Start with either the [decorator quick start](../README.md#decorator-quick-start)
or the [schema quick start](../README.md#schema-quick-start).
The sections below describe the main API choices without requiring knowledge of
the implementation or its development history.

## Schemas and decorators

Use `defineSchema<T>(fields)` with `textField`, `numberField`, `longField`,
`booleanField`, and `enumField`. Field names are checked against your record type.
For enums, supply the allowed values: `enumField("tier", ["silver", "gold"])`.

Common field options:

| Option | Purpose |
|---|---|
| `caseInsensitive` | Normalize text case for matching |
| `ignoreIndex` | Exclude a field from search; attempts to query it throw |
| `stemmedIndex` | Enable English stemming in keyword search |
| `oneEditAway`, `predictable` | Dictionary-related field metadata |
| `secondaryType` | Interpret serialized collections, dates, or ranges |
| `format` | Set a supported date/date-time format |

Choose your numeric profile when constructing a store:

- `NormalizationProfile.NATIVE`: preserves fractional number keys; rejects
  non-finite numeric inputs.
- `NormalizationProfile.JAVA` (default): uses long-key conversion, including
  truncation of fractional numbers and saturation at long boundaries.
  Use native mode when decimal comparisons must preserve fractions.

For class decorators, use TypeScript standard decorators, not legacy
`experimentalDecorators`. Call `initializeDecoratorMetadata()` **before**
declaring decorated classes. Give each field a type decorator such as `@Text()`
or `@NumberField()`, then add options such as `@CaseInsensitive()`.
Pass `getEntitySchema(YourClass)` to `Store`.

## Store lifecycle

1. Create a `Store` with a schema.
2. Call `loadRows(records)` (or `loadRow(record)` for one record at a time).
3. Call `prepare()` before querying. It builds the internal indexes.
4. Use `search(conditions)` or `queryAll()` to retrieve records.

Loading after preparation throws. For an atomic replacement, use
`new StoreLoader(store).replaceAll(newRows)`, which returns a new prepared store
and leaves the original intact. `beginLoading()` instead clears the current
store so you can load and prepare again.

Treat loaded records and inspection results as read-only. Data and indexes live
in memory; this is not a persistent database.

## Structured queries

Build conditions with `createCondition({ field, operator, values })`.
The default operator is `EQUAL`. Conditions in a search are combined with AND.
`BETWEEN` takes `lowerValue` and `upperValue` instead of `values`.

| Field family | Operators |
|---|---|
| Text, enum, boolean scalars | `EQUAL`, `NOT_EQUAL` |
| Numbers and scalar dates/date-times | Equality, `LESS_THAN`, `LESS_THAN_EQUAL`, `GREATER_THAN`, `GREATER_THAN_EQUAL`, `BETWEEN` |
| Collections | Equality, `CONTAINS_EITHER`, `CONTAINS_ALL`, `CONTAINS_EITHER_INCLUDING_NULL`, `NOT_CONTAINS` |
| Ranges and range collections | Equality, `CONTAINS_EITHER`, `CONTAINS_ALL`, `NOT_CONTAINS` |

Use `CONTAINS_EITHER` for collection membership, not scalar `EQUAL`.
Collection `NOT_EQUAL` excludes a whole collection key, while `NOT_CONTAINS`
excludes rows containing a matching member.

Secondary types are configured on fields and stored as serialized strings:

- Collections: `commaSeparatedStrings`, `commaSeparatedNumbers`,
  `commaSeparatedDates`, `commaSeparatedDateTimes`.
- Scalar dates: `dateFormat`, `dateTimeFormat`.
- Ranges: `numericRange`, `dateRange`, `dateTimeRange`.
- Range collections: `commaSeparatedNumericRanges`, `commaSeparatedDateRanges`,
  `commaSeparatedDateTimeRanges`.

Example values include `"red,blue"`, `"2026-10-18"`,
`"2026-10-18 09:30:00"`, and `"10->20"`.
Range containment tests points against stored intervals. Do not assume arbitrary
Java date-format patterns are supported; unsupported formats throw.

For a null scalar, use `values: [null]`. On collections,
`CONTAINS_EITHER_INCLUDING_NULL` with `values: [null, "blue"]` matches null
collections or a matching member. Range types do not support that operator.

## Projections and limits

- `store.search(conditions, limit)` returns full records.
- `store.searchProjection(conditions, fields, limit)` returns selected
  properties with their original types.
- `store.searchLegacyProjection(conditions, fields, limit)` returns uppercase
  field names and string/null values.

Omit `limit` for all matches. A non-positive limit returns no rows.
Typed projections require at least one field. Legacy projections select all
fields when the selection is omitted or empty.

## Keyword search

Construct `new KeywordSearch(store, maxKeywords)`; the default keyword cap is 10.
Call `bestMatch(input, options)` or `minimumMatch(input, options)`.
Input can be a sentence or an array of phrases. Options include:

- `fields`: restrict the searchable text fields.
- `conditions`: apply structured filters alongside keyword matching.
- `limit`: cap returned records.

Results include `results`, `matchedKeywords`, `correctedKeywords`,
`usedKeywords`, and `truncated`. Check `truncated` when accepting long input.
Enable `stemmedIndex` on appropriate fields for English stemming.

## Dictionary and autocomplete

```ts
import { DictionaryTrie } from "@kapoorlabs/kiara-ts";

const dictionary = new DictionaryTrie();
dictionary.addText("apollo airport");
console.log(dictionary.predict("apo", 5)); // ["apollo"]
console.log(dictionary.getOneEditCandidate("apolo")); // "apollo"
```

Predictions return dictionary words, not matching records. One-edit correction
supports insertion, deletion, or substitution and returns a candidate or `null`.

## Workers

`InMemoryWorkerAdapter` provides the request/response protocol on the current
thread. Register stores with `registerStore(id, store)` before `execute(request)`.
Requests carry `requestId`, `storeId`, `operation`, and `payload`.

Supported operations are search, typed/legacy projections, and keyword
best/minimum matching. Check the returned `ok` flag before using the result.

For actual background execution, create a browser module Web Worker, construct
and register the store inside it, and connect `attachBrowserWorkerHost` to a
`BrowserWorkerClient` on the main thread. Pass serializable messages, not Store
instances or schema functions. The bridge supports progress and cancellation;
cancellation is not a guarantee of interrupting synchronous work immediately.

## Errors and diagnostics

Catch `KiaraError` to inspect a library error's `code`, `message`, and `details`.
More specific classes include `SchemaValidationError`, `DecoratorError`,
`NormalizationError`, `QueryValidationError`, and `StoreStateError`.
Worker requests instead return an error response with `ok: false`.

Inspect a prepared store with `getPreparedTrieSnapshot()` or
`getPreparedData()`. Use `getDiagnosticTrieSerialization()` for diagnostic text.
These are inspection tools, not persistence or reload APIs; do not mutate
returned index structures.
