import { readFile } from "node:fs/promises";
import path from "node:path";

function maxAllowed(reference, absoluteMax, factor) {
  return Math.max(reference * factor, absoluteMax);
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

function assertMetric(name, value, reference, absoluteMax, factor) {
  const allowed = maxAllowed(reference, absoluteMax, factor);
  if (value > allowed) {
    throw new Error(
      `${name} regression: value=${value.toFixed(3)}ms exceeds allowed=${allowed.toFixed(3)}ms`,
    );
  }
}

async function main() {
  const profileArg = process.argv.find((arg) => arg.startsWith("--profile="));
  const profile = profileArg === undefined ? undefined : profileArg.split("=")[1];
  const defaultProfileBaseline = profile === "ci"
    ? "benchmarks/baselines/ci-default.json"
    : `benchmarks/baselines/${process.platform}-${process.arch}.json`;

  const baselineCandidate = process.env.BENCH_BASELINE_JSON ?? defaultProfileBaseline;
  const defaultBaselinePath = path.resolve("benchmarks/bench-baseline.json");
  const requestedBaselinePath = path.resolve(baselineCandidate);
  let baselinePath = requestedBaselinePath;

  let baseline;
  try {
    baseline = await readJson(baselinePath);
  } catch {
    baselinePath = defaultBaselinePath;
    baseline = await readJson(baselinePath);
  }

  const actualPath = path.resolve(
    process.env.BENCH_ACTUAL_JSON ?? "benchmarks/last-bench-run.json",
  );

  const actual = await readJson(actualPath);

  const prepareMs = actual.timings.prepareMs;
  const queryP95Ms = actual.timings.query.p95Ms;
  const workerRoundTripP95Ms = actual.timings.workerRoundTrip.p95Ms;
  const factor = baseline.regressionFactorMax;

  assertMetric(
    "prepareMs",
    prepareMs,
    baseline.prepareMsReference,
    baseline.prepareMsAbsoluteMax,
    factor,
  );
  assertMetric(
    "queryP95Ms",
    queryP95Ms,
    baseline.queryP95MsReference,
    baseline.queryP95MsAbsoluteMax,
    factor,
  );
  assertMetric(
    "workerRoundTripP95Ms",
    workerRoundTripP95Ms,
    baseline.workerRoundTripP95MsReference,
    baseline.workerRoundTripP95MsAbsoluteMax,
    factor,
  );

  console.log(
    JSON.stringify(
      {
        baselinePath,
        actualPath,
        status: "ok",
        checked: {
          prepareMs,
          queryP95Ms,
          workerRoundTripP95Ms,
        },
      },
      null,
      2,
    ),
  );
}

void main();
