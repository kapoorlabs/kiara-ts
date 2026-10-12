import type { OracleFixture, OracleSuiteResult } from "./oracle-fixture.js";
import { runOracleSuite } from "./oracle-fixture.js";
import {
  parseOracleFixtureDocument,
  type OracleFixtureDocument,
  type OracleImportedFixture,
} from "./oracle-import.js";

export type ImportedFixtureResolver<T extends object> = (
  importedFixture: OracleImportedFixture,
  index: number,
) => OracleFixture<T>;

export interface ImportedOracleSuiteOptions {
  readonly classifyFeature?: (importedFixture: OracleImportedFixture, index: number) => string;
}

export type ImportedFixtureBatchResolver<T extends object> = (
  importedFixture: OracleImportedFixture,
  fixtureIndex: number,
  documentIndex: number,
  document: OracleFixtureDocument,
) => OracleFixture<T>;

export interface ImportedOracleBatchOptions {
  readonly classifyFeature?: (
    importedFixture: OracleImportedFixture,
    fixtureIndex: number,
    documentIndex: number,
    document: OracleFixtureDocument,
  ) => string;
}

export interface OracleCategoryMismatch {
  readonly category: string;
  readonly failed: number;
  readonly failureShare: number;
}

export interface ImportedOracleBatchResult<T extends object> {
  readonly documentCount: number;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  readonly failedFixtureIds: readonly string[];
  readonly failedByCategory: Readonly<Record<string, number>>;
  readonly mismatchSummary: readonly OracleCategoryMismatch[];
  readonly suites: readonly OracleSuiteResult<T>[];
}

export function formatOracleBatchMismatchReport<T extends object>(
  batch: ImportedOracleBatchResult<T>,
): string {
  const header = [
    `documents=${batch.documentCount}`,
    `fixtures=${batch.total}`,
    `passed=${batch.passed}`,
    `failed=${batch.failed}`,
    `passRate=${(batch.passRate * 100).toFixed(2)}%`,
  ].join(" ");

  const lines = [
    header,
    "| Category | Failed | Failure Share |",
    "|---|---:|---:|",
  ];

  if (batch.mismatchSummary.length === 0) {
    lines.push("| none | 0 | 0.00% |");
    return lines.join("\n");
  }

  for (const entry of batch.mismatchSummary) {
    lines.push(
      `| ${entry.category} | ${entry.failed} | ${(entry.failureShare * 100).toFixed(2)}% |`,
    );
  }

  return lines.join("\n");
}

function inferFeatureCategory(fixtureId: string): string {
  const trimmed = fixtureId.trim();
  if (trimmed.length === 0) {
    return "uncategorized";
  }

  const parts = trimmed.split(/[:/_-]+/g);
  const [head] = parts;
  if (head === undefined || head.length === 0) {
    return "uncategorized";
  }

  return head.toLowerCase();
}

export function runImportedOracleSuite<T extends object>(
  document: OracleFixtureDocument,
  resolver: ImportedFixtureResolver<T>,
  options: ImportedOracleSuiteOptions = {},
): OracleSuiteResult<T> {
  const executableFixtures = document.fixtures.map((fixture, index) => {
    const resolvedFixture = resolver(fixture, index);
    const category = options.classifyFeature?.(fixture, index) ?? inferFeatureCategory(fixture.id);
    return {
      ...resolvedFixture,
      category: resolvedFixture.category ?? category,
    };
  });
  return runOracleSuite(executableFixtures);
}

function mergeCategoryCounts(
  aggregate: Record<string, number>,
  categoryCounts: Readonly<Record<string, number>>,
): void {
  for (const [category, count] of Object.entries(categoryCounts)) {
    aggregate[category] = (aggregate[category] ?? 0) + count;
  }
}

function buildMismatchSummary(
  failedByCategory: Readonly<Record<string, number>>,
  totalFailed: number,
): readonly OracleCategoryMismatch[] {
  return Object.entries(failedByCategory)
    .map(([category, failed]) => ({
      category,
      failed,
      failureShare: totalFailed === 0 ? 0 : failed / totalFailed,
    }))
    .sort((left, right) => {
      if (left.failed !== right.failed) {
        return right.failed - left.failed;
      }
      return left.category.localeCompare(right.category);
    });
}

export function runImportedOracleBatch<T extends object>(
  documents: readonly OracleFixtureDocument[],
  resolver: ImportedFixtureBatchResolver<T>,
  options: ImportedOracleBatchOptions = {},
): ImportedOracleBatchResult<T> {
  const suites: OracleSuiteResult<T>[] = [];
  const failedByCategory: Record<string, number> = {};

  let total = 0;
  let passed = 0;
  let failed = 0;
  const failedFixtureIds: string[] = [];

  documents.forEach((document, documentIndex) => {
    const suiteOptions: ImportedOracleSuiteOptions = options.classifyFeature === undefined
      ? {}
      : {
          classifyFeature: (fixture, fixtureIndex) =>
            options.classifyFeature?.(fixture, fixtureIndex, documentIndex, document) ??
            inferFeatureCategory(fixture.id),
        };

    const suite = runImportedOracleSuite<T>(
      document,
      (fixture, fixtureIndex) =>
        resolver(fixture, fixtureIndex, documentIndex, document),
      suiteOptions,
    );

    suites.push(suite);
    total += suite.total;
    passed += suite.passed;
    failed += suite.failed;

    for (const id of suite.failedFixtureIds) {
      failedFixtureIds.push(`${document.metadata.sourceSha}:${id}`);
    }

    mergeCategoryCounts(failedByCategory, suite.failedByCategory);
  });

  return {
    documentCount: documents.length,
    total,
    passed,
    failed,
    passRate: total === 0 ? 1 : passed / total,
    failedFixtureIds,
    failedByCategory,
    mismatchSummary: buildMismatchSummary(failedByCategory, failed),
    suites,
  };
}

export function runImportedOracleBatchFromJson<T extends object>(
  serializedDocuments: readonly string[],
  resolver: ImportedFixtureBatchResolver<T>,
  options: ImportedOracleBatchOptions = {},
): ImportedOracleBatchResult<T> {
  const documents = serializedDocuments.map((json) => parseOracleFixtureDocument(json));
  return runImportedOracleBatch(documents, resolver, options);
}
