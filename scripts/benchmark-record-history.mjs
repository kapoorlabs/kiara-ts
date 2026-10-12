import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function readJson(filePath) {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

async function main() {
  const actualPath = path.resolve(
    process.env.BENCH_ACTUAL_JSON ?? "benchmarks/last-bench-run.json",
  );
  const historyPath = path.resolve(
    process.env.BENCH_HISTORY_JSON ?? `benchmarks/history/${process.platform}-${process.arch}.json`,
  );

  const current = await readJson(actualPath);
  const record = {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    rows: current.rows,
    queryIterations: current.queryIterations,
    workerIterations: current.workerIterations,
    timings: current.timings,
  };

  await mkdir(path.dirname(historyPath), { recursive: true });

  let history = [];
  try {
    history = await readJson(historyPath);
    if (!Array.isArray(history)) {
      history = [];
    }
  } catch {
    history = [];
  }

  history.push(record);
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf-8");

  console.log(
    JSON.stringify(
      {
        status: "ok",
        historyPath,
        entries: history.length,
      },
      null,
      2,
    ),
  );
}

void main();
