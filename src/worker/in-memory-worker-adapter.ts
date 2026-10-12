import { KeywordSearch } from "../query/keyword-search.js";
import type { FieldName } from "../schema/types.js";
import { Store } from "../store/store.js";
import {
  WorkerOperation,
  type WorkerExecutionControl,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol.js";

export class InMemoryWorkerAdapter<T extends object> {
  private readonly stores: Map<string, Store<T>>;

  public constructor(stores?: Map<string, Store<T>>) {
    this.stores = stores ?? new Map<string, Store<T>>();
  }

  public registerStore(storeId: string, store: Store<T>): void {
    this.stores.set(storeId, store);
  }

  public unregisterStore(storeId: string): void {
    this.stores.delete(storeId);
  }

  public async execute(
    request: WorkerRequest<T>,
    control: WorkerExecutionControl = {},
  ): Promise<WorkerResponse<T>> {
    const { requestId, storeId, operation } = request;

    control.onProgress?.({
      requestId,
      operation,
      phase: "accepted",
    });

    if (control.isCancelled?.() === true) {
      return {
        requestId: request.requestId,
        storeId: request.storeId,
        operation: request.operation,
        ok: false,
        errorCode: "CANCELLED",
        message: "Request was cancelled before execution.",
      };
    }

    const store = this.stores.get(request.storeId);
    if (store === undefined) {
      return {
        requestId: request.requestId,
        storeId: request.storeId,
        operation: request.operation,
        ok: false,
        errorCode: "STORE_NOT_FOUND",
        message: `Store "${request.storeId}" is not registered.`,
      };
    }

    control.onProgress?.({
      requestId: request.requestId,
      operation: request.operation,
      phase: "running",
    });

    if (control.isCancelled?.() === true) {
      return {
        requestId: request.requestId,
        storeId: request.storeId,
        operation: request.operation,
        ok: false,
        errorCode: "CANCELLED",
        message: "Request was cancelled during execution.",
      };
    }

    try {
      let result:
        | readonly T[]
        | readonly Record<string, string | null>[]
        | readonly Pick<T, FieldName<T>>[]
        | ReturnType<KeywordSearch<T>["bestMatch"]>;

      switch (request.operation) {
        case WorkerOperation.SEARCH: {
          const payload = request.payload;
          result = store.search(payload.conditions, payload.limit);
          break;
        }
        case WorkerOperation.SEARCH_PROJECTION: {
          const payload = request.payload;
          result = store.searchProjection(payload.conditions, payload.fields, payload.limit);
          break;
        }
        case WorkerOperation.SEARCH_LEGACY_PROJECTION: {
          const payload = request.payload;
          result = store.searchLegacyProjection(payload.conditions, payload.fields, payload.limit);
          break;
        }
        case WorkerOperation.KEYWORD_BEST_MATCH: {
          const payload = request.payload;
          const keywordSearch = new KeywordSearch(store);
          result = keywordSearch.bestMatch(payload.input, payload.options);
          break;
        }
        case WorkerOperation.KEYWORD_MINIMUM_MATCH: {
          const payload = request.payload;
          const keywordSearch = new KeywordSearch(store);
          result = keywordSearch.minimumMatch(payload.input, payload.options);
          break;
        }
        default:
          return {
            requestId,
            storeId,
            operation,
            ok: false,
            errorCode: "UNKNOWN_OPERATION",
            message: `Operation "${operation}" is not supported.`,
          };
      }

      control.onProgress?.({
        requestId: request.requestId,
        operation: request.operation,
        phase: "completed",
      });

      return {
        requestId: request.requestId,
        storeId: request.storeId,
        operation: request.operation,
        ok: true,
        result,
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        storeId: request.storeId,
        operation: request.operation,
        ok: false,
        errorCode: "EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Unknown execution failure.",
      };
    }
  }
}
