export type FieldKind = "text" | "number" | "boolean" | "long" | "enum";

export type SecondaryType =
  | "commaSeparatedStrings"
  | "commaSeparatedNumbers"
  | "commaSeparatedDates"
  | "commaSeparatedDateTimes"
  | "commaSeparatedNumericRanges"
  | "commaSeparatedDateRanges"
  | "commaSeparatedDateTimeRanges"
  | "dateFormat"
  | "dateTimeFormat"
  | "dateRange"
  | "dateTimeRange"
  | "numericRange";

export interface FieldOptions {
  readonly nullable?: boolean;
  readonly caseInsensitive?: boolean;
  readonly ignoreIndex?: boolean;
  readonly oneEditAway?: boolean;
  readonly predictable?: boolean;
  readonly stemmedIndex?: boolean;
  readonly secondaryType?: SecondaryType;
  readonly secondaryTypes?: readonly SecondaryType[];
  readonly format?: string;
  readonly numericStartPos?: number;
}

export type FieldName<T extends object> = Extract<keyof T, string>;

export interface SchemaFieldInput<
  T extends object,
  TName extends FieldName<T> = FieldName<T>,
> extends FieldOptions {
  readonly name: TName;
  readonly kind: FieldKind;
  readonly enumValues?: readonly string[];
}

export interface SchemaField<
  T extends object,
  TName extends FieldName<T> = FieldName<T>,
> extends Omit<SchemaFieldInput<T, TName>, "secondaryTypes"> {
  readonly secondaryType?: SecondaryType;
}

export type ResultFactory<T extends object> = (record: Readonly<Record<string, unknown>>) => T;

export type ValueAccessor<T extends object> = (model: T, field: FieldName<T>) => unknown;

export interface SchemaOptions<T extends object> {
  readonly entityName?: string;
  readonly resultFactory?: ResultFactory<T>;
  readonly valueAccessor?: ValueAccessor<T>;
}

export interface CompiledSchema<T extends object> {
  readonly entityName?: string;
  readonly fields: readonly SchemaField<T>[];
  readonly fieldMap: ReadonlyMap<FieldName<T>, SchemaField<T>>;
  readonly resultFactory?: ResultFactory<T>;
  readonly valueAccessor?: ValueAccessor<T>;
}
