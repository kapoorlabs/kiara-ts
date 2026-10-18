import { describe, expect, it } from "vitest";
import { KeywordSearch } from "../query/keyword-search.js";
import { defineSchema } from "../schema/define-schema.js";
import { textField } from "../schema/field-factories.js";
import { Store } from "../store/store.js";
import { NormalizationProfile } from "../store/types.js";

interface KeywordRow {
  title: string;
  plot: string;
}

const schema = defineSchema<KeywordRow>([
  textField("title", { caseInsensitive: true }),
  textField("plot", { caseInsensitive: true, stemmedIndex: true }),
]);

function buildRows(count: number): KeywordRow[] {
  const rows: KeywordRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const bucket = index % 8;
    rows.push({
      title: `Story ${index}`,
      plot: `cluster-${bucket} running return launch orbit mission token-${index % 50}`,
    });
  }
  return rows;
}

function buildStore(count: number): Store<KeywordRow> {
  const store = new Store(schema, { normalizationProfile: NormalizationProfile.JAVA });
  for (const row of buildRows(count)) {
    store.loadRow(row);
  }
  store.prepare();
  return store;
}

describe("keyword capacity stress suites", () => {
  it("handles long keyword input with deterministic truncation under load", () => {
    const store = buildStore(5_000);
    const search = new KeywordSearch(store, 12);
    const longInput = Array.from({ length: 200 }, (_, index) =>
      index % 3 === 0 ? "running" : index % 3 === 1 ? "orbit" : `token-${index % 50}`
    ).join(" ");

    const result = search.bestMatch(longInput, { limit: 25 });
    expect(result.truncated).toBe(true);
    expect(result.usedKeywords.length).toBe(12);
    expect(result.results.length).toBeLessThanOrEqual(25);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("keeps punctuation/duplicate-heavy inputs stable under capacity pressure", () => {
    const store = buildStore(5_000);
    const search = new KeywordSearch(store, 8);

    const result = search.bestMatch("running, running! orbit? orbit... token-7 token-7 token-7");
    expect(result.truncated).toBe(false);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.matchedKeywords).toContain("running");
    expect(result.matchedKeywords).toContain("orbit");
  });
});
