import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { createCondition, validateConditions } from "./condition.js";
import { Operator } from "./operator.js";

interface MovieRow {
  title: string;
  year: number;
}

describe("conditions", () => {
  it("defaults missing operator to EQUAL", () => {
    const condition = createCondition<MovieRow, "title">({
      field: "title",
      values: ["Cast Away"],
    });

    expect(condition.operator).toBe(Operator.EQUAL);
  });

  it("requires values for non-BETWEEN operators", () => {
    expect(() =>
      createCondition<MovieRow, "title">({
        field: "title",
        operator: Operator.CONTAINS_EITHER,
        values: [],
      }),
    ).toThrowError(QueryValidationError);
  });

  it("requires lower and upper values for BETWEEN", () => {
    expect(() =>
      createCondition<MovieRow, "year">({
        field: "year",
        operator: Operator.BETWEEN,
        lowerValue: 2000,
        upperValue: undefined,
      }),
    ).toThrowError(QueryValidationError);
  });

  it("rejects empty condition lists", () => {
    expect(() => validateConditions<MovieRow>([])).toThrowError(QueryValidationError);
  });
});
