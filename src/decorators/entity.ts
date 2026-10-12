import { DecoratorError } from "../errors.js";
import { defineSchema } from "../schema/define-schema.js";
import type {
  CompiledSchema,
  FieldOptions,
  FieldKind,
  SchemaFieldInput,
  SecondaryType,
} from "../schema/types.js";
import { assertDecoratorMetadataAvailable } from "./metadata.js";

const KIARA_FIELD_METADATA_KEY = Symbol.for("kiara:schema:fields");
const entitySchemaRegistry = new WeakMap<object, CompiledSchema<Record<string, unknown>>>();

type MetadataRecord = Record<PropertyKey, unknown>;
type DecoratorFieldInput = SchemaFieldInput<Record<string, unknown>, string>;
interface MutableFieldDescriptor {
  name: string;
  kind?: FieldKind;
  enumValues?: readonly string[];
  nullable?: boolean;
  caseInsensitive?: boolean;
  ignoreIndex?: boolean;
  oneEditAway?: boolean;
  predictable?: boolean;
  stemmedIndex?: boolean;
  secondaryType?: SecondaryType;
  secondaryTypes?: SecondaryType[];
  format?: string;
  numericStartPos?: number;
}
type DecoratorFieldBucket = Map<string, MutableFieldDescriptor>;

type FieldDecoratorSignature = <This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => void;

function getMetadataRecord(context: { metadata: Record<PropertyKey, unknown> | undefined }): MetadataRecord {
  if (context.metadata === undefined) {
    throw new DecoratorError(
      "Decorator metadata is unavailable for this context. Ensure initializeDecoratorMetadata() runs before class evaluation.",
      "DECORATOR_METADATA_UNAVAILABLE",
    );
  }
  return context.metadata as MetadataRecord;
}

function getOwnFieldMetadataBucket(metadataRecord: MetadataRecord): DecoratorFieldBucket {
  if (!Object.prototype.hasOwnProperty.call(metadataRecord, KIARA_FIELD_METADATA_KEY)) {
    const empty = new Map<string, MutableFieldDescriptor>();
    metadataRecord[KIARA_FIELD_METADATA_KEY] = empty;
    return empty;
  }

  const existing = metadataRecord[KIARA_FIELD_METADATA_KEY];
  if (!(existing instanceof Map)) {
    throw new DecoratorError(
      "Decorator metadata bucket for Kiara fields has an invalid shape.",
      "DECORATOR_MISUSE",
    );
  }
  return existing as DecoratorFieldBucket;
}

function getOrCreateDescriptor(bucket: DecoratorFieldBucket, fieldName: string): MutableFieldDescriptor {
  const existing = bucket.get(fieldName);
  if (existing !== undefined) {
    return existing;
  }

  const created: MutableFieldDescriptor = { name: fieldName };
  bucket.set(fieldName, created);
  return created;
}

function mergeSecondaryType(descriptor: MutableFieldDescriptor, secondaryType: SecondaryType): void {
  const existingSecondary = descriptor.secondaryType;
  if (existingSecondary === undefined) {
    descriptor.secondaryType = secondaryType;
    return;
  }
  if (existingSecondary === secondaryType) {
    return;
  }

  const list = descriptor.secondaryTypes ?? [existingSecondary];
  if (!list.includes(secondaryType)) {
    list.push(secondaryType);
  }
  descriptor.secondaryTypes = list;
  delete descriptor.secondaryType;
}

function applyFieldOptions(descriptor: MutableFieldDescriptor, options: FieldOptions): void {
  if (options.nullable !== undefined) {
    descriptor.nullable = options.nullable;
  }
  if (options.caseInsensitive !== undefined) {
    descriptor.caseInsensitive = options.caseInsensitive;
  }
  if (options.ignoreIndex !== undefined) {
    descriptor.ignoreIndex = options.ignoreIndex;
  }
  if (options.oneEditAway !== undefined) {
    descriptor.oneEditAway = options.oneEditAway;
  }
  if (options.predictable !== undefined) {
    descriptor.predictable = options.predictable;
  }
  if (options.stemmedIndex !== undefined) {
    descriptor.stemmedIndex = options.stemmedIndex;
  }
  if (options.format !== undefined) {
    descriptor.format = options.format;
  }
  if (options.numericStartPos !== undefined) {
    descriptor.numericStartPos = options.numericStartPos;
  }
  if (options.secondaryType !== undefined) {
    mergeSecondaryType(descriptor, options.secondaryType);
  }
  if (options.secondaryTypes !== undefined) {
    for (const secondaryType of options.secondaryTypes) {
      mergeSecondaryType(descriptor, secondaryType);
    }
  }
}

