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
    expect(() =>
      defineSchema<MovieRow>([textField("title"), textField("title")]),
    ).toThrowError(SchemaValidationError);
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
    expect(() =>
      defineSchema<MovieRow>([
        {
          name: "title",
          kind: "text",
          secondaryType: "dateFormat",
          secondaryTypes: ["dateTimeFormat"],
        },
      ]),
    ).toThrowError(SchemaValidationError);
  });
});
