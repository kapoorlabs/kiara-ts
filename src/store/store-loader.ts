import type { CompiledSchema } from "../schema/types.js";
import { Store } from "./store.js";
import type { StoreOptions } from "./types.js";

export class StoreLoader<T extends object> {
  private readonly store: Store<T>;

  public constructor(store: Store<T>) {
    this.store = store;
  }

  public loadRow(row: T): void {
    this.store.loadRow(row);
  }

  public loadRows(rows: Iterable<T>): void {
    for (const row of rows) {
      this.store.loadRow(row);
    }
  }

  public prepareForSearch(): void {
    this.store.prepare();
  }

  public replaceAll(rows: Iterable<T>): Store<T> {
    const replacementStore = new Store(this.store.schema, {
      normalizationProfile: this.store.normalizationProfile,
    });
    const replacementLoader = new StoreLoader(replacementStore);
    replacementLoader.loadRows(rows);
    replacementLoader.prepareForSearch();
    return replacementStore;
  }
}

export function buildPreparedStore<T extends object>(
  schema: CompiledSchema<T>,
  rows: Iterable<T>,
  options: StoreOptions = {},
): Store<T> {
  const store = new Store(schema, options);
  const loader = new StoreLoader(store);
  loader.loadRows(rows);
  loader.prepareForSearch();
  return store;
}
