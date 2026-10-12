import { performance } from "node:perf_hooks";
import { MessageChannel } from "node:worker_threads";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BrowserWorkerClient,
  InMemoryWorkerAdapter,
  NormalizationProfile,
  Store,
  WorkerOperation,
  attachBrowserWorkerHost,
  defineSchema,
  numberField,
  textField,
} from "../dist/index.js";

function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1),
  );
  return sortedValues[index];
}

function summarizeDurations(durationsMs) {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const total = durationsMs.reduce((sum, value) => sum + value, 0);
  return {
    count: durationsMs.length,
    minMs: sorted[0] ?? 0,
    meanMs: durationsMs.length === 0 ? 0 : total / durationsMs.length,
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

function wrapMessagePort(port) {
  const listeners = new Map();
  port.start();

  return {
    postMessage(message) {
      port.postMessage(message);
    },
    addEventListener(_type, listener) {
      const handler = (message) => listener({ data: message });
      listeners.set(listener, handler);
      port.on("message", handler);
    },
    removeEventListener(_type, listener) {
      const handler = listeners.get(listener);
      if (handler === undefined) {
        return;
      }
      port.off("message", handler);
      listeners.delete(listener);
    },
  };
}

function createRows(rowCount) {
  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push({
      title: `Movie ${index}`,
      year: 1980 + (index % 45),
      actors: index % 3 === 0 ? "Tom Hanks, Meg Ryan" : "Bill Paxton, Helen Hunt",
      rating: 6 + (index % 5),
    });
  }
  return rows;
}

async function main() {
  const rowCount = Number.parseInt(process.env.BENCH_ROWS ?? "10000", 10);
  const queryIterations = Number.parseInt(process.env.BENCH_QUERY_ITERATIONS ?? "200", 10);
  const workerIterations = Number.parseInt(process.env.BENCH_WORKER_ITERATIONS ?? "100", 10);

  const schema = defineSchema([
    textField("title", { caseInsensitive: true }),
    numberField("year"),
    textField("actors", { secondaryType: "commaSeparatedStrings", caseInsensitive: true }),
    numberField("rating"),
  ]);

  const rows = createRows(rowCount);
  const store = new Store(schema, { normalizationProfile: NormalizationProfile.JAVA });

  const loadStart = performance.now();
  for (const row of rows) {
    store.loadRow(row);
  }
  const loadMs = performance.now() - loadStart;

  const prepareStart = performance.now();
  store.prepare();
  const prepareMs = performance.now() - prepareStart;

  const queryDurations = [];
  for (let index = 0; index < queryIterations; index += 1) {
    const start = performance.now();
    store.search([
      {
        field: "actors",
        operator: "CONTAINS_EITHER",
        values: ["tom hanks"],
      },
      {
        field: "year",
        operator: "GREATER_THAN_EQUAL",
        values: [1995],
      },
    ], 100);
    queryDurations.push(performance.now() - start);
  }

  const adapter = new InMemoryWorkerAdapter();
  adapter.registerStore("bench-store", store);

  const channel = new MessageChannel();
  const clientPort = wrapMessagePort(channel.port1);
  const hostPort = wrapMessagePort(channel.port2);
  const detach = attachBrowserWorkerHost(hostPort, adapter);
  const client = new BrowserWorkerClient(clientPort);

  const workerDurations = [];
  for (let index = 0; index < workerIterations; index += 1) {
    const requestId = `bench-${index}`;
    const start = performance.now();
    const response = await client.execute({
      requestId,
      storeId: "bench-store",
      operation: WorkerOperation.SEARCH,
      payload: {
        conditions: [
          {
            field: "title",
            operator: "EQUAL",
            values: [`movie ${index % rowCount}`],
          },
        ],
      },
    });
    if (!response.ok) {
      throw new Error(`Worker benchmark request failed: ${response.errorCode}`);
    }
    workerDurations.push(performance.now() - start);
  }

  client.dispose();
  detach();
  channel.port1.close();
  channel.port2.close();

  const summary = {
    rows: rowCount,
    queryIterations,
    workerIterations,
    timings: {
      loadMs,
      prepareMs,
      query: summarizeDurations(queryDurations),
      workerRoundTrip: summarizeDurations(workerDurations),
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const outputPath = process.env.BENCH_OUTPUT_JSON ?? "benchmarks/last-bench-run.json";
  const absoluteOutputPath = path.resolve(outputPath);
  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
}

void main();
