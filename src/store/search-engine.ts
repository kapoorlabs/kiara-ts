import { QueryValidationError } from "../errors.js";
import {
  normalizeDateTimeToEpochSecond,
  normalizeDateToEpochDay,
} from "../normalization/date.js";
import { normalizeJavaLongKey, normalizeNativeNumber } from "../normalization/numeric.js";
import {
  parseDateRangeValue,
  parseDateTimeRangeValue,
  parseNumericRangeValue,
} from "../normalization/range.js";
import { validateConditions, type Condition } from "../query/condition.js";
import { validateOperatorCompatibility } from "../query/operator-compatibility.js";
import { Operator } from "../query/operator.js";
import type { FieldName, SchemaField } from "../schema/types.js";
import {
  buildPreparedStoreData,
  encodeNormalizedScalar,
  normalizeConditionValue,
} from "./index-builder.js";
import {
  NormalizationProfile,
  type AnyModel,
  type FieldIndex,
  type NormalizedFieldValue,
  type NormalizedNumericRange,
  type NormalizedRow,
  type NormalizedScalar,
  type PreparedStoreData,
} from "./types.js";

function toSet(values: readonly number[]): Set<number> {
  return new Set<number>(values);
}

function intersect(left: Set<number>, right: Set<number>): Set<number> {
  const result = new Set<number>();
  for (const rowId of left) {
    if (right.has(rowId)) {
      result.add(rowId);
    }
  }
  return result;
}

function subtract(left: Set<number>, right: Set<number>): Set<number> {
  const result = new Set<number>();
  for (const rowId of left) {
    if (!right.has(rowId)) {
      result.add(rowId);
    }
  }
  return result;
}

function union(rowGroups: readonly (readonly number[])[]): Set<number> {
  const result = new Set<number>();
  for (const group of rowGroups) {
    for (const rowId of group) {
      result.add(rowId);
    }
  }
  return result;
}

function compareNumeric(left: number | bigint, right: number | bigint): number {
  if (typeof left === "bigint" && typeof right === "bigint") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
}

function isCollectionCondition(field: SchemaField<AnyModel, string>): boolean {
  return (
    field.secondaryType === "commaSeparatedStrings" ||
    field.secondaryType === "commaSeparatedNumbers" ||
    field.secondaryType === "commaSeparatedDates" ||
    field.secondaryType === "commaSeparatedDateTimes"
  );
}

function isDateRangeSecondaryType(secondaryType: string | undefined): boolean {
  return secondaryType === "dateRange" || secondaryType === "commaSeparatedDateRanges";
}

function isDateTimeRangeSecondaryType(secondaryType: string | undefined): boolean {
  return secondaryType === "dateTimeRange" || secondaryType === "commaSeparatedDateTimeRanges";
}

function isRangeSecondaryType(secondaryType: string | undefined): boolean {
  return (
    secondaryType === "numericRange" ||
    secondaryType === "commaSeparatedNumericRanges" ||
    isDateRangeSecondaryType(secondaryType) ||
    isDateTimeRangeSecondaryType(secondaryType)
  );
}

function normalizeScalarValues(
  field: SchemaField<AnyModel, string>,
  condition: Condition<AnyModel, string>,
  data: PreparedStoreData<AnyModel>,
): NormalizedScalar[] {
  const values = condition.values ?? [];
  return values.map((value) =>
    normalizeConditionValue(field, value, data.normalizationProfile),
  );
}

function normalizeCollectionConditionValues(
  field: SchemaField<AnyModel, string>,
  condition: Condition<AnyModel, string>,
  data: PreparedStoreData<AnyModel>,
): NormalizedScalar[] {
  const values = condition.values ?? [];
  return values.map((value) => normalizeConditionValue(field, value, data.normalizationProfile));
}

function resolveEquality(
  index: FieldIndex,
  values: readonly NormalizedScalar[],
): Set<number> {
  const groups = values.map((value) => index.equality.get(encodeNormalizedScalar(value)) ?? []);
  return union(groups);
}

