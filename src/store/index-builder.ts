import { QueryValidationError } from "../errors.js";
import {
  normalizeJavaLongKey,
  normalizeNativeNumber,
  normalizeText,
} from "../normalization/numeric.js";
import {
  normalizeDateTimeToEpochSecond,
  normalizeDateToEpochDay,
} from "../normalization/date.js";
import type { CompiledSchema, FieldName, SchemaField } from "../schema/types.js";
import {
  NormalizationProfile,
  type AnyModel,
  type FieldIndex,
  type NormalizationProfile as NormalizationProfileType,
  type NormalizedFieldValue,
  type NormalizedNumericRange,
  type NormalizedRow,
  type NormalizedScalar,
  type PreparedStoreData,
  type TrieNode,
  type TrieSnapshot,
} from "./types.js";
import {
  parseDateRangeValue,
  parseDateTimeRangeValue,
  parseNumericRangeValue,
} from "../normalization/range.js";

interface MutableFieldIndex {
  readonly field: SchemaField<AnyModel, string>;
  readonly equality: Map<string, Set<number>>;
  readonly numericOrder: Map<string, { key: number | bigint; rowIds: Set<number> }>;
  readonly collectionFullKeys: Map<string, Set<number>>;
  readonly rangeEntries: Map<number, NormalizedNumericRange[]>;
}

function isCollectionField(field: SchemaField<AnyModel, string>): boolean {
  return (
    field.secondaryType === "commaSeparatedStrings" ||
    field.secondaryType === "commaSeparatedNumbers" ||
    field.secondaryType === "commaSeparatedDates" ||
    field.secondaryType === "commaSeparatedDateTimes" ||
    field.secondaryType === "commaSeparatedNumericRanges" ||
    field.secondaryType === "commaSeparatedDateRanges" ||
    field.secondaryType === "commaSeparatedDateTimeRanges"
  );
}

function isRangeField(field: SchemaField<AnyModel, string>): boolean {
  return (
    field.secondaryType === "numericRange" ||
    field.secondaryType === "commaSeparatedNumericRanges" ||
    field.secondaryType === "dateRange" ||
    field.secondaryType === "commaSeparatedDateRanges" ||
    field.secondaryType === "dateTimeRange" ||
    field.secondaryType === "commaSeparatedDateTimeRanges"
  );
}

function canonicalizeNumericRange(range: NormalizedNumericRange): string {
  return `${range.prefix}${String(range.lower)}->${String(range.upper)}`;
}

function normalizeRangeInput(
  field: SchemaField<AnyModel, string>,
  input: string,
  profile: NormalizationProfileType,
): NormalizedNumericRange {
  if (
    field.secondaryType === "dateRange" ||
    field.secondaryType === "commaSeparatedDateRanges"
  ) {
    const parsed = parseDateRangeValue(input, field.format);
    return { prefix: "", lower: parsed.lower, upper: parsed.upper };
  }

  if (
    field.secondaryType === "dateTimeRange" ||
    field.secondaryType === "commaSeparatedDateTimeRanges"
  ) {
    const parsed = parseDateTimeRangeValue(input, field.format);
    return { prefix: "", lower: parsed.lower, upper: parsed.upper };
  }

  const parsed = parseNumericRangeValue(input, profile, field.numericStartPos ?? 0);
  return {
    prefix: parsed.prefix,
    lower: parsed.lower,
    upper: parsed.upper,
  };
}

function encodeScalar(value: NormalizedScalar): string {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "string":
      return `s:${value}`;
    case "boolean":
      return `b:${value ? "1" : "0"}`;
    case "number":
      return `n:${value}`;
    case "bigint":
      return `i:${value.toString()}`;
    default:
      return "unknown";
  }
}