function registerField(kind: FieldKind, options: FieldOptions): FieldDecoratorSignature {
  return function addFieldMetadata(_value, context): void {
    assertDecoratorMetadataAvailable();
    if (typeof context.name !== "string") {
      throw new DecoratorError(
        "Kiara field decorators support only string-named fields.",
        "DECORATOR_MISUSE",
        { field: String(context.name) },
      );
    }

    const metadataRecord = getMetadataRecord(context);
    const bucket = getOwnFieldMetadataBucket(metadataRecord);
    const descriptor = getOrCreateDescriptor(bucket, context.name);

    descriptor.kind = kind;
    applyFieldOptions(descriptor, options);
  };
}

function registerEnumField(enumValues: readonly string[], options: FieldOptions): FieldDecoratorSignature {
  return function addEnumFieldMetadata(_value, context): void {
    assertDecoratorMetadataAvailable();
    if (typeof context.name !== "string") {
      throw new DecoratorError(
        "Kiara enum field decorators support only string-named fields.",
        "DECORATOR_MISUSE",
        { field: String(context.name) },
      );
    }

    const metadataRecord = getMetadataRecord(context);
    const bucket = getOwnFieldMetadataBucket(metadataRecord);
    const descriptor = getOrCreateDescriptor(bucket, context.name);

    descriptor.kind = "enum";
    descriptor.enumValues = enumValues;
    applyFieldOptions(descriptor, options);
  };
}

function registerFieldOptions(options: FieldOptions, inferredKind?: FieldKind): FieldDecoratorSignature {
  return function addFieldOptions(_value, context): void {
    assertDecoratorMetadataAvailable();
    if (typeof context.name !== "string") {
      throw new DecoratorError(
        "Kiara field decorators support only string-named fields.",
        "DECORATOR_MISUSE",
        { field: String(context.name) },
      );
    }

    const metadataRecord = getMetadataRecord(context);
    const bucket = getOwnFieldMetadataBucket(metadataRecord);
    const descriptor = getOrCreateDescriptor(bucket, context.name);

    if (inferredKind !== undefined && descriptor.kind === undefined) {
      descriptor.kind = inferredKind;
    }
    applyFieldOptions(descriptor, options);
  };
}

function readEntityFields(metadataRecord: MetadataRecord): DecoratorFieldInput[] {
  const existing = metadataRecord[KIARA_FIELD_METADATA_KEY];
  if (existing === undefined) {
    return [];
  }

  if (!(existing instanceof Map)) {
    throw new DecoratorError(
      "Entity metadata contains malformed field descriptors.",
      "DECORATOR_MISUSE",
    );
  }

  const fields: DecoratorFieldInput[] = [];
  for (const descriptor of (existing as DecoratorFieldBucket).values()) {
    if (descriptor.kind === undefined) {
      throw new DecoratorError(
        `Field "${descriptor.name}" is missing a field kind decorator.`,
        "DECORATOR_MISUSE",
        { field: descriptor.name },
      );
    }

    fields.push(descriptor as DecoratorFieldInput);
  }
  return fields;
}

export function Entity<T extends abstract new (...args: never[]) => object>(
  target: T,
  context: ClassDecoratorContext<T>,
): void {
  assertDecoratorMetadataAvailable();
  const metadataRecord = getMetadataRecord(context);
  const fields = readEntityFields(metadataRecord);
  const schema = defineSchema(fields, { entityName: target.name });
  entitySchemaRegistry.set(target, schema);
}

export function getEntitySchema<T extends object>(entity: abstract new (...args: never[]) => T): CompiledSchema<T> {
  const schema = entitySchemaRegistry.get(entity);
  if (schema === undefined) {
    throw new DecoratorError(
      `Entity "${entity.name}" has no registered Kiara schema.`,
      "DECORATOR_MISUSE",
    );
  }
  return schema as unknown as CompiledSchema<T>;
}

