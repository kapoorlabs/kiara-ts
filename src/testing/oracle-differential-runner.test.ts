import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { NormalizationProfile } from "../store/types.js";
import type { OracleFixtureDocument } from "./oracle-import.js";
import {
  formatOracleBatchMismatchReport,
  runImportedOracleBatch,
  runImportedOracleBatchFromJson,
  runImportedOracleSuite,
} from "./oracle-differential-runner.js";

interface MovieRow {
  title: string;
  year: number;
}

const schema = defineSchema<MovieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
]);

describe("runImportedOracleSuite", () => {
  it("executes imported fixtures through resolver mapping", () => {
    const document: OracleFixtureDocument = {
      metadata: {
        sourceSha: "sha",
        javaVersion: "17",
        locale: "en_US",
        timeZone: "UTC",
      },
      fixtures: [
        {
          id: "operator:fixture-1",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
        {
          id: "keyword:fixture-2",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
      ],
    };

    const rows: MovieRow[] = [{ title: "Cast Away", year: 2000 }];

    const suite = runImportedOracleSuite(
      document,
      (fixture, index) => ({
        id: fixture.id,
        normalizationProfile: NormalizationProfile.JAVA,
        schema,
        rows,
        conditions: [createCondition<MovieRow, "title">({ field: "title", values: ["cast away"] })],
        expectedRowIndexes: index === 0 ? [0] : [],
      }),
      {
        classifyFeature: (fixture) =>
          fixture.id.startsWith("keyword:") ? "keyword-search" : "structured-search",
      },
    );

    expect(suite.passed).toBe(1);
    expect(suite.failed).toBe(1);
    expect(suite.failedFixtureIds).toEqual(["keyword:fixture-2"]);
    expect(suite.failedByCategory).toEqual({ "keyword-search": 1 });
  });

  it("aggregates larger imported batches with category mismatch summaries", () => {
    const docA: OracleFixtureDocument = {
      metadata: {
        sourceSha: "sha-a",
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
        {
          id: "keyword:best",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
      ],
    };

    const docB: OracleFixtureDocument = {
      metadata: {
        sourceSha: "sha-b",
        javaVersion: "17",
        locale: "en_US",
        timeZone: "UTC",
      },
      fixtures: [
        {
          id: "keyword:min",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
        {
          id: "range:contains",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
      ],
    };

    const rows: MovieRow[] = [{ title: "Cast Away", year: 2000 }];
    const batch = runImportedOracleBatch(
      [docA, docB],
      (fixture) => ({
        id: fixture.id,
        normalizationProfile: NormalizationProfile.JAVA,
        schema,
        rows,
        conditions: [createCondition<MovieRow, "title">({ field: "title", values: ["cast away"] })],
        expectedRowIndexes: fixture.id.includes("operator") ? [0] : [],
      }),
    );

    expect(batch.documentCount).toBe(2);
    expect(batch.total).toBe(4);
    expect(batch.passed).toBe(1);
    expect(batch.failed).toBe(3);
    expect(batch.failedByCategory).toEqual({ keyword: 2, range: 1 });
    expect(batch.mismatchSummary).toEqual([
      { category: "keyword", failed: 2, failureShare: 2 / 3 },
      { category: "range", failed: 1, failureShare: 1 / 3 },
    ]);
    expect(batch.failedFixtureIds).toEqual([
      "sha-a:keyword:best",
      "sha-b:keyword:min",
      "sha-b:range:contains",
    ]);
  });

  it("parses serialized fixture documents and runs batch differential suites", () => {
    const docA = JSON.stringify({
      metadata: {
        sourceSha: "sha-json-a",
        javaVersion: "17",
        locale: "en_US",
        timeZone: "UTC",
      },
      fixtures: [
        {
          id: "stemming:running",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
      ],
    });

    const docB = JSON.stringify({
      metadata: {
        sourceSha: "sha-json-b",
        javaVersion: "17",
        locale: "en_US",
        timeZone: "UTC",
      },
      fixtures: [
        {
          id: "trie:diagnostics",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
      ],
    });

    const rows: MovieRow[] = [{ title: "Cast Away", year: 2000 }];
    const batch = runImportedOracleBatchFromJson(
      [docA, docB],
      (fixture) => ({
        id: fixture.id,
        normalizationProfile: NormalizationProfile.JAVA,
        schema,
        rows,
        conditions: [createCondition<MovieRow, "title">({ field: "title", values: ["cast away"] })],
        expectedRowIndexes: fixture.id.startsWith("stemming:") ? [0] : [],
      }),
    );

    expect(batch.documentCount).toBe(2);
    expect(batch.total).toBe(2);
    expect(batch.passed).toBe(1);
    expect(batch.failed).toBe(1);
    expect(batch.failedByCategory).toEqual({ trie: 1 });
    expect(batch.failedFixtureIds).toEqual(["sha-json-b:trie:diagnostics"]);
  });

  it("formats category mismatch reports for batch output", () => {
    const rows: MovieRow[] = [{ title: "Cast Away", year: 2000 }];
    const document: OracleFixtureDocument = {
      metadata: {
        sourceSha: "sha-report",
        javaVersion: "17",
        locale: "en_US",
        timeZone: "UTC",
      },
      fixtures: [
        {
          id: "keyword:report",
          normalizationProfile: "java",
          schema: {},
          rows: [],
          conditions: [],
          expectedRowIndexes: [0],
        },
      ],
    };

    const batch = runImportedOracleBatch(
      [document],
      (fixture) => ({
        id: fixture.id,
        normalizationProfile: NormalizationProfile.JAVA,
        schema,
        rows,
        conditions: [createCondition<MovieRow, "title">({ field: "title", values: ["cast away"] })],
        expectedRowIndexes: [],
      }),
    );

    const report = formatOracleBatchMismatchReport(batch);
    expect(report).toContain("documents=1 fixtures=1 passed=0 failed=1 passRate=0.00%");
    expect(report).toContain("| keyword | 1 | 100.00% |");
  });
});
