import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { Operator } from "../query/operator.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { NormalizationProfile } from "../store/types.js";
import { runOracleSuite, type OracleFixture } from "./oracle-fixture.js";

interface ScaleRow {
  title: string;
  year: number;
  actors: string | null;
  rating: number;
  tags: string | null;
}

const schema = defineSchema<ScaleRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
  textField("actors", {
    caseInsensitive: true,
    secondaryType: "commaSeparatedStrings",
    nullable: true,
  }),
  numberField("rating"),
  textField("tags", {
    caseInsensitive: true,
    secondaryType: "commaSeparatedStrings",
    nullable: true,
  }),
]);

function generateRows(size: number): ScaleRow[] {
  const rows: ScaleRow[] = [];
  for (let i = 0; i < size; i += 1) {
    const year = 1980 + (i % 50);
    const actors = i % 13 === 0
      ? null
      : i % 5 === 0
      ? "Tom Hanks, Bill Paxton"
      : i % 2 === 0
      ? "Tom Hanks, Helen Hunt"
      : "Meg Ryan, Sandra Bullock";
    const rating = (i % 100) / 10;
    const tags = i % 11 === 0
      ? null
      : i % 3 === 0
      ? "alpha,beta"
      : i % 4 === 0
      ? "beta,delta"
      : "gamma,delta";
    rows.push({
      title: `Movie ${i}`,
      year,
      actors,
      rating,
      tags,
    });
  }
  return rows;
}

function computeExpectedIndexes(
  rows: readonly ScaleRow[],
  predicate: (row: ScaleRow) => boolean,
  limit?: number,
): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row !== undefined && predicate(row)) {
      indexes.push(index);
      if (limit !== undefined && limit > 0 && indexes.length >= limit) {
        break;
      }
    }
  }
  return indexes;
}

function hasToken(value: string | null, token: string): boolean {
  if (value === null) {
    return false;
  }
  return value.toLowerCase().split(",").map((entry) => entry.trim()).includes(token.toLowerCase());
}

function buildFixtures(rows: readonly ScaleRow[]): readonly OracleFixture<ScaleRow>[] {
  const betweenAndContainsLimit = 100;

  return [
    {
      id: "scale:between-and-contains-limit",
      category: "operator",
      normalizationProfile: NormalizationProfile.JAVA,
      schema,
      rows,
      conditions: [
        createCondition<ScaleRow, "year">({
          field: "year",
          operator: Operator.BETWEEN,
          lowerValue: 1990,
          upperValue: 1999,
        }),
        createCondition<ScaleRow, "actors">({
          field: "actors",
          operator: Operator.CONTAINS_EITHER,
          values: ["tom hanks"],
        }),
      ],
      expectedRowIndexes: computeExpectedIndexes(
        rows,
        (row) => row.year >= 1990 && row.year <= 1999 && hasToken(row.actors, "tom hanks"),
        betweenAndContainsLimit,
      ),
      limit: betweenAndContainsLimit,
    },
    {
      id: "scale:null-aware-collection",
      category: "null",
      normalizationProfile: NormalizationProfile.JAVA,
      schema,
      rows,
      conditions: [
        createCondition<ScaleRow, "tags">({
          field: "tags",
          operator: Operator.CONTAINS_EITHER_INCLUDING_NULL,
          values: [null, "alpha"],
        }),
      ],
      expectedRowIndexes: computeExpectedIndexes(
        rows,
        (row) => row.tags === null || hasToken(row.tags, "alpha"),
      ),
    },
    {
      id: "scale:not-contains-and-threshold",
      category: "collection",
      normalizationProfile: NormalizationProfile.JAVA,
      schema,
      rows,
      conditions: [
        createCondition<ScaleRow, "tags">({
          field: "tags",
          operator: Operator.NOT_CONTAINS,
          values: ["beta"],
        }),
        createCondition<ScaleRow, "rating">({
          field: "rating",
          operator: Operator.GREATER_THAN_EQUAL,
          values: [8],
        }),
      ],
      expectedRowIndexes: computeExpectedIndexes(
        rows,
        (row) => !hasToken(row.tags, "beta") && row.rating >= 8,
      ),
    },
  ];
}

describe("oracle scale differential suites", () => {
  it("matches deterministic expectations for a 10k-row corpus", () => {
    const rows = generateRows(10_000);
    const suite = runOracleSuite(buildFixtures(rows));

    expect(suite.total).toBe(3);
    expect(suite.failed).toBe(0);
    expect(suite.passRate).toBe(1);
  });

  it("matches deterministic expectations for a 50k-row corpus", { timeout: 30_000 }, () => {
    const rows = generateRows(50_000);
    const suite = runOracleSuite(buildFixtures(rows));

    expect(suite.total).toBe(3);
    expect(suite.failed).toBe(0);
    expect(suite.passRate).toBe(1);
  });
});