export function Text(options: FieldOptions = {}): FieldDecoratorSignature {
  return registerField("text", options);
}

export function NumberField(options: FieldOptions = {}): FieldDecoratorSignature {
  return registerField("number", options);
}

export function BooleanField(options: FieldOptions = {}): FieldDecoratorSignature {
  return registerField("boolean", options);
}

export function LongField(options: FieldOptions = {}): FieldDecoratorSignature {
  return registerField("long", options);
}

export function EnumField(
  enumValues: readonly string[],
  options: FieldOptions = {},
): FieldDecoratorSignature {
  return registerEnumField(enumValues, options);
}

export function CaseInsensitive(): FieldDecoratorSignature {
  return registerFieldOptions({ caseInsensitive: true });
}

export function IgnoreIndex(): FieldDecoratorSignature {
  return registerFieldOptions({ ignoreIndex: true });
}

export function OneEditAway(): FieldDecoratorSignature {
  return registerFieldOptions({ oneEditAway: true });
}

export function Predictable(): FieldDecoratorSignature {
  return registerFieldOptions({ predictable: true });
}

export function StemmedIndex(): FieldDecoratorSignature {
  return registerFieldOptions({ stemmedIndex: true });
}

export function CommaSeparatedStrings(): FieldDecoratorSignature {
  return registerFieldOptions({ secondaryType: "commaSeparatedStrings" }, "text");
}

export function CommaSeparatedNumbers(): FieldDecoratorSignature {
  return registerFieldOptions({ secondaryType: "commaSeparatedNumbers" }, "text");
}

export function CommaSeparatedDates(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "commaSeparatedDates" }, "text");
  }
  return registerFieldOptions({ secondaryType: "commaSeparatedDates", format }, "text");
}

export function CommaSeparatedDateTimes(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "commaSeparatedDateTimes" }, "text");
  }
  return registerFieldOptions({ secondaryType: "commaSeparatedDateTimes", format }, "text");
}

export function CommaSeparatedNumericRanges(numericStartPos = 0): FieldDecoratorSignature {
  return registerFieldOptions(
    { secondaryType: "commaSeparatedNumericRanges", numericStartPos },
    "text",
  );
}

export function CommaSeparatedDateRanges(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "commaSeparatedDateRanges" }, "text");
  }
  return registerFieldOptions({ secondaryType: "commaSeparatedDateRanges", format }, "text");
}

export function CommaSeparatedDateTimeRanges(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "commaSeparatedDateTimeRanges" }, "text");
  }
  return registerFieldOptions({ secondaryType: "commaSeparatedDateTimeRanges", format }, "text");
}

export function DateFormat(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "dateFormat" }, "text");
  }
  return registerFieldOptions({ secondaryType: "dateFormat", format }, "text");
}

export function DateTimeFormat(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "dateTimeFormat" }, "text");
  }
  return registerFieldOptions({ secondaryType: "dateTimeFormat", format }, "text");
}

export function DateRange(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "dateRange" }, "text");
  }
  return registerFieldOptions({ secondaryType: "dateRange", format }, "text");
}

export function DateTimeRange(format?: string): FieldDecoratorSignature {
  if (format === undefined) {
    return registerFieldOptions({ secondaryType: "dateTimeRange" }, "text");
  }
  return registerFieldOptions({ secondaryType: "dateTimeRange", format }, "text");
}

export function NumericRange(numericStartPos = 0): FieldDecoratorSignature {
  return registerFieldOptions({ secondaryType: "numericRange", numericStartPos }, "text");
}

export const CommaSeperatedStrings = CommaSeparatedStrings;
export const CommaSeperatedNumbers = CommaSeparatedNumbers;
export const CommaSeperatedDates = CommaSeparatedDates;
export const CommaSeperatedDateTimes = CommaSeparatedDateTimes;
export const CommaSeperatedNumericRanges = CommaSeparatedNumericRanges;
export const CommaSeperatedDateRanges = CommaSeparatedDateRanges;
export const CommaSeperatedDateTimeRanges = CommaSeparatedDateTimeRanges;
