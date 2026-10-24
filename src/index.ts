export {
  DecoratorError,
  KiaraError,
  NormalizationError,
  QueryValidationError,
  SchemaValidationError,
  StoreStateError,
  type KiaraErrorCode,
  type KiaraErrorDetails,
} from "./errors.js";

export { defineSchema } from "./schema/define-schema.js";
export {
  booleanField,
  enumField,
  longField,
  numberField,
  textField,
} from "./schema/field-factories.js";
export type {
  CompiledSchema,
  FieldKind,
  FieldName,
  FieldOptions,
  ResultFactory,
  SchemaField,
  SchemaFieldInput,
  SchemaOptions,
  SecondaryType,
  ValueAccessor,
} from "./schema/types.js";

export {
  BooleanField,
  CaseInsensitive,
  CommaSeparatedDateRanges,
  CommaSeparatedDateTimeRanges,
  CommaSeparatedDateTimes,
  CommaSeparatedDates,
  CommaSeparatedNumbers,
  CommaSeparatedNumericRanges,
  CommaSeparatedStrings,
  CommaSeperatedDateRanges,
  CommaSeperatedDateTimeRanges,
  CommaSeperatedDateTimes,
  CommaSeperatedDates,
  CommaSeperatedNumbers,
  CommaSeperatedNumericRanges,
  CommaSeperatedStrings,
  DateFormat,
  DateRange,
  DateTimeFormat,
  DateTimeRange,
  Entity,
  EnumField,
  IgnoreIndex,
  LongField,
  NumericRange,
  NumberField,
  OneEditAway,
  Predictable,
  StemmedIndex,
  Text,
  getEntitySchema,
} from "./decorators/entity.js";
export {
  assertDecoratorMetadataAvailable,
  initializeDecoratorMetadata,
} from "./decorators/metadata.js";

export {
  javaLongRange,
  normalizeJavaLongKey,
  normalizeNativeNumber,
  normalizeText,
} from "./normalization/numeric.js";
export {
  normalizeDateTimeToEpochSecond,
  normalizeDateToEpochDay,
} from "./normalization/date.js";
export {
  parseDateRangeValue,
  parseDateTimeRangeValue,
  parseNumericRangeValue,
  type DateRangeValue,
  type NumericRangeValue,
} from "./normalization/range.js";

export { createCondition, validateConditions, type Condition } from "./query/condition.js";
export {
  KeywordSearch,
  type KeywordSearchOptions,
  type KeywordSearchResult,
} from "./query/keyword-search.js";
export { validateOperatorCompatibility } from "./query/operator-compatibility.js";
export { Operator, type Operator as OperatorType } from "./query/operator.js";
export { StoreSearch } from "./query/store-search.js";
export { QueryInterpreter, editQueryFragment } from "./query/query-interpreter.js";
export type {
  InterpretationFieldOptions,
  QueryInterpreterOptions,
  QueryFragment,
  InterpretedFilter,
  InterpretationIssue,
  QueryInterpretation,
} from "./query/query-interpreter.js";
export { StoreLoader, buildPreparedStore } from "./store/store-loader.js";
export { Store } from "./store/store.js";
export { StoreState, type StoreState as StoreStateType } from "./store/store-state.js";
export { serializeTrieSnapshot } from "./store/trie-diagnostics.js";
export { NormalizationProfile, type StoreOptions } from "./store/types.js";
export { DictionaryTrie } from "./text/dictionary-trie.js";
export { extractKeywordTokens, sanitizeKeywordText } from "./text/keyword-utils.js";
export { stemEnglishToken } from "./text/stemming.js";
export {
  parseOracleFixtureDocument,
  type OracleExportMetadata,
  type OracleFixtureDocument,
  type OracleImportedFixture,
} from "./testing/oracle-import.js";
export {
  formatOracleBatchMismatchReport,
  runImportedOracleBatch,
  runImportedOracleBatchFromJson,
  runImportedOracleSuite,
  type ImportedFixtureBatchResolver,
  type ImportedFixtureResolver,
  type ImportedOracleBatchOptions,
  type ImportedOracleBatchResult,
  type OracleCategoryMismatch,
  type ImportedOracleSuiteOptions,
} from "./testing/oracle-differential-runner.js";
export { InMemoryWorkerAdapter } from "./worker/in-memory-worker-adapter.js";
export {
  attachBrowserWorkerHost,
  BrowserWorkerClient,
  type BrowserWorkerExecuteOptions,
  type WorkerCancelEnvelope,
  type WorkerInboundEnvelope,
  type WorkerMessagePort,
  type WorkerOutboundEnvelope,
  type WorkerProgressEnvelope,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from "./worker/browser-worker-adapter.js";
export {
  WorkerOperation,
  type WorkerExecutionControl,
  type WorkerKeywordBestMatchRequest,
  type WorkerKeywordMinimumMatchRequest,
  type WorkerKeywordPayload,
  type WorkerLegacyProjectionPayload,
  type WorkerLegacyProjectionRequest,
  type WorkerProjectionPayload,
  type WorkerProjectionRequest,
  type WorkerPayload,
  type WorkerProgressEvent,
  type WorkerRequest,
  type WorkerSearchPayload,
  type WorkerSearchRequest,
  type WorkerResponse,
} from "./worker/protocol.js";