function parseCollectionString(value: string): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function normalizeScalarValue(
  field: SchemaField<AnyModel, string>,
  value: unknown,
  profile: NormalizationProfileType,
): NormalizedScalar {
  if (value === null || value === undefined) {
    return null;
  }

  if (field.secondaryType === "dateFormat") {
    return normalizeDateToEpochDay(value, field.format);
  }

  if (field.secondaryType === "dateTimeFormat") {
    return normalizeDateTimeToEpochSecond(value, field.format);
  }

  if (field.secondaryType === "commaSeparatedStrings") {
    if (typeof value !== "string") {
      throw new QueryValidationError(
        `Field "${field.name}" expects string collection values.`,
        "QUERY_INVALID_CONDITION",
        { field: field.name, valueType: typeof value },
      );
    }
    return normalizeText(value, field.caseInsensitive === true);
  }

  if (field.secondaryType === "commaSeparatedNumbers") {
    return profile === NormalizationProfile.JAVA
      ? normalizeJavaLongKey(value)
      : normalizeNativeNumber(value);
  }

  if (field.secondaryType === "commaSeparatedDates") {
    return normalizeDateToEpochDay(value, field.format);
  }

  if (field.secondaryType === "commaSeparatedDateTimes") {
    return normalizeDateTimeToEpochSecond(value, field.format);
  }

  if (field.secondaryType === "numericRange") {
    if (typeof value !== "string") {
      throw new QueryValidationError(
        `Field "${field.name}" expects a numeric range string.`,
        "QUERY_INVALID_CONDITION",
        { field: field.name, valueType: typeof value },
      );
    }
    return canonicalizeNumericRange(normalizeRangeInput(field, value, profile));
  }

  if (field.secondaryType === "commaSeparatedNumericRanges") {
    if (typeof value !== "string") {
      throw new QueryValidationError(
        `Field "${field.name}" expects numeric range string tokens.`,
        "QUERY_INVALID_CONDITION",
        { field: field.name, valueType: typeof value },
      );
    }
    return canonicalizeNumericRange(normalizeRangeInput(field, value, profile));
  }

  if (field.secondaryType === "dateRange" || field.secondaryType === "dateTimeRange") {
    if (typeof value !== "string") {
      throw new QueryValidationError(
        `Field "${field.name}" expects a range string value.`,
        "QUERY_INVALID_CONDITION",
        { field: field.name, valueType: typeof value },
      );
    }
    return canonicalizeNumericRange(normalizeRangeInput(field, value, profile));
  }

  if (
    field.secondaryType === "commaSeparatedDateRanges" ||
    field.secondaryType === "commaSeparatedDateTimeRanges"
  ) {
    if (typeof value !== "string") {
      throw new QueryValidationError(
        `Field "${field.name}" expects range string tokens.`,
        "QUERY_INVALID_CONDITION",
        { field: field.name, valueType: typeof value },
      );
    }
    return canonicalizeNumericRange(normalizeRangeInput(field, value, profile));
  }

  switch (field.kind) {
    case "text":
    case "enum": {
      if (typeof value !== "string") {
        throw new QueryValidationError(
          `Field "${field.name}" expects a string value.`,
          "QUERY_INVALID_CONDITION",
          { field: field.name, valueType: typeof value },
        );
      }
      return normalizeText(value, field.caseInsensitive === true);
    }
    case "boolean": {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
          return true;
        }
        if (normalized === "false") {
          return false;
        }
      }
      throw new QueryValidationError(
        `Field "${field.name}" expects a boolean value.`,
        "QUERY_INVALID_CONDITION",
        { field: field.name, valueType: typeof value },
      );
    }
    case "number":
    case "long": {
      if (profile === NormalizationProfile.JAVA) {
        return normalizeJavaLongKey(value);
      }
      if (field.kind === "long") {
        if (typeof value === "bigint") {
          return value;
        }
        return BigInt(Math.trunc(normalizeNativeNumber(value)));
      }
      return normalizeNativeNumber(value);
    }
    default:
      throw new QueryValidationError(
        `Field "${field.name}" has unsupported kind "${String(field.kind)}".`,
        "QUERY_INVALID_CONDITION",
      );
  }
}

function normalizeFieldValue(
  field: SchemaField<AnyModel, string>,
  value: unknown,
  profile: NormalizationProfileType,
): NormalizedFieldValue {
  if (!isCollectionField(field)) {
    const scalar = normalizeScalarValue(field, value, profile);
    const rangeValues = isRangeField(field) && typeof value === "string"
      ? [normalizeRangeInput(field, value, profile)]
      : undefined;
    return {
      isCollection: false,
      scalar,
      collectionValues: undefined,
      rangeValues,
    };
  }

  if (value === null || value === undefined) {
    return {
      isCollection: true,
      scalar: undefined,
      collectionValues: undefined,
      rangeValues: undefined,
    };
  }

  if (typeof value !== "string") {
    throw new QueryValidationError(
      `Collection field "${field.name}" expects a comma-separated string.`,
      "QUERY_INVALID_CONDITION",
      { field: field.name, valueType: typeof value },
    );
  }

  const tokens = parseCollectionString(value);
  if (field.secondaryType === "commaSeparatedStrings") {
    return {
      isCollection: true,
      scalar: undefined,
      collectionValues: tokens.map((token) => normalizeText(token, field.caseInsensitive === true)),
      rangeValues: undefined,
    };
  }

  if (field.secondaryType === "commaSeparatedNumbers") {
    return {
      isCollection: true,
      scalar: undefined,
      collectionValues: tokens.map((token) =>
        profile === NormalizationProfile.JAVA
          ? normalizeJavaLongKey(token)
          : normalizeNativeNumber(token)
      ),
      rangeValues: undefined,
    };
  }

  if (field.secondaryType === "commaSeparatedDates") {
    return {
      isCollection: true,
      scalar: undefined,
      collectionValues: tokens.map((token) => normalizeDateToEpochDay(token, field.format)),
      rangeValues: undefined,
    };
  }

  if (field.secondaryType === "commaSeparatedDateTimes") {
    return {
      isCollection: true,
      scalar: undefined,
      collectionValues: tokens.map((token) =>
        normalizeDateTimeToEpochSecond(token, field.format)
      ),
      rangeValues: undefined,
    };
  }

  if (
    field.secondaryType === "commaSeparatedNumericRanges" ||
    field.secondaryType === "commaSeparatedDateRanges" ||
    field.secondaryType === "commaSeparatedDateTimeRanges"
  ) {
    const ranges = tokens.map((token) => normalizeRangeInput(field, token, profile));
    return {
      isCollection: true,
      scalar: undefined,
      collectionValues: ranges.map((range) => canonicalizeNumericRange(range)),
      rangeValues: ranges,
    };
  }

  return {
    isCollection: true,
    scalar: undefined,
    collectionValues: tokens.map((token) => normalizeScalarValue(field, token, profile)),
    rangeValues: undefined,
  };
}

