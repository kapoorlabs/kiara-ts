import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { Operator } from "../query/operator.js";
import { defineSchema } from "../schema/define-schema.js";
import { textField } from "../schema/field-factories.js";
import { Store } from "./store.js";
import { NormalizationProfile } from "./types.js";

interface DateRangeRow {
  id: string;
  validDate: string;
  dateWindows: string;
  validTime: string;
  timeWindows: string;
}

const dateRangeSchema = defineSchema<DateRangeRow>([
  textField("id"),
  textField("validDate", { secondaryType: "dateRange" }),
  textField("dateWindows", { secondaryType: "commaSeparatedDateRanges" }),
  textField("validTime", { secondaryType: "dateTimeRange" }),
  textField("timeWindows", { secondaryType: "commaSeparatedDateTimeRanges" }),
]);

function preparedDateRangeStore(): Store<DateRangeRow> {
  const store = new Store(dateRangeSchema, { normalizationProfile: NormalizationProfile.JAVA });
  store.loadRow({
    id: "r1",
    validDate: "2020-01-01->2020-01-10",
    dateWindows: "2020-01-01->2020-01-10,2020-02-01->2020-02-05",
    validTime: "2020-01-01 00:00:00->2020-01-01 12:00:00",
    timeWindows: "2020-01-01 00:00:00->2020-01-01 12:00:00,2020-01-02 00:00:00->2020-01-02 12:00:00",
  });
  store.loadRow({
    id: "r2",
    validDate: "2020-01-11->2020-01-20",
    dateWindows: "2020-01-11->2020-01-20",
    validTime: "2020-01-03 00:00:00->2020-01-03 12:00:00",
    timeWindows: "2020-01-03 00:00:00->2020-01-03 12:00:00",
  });
  store.prepare();
  return store;
}

describe("date/date-time range secondary types", () => {
  it("supports CONTAINS_EITHER for dateRange fields", () => {
    const store = preparedDateRangeStore();
    const results = store.search([
      createCondition<DateRangeRow, "validDate">({
        field: "validDate",
        operator: Operator.CONTAINS_EITHER,
        values: ["2020-01-05"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r1"]);
  });

  it("supports CONTAINS_ALL for commaSeparatedDateRanges fields", () => {
    const store = preparedDateRangeStore();
    const results = store.search([
      createCondition<DateRangeRow, "dateWindows">({
        field: "dateWindows",
        operator: Operator.CONTAINS_ALL,
        values: ["2020-01-03", "2020-02-02"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r1"]);
  });

  it("supports CONTAINS_EITHER for dateTimeRange fields", () => {
    const store = preparedDateRangeStore();
    const results = store.search([
      createCondition<DateRangeRow, "validTime">({
        field: "validTime",
        operator: Operator.CONTAINS_EITHER,
        values: ["2020-01-01 08:00:00"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r1"]);
  });

  it("supports NOT_CONTAINS for commaSeparatedDateTimeRanges fields", () => {
    const store = preparedDateRangeStore();
    const results = store.search([
      createCondition<DateRangeRow, "timeWindows">({
        field: "timeWindows",
        operator: Operator.NOT_CONTAINS,
        values: ["2020-01-01 08:00:00"],
      }),
    ]);
    expect(results.map((row) => row.id)).toEqual(["r2"]);
  });
});
