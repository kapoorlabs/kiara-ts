import { InMemoryWorkerAdapter } from "./in-memory-worker-adapter.js";
import type {
  WorkerExecutionControl,
  WorkerProgressEvent,
  WorkerRequest,
  WorkerResponse,
} from "./protocol.js";

interface MessageEventLike {
  readonly data: unknown;
}

type MessageListener = (event: MessageEventLike) => void;

export interface WorkerMessagePort {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "message", listener: MessageListener): void;
}

export interface WorkerRequestEnvelope<T extends object> {
  readonly type: "request";
  readonly request: WorkerRequest<T>;
}

export interface WorkerCancelEnvelope {
  readonly type: "cancel";
  readonly requestId: string;
}

export type WorkerInboundEnvelope<T extends object> =
  | WorkerRequestEnvelope<T>
  | WorkerCancelEnvelope;

export interface WorkerProgressEnvelope {
  readonly type: "progress";
  readonly event: WorkerProgressEvent;
}

export interface WorkerResponseEnvelope<T extends object> {
  readonly type: "response";
  readonly response: WorkerResponse<T>;
}

export type WorkerOutboundEnvelope<T extends object> =
  | WorkerProgressEnvelope
  | WorkerResponseEnvelope<T>;

interface PendingRequest<T extends object> {
  readonly resolve: (response: WorkerResponse<T>) => void;
  readonly onProgress?: (event: WorkerProgressEvent) => void;
}

export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
}

export interface BrowserWorkerExecuteOptions {
  readonly signal?: AbortSignalLike;
  readonly onProgress?: (event: WorkerProgressEvent) => void;
}

function isWorkerProgressEnvelope(message: unknown): message is WorkerProgressEnvelope {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Record<string, unknown>).type === "progress"
  );
}

function isWorkerResponseEnvelope<T extends object>(
  message: unknown,
): message is WorkerResponseEnvelope<T> {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Record<string, unknown>).type === "response"
  );
}

export class BrowserWorkerClient<T extends object> {
  private readonly worker: WorkerMessagePort;
  private readonly pendingByRequestId = new Map<string, PendingRequest<T>>();
  private readonly listener: MessageListener;

  public constructor(worker: WorkerMessagePort) {
    this.worker = worker;
    this.listener = (event) => {
      if (isWorkerProgressEnvelope(event.data)) {
        const pending = this.pendingByRequestId.get(event.data.event.requestId);
        pending?.onProgress?.(event.data.event);
        return;
      }

      if (isWorkerResponseEnvelope<T>(event.data)) {
        const pending = this.pendingByRequestId.get(event.data.response.requestId);
        if (pending === undefined) {
          return;
        }
        this.pendingByRequestId.delete(event.data.response.requestId);
        pending.resolve(event.data.response);
      }
    };
    this.worker.addEventListener("message", this.listener);
  }

  public dispose(): void {
    this.worker.removeEventListener("message", this.listener);
    this.pendingByRequestId.clear();
  }

  public execute(
    request: WorkerRequest<T>,
    options: BrowserWorkerExecuteOptions = {},
  ): Promise<WorkerResponse<T>> {
    if (options.signal?.aborted === true) {
      return Promise.resolve({
        requestId: request.requestId,
        storeId: request.storeId,
        operation: request.operation,
        ok: false,
        errorCode: "CANCELLED",
        message: "Request was cancelled before dispatch.",
      });
    }

    return new Promise((resolve) => {
      this.pendingByRequestId.set(request.requestId, {
        resolve,
        ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
      });

      const abortListener = (): void => {
        this.worker.postMessage({
          type: "cancel",
          requestId: request.requestId,
        } satisfies WorkerCancelEnvelope);
      };

      options.signal?.addEventListener("abort", abortListener, { once: true });

      this.worker.postMessage({
        type: "request",
        request,
      } satisfies WorkerRequestEnvelope<T>);
    });
  }
}

function isWorkerCancelEnvelope(message: unknown): message is WorkerCancelEnvelope {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Record<string, unknown>).type === "cancel" &&
    typeof (message as Record<string, unknown>).requestId === "string"
  );
}

function isWorkerRequestEnvelope<T extends object>(message: unknown): message is WorkerRequestEnvelope<T> {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as Record<string, unknown>).type === "request" &&
    typeof (message as Record<string, unknown>).request === "object"
  );
}

export function attachBrowserWorkerHost<T extends object>(
  port: WorkerMessagePort,
  adapter: InMemoryWorkerAdapter<T>,
): () => void {
  const cancelledRequestIds = new Set<string>();
  const inflightControls = new Map<string, WorkerExecutionControl>();

  const listener: MessageListener = (event) => {
    if (isWorkerCancelEnvelope(event.data)) {
      cancelledRequestIds.add(event.data.requestId);
      return;
    }

    if (!isWorkerRequestEnvelope<T>(event.data)) {
      return;
    }

    const { request } = event.data;
    const control: WorkerExecutionControl = {
      isCancelled: () => cancelledRequestIds.has(request.requestId),
      onProgress: (progressEvent) => {
        port.postMessage({
          type: "progress",
          event: progressEvent,
        } satisfies WorkerProgressEnvelope);
      },
    };

    inflightControls.set(request.requestId, control);
    void adapter.execute(request, control).then((response) => {
      inflightControls.delete(request.requestId);
      cancelledRequestIds.delete(request.requestId);
      port.postMessage({
        type: "response",
        response,
      } satisfies WorkerResponseEnvelope<T>);
    });
  };

  port.addEventListener("message", listener);

  return () => {
    port.removeEventListener("message", listener);
    inflightControls.clear();
    cancelledRequestIds.clear();
  };
}
