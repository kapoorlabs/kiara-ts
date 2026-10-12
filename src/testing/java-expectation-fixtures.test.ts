import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { Store } from "../store/store.js";
import { NormalizationProfile } from "../store/types.js";
import { stemEnglishToken } from "../text/stemming.js";

interface Metadata {
  readonly sourceSha: string;
  readonly javaVersion: string;
  readonly locale: string;
  readonly timeZone: string;
}

interface StemCase {
  readonly id: string;
  readonly input: string;
  readonly expected: string;
}

interface StemDocument {
  readonly metadata: Metadata;
  readonly cases: readonly StemCase[];
}

interface TrieRow {
  readonly title: string;
  readonly year: number;
}

interface TrieCase {
  readonly id: string;
  readonly rows: readonly TrieRow[];
  readonly expectedSerialization: string;
}

interface TrieDocument {
  readonly metadata: Metadata;
  readonly cases: readonly TrieCase[];
}

function readFixture(filename: string): string {
  return readFileSync(new URL(`./fixtures/${filename}`, import.meta.url), "utf-8");
}

const trieSchema = defineSchema<TrieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
]);

describe("java-derived expectation fixtures", () => {
  it("matches committed stemming expectations", () => {
    const document = JSON.parse(readFixture("java-stemming-expectations.json")) as StemDocument;
    expect(document.metadata.sourceSha).toBe("568d1addd15e237a5fa2dfaf7538b193d5564773");

    for (const entry of document.cases) {
      expect(stemEnglishToken(entry.input), entry.id).toBe(entry.expected);
    }
  });

  it("matches committed trie diagnostic serialization expectations", () => {
    const document = JSON.parse(
      readFixture("java-trie-diagnostics-expectations.json"),
    ) as TrieDocument;
    expect(document.metadata.sourceSha).toBe("568d1addd15e237a5fa2dfaf7538b193d5564773");

    for (const entry of document.cases) {
      const store = new Store(trieSchema, { normalizationProfile: NormalizationProfile.JAVA });
      for (const row of entry.rows) {
        store.loadRow({ title: row.title, year: row.year });
      }
      store.prepare();
      expect(store.getDiagnosticTrieSerialization(), entry.id).toBe(entry.expectedSerialization);
    }
  });
});