function resolveNumericComparison(
  index: FieldIndex,
  lowerBound: number | bigint | undefined,
  upperBound: number | bigint | undefined,
  lowerInclusive: boolean,
  upperInclusive: boolean,
): Set<number> {
  const groups: number[][] = [];
  for (const entry of index.numericOrder) {
    if (lowerBound !== undefined) {
      const lowerComparison = compareNumeric(entry.key, lowerBound);
      if (lowerComparison < 0 || (lowerComparison === 0 && !lowerInclusive)) {
        continue;
      }
    }
    if (upperBound !== undefined) {
      const upperComparison = compareNumeric(entry.key, upperBound);
      if (upperComparison > 0 || (upperComparison === 0 && !upperInclusive)) {
        continue;
      }
    }
    groups.push([...entry.rowIds]);
  }
  return union(groups);
}

function resolveNotContainsCollection(
  condition: Condition<AnyModel, string>,
  field: SchemaField<AnyModel, string>,
  index: FieldIndex,
  allRows: Set<number>,
  data: PreparedStoreData<AnyModel>,
): Set<number> {
  if (condition.values === undefined || condition.values.length === 0) {
    throw new QueryValidationError(
      `NOT_CONTAINS condition on "${condition.field}" requires values.`,
      "QUERY_INVALID_CONDITION",
    );
  }
  const normalizedValues = normalizeCollectionConditionValues(field, condition, data);
  const forbiddenRows = resolveEquality(index, normalizedValues);
  return subtract(allRows, forbiddenRows);
}

function hasCollectionMatch(stored: NormalizedFieldValue, target: NormalizedScalar): boolean {
  const values = stored.collectionValues;
  if (values === undefined) {
    return false;
  }
  return values.some((value) => value === target);
}

function parseRangeQueryPoint(
  field: SchemaField<AnyModel, string>,
  value: unknown,
  data: PreparedStoreData<AnyModel>,
): { readonly prefix: string; readonly point: number | bigint } {
  if (typeof value === "number" || typeof value === "bigint") {
    return { prefix: "", point: value };
  }

  if (typeof value !== "string") {
    throw new QueryValidationError(
      `Range query value for field "${field.name}" must be string/number/bigint.`,
      "QUERY_INVALID_CONDITION",
      { field: field.name, valueType: typeof value },
    );
  }

  if (value.includes("->")) {
    if (isDateRangeSecondaryType(field.secondaryType)) {
      const parsed = parseDateRangeValue(value, field.format);
      return { prefix: "", point: parsed.lower };
    }
    if (isDateTimeRangeSecondaryType(field.secondaryType)) {
      const parsed = parseDateTimeRangeValue(value, field.format);
      return { prefix: "", point: parsed.lower };
    }
    const parsed = parseNumericRangeValue(
      value,
      data.normalizationProfile,
      field.numericStartPos ?? 0,
    );
    return { prefix: parsed.prefix, point: parsed.lower };
  }

  if (isDateRangeSecondaryType(field.secondaryType)) {
    return { prefix: "", point: normalizeDateToEpochDay(value, field.format) };
  }
  if (isDateTimeRangeSecondaryType(field.secondaryType)) {
    return { prefix: "", point: normalizeDateTimeToEpochSecond(value, field.format) };
  }

  const startPos = Math.max(0, field.numericStartPos ?? 0);
  const prefix = startPos > 0 ? value.slice(0, startPos) : "";
  const numericPart = startPos > 0 ? value.slice(startPos) : value;

  const normalizedPoint = data.normalizationProfile === NormalizationProfile.JAVA
    ? normalizeJavaLongKey(numericPart)
    : normalizeNativeNumber(numericPart);
  if (typeof normalizedPoint !== "number" && typeof normalizedPoint !== "bigint") {
    throw new QueryValidationError(
      `Range query value for field "${field.name}" must resolve to a numeric point.`,
      "QUERY_INVALID_CONDITION",
      { field: field.name, value },
    );
  }

  return { prefix, point: normalizedPoint };
}

function rangeContainsPoint(
  range: NormalizedNumericRange,
  prefix: string,
  point: number | bigint,
): boolean {
  if (range.prefix !== prefix) {
    return false;
  }
  return compareNumeric(point, range.lower) >= 0 && compareNumeric(point, range.upper) <= 0;
}

