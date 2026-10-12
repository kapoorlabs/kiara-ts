import { SchemaValidationError } from "../errors.js";
import type {
  CompiledSchema,
  FieldName,
  SchemaField,
  SchemaFieldInput,
  SchemaOptions,
  SecondaryType,
} from "./types.js";

const KNOWN_SECONDARY_TYPES = new Set<SecondaryType>([
  "commaSeparatedStrings",
  "commaSeparatedNumbers",
  "commaSeparatedDates",
  "commaSeparatedDateTimes",
  "commaSeparatedNumericRanges",
  "commaSeparatedDateRanges",
  "commaSeparatedDateTimeRanges",
  "dateFormat",
  "dateTimeFormat",
  "dateRange",
  "dateTimeRange",
  "numericRange",
]);

function normalizeSecondaryType<T extends object>(
  field: SchemaFieldInput<T>,
): SecondaryType | undefined {
  if (field.secondaryType !== undefined && field.secondaryTypes !== undefined) {
    throw new SchemaValidationError(
      `Field "${field.name}" cannot define both secondaryType and secondaryTypes.`,
      "SCHEMA_INVALID_SECONDARY_TYPE",
      { field: field.name },
    );
  }

  if (field.secondaryType !== undefined) {
    if (!KNOWN_SECONDARY_TYPES.has(field.secondaryType)) {
      throw new SchemaValidationError(
        `Field "${field.name}" uses unsupported secondaryType "${field.secondaryType}".`,
        "SCHEMA_INVALID_SECONDARY_TYPE",
        { field: field.name, secondaryType: field.secondaryType },
      );
    }
    return field.secondaryType;
  }

  if (field.secondaryTypes === undefined) {
    return undefined;
  }

  if (field.secondaryTypes.length !== 1) {
    throw new SchemaValidationError(
      `Field "${field.name}" must define exactly one secondary type when secondaryTypes is provided.`,
      "SCHEMA_INVALID_SECONDARY_TYPE",
      { field: field.name, secondaryTypes: field.secondaryTypes },
    );
  }

  const secondaryType = field.secondaryTypes[0];
  if (secondaryType === undefined) {
    throw new SchemaValidationError(
      `Field "${field.name}" must define exactly one secondary type when secondaryTypes is provided.`,
      "SCHEMA_INVALID_SECONDARY_TYPE",
      { field: field.name, secondaryTypes: field.secondaryTypes },
    );
  }

  if (!KNOWN_SECONDARY_TYPES.has(secondaryType)) {
    throw new SchemaValidationError(
      `Field "${field.name}" uses unsupported secondaryType "${secondaryType}".`,
      "SCHEMA_INVALID_SECONDARY_TYPE",
      { field: field.name, secondaryType },
    );
  }
  return secondaryType;
}

function normalizeField<T extends object>(field: SchemaFieldInput<T>): SchemaField<T> {
  if (typeof field.name !== "string" || field.name.trim() === "") {
    throw new SchemaValidationError(
      "Field name must be a non-empty string.",
      "SCHEMA_INVALID_FIELD_NAME",
      { field },
    );
  }

  if (field.kind === "enum") {
    if (field.enumValues === undefined || field.enumValues.length === 0) {
      throw new SchemaValidationError(
        `Enum field "${field.name}" must define enumValues.`,
        "SCHEMA_INVALID_ENUM",
        { field: field.name },
      );
    }

    const uniqueValues = new Set(field.enumValues);
    if (uniqueValues.size !== field.enumValues.length) {
      throw new SchemaValidationError(
        `Enum field "${field.name}" contains duplicate enumValues.`,
        "SCHEMA_INVALID_ENUM",
        { field: field.name, enumValues: field.enumValues },
      );
    }
  } else if (field.enumValues !== undefined) {
    throw new SchemaValidationError(
      `Only enum fields may define enumValues. Field "${field.name}" has kind "${field.kind}".`,
      "SCHEMA_INVALID_ENUM",
      { field: field.name, kind: field.kind },
    );
  }

  const secondaryType = normalizeSecondaryType(field);
  const { secondaryTypes: _secondaryTypes, ...rest } = field;
  if (secondaryType === undefined) {
    return rest;
  }

  return { ...rest, secondaryType };
}

export function defineSchema<T extends object>(
  fields: readonly SchemaFieldInput<T>[],
  options: SchemaOptions<T> = {},
): CompiledSchema<T> {
  if (fields.length === 0) {
    throw new SchemaValidationError(
      "Schema must define at least one field.",
      "SCHEMA_EMPTY",
      { entityName: options.entityName },
    );
  }

  const normalizedFields: SchemaField<T>[] = [];
  const fieldMap = new Map<FieldName<T>, SchemaField<T>>();

  for (const rawField of fields) {
    const field = normalizeField(rawField);
    if (fieldMap.has(field.name)) {
      throw new SchemaValidationError(
        `Duplicate field "${field.name}" in schema.`,
        "SCHEMA_DUPLICATE_FIELD",
        { field: field.name },
      );
    }

    fieldMap.set(field.name as FieldName<T>, field);
    normalizedFields.push(field);
  }

  const schema: CompiledSchema<T> = {
    fields: normalizedFields,
    fieldMap,
  };

  if (options.entityName !== undefined) {
    Object.assign(schema, { entityName: options.entityName });
  }
  if (options.resultFactory !== undefined) {
    Object.assign(schema, { resultFactory: options.resultFactory });
  }
  if (options.valueAccessor !== undefined) {
    Object.assign(schema, { valueAccessor: options.valueAccessor });
  }

  return schema;
}
