# Browser-only Kiara DB demo plan

## 1. Purpose and delivery

Build a Vite + vanilla TypeScript demo to keep attention on Kiara rather than a
framework. It should work as static hosting with no Java runtime or query server.
Use an `examples/browser-demo` npm workspace in the future repository, depending
on the actual local package. Keep core-package installation independent of demo
dependencies. A separate demo repository can follow if useful; it is not needed
for the first release.

This is a plan only. No UI, API implementation, fixtures or deployment were created.

## 2. Java reference and data audit

Reference: [kiara-demo at the inspected commit](https://github.com/kapoorlabs/kiara-demo/tree/37b36c4031c8163a27293d044ca57fc84f53b8d7).

| Existing example | Evidence / behavior | Browser equivalent |
|---|---|---|
| Movie query page | `movie.html`; controller endpoints `queyAndGetSelectedMovieAttributes` and `queyAndGetAllMovieAttributes`; conditions plus optional filterSet | Typed query builder and JSON request view; full-record or selected-field results without HTTP query calls |
| Movie keyword page | `keyword.html`; comma-separated phrases lowercased by controller; best match, maximum ten keywords and 100 results | Phrase chips, matched keywords, typo/stemming explanation and result titles |
| Airport page | `airport.html`; typeAhead endpoint, top ten; lowercased data; prefix suggestions then one-edit fallback | Accessible combobox with identical dictionary sources and clearly labeled fallback |
| Config example | ConfigStore has a standalone `main`, not an exposed demo page; six country/city/airline surcharge rules | New interactive explanation of existing Java minimum-match behavior |

Data inspected:

- Movie CSV: **5,043 data rows**, 23 columns, 1,446,978 bytes. These are input
  counts, not guaranteed unique indexed/result counts after deduplication.
- Airport CSV: **7,698 data rows**, three columns, 185,644 bytes.
- Movie schema has actors, color, director_name, num_critic_for_reviews,
  duration, director_facebook_likes, gross, genres, movie_title,
  num_voted_users, cast_total_facebook_likes, face_number_in_poster,
  plot_keywords, movie_imdb_link, num_user_for_reviews, language, country,
  content_rating, budget, title_year, imdb_score, aspect_ratio and
  movie_facebook_likes.
- Explicitly map CSV `facenumber_in_poster` to model `face_number_in_poster`.
- Airport CSV `airportName`, `country`, `airportCode` maps to model airportName,
  countryName and airportCode. Java lowercases all three before loading.
- Movie actors/director/genres/plot keywords carry the Java case, one-edit,
  collection and stemming annotations; reproduce the combinations, not merely
  a text input that searches every raw column.

Use a real CSV parser, not splitting lines/commas. Preserve null/empty input,
numeric conversion and Java normalization in compatibility fixtures. Show
source count, loaded count, deduplicated count where available and rejected
rows with reasons. Do not copy Java demo's silent continue-on-load-error behavior.

Both repositories license code under Apache-2.0. Dataset redistribution rights
remain to be established independently. Until resolved, develop with clearly
licensed or synthetic fixtures and label any replacement prominently. Do not
bundle or host the original IMDb-derived data merely because it is on GitHub.

## 3. Guided experiences

### Screen 1: Ten-minute quick start

- Three-step walkthrough: define a decorated class or plain schema, load and
  prepare local data, execute a query.
- Toggle between class/decorator and decorator-free schema representations.
  Both must run the same fixture and return equivalent results.
- Display readiness/progress and a direct explanation of why preparation is
  required; disable search until ready.
- Show a small, copyable future integration example and a link to API docs.
  No framework boilerplate or backend credentials.

### Screen 2: Movie query explorer

- Add/remove typed conditions; field-aware operator choices; scalar/list and
  BETWEEN editors; selected attributes; result limit and readable errors.
- Read-only JSON request panel using Java's fieldName/operator/values and
  lowerValue/upperValue shapes; optional validated import for migration practice.
- Full typed record view versus Java-compatible uppercase string-map view.
- Presets: multi-value equality, duration/score threshold, year BETWEEN,
  actor/genre CONTAINS_EITHER, plot-keyword CONTAINS_ALL, NOT_EQUAL and NOT_CONTAINS.
- Recreate the README's 14-condition **Cast Away** query. On the original
  approved dataset, verify its exact result against Java instead of assuming
  the README remains correct. On synthetic data, use an explicitly labeled
  equivalent fixture rather than claiming the original expected result.
- Show elapsed engine time separately from transfer/rendering time, result
  count and a paged/virtualized display. UI paging is not a new core offset API.
- Make decimal behavior visible: explain Java-compatible truncated numeric
  index semantics versus an explicitly selected native-number mode.

### Screen 3: Keyword movie search

- Sentence and phrase-set modes; comma-delimited phrase chips preserve names
  containing spaces instead of always splitting them into independent words.
- Show returned matched keyword set, corrected terms and selected movie titles.
- Add structured preconditions and result-limit controls.
- Presets demonstrate casing, stemming, one-edit correction, unknown words,
  punctuation handling and the configured maximum.
- Warn when keywords are truncated or a budget is exceeded; no fake "no results"
  response when an operation failed.

### Screen 4: Airport autocomplete

- Search airport names, country names and IATA codes from the same dictionary.
- Display at most ten suggestions using prefix prediction, then the Java-style
  one-edit fallback when no prediction exists.
- If fallback returns null, render no suggestion rather than a literal null item.
  Record this as a correction to the demo UI, not a change to core correction semantics.
- Arrow keys, Enter and Escape; labeled listbox/combobox, screen-reader status,
  visible focus and no stale results replacing newer input.
- Selection can show matching airport records through the existing best-match
  capability. This adds UI around the Java service, not a new database operator.

### Screen 5: Hierarchical configuration

- Display the six Java demo rules: in -> 2.00; usa -> 1.00; usa/dl -> 3.00;
  usa/nyc -> 2.50; usa/nyc/aa -> 4.50; usa/nyc/dl -> 5.50.
- Country/city/airline controls create the keyword sentence. Show best-match
  and minimum-match results side by side, including matched keywords.
- Explain null as an unspecified rule dimension, numeric surcharge excluded
  from minimum-match dimension counting, and unknown-keyword behavior.
- Keep demo `usa` separate from the library ConfigTest's `us` fixtures.
- Expected fixture examples include usa alone -> 1.00 and usa/nyc/dl -> 5.50,
  verified against the pinned demo/library versions before asserting success.
- Do not advertise a generalized priority or wildcard engine beyond what
  Java's minimum-match algorithm actually guarantees.

### Screen 6: Feature parity playground

The original movie/airport datasets do not demonstrate every Java annotation.
Add a tiny synthetic model with dates, date-times, numeric/prefixed ranges,
date/date-time ranges, all seven collection annotations, ignored fields,
enums, nullable values and all search-assist flags.

Provide at least one successful or expected-error example for each of the
17 annotation rows and 11 operator rows in the [parity matrix](feature-parity.md).
Include range-boundary failures, ignored-field search errors, null-aware
containment, all projection styles and legacy trie diagnostic output.
Do not add arbitrary large datasets just to demonstrate a single annotation.

## 4. Runtime and UI architecture

- Static assets and approved data are fetched once; all preparation and querying
  after load occur locally. No query telemetry or uploads.
- Small quick-start fixture can run synchronously; larger demo stores live in a
  module worker to keep the UI responsive.
- Worker messages carry request ID, store ID, operation, serializable parameters
  and typed success/error envelopes. Discard stale responses; cancellation must
  interrupt/chunk expensive work or terminate/rebuild a worker deliberately.
  Merely posting a cancel message to a blocked worker is not cancellation.
- Register model schemas inside the worker; do not serialize class constructors.
- Expose fetch/parse/index timing, readiness, failed state, retry and reload.
  On reload retain the old usable store until the replacement is ready, or
  explicitly release it first when the documented memory budget requires it.
- No SharedArrayBuffer/cross-origin-isolation requirement. No mandatory
  IndexedDB or service worker in the first demo.
- Render dataset strings as text; validate optional CSV uploads by size/schema
  and keep them local. Imported query JSON is data, never executable code.
- Responsive layout, keyboard navigation, high contrast and usable empty/error
  states are acceptance requirements, not later polish.

## 5. Build sequence and dependency gates

| Step | Library prerequisite | Deliverable / acceptance |
|---|---|---|
| D0: fixture and design audit | M0 | Data provenance decision, approved/synthetic fixtures and Java golden expected outputs |
| D1: shell and quick start | M1-M2 | Static app, schema toggle, loading states and shared model definitions |
| D2: movie query UI | M3 | Condition editor, projection/limit results and all structured presets |
| D3: text and rules screens | M4 | Keyword, airport and config scenarios match fixtures |
| D4: worker and feature playground | M5 | Same results via worker; all annotation/operator examples and responsive interaction |
| D5: docs and publication | M6-M7 | Packaged-library consumer, static deployment, accessibility and end-to-end tests pass |

Use the built package in final tests, not deep imports into internal source files.
Document local startup and production static-hosting steps once scripts actually
exist. Do not publish a demo that appears to use Kiara while actually querying a
mock array filter or remote Java service.

## 6. Demo validation and success criteria

- Playwright tests in Chromium, Firefox and WebKit for every guided preset,
  loading failures, invalid queries, zero matches and retry.
- Verify exact returned values and matched keywords, not only visible row counts.
- Verify class and plain-schema modes produce identical results.
- Assert all queries continue working after data load with outbound API requests
  blocked; a cold reload offline is not promised without a cache/service worker.
- Confirm capped suggestion count, keyboard behavior, stale-response handling
  and worker errors. Verify cancellation using an intentionally expensive case.
- Report data download, parse, prepare, query, transfer and render time separately.
- Meet the performance targets in the migration plan on the documented reference
  device; include a mobile smoke test without pretending desktop limits apply.
- Confirm public assets contain no secrets or unauthorized datasets.
- Have a new developer follow the quick start without assistance and complete
  the first class-backed query in ten minutes; record friction and improve docs.

The demo is complete only when it teaches real, verified library behavior and
requires no backend to execute searches.
