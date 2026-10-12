import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { KeywordSearch } from "../query/keyword-search.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { Store } from "../store/store.js";
import { NormalizationProfile } from "../store/types.js";

interface KeywordRow {
  title: string;
  plot: string;
  year: number;
}

interface RawCondition {
  readonly field: "year";
  readonly values: readonly number[];
}

interface KeywordCase {
  readonly id: string;
  readonly method: "best" | "minimum";
  readonly input: string;
  readonly maxKeywords?: number;
  readonly options?: {
    readonly conditions?: readonly RawCondition[];
  };
  readonly expectedTitles: readonly string[];
  readonly expectedTruncated?: boolean;
}

interface KeywordDocument {
  readonly rows: readonly KeywordRow[];
  readonly cases: readonly KeywordCase[];
}

const schema = defineSchema<KeywordRow>([
  textField("title", { caseInsensitive: true }),
  textField("plot", { caseInsensitive: true }),
  numberField("year"),
]);

function readFixture(filename: string): string {
  return readFileSync(new URL(`./fixtures/${filename}`, import.meta.url), "utf-8");
}

describe("java-derived keyword corpus smoke", () => {
  it("executes committed keyword cases with expected result sets", () => {
    const document = JSON.parse(readFixture("java-keyword-sample.json")) as KeywordDocument;

    for (const testCase of document.cases) {
      const store = new Store(schema, { normalizationProfile: NormalizationProfile.JAVA });
      for (const row of document.rows) {
        store.loadRow(row);
      }
      store.prepare();

      const search = new KeywordSearch(store, testCase.maxKeywords ?? 10);
      const options = testCase.options?.conditions === undefined
        ? undefined
        : {
            conditions: testCase.options.conditions.map((condition) =>
              createCondition<KeywordRow, "year">({
                field: condition.field,
                values: condition.values,
              })),
          };

      const result = testCase.method === "best"
        ? search.bestMatch(testCase.input, options)
        : search.minimumMatch(testCase.input, options);

      expect(result.results.map((row) => row.title), testCase.id).toEqual(testCase.expectedTitles);
      if (testCase.expectedTruncated !== undefined) {
        expect(result.truncated, `${testCase.id}:truncated`).toBe(testCase.expectedTruncated);
      }
    }
  });
});
