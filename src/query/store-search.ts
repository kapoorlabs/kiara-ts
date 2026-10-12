import type { Condition } from "./condition.js";
import { Store } from "../store/store.js";

export class StoreSearch<T extends object> {
  private readonly store: Store<T>;

  public constructor(store: Store<T>) {
    this.store = store;
  }

  public query(conditions: readonly Condition<T>[], limit?: number): readonly T[] {
    return this.store.search(conditions, limit);
  }
}
