import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCondition, type Condition } from "../query/condition.js";
import { Operator, type OperatorType } from "../query/operator.js";
import { defineSchema } from "../schema/define-schema.js";
import { longField, numberField, textField } from "../schema/field-factories.js";
import { NormalizationProfile } from "../store/types.js";
import {
  formatOracleBatchMismatchReport,
  runImportedOracleBatchFromJson,
} from "./oracle-differential-runner.js";
import { JAVA_IMPORTED_ORACLE_FIXTURE_FILES } from "./java-fixture-catalog.js";
import type { OracleImportedFixture } from "./oracle-import.js";

interface MovieRow {
  title: string;
  year: number;
  actors: string;
  rating: number;
}

interface RangeRow {
  name: string;
  window: string;
}

interface DateRow {
  event: string;
  day: string;
  milestones: string;
}

interface DateTimeRow {
  event: string;
  createdAt: string;
  touchpoints: string;
}

interface DateRangeRow {
  event: string;
  validDate: string;
  dateWindows: string;
  validTime: string;
  timeWindows: string;
}

interface NullRow {
  title: string;
  tags: string | null;
  score: number | null;
}

interface LongRow {
  label: string;
  longValue: string | number;
}

interface NumberCollectionNullRow {
  label: string;
  numbers: string | null;
}

interface RawCondition {
  readonly field: string;
  readonly operator?: OperatorType;
  readonly values?: readonly unknown[];
  readonly lowerValue?: unknown;
  readonly upperValue?: unknown;
}

const movieSchema = defineSchema<MovieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
  textField("actors", { secondaryType: "commaSeparatedStrings", caseInsensitive: true }),
  numberField("rating"),
]);

const rangeSchema = defineSchema<RangeRow>([
  textField("name", { caseInsensitive: true }),
  textField("window", { secondaryType: "numericRange" }),
]);

const dateSchema = defineSchema<DateRow>([
  textField("event", { caseInsensitive: true }),
  textField("day", { secondaryType: "dateFormat", format: "yyyy-MM-dd" }),
  textField("milestones", { secondaryType: "commaSeparatedDates", format: "yyyy-MM-dd" }),
]);

const dateTimeSchema = defineSchema<DateTimeRow>([
  textField("event", { caseInsensitive: true }),
  textField("createdAt", { secondaryType: "dateTimeFormat", format: "yyyy-MM-dd HH:mm:ss" }),
  textField("touchpoints", {
    secondaryType: "commaSeparatedDateTimes",
    format: "yyyy-MM-dd HH:mm:ss",
  }),
]);

const dateRangeSchema = defineSchema<DateRangeRow>([
  textField("event", { caseInsensitive: true }),
  textField("validDate", { secondaryType: "dateRange" }),
  textField("dateWindows", { secondaryType: "commaSeparatedDateRanges" }),
  textField("validTime", { secondaryType: "dateTimeRange" }),
  textField("timeWindows", { secondaryType: "commaSeparatedDateTimeRanges" }),
]);

const nullSchema = defineSchema<NullRow>([
  textField("title", { caseInsensitive: true }),
  textField("tags", {
    secondaryType: "commaSeparatedStrings",
    caseInsensitive: true,
    nullable: true,
  }),
  numberField("score", { nullable: true }),
]);

const longSchema = defineSchema<LongRow>([
  textField("label", { caseInsensitive: true }),
  longField("longValue"),
]);

const numberCollectionNullSchema = defineSchema<NumberCollectionNullRow>([
  textField("label", { caseInsensitive: true }),
  textField("numbers", {
    secondaryType: "commaSeparatedNumbers",
    nullable: true,
  }),
]);

function readFixture(filename: string): string {
  return readFileSync(new URL(`./fixtures/${filename}`, import.meta.url), "utf-8");
}