function indexScalarValue(index: MutableFieldIndex, value: NormalizedScalar, rowId: number): void {
  const encoded = encodeScalar(value);
  const equalityRows = index.equality.get(encoded) ?? new Set<number>();
  equalityRows.add(rowId);
  index.equality.set(encoded, equalityRows);

  if (typeof value === "number" || typeof value === "bigint") {
    const numericRows = index.numericOrder.get(encoded) ?? { key: value, rowIds: new Set<number>() };
    numericRows.rowIds.add(rowId);
    index.numericOrder.set(encoded, numericRows);
  }
}

function indexCollectionValues(index: MutableFieldIndex, values: readonly NormalizedScalar[], rowId: number): void {
  for (const token of values) {
    const encoded = encodeScalar(token);
    const tokenRows = index.equality.get(encoded) ?? new Set<number>();
    tokenRows.add(rowId);
    index.equality.set(encoded, tokenRows);
  }

  const fullKey = values.map((token) => encodeScalar(token)).join("|");
  const fullRows = index.collectionFullKeys.get(fullKey) ?? new Set<number>();
  fullRows.add(rowId);
  index.collectionFullKeys.set(fullKey, fullRows);
}

function compareNumeric(a: number | bigint, b: number | bigint): number {
  if (typeof a === "bigint" && typeof b === "bigint") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const an = Number(a);
  const bn = Number(b);
  return an < bn ? -1 : an > bn ? 1 : 0;
}

function freezeIndex(index: MutableFieldIndex): FieldIndex {
  const equality = new Map<string, readonly number[]>();
  for (const [key, rowIds] of index.equality) {
    equality.set(key, Object.freeze([...rowIds]));
  }

  const collectionFullKeys = new Map<string, readonly number[]>();
  for (const [key, rowIds] of index.collectionFullKeys) {
    collectionFullKeys.set(key, Object.freeze([...rowIds]));
  }

  const numericOrder = [...index.numericOrder.values()]
    .map((entry) => ({
      key: entry.key,
      rowIds: Object.freeze([...entry.rowIds]),
    }))
    .sort((left, right) => compareNumeric(left.key, right.key));

  const rangeEntries = [...index.rangeEntries.entries()].map(([rowId, ranges]) => ({
    rowId,
    ranges: Object.freeze([...ranges]),
  }));

  return {
    field: index.field,
    equality,
    numericOrder,
    collectionFullKeys,
    rangeEntries: Object.freeze(rangeEntries),
  };
}

function toMutableFieldIndex(field: SchemaField<AnyModel, string>): MutableFieldIndex {
  return {
    field,
    equality: new Map<string, Set<number>>(),
    numericOrder: new Map<string, { key: number | bigint; rowIds: Set<number> }>(),
    collectionFullKeys: new Map<string, Set<number>>(),
    rangeEntries: new Map<number, NormalizedNumericRange[]>(),
  };
}

