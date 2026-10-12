import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { createCondition } from "../query/condition.js";
import { Operator } from "../query/operator.js";
import { StoreSearch } from "../query/store-search.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { Store } from "./store.js";
import { NormalizationProfile } from "./types.js";

interface MovieRow {
  title: string;
  year: number;
  actors: string;
  rating: number;
}

interface HiddenMovieRow {
  title: string;
  privateNotes: string;
}

const movieSchema = defineSchema<MovieRow>([
  textField("title", { caseInsensitive: true }),
  numberField("year"),
  textField("actors", { secondaryType: "commaSeparatedStrings", caseInsensitive: true }),
  numberField("rating"),
]);

function preparedStore(): Store<MovieRow> {
  const store = new Store(movieSchema, { normalizationProfile: NormalizationProfile.JAVA });
  store.loadRow({ title: "Cast Away", year: 2000, actors: "Tom Hanks, Helen Hunt", rating: 8.1 });
  store.loadRow({ title: "Apollo 13", year: 1995, actors: "Tom Hanks, Bill Paxton", rating: 7.6 });
  store.loadRow({ title: "Big", year: 1988, actors: "Tom Hanks", rating: 7.3 });
  store.prepare();
  return store;
}

function preparedIgnoreIndexStore(): Store<HiddenMovieRow> {
  const schema = defineSchema<HiddenMovieRow>([
    textField("title", { caseInsensitive: true }),
    textField("privateNotes", { caseInsensitive: true, ignoreIndex: true }),
  ]);
  const store = new Store(schema, { normalizationProfile: NormalizationProfile.JAVA });
  store.loadRow({ title: "Cast Away", privateNotes: "internal island marker" });
  store.loadRow({ title: "Apollo 13", privateNotes: "internal moon marker" });
  store.prepare();
  return store;
}

describe("Store search", () => {
  it("supports case-insensitive EQUAL on text fields", () => {
    const store = preparedStore();
    const search = new StoreSearch(store);
    const results = search.query([
      createCondition<MovieRow, "title">({ field: "title", values: ["cast away"] }),
    ]);
    expect(results.map((row) => row.title)).toEqual(["Cast Away"]);
  });

  it("supports LESS_THAN with Java numeric key normalization", () => {
    const store = preparedStore();
    const results = store.search([
      createCondition<MovieRow, "rating">({
        field: "rating",
        operator: Operator.LESS_THAN,
        values: [7.9],
      }),
    ]);
    expect(results.map((row) => row.title)).toEqual([]);
  });

  it("supports LESS_THAN in native profile without Java truncation", () => {
    const store = new Store(movieSchema, { normalizationProfile: NormalizationProfile.NATIVE });
    store.loadRow({ title: "Cast Away", year: 2000, actors: "Tom Hanks, Helen Hunt", rating: 8.1 });
    store.loadRow({ title: "Apollo 13", year: 1995, actors: "Tom Hanks, Bill Paxton", rating: 7.6 });
    store.loadRow({ title: "Big", year: 1988, actors: "Tom Hanks", rating: 7.3 });
    store.prepare();

    const results = store.search([
      createCondition<MovieRow, "rating">({
        field: "rating",
        operator: Operator.LESS_THAN,
        values: [7.9],
      }),
    ]);
    expect(results.map((row) => row.title)).toEqual(["Apollo 13", "Big"]);
  });

  it("supports BETWEEN on numeric fields", () => {
    const store = preparedStore();
    const results = store.search([
      createCondition<MovieRow, "year">({
        field: "year",
        operator: Operator.BETWEEN,
        lowerValue: 1990,
        upperValue: 2000,
      }),
    ]);
    expect(results.map((row) => row.title)).toEqual(["Cast Away", "Apollo 13"]);
  });

  it("supports CONTAINS_EITHER and CONTAINS_ALL on collection fields", () => {
    const store = preparedStore();
    const either = store.search([
      createCondition<MovieRow, "actors">({
        field: "actors",
        operator: Operator.CONTAINS_EITHER,
        values: ["helen hunt"],
      }),
    ]);
    expect(either.map((row) => row.title)).toEqual(["Cast Away"]);

    const all = store.search([
      createCondition<MovieRow, "actors">({
        field: "actors",
        operator: Operator.CONTAINS_ALL,
        values: ["tom hanks", "bill paxton"],
      }),
    ]);
    expect(all.map((row) => row.title)).toEqual(["Apollo 13"]);
  });

  it("supports NOT_CONTAINS on collection fields", () => {
    const store = preparedStore();
    const results = store.search([
      createCondition<MovieRow, "actors">({
        field: "actors",
        operator: Operator.NOT_CONTAINS,
        values: ["bill paxton"],
      }),
    ]);
    expect(results.map((row) => row.title)).toEqual(["Cast Away", "Big"]);
  });

  it("builds trie with deduplicated nodes for shared prefixes", () => {
    const store = new Store(movieSchema, { normalizationProfile: NormalizationProfile.JAVA });
    store.loadRow({ title: "Cast Away", year: 2000, actors: "Tom Hanks, Helen Hunt", rating: 8.1 });
    store.loadRow({ title: "Cast Away", year: 2000, actors: "Tom Hanks, Helen Hunt", rating: 8.1 });
    store.prepare();

    const trie = store.getPreparedTrieSnapshot();
    const root = trie.nodes.find((node) => node.id === 0);
    expect(root?.rowIds.length).toBe(2);
    expect(root?.childIds.size).toBe(1);
    expect(trie.nodes.length).toBe(5);
  });

  it("rejects structured queries on ignoreIndex fields", () => {
    const store = preparedIgnoreIndexStore();
    expect(() =>
      store.search([
        createCondition<HiddenMovieRow, "privateNotes">({
          field: "privateNotes",
          values: ["internal island marker"],
        }),
      ]),
    ).toThrowError(QueryValidationError);
  });
});
