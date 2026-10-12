import { NormalizationError } from "../errors.js";

const JAVA_LONG_MAX = 9223372036854775807n;
const JAVA_LONG_MIN = -9223372036854775808n;

const JAVA_LONG_MAX_AS_NUMBER = Number(JAVA_LONG_MAX);
const JAVA_LONG_MIN_AS_NUMBER = Number(JAVA_LONG_MIN);

function coerceNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new NormalizationError(
        "Cannot normalize an empty numeric string.",
        "NORMALIZATION_INVALID_NUMBER",
        { value },
      );
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new NormalizationError(
    "Value cannot be normalized as a number.",
    "NORMALIZATION_INVALID_NUMBER",
    { valueType: typeof value, value },
  );
}

export function normalizeNativeNumber(value: unknown): number {
  const coerced = coerceNumber(value);
  if (!Number.isFinite(coerced)) {
    throw new NormalizationError(
      "Native numeric mode rejects non-finite numbers.",
      "NORMALIZATION_INVALID_NUMBER",
      { value: coerced },
    );
  }
  return coerced;
}

export function normalizeJavaLongKey(value: unknown): bigint {
  const coerced = coerceNumber(value);
  if (Number.isNaN(coerced)) {
    return 0n;
  }
  if (coerced >= JAVA_LONG_MAX_AS_NUMBER) {
    return JAVA_LONG_MAX;
  }
  if (coerced <= JAVA_LONG_MIN_AS_NUMBER) {
    return JAVA_LONG_MIN;
  }
  return BigInt(Math.trunc(coerced));
}

export function normalizeText(value: unknown, caseInsensitive: boolean): string {
  if (typeof value !== "string") {
    throw new NormalizationError(
      "Value cannot be normalized as text.",
      "NORMALIZATION_INVALID_TEXT",
      { valueType: typeof value, value },
    );
  }
  return caseInsensitive ? value.toLocaleLowerCase("en-US") : value;
}

export const javaLongRange = Object.freeze({
  min: JAVA_LONG_MIN,
  max: JAVA_LONG_MAX,
});