function buildTrie<T extends object>(
  schema: CompiledSchema<T>,
  rows: readonly NormalizedRow<T>[],
): TrieSnapshot {
  const nodes = new Map<number, {
    id: number;
    level: number;
    fieldName: string | null;
    key: NormalizedScalar | null;
    parentId: number | null;
    childIds: Map<string, number>;
    rowIds: Set<number>;
  }>();

  nodes.set(0, {
    id: 0,
    level: 0,
    fieldName: null,
    key: null,
    parentId: null,
    childIds: new Map<string, number>(),
    rowIds: new Set<number>(),
  });

  let nextNodeId = 1;
  for (const row of rows) {
    let currentNodeId = 0;
    const root = nodes.get(0);
    root?.rowIds.add(row.id);

    let level = 1;
    for (const field of schema.fields) {
      const normalized = row.values.get(field.name);
      const key = normalized?.isCollection === true
        ? normalized.collectionValues?.map((value) => encodeScalar(value)).join("|") ?? "null"
        : encodeScalar(normalized?.scalar ?? null);
      const edgeLabel = `${field.name}:${key}`;
      const current = nodes.get(currentNodeId);
      if (current === undefined) {
        continue;
      }

      let childId = current.childIds.get(edgeLabel);
      if (childId === undefined) {
        childId = nextNodeId;
        nextNodeId += 1;
        current.childIds.set(edgeLabel, childId);
        nodes.set(childId, {
          id: childId,
          level,
          fieldName: field.name,
          key: normalized?.isCollection === true
            ? (normalized.collectionValues?.join(",") ?? null)
            : (normalized?.scalar ?? null),
          parentId: currentNodeId,
          childIds: new Map<string, number>(),
          rowIds: new Set<number>(),
        });
      }

      currentNodeId = childId;
      const child = nodes.get(childId);
      child?.rowIds.add(row.id);
      level += 1;
    }
  }

  const frozenNodes: TrieNode[] = [...nodes.values()]
    .sort((left, right) => left.id - right.id)
    .map((node) => ({
      id: node.id,
      level: node.level,
      fieldName: node.fieldName,
      key: node.key,
      parentId: node.parentId,
      childIds: new Map<string, number>(node.childIds),
      rowIds: Object.freeze([...node.rowIds]),
    }));

  return { nodes: Object.freeze(frozenNodes) };
}

export function buildPreparedStoreData<T extends object>(
  schema: CompiledSchema<T>,
  sourceRows: readonly T[],
  profile: NormalizationProfileType,
): PreparedStoreData<T> {
  const mutableIndexes = new Map<FieldName<T>, MutableFieldIndex>();
  for (const field of schema.fields) {
    if (field.ignoreIndex === true) {
      continue;
    }
    mutableIndexes.set(field.name, toMutableFieldIndex(field as SchemaField<AnyModel, string>));
  }

  const normalizedRows: NormalizedRow<T>[] = [];
  const rowById = new Map<number, NormalizedRow<T>>();

  for (let rowId = 0; rowId < sourceRows.length; rowId += 1) {
    const source = sourceRows[rowId];
    if (source === undefined) {
      continue;
    }
    const sourceRecord = source as Record<string, unknown>;
    const values = new Map<FieldName<T>, NormalizedFieldValue>();

    for (const field of schema.fields) {
      const rawValue = sourceRecord[field.name];
      const normalized = normalizeFieldValue(
        field as SchemaField<AnyModel, string>,
        rawValue,
        profile,
      );
      values.set(field.name, normalized);

      const fieldIndex = mutableIndexes.get(field.name);
      if (fieldIndex === undefined) {
        continue;
      }

      if (normalized.isCollection) {
        const tokens = normalized.collectionValues;
        if (tokens !== undefined && tokens.length > 0) {
          indexCollectionValues(fieldIndex, tokens, rowId);
        }
      } else {
        indexScalarValue(fieldIndex, normalized.scalar ?? null, rowId);
      }

      if (isRangeField(field as SchemaField<AnyModel, string>)) {
        const ranges = normalized.rangeValues;
        if (ranges !== undefined && ranges.length > 0) {
          fieldIndex.rangeEntries.set(rowId, [...ranges]);
        } else if (!normalized.isCollection && typeof rawValue === "string") {
          const parsed = normalizeRangeInput(
            field as SchemaField<AnyModel, string>,
            rawValue,
            profile,
          );
          fieldIndex.rangeEntries.set(rowId, [parsed]);
        }
      }
    }

    const normalizedRow: NormalizedRow<T> = {
      id: rowId,
      source,
      values,
    };
    normalizedRows.push(normalizedRow);
    rowById.set(rowId, normalizedRow);
  }

  const frozenIndexes = new Map<FieldName<T>, FieldIndex>();
  for (const [fieldName, index] of mutableIndexes) {
    frozenIndexes.set(fieldName, freezeIndex(index));
  }

  const trie = buildTrie(schema, normalizedRows);
  const rowIds = Object.freeze(normalizedRows.map((row) => row.id));

  return {
    schema,
    normalizationProfile: profile,
    rows: Object.freeze([...sourceRows]),
    normalizedRows: Object.freeze(normalizedRows),
    rowIds,
    rowById,
    trie,
    indexes: frozenIndexes,
  };
}

export function encodeNormalizedScalar(value: NormalizedScalar): string {
  return encodeScalar(value);
}

export function normalizeConditionValue(
  field: SchemaField<AnyModel, string>,
  value: unknown,
  profile: NormalizationProfileType,
): NormalizedScalar {
  return normalizeScalarValue(field, value, profile);
}