function toCondition<T extends object>(raw: RawCondition): Condition<T> {
  if (raw.operator === Operator.BETWEEN) {
    return createCondition<T, Extract<keyof T, string>>({
      field: raw.field as Extract<keyof T, string>,
      operator: Operator.BETWEEN,
      lowerValue: raw.lowerValue,
      upperValue: raw.upperValue,
    });
  }

  return createCondition<T, Extract<keyof T, string>>({
    field: raw.field as Extract<keyof T, string>,
    operator: raw.operator,
    values: raw.values ?? [],
  });
}

describe("java corpus imported-oracle smoke", () => {
  it("runs designated java-derived corpus fixtures through batch differential pipeline", () => {
    const fixtureDocuments = JAVA_IMPORTED_ORACLE_FIXTURE_FILES.map((filename) => readFixture(filename));
    const expectedFixtureCount = fixtureDocuments.reduce((sum, documentJson) => {
      const parsed = JSON.parse(documentJson) as {
        readonly metadata: { readonly sourceSha: string };
        readonly fixtures: readonly unknown[];
      };
      expect(parsed.metadata.sourceSha).toBe("568d1addd15e237a5fa2dfaf7538b193d5564773");
      return sum + parsed.fixtures.length;
    }, 0);

    const batch = runImportedOracleBatchFromJson(
      fixtureDocuments,
      (fixture) => {
        const imported = fixture as OracleImportedFixture & {
          readonly schema: string;
          readonly rows: readonly unknown[];
          readonly conditions: readonly RawCondition[];
        };
        if (imported.schema === "movie-sample-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: movieSchema,
            rows: imported.rows as readonly MovieRow[],
            conditions: imported.conditions.map((condition) => toCondition<MovieRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "range-sample-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: rangeSchema,
            rows: imported.rows as readonly RangeRow[],
            conditions: imported.conditions.map((condition) => toCondition<RangeRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "date-sample-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: dateSchema,
            rows: imported.rows as readonly DateRow[],
            conditions: imported.conditions.map((condition) => toCondition<DateRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "datetime-sample-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: dateTimeSchema,
            rows: imported.rows as readonly DateTimeRow[],
            conditions: imported.conditions.map((condition) => toCondition<DateTimeRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "date-range-sample-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: dateRangeSchema,
            rows: imported.rows as readonly DateRangeRow[],
            conditions: imported.conditions.map((condition) => toCondition<DateRangeRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "null-sample-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: nullSchema,
            rows: imported.rows as readonly NullRow[],
            conditions: imported.conditions.map((condition) => toCondition<NullRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "long-sample-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: longSchema,
            rows: imported.rows as readonly LongRow[],
            conditions: imported.conditions.map((condition) => toCondition<LongRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "number-collection-null-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: numberCollectionNullSchema,
            rows: imported.rows as readonly NumberCollectionNullRow[],
            conditions: imported.conditions.map((condition) =>
              toCondition<NumberCollectionNullRow>(condition)
            ),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        if (imported.schema === "collection-contrast-v1") {
          return {
            id: imported.id,
            normalizationProfile: NormalizationProfile.JAVA,
            schema: movieSchema,
            rows: imported.rows as readonly MovieRow[],
            conditions: imported.conditions.map((condition) => toCondition<MovieRow>(condition)),
            expectedRowIndexes: imported.expectedRowIndexes,
            limit: imported.limit,
          };
        }

        throw new Error(`Unsupported fixture schema "${imported.schema}".`);
      },
    );

    expect(batch.documentCount).toBe(JAVA_IMPORTED_ORACLE_FIXTURE_FILES.length);
    expect(batch.total).toBe(expectedFixtureCount);
    expect(batch.passed).toBe(expectedFixtureCount);
    expect(batch.failed).toBe(0);
    expect(batch.failedByCategory).toEqual({});
    expect(batch.mismatchSummary).toEqual([]);

    const report = formatOracleBatchMismatchReport(batch);
    expect(report).toContain(
      `documents=${JAVA_IMPORTED_ORACLE_FIXTURE_FILES.length} fixtures=${expectedFixtureCount} passed=${expectedFixtureCount} failed=0 passRate=100.00%`,
    );
    expect(report).toContain("| none | 0 | 0.00% |");
  });
});
