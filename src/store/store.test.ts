import { describe, expect, it } from "vitest";
import { StoreStateError } from "../errors.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { StoreLoader, buildPreparedStore } from "./store-loader.js";
import { Store } from "./store.js";
import { StoreState } from "./store-state.js";

interface MovieRow {
  title: string;
  year: number;
}

const movieSchema = defineSchema<MovieRow>([
  textField("title"),
  numberField("year"),
]);

describe("Store lifecycle", () => {
  it("starts in loading state", () => {
    const store = new Store(movieSchema);
    expect(store.getState()).toBe(StoreState.LOADING);
  });

  it("rejects query before prepare", () => {
    const store = new Store(movieSchema);
    expect(() => store.queryAll()).toThrowError(StoreStateError);
  });

  it("supports loading and querying after prepare", () => {
    const store = new Store(movieSchema);
    const loader = new StoreLoader(store);
    loader.loadRows([
      { title: "Cast Away", year: 2000 },
      { title: "Apollo 13", year: 1995 },
    ]);
    loader.prepareForSearch();

    expect(store.getState()).toBe(StoreState.READY);
    expect(store.queryAll(1)).toEqual([{ title: "Cast Away", year: 2000 }]);
  });

  it("rejects post-prepare loading", () => {
    const store = buildPreparedStore(movieSchema, [{ title: "Cast Away", year: 2000 }]);
    expect(() => store.loadRow({ title: "Captain Phillips", year: 2013 })).toThrowError(
      StoreStateError,
    );
  });

  it("creates an atomically prepared replacement store", () => {
    const store = buildPreparedStore(movieSchema, [{ title: "Cast Away", year: 2000 }]);
    const loader = new StoreLoader(store);

    const replacement = loader.replaceAll([
      { title: "Sully", year: 2016 },
      { title: "Big", year: 1988 },
    ]);

    expect(store.queryAll()).toEqual([{ title: "Cast Away", year: 2000 }]);
    expect(replacement.getState()).toBe(StoreState.READY);
    expect(replacement.queryAll().map((row) => row.title)).toEqual(["Sully", "Big"]);
  });
});
