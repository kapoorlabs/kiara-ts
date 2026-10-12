import { describe, expect, it } from "vitest";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { Store } from "./store.js";
import { NormalizationProfile } from "./types.js";
import { serializeTrieSnapshot } from "./trie-diagnostics.js";

interface MovieRow {
  title: string;
  year: number;
}

const schema = defineSchema<MovieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
]);

function createStore(): Store<MovieRow> {
  const store = new Store(schema, { normalizationProfile: NormalizationProfile.JAVA });
  store.loadRow({ title: "Cast Away", year: 2000 });
  store.loadRow({ title: "Apollo 13", year: 1995 });
  store.prepare();
  return store;
}

describe("serializeTrieSnapshot", () => {
  it("serializes trie nodes in BFS order with diagnostic markers", () => {
    const store = createStore();
    const serialized = serializeTrieSnapshot(store.getPreparedTrieSnapshot());
    const lines = serialized.split("\n");
    const ids = lines.map((line) => Number(line.slice(1, line.indexOf("|"))));

    expect(ids).toEqual([0, 1, 3, 2, 4]);
    expect(lines[0]).toContain("#0|null|null|null|~0,1");
    expect(lines.some((line) => line.includes("|year|2000.00|~0"))).toBe(true);
    expect(lines.every((line) => line.startsWith("#") && line.includes("|~"))).toBe(true);
  });

  it("is exposed via Store helper", () => {
    const store = createStore();
    const direct = serializeTrieSnapshot(store.getPreparedTrieSnapshot());
    const viaStore = store.getDiagnosticTrieSerialization();

    expect(viaStore).toBe(direct);
  });
});
