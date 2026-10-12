import type { Condition } from "../query/condition.js";
import type { KeywordSearchOptions, KeywordSearchResult } from "../query/keyword-search.js";
import type { FieldName } from "../schema/types.js";

export const WorkerOperation = {
  SEARCH: "search",
  SEARCH_PROJECTION: "searchProjection",
  SEARCH_LEGACY_PROJECTION: "searchLegacyProjection",
  KEYWORD_BEST_MATCH: "keywordBestMatch",
  KEYWORD_MINIMUM_MATCH: "keywordMinimumMatch",
} as const;

export type WorkerOperation = (typeof WorkerOperation)[keyof typeof WorkerOperation];

export interface WorkerSearchPayload<T extends object> {
  readonly conditions: readonly Condition<T>[];
  readonly limit?: number;
}

export interface WorkerProjectionPayload<T extends object> {
  readonly conditions: readonly Condition<T>[];
  readonly fields: readonly FieldName<T>[];
  readonly limit?: number;
}

export interface WorkerLegacyProjectionPayload<T extends object> {
  readonly conditions: readonly Condition<T>[];
  readonly fields?: readonly FieldName<T>[];
  readonly limit?: number;
}

export interface WorkerKeywordPayload<T extends object> {
  readonly input: string | readonly string[];
  readonly options?: KeywordSearchOptions<T>;
}

interface WorkerRequestBase {
  readonly requestId: string;
  readonly storeId: string;
}

export interface WorkerSearchRequest<T extends object> extends WorkerRequestBase {
  readonly operation: typeof WorkerOperation.SEARCH;
  readonly payload: WorkerSearchPayload<T>;
}

export interface WorkerProjectionRequest<T extends object> extends WorkerRequestBase {
  readonly operation: typeof WorkerOperation.SEARCH_PROJECTION;
  readonly payload: WorkerProjectionPayload<T>;
}

export interface WorkerLegacyProjectionRequest<T extends object> extends WorkerRequestBase {
  readonly operation: typeof WorkerOperation.SEARCH_LEGACY_PROJECTION;
  readonly payload: WorkerLegacyProjectionPayload<T>;
}

export interface WorkerKeywordBestMatchRequest<T extends object> extends WorkerRequestBase {
  readonly operation: typeof WorkerOperation.KEYWORD_BEST_MATCH;
  readonly payload: WorkerKeywordPayload<T>;
}

export interface WorkerKeywordMinimumMatchRequest<T extends object> extends WorkerRequestBase {
  readonly operation: typeof WorkerOperation.KEYWORD_MINIMUM_MATCH;
  readonly payload: WorkerKeywordPayload<T>;
}

export type WorkerRequest<T extends object> =
  | WorkerSearchRequest<T>
  | WorkerProjectionRequest<T>
  | WorkerLegacyProjectionRequest<T>
  | WorkerKeywordBestMatchRequest<T>
  | WorkerKeywordMinimumMatchRequest<T>;

export type WorkerPayload<T extends object> =
  | WorkerSearchPayload<T>
  | WorkerProjectionPayload<T>
  | WorkerLegacyProjectionPayload<T>
  | WorkerKeywordPayload<T>;

export interface WorkerProgressEvent {
  readonly requestId: string;
  readonly operation: WorkerOperation;
  readonly phase: "accepted" | "running" | "completed";
}

export interface WorkerSuccessResponse<T extends object> {
  readonly requestId: string;
  readonly storeId: string;
  readonly operation: WorkerOperation;
  readonly ok: true;
  readonly result:
    | readonly T[]
    | readonly Record<string, string | null>[]
    | readonly Pick<T, FieldName<T>>[]
    | KeywordSearchResult<T>;
}

export interface WorkerErrorResponse {
  readonly requestId: string;
  readonly storeId: string;
  readonly operation: WorkerOperation;
  readonly ok: false;
  readonly errorCode:
    | "STORE_NOT_FOUND"
    | "UNKNOWN_OPERATION"
    | "CANCELLED"
    | "EXECUTION_FAILED";
  readonly message: string;
}

export type WorkerResponse<T extends object> = WorkerSuccessResponse<T> | WorkerErrorResponse;

export interface WorkerExecutionControl {
  readonly isCancelled?: () => boolean;
  readonly onProgress?: (event: WorkerProgressEvent) => void;
}