function resolveNumericRangeCandidates(
  field: SchemaField<AnyModel, string>,
  condition: Condition<AnyModel, string>,
  index: FieldIndex,
  universe: Set<number>,
  data: PreparedStoreData<AnyModel>,
): Set<number> {
  const points = (condition.values ?? []).map((value) => parseRangeQueryPoint(field, value, data));
  const matches = new Set<number>();

  for (const entry of index.rangeEntries) {
    const matchesEither = points.some((point) =>
      entry.ranges.some((range) => rangeContainsPoint(range, point.prefix, point.point))
    );
    const matchesAll = points.every((point) =>
      entry.ranges.some((range) => rangeContainsPoint(range, point.prefix, point.point))
    );

    if (condition.operator === Operator.CONTAINS_EITHER && matchesEither) {
      matches.add(entry.rowId);
    } else if (condition.operator === Operator.CONTAINS_ALL && matchesAll) {
      matches.add(entry.rowId);
    } else if (condition.operator === Operator.NOT_CONTAINS && !matchesEither) {
      matches.add(entry.rowId);
    }
  }

  if (condition.operator === Operator.NOT_CONTAINS) {
    for (const rowId of universe) {
      const hasRangeEntry = index.rangeEntries.some((entry) => entry.rowId === rowId);
      if (!hasRangeEntry) {
        matches.add(rowId);
      }
    }
  }

  return matches;
}

function evaluateNumericRangeCondition(
  stored: NormalizedFieldValue,
  field: SchemaField<AnyModel, string>,
  condition: Condition<AnyModel, string>,
  data: PreparedStoreData<AnyModel>,
): boolean {
  const ranges = stored.rangeValues;
  if (ranges === undefined || ranges.length === 0) {
    return false;
  }

  const points = (condition.values ?? []).map((value) => parseRangeQueryPoint(field, value, data));
  const matchesEither = points.some((point) =>
    ranges.some((range) => rangeContainsPoint(range, point.prefix, point.point))
  );
  const matchesAll = points.every((point) =>
    ranges.some((range) => rangeContainsPoint(range, point.prefix, point.point))
  );

  if (condition.operator === Operator.CONTAINS_EITHER) {
    return matchesEither;
  }
  if (condition.operator === Operator.CONTAINS_ALL) {
    return matchesAll;
  }
  if (condition.operator === Operator.NOT_CONTAINS) {
    return !matchesEither;
  }
  return false;
}

function evaluateConditionFallback(
  condition: Condition<AnyModel, string>,
  row: NormalizedRow<AnyModel>,
  field: SchemaField<AnyModel, string>,
  data: PreparedStoreData<AnyModel>,
): boolean {
  const storedValue = row.values.get(condition.field as FieldName<AnyModel>);
  if (storedValue === undefined) {
    return false;
  }

  if (
    isRangeSecondaryType(field.secondaryType) &&
    (
      condition.operator === Operator.CONTAINS_EITHER ||
      condition.operator === Operator.CONTAINS_ALL ||
      condition.operator === Operator.NOT_CONTAINS
    )
  ) {
    return evaluateNumericRangeCondition(storedValue, field, condition, data);
  }

  if (condition.operator === Operator.BETWEEN) {
    const lower = normalizeConditionValue(field, condition.lowerValue, data.normalizationProfile);
    const upper = normalizeConditionValue(field, condition.upperValue, data.normalizationProfile);
    if (storedValue.scalar === undefined || lower === null || upper === null) {
      return false;
    }
    if ((typeof storedValue.scalar !== "number" && typeof storedValue.scalar !== "bigint") ||
      (typeof lower !== "number" && typeof lower !== "bigint") ||
      (typeof upper !== "number" && typeof upper !== "bigint")) {
      return false;
    }
    return compareNumeric(storedValue.scalar, lower) >= 0 &&
      compareNumeric(storedValue.scalar, upper) <= 0;
  }

  const normalizedValues = normalizeScalarValues(field, condition, data);
  switch (condition.operator) {
    case Operator.EQUAL:
      return normalizedValues.some((value) => storedValue.scalar === value);
    case Operator.NOT_EQUAL:
      return normalizedValues.every((value) => storedValue.scalar !== value);
    case Operator.LESS_THAN:
    case Operator.LESS_THAN_EQUAL:
    case Operator.GREATER_THAN:
    case Operator.GREATER_THAN_EQUAL: {
      if (storedValue.scalar === undefined || normalizedValues[0] === undefined) {
        return false;
      }
      const right = normalizedValues[0];
      if (
        (typeof storedValue.scalar !== "number" && typeof storedValue.scalar !== "bigint") ||
        (typeof right !== "number" && typeof right !== "bigint")
      ) {
        return false;
      }
      const comparison = compareNumeric(storedValue.scalar, right);
      if (condition.operator === Operator.LESS_THAN) {
        return comparison < 0;
      }
      if (condition.operator === Operator.LESS_THAN_EQUAL) {
        return comparison <= 0;
      }
      if (condition.operator === Operator.GREATER_THAN) {
        return comparison > 0;
      }
      return comparison >= 0;
    }
    case Operator.CONTAINS_EITHER:
      return normalizedValues.some((value) => hasCollectionMatch(storedValue, value));
    case Operator.CONTAINS_ALL:
      return normalizedValues.every((value) => hasCollectionMatch(storedValue, value));
    case Operator.CONTAINS_EITHER_INCLUDING_NULL:
      return storedValue.scalar === null || storedValue.collectionValues === undefined
        ? normalizedValues.some((value) => value === null)
        : normalizedValues.some((value) => hasCollectionMatch(storedValue, value));
    case Operator.NOT_CONTAINS:
      return normalizedValues.every((value) => !hasCollectionMatch(storedValue, value));
    default:
      return false;
  }
}

