# Feature parity checklist

This checklist defines the parity surface. Row-by-row status and evidence are
tracked in [parity-ledger.md](parity-ledger.md), with blocker closure status in
[blocker-gates.md](blocker-gates.md). Baseline SHAs and limitations are in the
[migration plan](migration-plan.md). No feature is omitted merely because it
does not appear in the quick-start guide.

## A. All Java annotations

Source: [annotation package](https://github.com/kapoorlabs/kiara/tree/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/domain/annotations).
Each row has a class decorator equivalent and a plain-schema option.

| ID | Java annotation | TS mapping and required parity cases |
|---|---|---|
| A01 | `CaseInsensitive` | Case-insensitive field option; Java-mode storage/result lowercasing, query normalization and locale tests |
| A02 | `CommaSeperatedStrings` | CSV-string collection; token whitespace, repeated tokens, full-key indexes, blank/null members |
| A03 | `CommaSeperatedNumbers` | Numeric CSV collection; Java long-key conversion and native numeric alternative |
| A04 | `CommaSeperatedDates` | Date CSV collection; default `yyyy-MM-dd`, custom `value`, epoch-day keys |
| A05 | `CommaSeperatedDateTimes` | Date-time CSV collection; default `yyyy-MM-dd HH:mm:ss`, custom `value`, UTC epoch-second keys |
| A06 | `CommaSeperatedNumericRanges` | Range collection, prefixes, `numericStartPos` default zero and negative-position normalization |
| A07 | `CommaSeperatedDateRanges` | Date-range collection; custom/default format and malformed/boundary/null fixtures |
| A08 | `CommaSeperatedDateTimeRanges` | Date-time-range collection; custom/default format and point-containment fixtures |
| A09 | `DateFormat` | String-backed scalar date; default/custom format plus ISO fallback where Java uses it |
| A10 | `DateTimeFormat` | String-backed scalar local date-time interpreted at UTC for indexing; no host-local timezone conversion |
| A11 | `DateRange` | String-backed scalar date range with custom/default format |
| A12 | `DateTimeRange` | String-backed scalar date-time range with custom/default format |
| A13 | `NumericRange` | String-backed numeric/prefixed range; `numericStartPos`, single-point, signed and null cases |
| A14 | `IgnoreIndex` | Keep field available in results but forbid searching it; test keyword dictionary/index exclusion too |
| A15 | `OneEditAway` | Populate shared spelling/prediction dictionary; preserve single-correction behavior |
| A16 | `Predictable` | Same Java dictionary-capability flag as OneEditAway; prefix prediction and interaction tests |
| A17 | `StemmedIndex` | English Snowball-compatible token indexes and matching, combined with case/list flags |

Preserve the existing misspelled `Seperated` names as migration aliases while
documenting correctly spelled `Separated` names. Native arrays and structured
range objects are optional convenience inputs into the same engine, not
replacements for the Java string-backed representations.

Conflicting secondary-type annotations must be diagnosed. Any deterministic
resolution that differs from Java's observed annotation-processing behavior is
an explicit schema-safety deviation, not a silent precedence assumption.

## B. All Java operators

Source: [Operator](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/domain/Operator.java)
and [StoreSearch](https://github.com/kapoorlabs/kiara/blob/568d1addd15e237a5fa2dfaf7538b193d5564773/src/main/java/com/kapoorlabs/kiara/search/StoreSearch.java).

| ID | Operator | Required contract and tests |
|---|---|---|
| Q01 | `EQUAL` | Single/multiple query values; numeric/string/enum/boolean/date keys; normalized range equality |
| Q02 | `NOT_EQUAL` | Inverted-key complement and multiple excluded keys; characterize collection-token behavior rather than equating it with NOT_CONTAINS |
| Q03 | `LESS_THAN` | Exclusive sorted-key comparison, null ordering and supported scalar/collection types; range rejection |
| Q04 | `LESS_THAN_EQUAL` | Inclusive comparison, same type restrictions |
| Q05 | `GREATER_THAN` | Exclusive comparison, same type restrictions |
| Q06 | `GREATER_THAN_EQUAL` | Inclusive comparison, same type restrictions |
| Q07 | `BETWEEN` | Inclusive lower/upper values, constructor forms, missing/inverted bounds and unsupported range-type rejection |
| Q08 | `CONTAINS_EITHER` | Any matching member; for ranges, point containment by matching prefix and query lower endpoint |
| Q09 | `CONTAINS_ALL` | All specified members/points, same-row intersection, duplicates, nulls and multiple values |
| Q10 | `CONTAINS_EITHER_INCLUDING_NULL` | Java null-normalization expansion into CONTAINS_EITHER; numeric sentinel and collection cases |
| Q11 | `NOT_CONTAINS` | Collection-only exclusion via full collection keys; include numeric/date/range collections; reject scalars |

Create an executable operator x scalar/secondary-type compatibility table.
Test both allowed operations and Java's expected rejections; "all operators"
does not mean inventing support for combinations Java rejects. Include
cross-column AND, multiple conditions on the same field, OR-like multi-value
equality, empty values and reused conditions.

## C. Other observable capabilities

| ID | Java capability | TS plan / parity acceptance |
|---|---|---|
| F01 | POJO-backed generic Store | Decorated class or typed schema; field order, enum values, factory/accessor behavior and empty-schema errors |
| F02 | Simple data types | byte/short/int/long/float/double/char, boxed equivalents, string, boolean and enum mappings; preserve nullability and Java conversion behavior in compatibility mode |
| F03 | Field discovery and validation | Explicit metadata replaces reflection; tests for missing/inaccessible accessors become typed-schema/factory validation tests, not silently dropped requirements |
| F04 | Row loading | Incremental load calls before prepare; type/parse errors exposed with row/field context |
| F05 | Preparation and commit state | Build all indexes and interval structures; query-before-ready rejection, failed preparation and safe rebuild behavior |
| F06 | Deduplicated trie storage | Shared prefixes and duplicate rows; reconstruct matching records without composite indexes |
| F07 | Inverted string/numeric indexes | Normalized keys, node references, ordered-key search and Java numeric key quirks |
| F08 | Collection full-key index | Whole stored collection identity for exclusions; distinguish member and full-key semantics |
| F09 | Interval/range indexes | Prefix buckets, interval tree search, boundaries, single points, signed values, null ranges and invalid-order errors |
| F10 | Condition input forms | Default equality, scalar/iterable/array inputs, explicit operators and two-bound BETWEEN forms; adapters into one immutable query representation |
| F11 | Full model results | Reconstruct typed records/classes, enum/boolean/character/numeric conversions and Java-mode normalized text |
| F12 | Selected-field results | Native typed projection plus Java-compatible uppercase-column string/null maps; all fields when projection is null/empty; unknown-field diagnostics |
| F13 | Query result limits | Both model and projection query overloads, null/unlimited, zero/negative and limit application order |
| F14 | Keyword best match | Sentence and set-of-phrases inputs; optional preconditions and result limits; report matched keyword set and typed result list |
| F15 | Keyword capacity | Constructor maximum, truncation diagnostics, duplicated/unmatched words, safe combinatorial counting |
| F16 | Keyword minimum match | Best-match postfilter using distinct non-null nonnumeric field values; config hierarchy fixtures, not invented rule precedence |
| F17 | Punctuation cleanup | Existing removeStopWords behavior; punctuation, brackets, spacing and phrase handling |
| F18 | One-edit correction | Single result/null, minimum input length, insertion/deletion/substitution examples and exact-word behavior |
| F19 | Text predictions | Shared trie, prefix matching, top-N, empty/unknown prefixes, BFS/character ordering |
| F20 | English stemming | Same algorithmic outputs as OpenNLP Snowball ENGLISH on a corpus and combinations with list/case/typo features |
| F21 | Diagnostic trie serialization | Parent IDs with `#`, records with `~`, BFS traversal, two-decimal numeric formatting and nulls; clarify lack of reload API |
| F22 | Error taxonomy | All nine custom Java exception categories mapped to documented JS Error classes/codes; useful contextual errors across worker boundary |
| F23 | Public helpers/diagnostics | Preserve useful adapter, parser, numeric, logical and spell helper capabilities in a compatibility entry point; test observable helper contracts |
| F24 | Exposed domain/index types | Port required structures; provide read-only inspection where useful. Do not promise externally mutable Java internals as a safe TS public API; explicitly list any nonportable mutator in the M0 API ledger |

For F02, Java has no native arbitrary nested-object/list storage; secondary
collections are serialized strings. Supporting native JS objects or arrays is
an extension, not evidence that legacy serialized formats may be dropped.

## D. Complete production-file accounting

The 57 production files fall into the following non-overlapping groups. This
inventory prevents accidentally overlooking less-visible classes; it is not a
commitment to expose every Java implementation class unchanged in TypeScript.

| Group | Files/classes | Disposition |
|---|---|---|
| Entry points and model adaptation (5) | PojoAdapter, Store, StoreLoader, StoreSearch, KeywordSearch | Equivalent capabilities and familiar compatibility entry points |
| Query/result models (6) | Condition, Operator, KeywordColPair, KeywordConditionsPair, KeywordSearchResult, MatchesForKeyword | Public typed conditions/results; internal keyword bookkeeping where appropriate |
| Index/schema/storage models (12) | NullableOrderedString, OrderedKeys, Range, SBTree, SBTreeElement, SdqlColumn, SdqlNode, SearchableRange, SecondaryCollectionDataType, SecondarySingleDataType, SecondaryType, SpellCheckNode | Port algorithms/metadata; preserve relevant tests and documented diagnostics |
| Dictionary model (1) | SpellCheckTrie | Dictionary construction, correction and prediction |
| Annotations (17) | A01-A17 above | All mapped to decorators and schema options |
| Exceptions (9) | ColumnNotFoundException, EmptyColumnException, IndexingException, InsufficientDataException, LoadDataException, NoDefaultConstructorException, NonSupportedOperationException, RangeOutOfOrderException, UnknownRangeFormatException | JS error codes/classes; NoDefaultConstructor maps to invalid/missing result factory where appropriate |
| Parser/utilities (4) | RangeParser, LogicalUtil, NumericUtil, SpellCheckUtil | Shared compatibility primitives; do not duplicate logic across API paths |
| Constants (3) | Delimiters, ExceptionConstants, SdqlConstants | Preserve format/default/error semantics; isolate legacy sentinels and misspelled internal identifiers |

Lombok generates additional getters/setters/constructors absent as handwritten
methods. M0 must inventory generated public signatures as well as source methods.
Internal mutation and Java reflection mechanics may require TS-specific
equivalents; classify each as supported, internalized with equivalent diagnostics,
or explicitly blocked. Do not hide such decisions behind a file-count claim.

## E. Release sign-off

For every A/Q/F row attach:

- Java source/test references and TS test identifiers.
- Expected outputs, supported input combinations and expected errors.
- Status: planned / implemented / verified / blocked.
- Any intentional deviation, reason, workaround and approval.

Until all rows are verified or explicitly accepted as blocked with documented
deviations, describe the package as an in-progress port, not a full-parity
replacement.
