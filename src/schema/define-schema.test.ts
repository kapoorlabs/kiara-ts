import { describe, expect, it } from "vitest";
import { SchemaValidationError } from "../errors.js";
import { defineSchema } from "./define-schema.js";
import { enumField, numberField, textField } from "./field-factories.js";

interface MovieRow {
  title: string;
  year: number;
  rating: "G" | "PG";
}

describe("defineSchema", () => {
  it("preserves explicit field order", () => {
    const schema = defineSchema<MovieRow>([
      numberField("year"),
      textField("title"),
      enumField("rating", ["G", "PG"]),
    ]);

    expect(schema.fields.map((field) => field.name)).toEqual(["year", "title", "rating"]);
  });

  it("rejects empty schemas", () => {
    expect(() => defineSchema<MovieRow>([])).toThrowError(SchemaValidationError);
  });

  it("rejects duplicate field names", () => {
    try {
      defineSchema<MovieRow>([textField("title"), textField("title")]);
      throw new Error("Expected duplicate-field schema validation to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaValidationError);
      expect(error).toMatchObject({
        code: "SCHEMA_DUPLICATE_FIELD",
        details: { field: "title" },
      });
    }
  });

  it("requires enum values for enum fields", () => {
    expect(() =>
      defineSchema<MovieRow>([
        {
          name: "rating",
          kind: "enum",
          enumValues: [],
        },
      ]),
    ).toThrowError(SchemaValidationError);
  });

  it("rejects conflicting secondary-type declarations", () => {
    try {
      defineSchema<MovieRow>([
        {
          name: "title",
          kind: "text",
          secondaryType: "dateFormat",
          secondaryTypes: ["dateTimeFormat"],
        },
      ]);
      throw new Error("Expected conflicting secondaryType schema validation to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaValidationError);
      expect(error).toMatchObject({
        code: "SCHEMA_INVALID_SECONDARY_TYPE",
        details: { field: "title" },
      });
    }
  });

  it("rejects secondaryTypes declarations that do not resolve to exactly one value", () => {
    try {
      defineSchema<MovieRow>([
        {
          name: "title",
          kind: "text",
          secondaryTypes: ["dateFormat", "dateTimeFormat"],
        },
      ]);
      throw new Error("Expected ambiguous secondaryTypes schema validation to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaValidationError);
      expect(error).toMatchObject({
        code: "SCHEMA_INVALID_SECONDARY_TYPE",
        details: { field: "title" },
      });
    }
  });
});
