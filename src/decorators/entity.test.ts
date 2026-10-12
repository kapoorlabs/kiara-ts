import { describe, expect, it } from "vitest";
import { SchemaValidationError } from "../errors.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import {
  CaseInsensitive,
  CommaSeparatedNumbers,
  CommaSeperatedDateRanges,
  Entity,
  NumberField,
  StemmedIndex,
  Text,
  getEntitySchema,
} from "./entity.js";
import { initializeDecoratorMetadata } from "./metadata.js";

describe("Entity decorators", () => {
  it("compiles the same field layout as defineSchema", () => {
    initializeDecoratorMetadata();

    @Entity
    class MovieModel {
      @Text()
      public title = "";

      @NumberField()
      public year = 0;
    }

    const classSchema = getEntitySchema(MovieModel);
    const objectSchema = defineSchema<MovieModel>([
      textField("title"),
      numberField("year"),
    ]);

    expect(classSchema.fields).toEqual(objectSchema.fields);
  });

  it("rejects entity classes without fields", () => {
    initializeDecoratorMetadata();

    expect(() => {
      @Entity
      class EmptyEntity {
        public id = "";
      }

      return EmptyEntity;
    }).toThrowError(SchemaValidationError);
  });

  it("rejects fields that only have non-type decorators", () => {
    initializeDecoratorMetadata();

    expect(() => {
      @Entity
      class InvalidEntity {
        @CaseInsensitive()
        public title = "";
      }

      return InvalidEntity;
    }).toThrowError();
  });

  it("keeps metadata isolated per class hierarchy level", () => {
    initializeDecoratorMetadata();

    @Entity
    class ParentEntity {
      @Text()
      public parentOnly = "";
    }

    @Entity
    class ChildEntity extends ParentEntity {
      @Text()
      public childOnly = "";
    }

    const parentSchema = getEntitySchema(ParentEntity);
    const childSchema = getEntitySchema(ChildEntity);

    expect(parentSchema.fields.map((field) => field.name)).toEqual(["parentOnly"]);
    expect(childSchema.fields.map((field) => field.name)).toEqual(["childOnly"]);
  });

  it("supports reversed decorator stacking on the same field", () => {
    initializeDecoratorMetadata();

    @Entity
    class ReversedStackingEntity {
      @Text()
      @CaseInsensitive()
      public title = "";
    }

    const schema = getEntitySchema(ReversedStackingEntity);
    expect(schema.fields[0]?.caseInsensitive).toBe(true);
  });

  it("supports inferred string fields for secondary-type decorators", () => {
    initializeDecoratorMetadata();

    @Entity
    class SecondaryTypeEntity {
      @CommaSeparatedNumbers()
      public scores = "";
    }

    const schema = getEntitySchema(SecondaryTypeEntity);
    expect(schema.fields[0]).toMatchObject({
      name: "scores",
      kind: "text",
      secondaryType: "commaSeparatedNumbers",
    });
  });

  it("preserves misspelled comma-separated decorator aliases", () => {
    initializeDecoratorMetadata();

    @Entity
    class LegacyAliasEntity {
      @CommaSeperatedDateRanges()
      public dateRanges = "";
    }

    const schema = getEntitySchema(LegacyAliasEntity);
    expect(schema.fields[0]?.secondaryType).toBe("commaSeparatedDateRanges");
  });

  it("maps StemmedIndex metadata to schema fields", () => {
    initializeDecoratorMetadata();

    @Entity
    class StemmedEntity {
      @Text()
      @StemmedIndex()
      public description = "";
    }

    const schema = getEntitySchema(StemmedEntity);
    expect(schema.fields[0]?.stemmedIndex).toBe(true);
  });
});