function resolveConditionCandidates(
  data: PreparedStoreData<AnyModel>,
  condition: Condition<AnyModel, string>,
  universe: Set<number>,
): Set<number> {
  const field = data.schema.fieldMap.get(condition.field as FieldName<AnyModel>) as
    | SchemaField<AnyModel, string>
    | undefined;

  if (field === undefined) {
    throw new QueryValidationError(
      `Unknown field "${condition.field}" in condition.`,
      "QUERY_INVALID_CONDITION",
      { field: condition.field },
    );
  }

  if (field.ignoreIndex === true) {
    throw new QueryValidationError(
      `Field "${condition.field}" is marked ignoreIndex and cannot be used in search conditions.`,
      "QUERY_INVALID_CONDITION",
      { field: condition.field, operator: condition.operator },
    );
  }

  validateOperatorCompatibility(field, condition.operator);

  const index = data.indexes.get(condition.field as FieldName<AnyModel>);
  if (index === undefined) {
    return new Set<number>(universe);
  }

  switch (condition.operator) {
    case Operator.EQUAL: {
      const values = normalizeScalarValues(field, condition, data);
      return resolveEquality(index, values);
    }
    case Operator.NOT_EQUAL: {
      const equalRows = resolveEquality(index, normalizeScalarValues(field, condition, data));
      return subtract(universe, equalRows);
    }
    case Operator.LESS_THAN:
    case Operator.LESS_THAN_EQUAL:
    case Operator.GREATER_THAN:
    case Operator.GREATER_THAN_EQUAL: {
      const [value] = normalizeScalarValues(field, condition, data);
      if (value === undefined || (typeof value !== "number" && typeof value !== "bigint")) {
        throw new QueryValidationError(
          `Operator "${condition.operator}" on field "${condition.field}" requires one numeric value.`,
          "QUERY_INVALID_CONDITION",
        );
      }
      if (condition.operator === Operator.LESS_THAN) {
        return resolveNumericComparison(index, undefined, value, false, false);
      }
      if (condition.operator === Operator.LESS_THAN_EQUAL) {
        return resolveNumericComparison(index, undefined, value, false, true);
      }
      if (condition.operator === Operator.GREATER_THAN) {
        return resolveNumericComparison(index, value, undefined, false, false);
      }
      return resolveNumericComparison(index, value, undefined, true, false);
    }
    case Operator.BETWEEN: {
      const lower = normalizeConditionValue(field, condition.lowerValue, data.normalizationProfile);
      const upper = normalizeConditionValue(field, condition.upperValue, data.normalizationProfile);
      if (
        (typeof lower !== "number" && typeof lower !== "bigint") ||
        (typeof upper !== "number" && typeof upper !== "bigint")
      ) {
        throw new QueryValidationError(
          `BETWEEN on field "${condition.field}" requires numeric bounds.`,
          "QUERY_INVALID_CONDITION",
        );
      }
      return resolveNumericComparison(index, lower, upper, true, true);
    }
    case Operator.CONTAINS_EITHER: {
      if (isRangeSecondaryType(field.secondaryType)) {
        return resolveNumericRangeCandidates(field, condition, index, universe, data);
      }
      if (!isCollectionCondition(field)) {
        throw new QueryValidationError(
          `CONTAINS_EITHER is supported only for collection fields. Field "${condition.field}" is not one.`,
          "QUERY_INVALID_CONDITION",
        );
      }
      return resolveEquality(index, normalizeCollectionConditionValues(field, condition, data));
    }
    case Operator.CONTAINS_ALL: {
      if (isRangeSecondaryType(field.secondaryType)) {
        return resolveNumericRangeCandidates(field, condition, index, universe, data);
      }
      if (!isCollectionCondition(field)) {
        throw new QueryValidationError(
          `CONTAINS_ALL is supported only for collection fields. Field "${condition.field}" is not one.`,
          "QUERY_INVALID_CONDITION",
        );
      }
      const tokenGroups = normalizeCollectionConditionValues(field, condition, data).map((value) =>
        toSet(index.equality.get(encodeNormalizedScalar(value)) ?? [])
      );
      const firstGroup = tokenGroups[0];
      if (firstGroup === undefined) {
        return new Set<number>();
      }
      let result = firstGroup;
      for (let i = 1; i < tokenGroups.length; i += 1) {
        const group = tokenGroups[i];
        if (group !== undefined) {
          result = intersect(result, group);
        }
      }
      return result;
    }
    case Operator.CONTAINS_EITHER_INCLUDING_NULL: {
      if (!isCollectionCondition(field)) {
        throw new QueryValidationError(
          `CONTAINS_EITHER_INCLUDING_NULL is supported only for collection fields. Field "${condition.field}" is not one.`,
          "QUERY_INVALID_CONDITION",
        );
      }
      const tokens = normalizeCollectionConditionValues(field, condition, data);
      const containsNull = tokens.some((token) => token === null);
      const nonNullRows = resolveEquality(index, tokens.filter((token) => token !== null));
      if (!containsNull) {
        return nonNullRows;
      }
      const nullRows = new Set<number>(index.equality.get(encodeNormalizedScalar(null)) ?? []);
      for (const row of data.normalizedRows) {
        const value = row.values.get(condition.field as FieldName<AnyModel>);
        if (value?.collectionValues === undefined) {
          nullRows.add(row.id);
        }
      }
      for (const rowId of nullRows) {
        nonNullRows.add(rowId);
      }
      return nonNullRows;
    }
    case Operator.NOT_CONTAINS: {
      if (isRangeSecondaryType(field.secondaryType)) {
        return resolveNumericRangeCandidates(field, condition, index, universe, data);
      }
      if (!isCollectionCondition(field)) {
        throw new QueryValidationError(
          `NOT_CONTAINS is supported only for collection fields. Field "${condition.field}" is not one.`,
          "QUERY_INVALID_CONDITION",
        );
      }
      return resolveNotContainsCollection(condition, field, index, universe, data);
    }
    default:
      return new Set<number>(universe);
  }
}

