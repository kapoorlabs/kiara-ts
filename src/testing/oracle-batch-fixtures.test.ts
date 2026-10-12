import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { NormalizationProfile } from "../store/types.js";
import {
  formatOracleBatchMismatchReport,
  runImportedOracleBatchFromJson,
} from "./oracle-differential-runner.js";

interface MovieRow {
  title: string;
  year: number;
}

const schema = defineSchema<MovieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
]);

function readFixture(filename: string): string {
  return readFileSync(new URL(`./fixtures/${filename}`, import.meta.url), "utf-8");
}

describe("oracle batch fixture ingestion", () => {
  it("runs committed JSON fixture documents and reports category mismatches", () => {
    const serializedDocuments = [
      readFixture("oracle-import-sample-a.json"),
      readFixture("oracle-import-sample-b.json"),
    ] as const;

    const rows: MovieRow[] = [{ title: "Cast Away", year: 2000 }];
    const batch = runImportedOracleBatchFromJson(
      serializedDocuments,
      (fixture) => ({
        id: fixture.id,
        normalizationProfile: NormalizationProfile.JAVA,
        schema,
        rows,
        conditions: [
          createCondition<MovieRow, "title">({
            field: "title",
            values: [fixture.id.includes("match") ? "cast away" : "does not exist"],
          }),
        ],
        expectedRowIndexes: fixture.expectedRowIndexes,
      }),
    );

    expect(batch.documentCount).toBe(2);
    expect(batch.total).toBe(4);
    expect(batch.passed).toBe(2);
    expect(batch.failed).toBe(2);
    expect(batch.failedByCategory).toEqual({ operator: 1, stemming: 1 });
    expect(batch.mismatchSummary).toEqual([
      { category: "operator", failed: 1, failureShare: 0.5 },
      { category: "stemming", failed: 1, failureShare: 0.5 },
    ]);

    const report = formatOracleBatchMismatchReport(batch);
    expect(report).toContain("documents=2 fixtures=4 passed=2 failed=2 passRate=50.00%");
    expect(report).toContain("| operator | 1 | 50.00% |");
    expect(report).toContain("| stemming | 1 | 50.00% |");
  });
});
