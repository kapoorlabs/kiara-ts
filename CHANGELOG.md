# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-10-18

### Added
- Typed schemas and decorators for defining searchable records.
- Structured filters, collection membership, and null-aware queries.
- Numeric, date, and date-time range searches.
- Keyword search, typo correction, stemming, and prefix predictions.
- Selected-field projections, result limits, and worker adapters.
- Runnable schema, decorator, and worker examples.

### Changed
- Package metadata hardened for public npm publication:
  - package renamed to `@kapoorlabs/kiara-ts`
  - `private` disabled
  - MIT license metadata
  - ESM entry points/exports and type declarations wired to `dist/`
  - explicit publish access and packed files list
