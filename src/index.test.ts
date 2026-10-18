import { describe, expect, it } from "vitest";
import {
  CommaSeparatedNumbers,
  CommaSeperatedNumbers,
  NormalizationProfile,
  Operator,
  createCondition,
  defineSchema,
  formatOracleBatchMismatchReport,
  numberField,
  runImportedOracleBatchFromJson,
  textField,
} from "./index.js";

interface ExportMovieRow {
  title: string;
  year: number;
}

describe("public helper exports", () => {
  it("keeps misspelled decorator aliases wired to canonical decorator exports", () => {
    expect(CommaSeperatedNumbers).toBe(CommaSeparatedNumbers);
  });

  it("runs oracle-batch helper exports from serialized fixture documents", () => {
    const schema = defineSchema<ExportMovieRow>([
      textField("title", { caseInsensitive: true }),
      numberField("year"),
    ]);

    const document = JSON.stringify({
      metadata: {
        sourceSha: "sha-export",
        javaVersion: "17",
        locale: "en_US",
        timeZone: "UTC",
      },
      fixtures: [
        {
          id: "operator:eq",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
      ],
    });

    const batch = runImportedOracleBatchFromJson([document], () => ({
      id: "operator:eq",
      normalizationProfile: NormalizationProfile.JAVA,
      schema,
      rows: [{ title: "Cast Away", year: 2000 }],
      conditions: [
        createCondition<ExportMovieRow, "title">({
          field: "title",
          operator: Operator.EQUAL,
          values: ["cast away"],
        }),
      ],
      expectedRowIndexes: [0],
    }));

    expect(batch.failed).toBe(0);
    expect(formatOracleBatchMismatchReport(batch)).toContain("documents=1 fixtures=1");
  });
});