export function executeSearch<T extends object>(
  data: PreparedStoreData<T>,
  conditions: readonly Condition<T>[],
  limit?: number,
): readonly T[] {
  validateConditions(conditions);

  const universe = new Set<number>(data.rowIds);
  let candidates = new Set<number>(universe);

  const asObjectData = data as unknown as PreparedStoreData<AnyModel>;
  const asObjectConditions = conditions as unknown as Condition<AnyModel, string>[];

  for (const condition of asObjectConditions) {
    const conditionCandidates = resolveConditionCandidates(asObjectData, condition, universe);
    candidates = intersect(candidates, conditionCandidates);
    if (candidates.size === 0) {
      return [];
    }
  }

  const orderedRows: T[] = [];
  for (const rowId of data.rowIds) {
    if (!candidates.has(rowId)) {
      continue;
    }
    const row = data.rowById.get(rowId);
    if (row === undefined) {
      continue;
    }

    const passesFallback = asObjectConditions.every((condition) => {
      const field = asObjectData.schema.fieldMap.get(condition.field as FieldName<AnyModel>) as
        | SchemaField<AnyModel, string>
        | undefined;
      if (field === undefined) {
        return false;
      }
      return evaluateConditionFallback(
        condition,
        row as unknown as NormalizedRow<AnyModel>,
        field,
        asObjectData,
      );
    });
    if (!passesFallback) {
      continue;
    }

    orderedRows.push(row.source);
    if (limit !== undefined && limit > 0 && orderedRows.length >= limit) {
      break;
    }
  }

  if (limit === undefined || limit > 0) {
    return orderedRows;
  }
  return [];
}

export { buildPreparedStoreData };
