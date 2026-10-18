# Java exception family -> TypeScript error parity map

This map pins how Java Kiara exception families are represented in the TS port.
It documents intentional adaptation where Java reflection-specific behavior does
not directly translate to TypeScript.

## Mapping table

| Java exception family | TS error code/class | Notes |
|---|---|---|
| `ColumnNotFoundException` | `QUERY_INVALID_CONDITION` / `QueryValidationError` | Unknown field references in queries/projections are reported as invalid conditions. |
| `EmptyColumnException` | `SCHEMA_EMPTY` / `SchemaValidationError` | Empty schema definitions are rejected at compile time. |
| `IndexingException` | `QUERY_INVALID_CONDITION`, `NORMALIZATION_INVALID_NUMBER`, `NORMALIZATION_INVALID_TEXT` | Index/normalization failures are surfaced as explicit query/normalization errors. |
| `InsufficientDataException` | `QUERY_EMPTY_CONDITIONS` / `QueryValidationError` | Empty/insufficient query condition sets are rejected. |
| `LoadDataException` | `QUERY_INVALID_CONDITION` or `STORE_INVALID_STATE` | Invalid values and invalid load/query state transitions are explicit errors. |
| `NoDefaultConstructorException` | `DECORATOR_MISUSE` / `DecoratorError` | Mapped to invalid/missing metadata/schema-construction constraints in TS. |
| `NonSupportedOperationException` | `QUERY_INVALID_CONDITION` / `QueryValidationError` | Unsupported operator/field combinations are rejected with details. |
| `RangeOutOfOrderException` | `QUERY_INVALID_CONDITION` / `QueryValidationError` | Invalid range ordering is treated as an invalid query constraint. |
| `UnknownRangeFormatException` | `QUERY_INVALID_CONDITION` / `QueryValidationError` | Unsupported/invalid range/date formats are explicit query validation failures. |

## Worker-boundary propagation contract

- Worker adapters preserve typed Kiara error codes and details over the worker
  protocol (instead of collapsing to a generic execution failure).
- Covered by:
  - [in-memory-worker-adapter.test.ts](../src/worker/in-memory-worker-adapter.test.ts)
  - [browser-worker-adapter.test.ts](../src/worker/browser-worker-adapter.test.ts)
