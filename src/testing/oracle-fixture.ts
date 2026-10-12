import type { Condition } from "../query/condition.js";
import { buildPreparedStore } from "../store/store-loader.js";
import type { NormalizationProfile, StoreOptions } from "../store/types.js";
import type { CompiledSchema } from "../schema/types.js";

export interface OracleFixture<T extends object> {
  readonly id: string;
  readonly category?: string;
  readonly normalizationProfile: NormalizationProfile;
  readonly schema: CompiledSchema<T>;
  readonly rows: readonly T[];
  readonly conditions: readonly Condition<T>[];
  readonly expectedRowIndexes: readonly number[];
  readonly limit?: number;
}

export interface OracleFixtureResult<T extends object> {
  readonly id: string;
  readonly category?: string;
  readonly actualRowIndexes: readonly number[];
  readonly expectedRowIndexes: readonly number[];
  readonly results: readonly T[];
  readonly passed: boolean;
}

export interface OracleSuiteResult<T extends object> {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  readonly results: readonly OracleFixtureResult<T>[];
  readonly failedFixtureIds: readonly string[];
  readonly failedByCategory: Readonly<Record<string, number>>;
}

function findRowIndex<T extends object>(rows: readonly T[], row: T): number {
  return rows.findIndex((candidate) => candidate === row);
}

export function runOracleFixture<T extends object>(
  fixture: OracleFixture<T>,
): OracleFixtureResult<T> {
  const options: StoreOptions = { normalizationProfile: fixture.normalizationProfile };
  const store = buildPreparedStore(fixture.schema, fixture.rows, options);
  const results = store.search(fixture.conditions, fixture.limit);

  const actualRowIndexes = results
    .map((row) => findRowIndex(fixture.rows, row))
    .filter((index) => index >= 0);

  const passed = actualRowIndexes.length === fixture.expectedRowIndexes.length &&
    actualRowIndexes.every((index, position) => index === fixture.expectedRowIndexes[position]);

  return {
    id: fixture.id,
    ...(fixture.category === undefined ? {} : { category: fixture.category }),
    actualRowIndexes,
    expectedRowIndexes: fixture.expectedRowIndexes,
    results,
    passed,
  };
}

function collectFailedCategories<T extends object>(
  results: readonly OracleFixtureResult<T>[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const result of results) {
    if (result.passed) {
      continue;
    }
    const category = result.category ?? "uncategorized";
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}

export function runOracleSuite<T extends object>(
  fixtures: readonly OracleFixture<T>[],
): OracleSuiteResult<T> {
  const results = fixtures.map((fixture) => runOracleFixture(fixture));
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  const passRate = results.length === 0 ? 1 : passed / results.length;
  const failedFixtureIds = results.filter((result) => !result.passed).map((result) => result.id);
  const failedByCategory = collectFailedCategories(results);

  return {
    total: results.length,
    passed,
    failed,
    passRate,
    results,
    failedFixtureIds,
    failedByCategory,
  };
}
