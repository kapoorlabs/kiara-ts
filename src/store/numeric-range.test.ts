import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { Operator } from "../query/operator.js";
import { defineSchema } from "../schema/define-schema.js";
import { textField } from "../schema/field-factories.js";
import { Store } from "./store.js";
import { NormalizationProfile } from "./types.js";

interface RangeRow {
  id: string;
  priceBand: string;
  priceBands: string;
}

const rangeSchema = defineSchema<RangeRow>([
  textField("id"),
  textField("priceBand", { secondaryType: "numericRange", numericStartPos: 1 }),
  textField("priceBands", { secondaryType: "commaSeparatedNumericRanges", numericStartPos: 1 }),
]);

function preparedRangeStore(): Store<RangeRow> {
  const store = new Store(rangeSchema, { normalizationProfile: NormalizationProfile.JAVA });
  store.loadRow({ id: "r1", priceBand: "A10->20", priceBands: "A10->20,A30->40" });
  store.loadRow({ id: "r2", priceBand: "A21->30", priceBands: "A5->9,A21->30" });
  store.loadRow({ id: "r3", priceBand: "B10->20", priceBands: "B10->20" });
  store.prepare();
  return store;
}

describe("numeric range secondary types", () => {
  it("supports CONTAINS_EITHER for scalar numericRange fields", () => {
    const store = preparedRangeStore();
    const results = store.search([
      createCondition<RangeRow, "priceBand">({
        field: "priceBand",
        operator: Operator.CONTAINS_EITHER,
        values: ["A15->16"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r1"]);
  });

  it("supports CONTAINS_ALL for commaSeparatedNumericRanges fields", () => {
    const store = preparedRangeStore();
    const results = store.search([
      createCondition<RangeRow, "priceBands">({
        field: "priceBands",
        operator: Operator.CONTAINS_ALL,
        values: ["A15", "A35"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r1"]);
  });

  it("supports NOT_CONTAINS for numeric range collections", () => {
    const store = preparedRangeStore();
    const results = store.search([
      createCondition<RangeRow, "priceBands">({
        field: "priceBands",
        operator: Operator.NOT_CONTAINS,
        values: ["A15"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r2", "r3"]);
  });

  it("supports EQUAL for scalar numericRange fields", () => {
    const store = preparedRangeStore();
    const results = store.search([
      createCondition<RangeRow, "priceBand">({
        field: "priceBand",
        operator: Operator.EQUAL,
        values: ["A21->30"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r2"]);
  });
});
