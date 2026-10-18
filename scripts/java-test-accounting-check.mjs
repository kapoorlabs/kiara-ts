import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOTAL_DECLARATIONS = 448;
const EXPECTED_CLASS_COUNT = 25;
const EXPECTED_SOURCE_SHA = "568d1addd15e237a5fa2dfaf7538b193d5564773";
const VALID_STATUSES = new Set(["covered", "nonportable", "missing"]);

const argv = process.argv.slice(2);
const writeSummary = argv.includes("--write-summary");

function parseIntegerOption(optionName) {
  const prefix = `${optionName}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  if (match === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(match.slice(prefix.length), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value for ${optionName}.`);
  }

  return parsed;
}

const maxMissing = parseIntegerOption("--max-missing");
const minCovered = parseIntegerOption("--min-covered");

const ledgerPath = path.resolve("docs/java-test-accounting-ledger.json");
const summaryPath = path.resolve("docs/java-test-accounting-summary.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summarizeByClass(declarations) {
  const byClass = new Map();
  for (const declaration of declarations) {
    const current = byClass.get(declaration.className) ?? {
      className: declaration.className,
      sourcePath: declaration.sourcePath,
      total: 0,
      covered: 0,
      nonportable: 0,
      missing: 0,
    };

    current.total += 1;
    current[declaration.status] += 1;
    byClass.set(declaration.className, current);
  }

  return [...byClass.values()].sort((a, b) => a.className.localeCompare(b.className));
}

function percentage(numerator, denominator) {
  if (denominator === 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function main() {
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  const declarations = Array.isArray(ledger.declarations) ? ledger.declarations : [];
  const totals = { covered: 0, nonportable: 0, missing: 0 };
  const seenIds = new Set();

  assert(ledger.metadata?.sourceSha === EXPECTED_SOURCE_SHA, `sourceSha mismatch in ${ledgerPath}`);
  assert(
    ledger.metadata?.totalDeclarations === EXPECTED_TOTAL_DECLARATIONS,
    `metadata.totalDeclarations must be ${EXPECTED_TOTAL_DECLARATIONS}`,
  );

  for (const declaration of declarations) {
    assert(typeof declaration.id === "string" && declaration.id.length > 0, "Declaration id is required.");
    assert(!seenIds.has(declaration.id), `Duplicate declaration id: ${declaration.id}`);
    seenIds.add(declaration.id);

    assert(
      typeof declaration.className === "string" && declaration.className.length > 0,
      `Declaration ${declaration.id} missing className.`,
    );
    assert(
      typeof declaration.methodName === "string" && declaration.methodName.length > 0,
      `Declaration ${declaration.id} missing methodName.`,
    );
    assert(
      typeof declaration.sourcePath === "string" && declaration.sourcePath.length > 0,
      `Declaration ${declaration.id} missing sourcePath.`,
    );
    assert(VALID_STATUSES.has(declaration.status), `Declaration ${declaration.id} has invalid status.`);

    if (declaration.status === "covered" || declaration.status === "nonportable") {
      assert(
        Array.isArray(declaration.tsEvidence) && declaration.tsEvidence.length > 0,
        `Declaration ${declaration.id} with status "${declaration.status}" must include tsEvidence.`,
      );
    }

    if (declaration.status === "nonportable") {
      assert(
        typeof declaration.notes === "string" && declaration.notes.trim().length > 0,
        `Declaration ${declaration.id} with status "nonportable" must include rationale notes.`,
      );
    }

    totals[declaration.status] += 1;
  }

  assert(
    declarations.length === EXPECTED_TOTAL_DECLARATIONS,
    `Expected ${EXPECTED_TOTAL_DECLARATIONS} declarations, found ${declarations.length}.`,
  );

  const byClass = summarizeByClass(declarations);
  assert(
    byClass.length === EXPECTED_CLASS_COUNT,
    `Expected ${EXPECTED_CLASS_COUNT} classes, found ${byClass.length}.`,
  );

  const totalFromStatuses = toNumber(totals.covered) + toNumber(totals.nonportable) + toNumber(totals.missing);
  assert(
    totalFromStatuses === EXPECTED_TOTAL_DECLARATIONS,
    "Status totals do not reconcile to expected declaration count.",
  );

  const summary = {
    sourceSha: ledger.metadata.sourceSha,
    totalDeclarations: EXPECTED_TOTAL_DECLARATIONS,
    classCount: EXPECTED_CLASS_COUNT,
    statuses: totals,
    coveragePercent: percentage(totals.covered + totals.nonportable, EXPECTED_TOTAL_DECLARATIONS),
    byClass,
  };

  if (maxMissing !== undefined) {
    assert(
      summary.statuses.missing <= maxMissing,
      `Missing declarations ${summary.statuses.missing} exceed max-missing threshold ${maxMissing}.`,
    );
  }

  if (minCovered !== undefined) {
    assert(
      summary.statuses.covered >= minCovered,
      `Covered declarations ${summary.statuses.covered} are below min-covered threshold ${minCovered}.`,
    );
  }

  if (writeSummary) {
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  console.log(
    [
      `Java test accounting: ${summary.totalDeclarations} declarations across ${summary.classCount} classes`,
      `covered=${summary.statuses.covered}`,
      `nonportable=${summary.statuses.nonportable}`,
      `missing=${summary.statuses.missing}`,
      `coverage=${summary.coveragePercent.toFixed(2)}%`,
    ].join(" | "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
