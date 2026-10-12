import type { FieldName, FieldOptions, SchemaFieldInput } from "./types.js";

export function textField<T extends object, TName extends FieldName<T>>(
  name: TName,
  options: FieldOptions = {},
): SchemaFieldInput<T, TName> {
  return { name, kind: "text", ...options };
}

export function numberField<T extends object, TName extends FieldName<T>>(
  name: TName,
  options: FieldOptions = {},
): SchemaFieldInput<T, TName> {
  return { name, kind: "number", ...options };
}

export function booleanField<T extends object, TName extends FieldName<T>>(
  name: TName,
  options: FieldOptions = {},
): SchemaFieldInput<T, TName> {
  return { name, kind: "boolean", ...options };
}

export function longField<T extends object, TName extends FieldName<T>>(
  name: TName,
  options: FieldOptions = {},
): SchemaFieldInput<T, TName> {
  return { name, kind: "long", ...options };
}

export function enumField<T extends object, TName extends FieldName<T>>(
  name: TName,
  enumValues: readonly string[],
  options: FieldOptions = {},
): SchemaFieldInput<T, TName> {
  return { name, kind: "enum", enumValues, ...options };
}
