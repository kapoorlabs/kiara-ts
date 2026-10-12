import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { createCondition } from "../query/condition.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { Store } from "./store.js";
import { NormalizationProfile } from "./types.js";

interface MovieRow {
  title: string;
  year: number;
  rating: number;
}

const movieSchema = defineSchema<MovieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
  numberField("rating"),
]);

function createStore(): Store<MovieRow> {
  const store = new Store(movieSchema, { normalizationProfile: NormalizationProfile.JAVA });
  store.loadRow({ title: "Cast Away", year: 2000, rating: 8.1 });
  store.loadRow({ title: "Big", year: 1988, rating: 7.3 });
  store.prepare();
  return store;
}

describe("projection search", () => {
  it("returns typed projections for selected fields", () => {
    const store = createStore();
    const projected = store.searchProjection(
      [createCondition<MovieRow, "title">({ field: "title", values: ["cast away"] })],
      ["title", "year"],
    );
    expect(projected).toEqual([{ title: "Cast Away", year: 2000 }]);
  });

  it("returns Java-compatible uppercase string-map projection", () => {
    const store = createStore();
    const projected = store.searchLegacyProjection(
      [createCondition<MovieRow, "title">({ field: "title", values: ["big"] })],
      ["title", "rating"],
    );
    expect(projected).toEqual([{ TITLE: "Big", RATING: "7.3" }]);
  });

  it("returns all fields when legacy projection fields are omitted", () => {
    const store = createStore();
    const projected = store.searchLegacyProjection(
      [createCondition<MovieRow, "title">({ field: "title", values: ["big"] })],
    );
    expect(projected[0]).toMatchObject({
      TITLE: "Big",
      YEAR: "1988",
      RATING: "7.3",
    });
  });

  it("rejects unknown projection fields", () => {
    const store = createStore();
    expect(() =>
      store.searchLegacyProjection(
        [createCondition<MovieRow, "title">({ field: "title", values: ["big"] })],
        ["unknown" as unknown as "title"],
      ),
    ).toThrowError(QueryValidationError);
  });
});
