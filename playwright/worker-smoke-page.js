import { BrowserWorkerClient, WorkerOperation } from "../dist/index.js";

const worker = new Worker("/playwright/worker-smoke.worker.js", { type: "module" });
const client = new BrowserWorkerClient(worker);
const phases = [];

const response = await client.execute(
  {
    requestId: "pw-1",
    storeId: "movies",
    operation: WorkerOperation.SEARCH,
    payload: {
      conditions: [
        {
          field: "title",
          operator: "EQUAL",
          values: ["cast away"],
        },
      ],
    },
  },
  {
    onProgress: (event) => phases.push(event.phase),
  },
);

window.__workerSmokeResult = {
  phases,
  response,
};

client.dispose();
worker.terminate();
