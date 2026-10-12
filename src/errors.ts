export type KiaraErrorCode =
  | "SCHEMA_EMPTY"
  | "SCHEMA_DUPLICATE_FIELD"
  | "SCHEMA_INVALID_FIELD_NAME"
  | "SCHEMA_INVALID_ENUM"
  | "SCHEMA_INVALID_SECONDARY_TYPE"
  | "DECORATOR_METADATA_UNAVAILABLE"
  | "DECORATOR_MISUSE"
  | "NORMALIZATION_INVALID_NUMBER"
  | "NORMALIZATION_INVALID_TEXT"
  | "STORE_INVALID_STATE"
  | "QUERY_EMPTY_CONDITIONS"
  | "QUERY_INVALID_CONDITION";

export interface KiaraErrorDetails {
  readonly [key: string]: unknown;
}

export class KiaraError extends Error {
  public readonly code: KiaraErrorCode;
  public readonly details: KiaraErrorDetails | undefined;

  public constructor(
    code: KiaraErrorCode,
    message: string,
    details?: KiaraErrorDetails,
  ) {
    super(message);
    this.name = "KiaraError";
    this.code = code;
    this.details = details;
  }
}

export class SchemaValidationError extends KiaraError {
  public constructor(message: string, code: KiaraErrorCode, details?: KiaraErrorDetails) {
    super(code, message, details);
    this.name = "SchemaValidationError";
  }
}

export class DecoratorError extends KiaraError {
  public constructor(message: string, code: KiaraErrorCode, details?: KiaraErrorDetails) {
    super(code, message, details);
    this.name = "DecoratorError";
  }
}

export class QueryValidationError extends KiaraError {
  public constructor(message: string, code: KiaraErrorCode, details?: KiaraErrorDetails) {
    super(code, message, details);
    this.name = "QueryValidationError";
  }
}

export class NormalizationError extends KiaraError {
  public constructor(message: string, code: KiaraErrorCode, details?: KiaraErrorDetails) {
    super(code, message, details);
    this.name = "NormalizationError";
  }
}

export class StoreStateError extends KiaraError {
  public constructor(message: string, details?: KiaraErrorDetails) {
    super("STORE_INVALID_STATE", message, details);
    this.name = "StoreStateError";
  }
}
