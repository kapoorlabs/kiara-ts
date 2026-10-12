import { BrowserWorkerClient, WorkerOperation } from "../dist/index.js";

async function runSingleQuery(workerUrl, queryTitle, requestId, signal) {
  const worker = new Worker(workerUrl, { type: "module" });
  const client = new BrowserWorkerClient(worker);
  try {
    return await client.execute(
      {
        requestId,
        storeId: "movies",
        operation: WorkerOperation.SEARCH,
        payload: {
          conditions: [
            {
              field: "title",
              operator: "EQUAL",
              values: [queryTitle],
            },
          ],
        },
      },
      signal === undefined ? {} : { signal },
    );
  } finally {
    client.dispose();
    worker.terminate();
  }
}

function createWorkerUrl(rows, delayMs = 0) {
  return `/playwright/worker-stress.worker.js?rows=${rows}&delayMs=${delayMs}`;
}

const params = new URL(window.location.href).searchParams;
const rows = Number.parseInt(params.get("rows") ?? "5000", 10);
const repeats = Number.parseInt(params.get("repeats") ?? "20", 10);
const concurrency = Number.parseInt(params.get("concurrency") ?? "10", 10);
const cancellationRaces = Number.parseInt(params.get("cancellationRaces") ?? "20", 10);
const delayedCancellationMs = Number.parseInt(params.get("delayedCancellationMs") ?? "15", 10);
const cancellationRows = Number.parseInt(params.get("cancellationRows") ?? `${Math.min(rows, 2000)}`, 10);

const workerUrl = createWorkerUrl(rows, 0);
const largeDatasetResponse = await runSingleQuery(
  workerUrl,
  `movie ${Math.max(0, rows - 1)}`,
  "stress-large-1",
);

let repeatedSuccesses = 0;
for (let index = 0; index < repeats; index += 1) {
  const response = await runSingleQuery(workerUrl, `movie ${index}`, `stress-repeat-${index}`);
  if (response.ok) {
    repeatedSuccesses += 1;
  }
}

const sharedWorker = new Worker(workerUrl, { type: "module" });
const sharedClient = new BrowserWorkerClient(sharedWorker);
const concurrentRequests = await Promise.all(
  Array.from({ length: concurrency }, (_, index) =>
    sharedClient.execute({
      requestId: `stress-concurrent-${index}`,
      storeId: "movies",
      operation: WorkerOperation.SEARCH,
      payload: {
        conditions: [
          {
            field: "title",
            operator: "EQUAL",
            values: [`movie ${index % Math.max(1, rows)}`],
          },
        ],
      },
    })),
);
const concurrentSuccesses = concurrentRequests.filter((response) => response.ok).length;
sharedClient.dispose();
sharedWorker.terminate();

let cancelledResponses = 0;
for (let index = 0; index < cancellationRaces; index += 1) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 0);
  const response = await runSingleQuery(
    createWorkerUrl(cancellationRows, delayedCancellationMs),
    "movie 10",
    `stress-cancel-${index}`,
    controller.signal,
  );
  if (!response.ok && response.errorCode === "CANCELLED") {
    cancelledResponses += 1;
  }
}

window.__workerStressResult = {
  rows,
  repeats,
  concurrency,
  cancellationRaces,
  cancellationRows,
  largeDatasetResponse,
  repeatedSuccesses,
  concurrentSuccesses,
  cancelledResponses,
};
