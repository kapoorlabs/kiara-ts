import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { textField } from "../schema/field-factories.js";
import { defineSchema } from "../schema/define-schema.js";
import { validateOperatorCompatibility } from "./operator-compatibility.js";
import { Operator } from "./operator.js";

interface Sample {
  title: string;
  tags: string;
  releaseDate: string;
  numericRange: string;
  dateRange: string;
}

const schema = defineSchema<Sample>([
  textField("title"),
  textField("tags", { secondaryType: "commaSeparatedStrings" }),
  textField("releaseDate", { secondaryType: "dateFormat" }),
  textField("numericRange", { secondaryType: "numericRange" }),
  textField("dateRange", { secondaryType: "dateRange" }),
]);

describe("operator compatibility", () => {
  it("allows contains operators for collection fields", () => {
    const field = schema.fieldMap.get("tags");
    if (field === undefined) {
      throw new Error("Expected tags field to exist");
    }
    expect(() => validateOperatorCompatibility(field, Operator.CONTAINS_EITHER)).not.toThrow();
  });

  it("rejects contains operators for scalar date fields", () => {
    const field = schema.fieldMap.get("releaseDate");
    if (field === undefined) {
      throw new Error("Expected releaseDate field to exist");
    }
    expect(() => validateOperatorCompatibility(field, Operator.CONTAINS_ALL)).toThrowError(
      QueryValidationError,
    );
  });

  it("rejects comparison operators for range secondary type in current phase", () => {
    const field = schema.fieldMap.get("numericRange");
    if (field === undefined) {
      throw new Error("Expected numericRange field to exist");
    }
    expect(() => validateOperatorCompatibility(field, Operator.BETWEEN)).toThrowError(
      QueryValidationError,
    );
  });

  it("allows contains operators for numeric range secondary type", () => {
    const field = schema.fieldMap.get("numericRange");
    if (field === undefined) {
      throw new Error("Expected numericRange field to exist");
    }
    expect(() => validateOperatorCompatibility(field, Operator.CONTAINS_EITHER)).not.toThrow();
  });

  it("allows contains operators for date range secondary type", () => {
    const field = schema.fieldMap.get("dateRange");
    if (field === undefined) {
      throw new Error("Expected dateRange field to exist");
    }
    expect(() => validateOperatorCompatibility(field, Operator.CONTAINS_ALL)).not.toThrow();
  });
});
