import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { normalizeDateTimeToEpochSecond, normalizeDateToEpochDay } from "../normalization/date.js";
import { normalizeText } from "../normalization/numeric.js";

interface Metadata {
  readonly sourceSha: string;
}

interface DateCase {
  readonly id: string;
  readonly kind: "date" | "dateTime";
  readonly value: string;
  readonly format?: string;
  readonly expected: number;
}

interface UnsupportedFormatCase {
  readonly id: string;
  readonly kind: "date" | "dateTime";
  readonly value: string;
  readonly format: string;
  readonly expectedErrorCode: "QUERY_INVALID_CONDITION";
}

interface LocaleCase {
  readonly id: string;
  readonly input: string;
  readonly caseInsensitive: boolean;
  readonly expected: string;
}

interface DateLocaleContractDocument {
  readonly metadata: Metadata;
  readonly dateCases: readonly DateCase[];
  readonly unsupportedFormatCases: readonly UnsupportedFormatCase[];
  readonly localeCases: readonly LocaleCase[];
}

function readFixture(filename: string): string {
  return readFileSync(new URL(`./fixtures/${filename}`, import.meta.url), "utf-8");
}

describe("java date + locale contract fixtures", () => {
  it("enforces supported date/date-time format matrix", () => {
    const document = JSON.parse(readFixture("java-date-locale-contract.json")) as DateLocaleContractDocument;
    expect(document.metadata.sourceSha).toBe("568d1addd15e237a5fa2dfaf7538b193d5564773");

    for (const entry of document.dateCases) {
      const actual = entry.kind === "date"
        ? normalizeDateToEpochDay(entry.value, entry.format)
        : normalizeDateTimeToEpochSecond(entry.value, entry.format);
      expect(actual, entry.id).toBe(entry.expected);
    }
  });

  it("rejects unsupported explicit format patterns", () => {
    const document = JSON.parse(readFixture("java-date-locale-contract.json")) as DateLocaleContractDocument;

    for (const entry of document.unsupportedFormatCases) {
      const execute = () =>
        entry.kind === "date"
          ? normalizeDateToEpochDay(entry.value, entry.format)
          : normalizeDateTimeToEpochSecond(entry.value, entry.format);
      expect(execute, entry.id).toThrowError(QueryValidationError);
      try {
        execute();
      } catch (error) {
        expect(error).toBeInstanceOf(QueryValidationError);
        if (error instanceof QueryValidationError) {
          expect(error.code, `${entry.id}:code`).toBe(entry.expectedErrorCode);
        }
      }
    }
  });

  it("pins case normalization behavior to en-US locale contract", () => {
    const document = JSON.parse(readFixture("java-date-locale-contract.json")) as DateLocaleContractDocument;

    for (const entry of document.localeCases) {
      const actual = normalizeText(entry.input, entry.caseInsensitive);
      expect(actual, entry.id).toBe(entry.expected);
    }
  });
});
