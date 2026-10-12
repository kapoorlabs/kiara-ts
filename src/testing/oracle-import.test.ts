import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { parseOracleFixtureDocument } from "./oracle-import.js";

describe("parseOracleFixtureDocument", () => {
  it("parses valid fixture documents", () => {
    const document = parseOracleFixtureDocument(
      JSON.stringify({
        metadata: {
          sourceSha: "568d1addd15e237a5fa2dfaf7538b193d5564773",
          javaVersion: "17",
          locale: "en_US",
          timeZone: "UTC",
        },
        fixtures: [
          {
            id: "fixture-1",
            normalizationProfile: "java",
            schema: {},
            rows: [],
            conditions: [],
            expectedRowIndexes: [],
          },
        ],
      }),
    );

    expect(document.metadata.sourceSha).toBe("568d1addd15e237a5fa2dfaf7538b193d5564773");
    expect(document.fixtures).toHaveLength(1);
  });

  it("rejects duplicate fixture ids", () => {
    expect(() =>
      parseOracleFixtureDocument(
        JSON.stringify({
          metadata: {
            sourceSha: "sha",
            javaVersion: "17",
            locale: "en_US",
            timeZone: "UTC",
          },
          fixtures: [
            { id: "dup", normalizationProfile: "java", expectedRowIndexes: [] },
            { id: "dup", normalizationProfile: "native", expectedRowIndexes: [] },
          ],
        }),
      ),
    ).toThrowError(QueryValidationError);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseOracleFixtureDocument("{not-json}")).toThrowError(QueryValidationError);
  });
});
