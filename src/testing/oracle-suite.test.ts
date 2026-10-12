import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { NormalizationProfile } from "../store/types.js";
import { runOracleSuite } from "./oracle-fixture.js";

interface MovieRow {
  title: string;
  year: number;
}

const schema = defineSchema<MovieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
]);

describe("oracle suite runner", () => {
  it("aggregates fixture pass/fail metrics", () => {
    const rows: MovieRow[] = [
      { title: "Cast Away", year: 2000 },
      { title: "Big", year: 1988 },
    ];

    const suite = runOracleSuite([
      {
        id: "passing-fixture",
        category: "keyword",
        normalizationProfile: NormalizationProfile.JAVA,
        schema,
        rows,
        conditions: [createCondition<MovieRow, "title">({ field: "title", values: ["cast away"] })],
        expectedRowIndexes: [0],
      },
      {
        id: "failing-fixture",
        category: "operator",
        normalizationProfile: NormalizationProfile.JAVA,
        schema,
        rows,
        conditions: [createCondition<MovieRow, "title">({ field: "title", values: ["big"] })],
        expectedRowIndexes: [0],
      },
    ]);

    expect(suite.total).toBe(2);
    expect(suite.passed).toBe(1);
    expect(suite.failed).toBe(1);
    expect(suite.passRate).toBe(0.5);
    expect(suite.failedFixtureIds).toEqual(["failing-fixture"]);
    expect(suite.failedByCategory).toEqual({ operator: 1 });
  });
});
