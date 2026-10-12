import { QueryValidationError } from "../errors.js";
import {
  normalizeDateTimeToEpochSecond,
  normalizeDateToEpochDay,
} from "./date.js";
import { normalizeJavaLongKey, normalizeNativeNumber } from "./numeric.js";
import { NormalizationProfile } from "../store/types.js";

export interface NumericRangeValue {
  readonly prefix: string;
  readonly lower: number | bigint;
  readonly upper: number | bigint;
}

export interface DateRangeValue {
  readonly lower: number;
  readonly upper: number;
}

function splitBounds(
  value: string,
  errorContext: string,
): { readonly lower: string; readonly upper: string } {
  const [rawLower, rawUpper] = value.split("->").map((part) => part.trim());
  if (rawLower === undefined || rawUpper === undefined || rawLower === "" || rawUpper === "") {
    throw new QueryValidationError(
      `Invalid ${errorContext} "${value}". Expected "lower->upper".`,
      "QUERY_INVALID_CONDITION",
      { value },
    );
  }
  return { lower: rawLower, upper: rawUpper };
}

export function parseNumericRangeValue(
  value: string,
  profile: (typeof NormalizationProfile)[keyof typeof NormalizationProfile],
  numericStartPos = 0,
): NumericRangeValue {
  const trimmed = value.trim();
  const startPos = Math.max(0, numericStartPos);
  if (startPos >= trimmed.length) {
    throw new QueryValidationError(
      `Invalid range "${value}" for numericStartPos=${numericStartPos}.`,
      "QUERY_INVALID_CONDITION",
      { value, numericStartPos },
    );
  }

  const prefix = trimmed.slice(0, startPos);
  const expression = trimmed.slice(startPos);
  const bounds = splitBounds(expression, "numeric range");

  if (profile === NormalizationProfile.JAVA) {
    const lower = normalizeJavaLongKey(bounds.lower);
    const upper = normalizeJavaLongKey(bounds.upper);
    if (lower > upper) {
      throw new QueryValidationError(
        `Range "${value}" has lower bound greater than upper bound.`,
        "QUERY_INVALID_CONDITION",
        { value },
      );
    }
    return { prefix, lower, upper };
  }

  const lower = normalizeNativeNumber(bounds.lower);
  const upper = normalizeNativeNumber(bounds.upper);
  if (lower > upper) {
    throw new QueryValidationError(
      `Range "${value}" has lower bound greater than upper bound.`,
      "QUERY_INVALID_CONDITION",
      { value },
    );
  }
  return { prefix, lower, upper };
}

export function parseDateRangeValue(value: string, format?: string): DateRangeValue {
  const bounds = splitBounds(value, "date range");
  const lower = normalizeDateToEpochDay(bounds.lower, format);
  const upper = normalizeDateToEpochDay(bounds.upper, format);
  if (lower > upper) {
    throw new QueryValidationError(
      `Date range "${value}" has lower bound greater than upper bound.`,
      "QUERY_INVALID_CONDITION",
      { value, format },
    );
  }
  return { lower, upper };
}

export function parseDateTimeRangeValue(value: string, format?: string): DateRangeValue {
  const bounds = splitBounds(value, "date-time range");
  const lower = normalizeDateTimeToEpochSecond(bounds.lower, format);
  const upper = normalizeDateTimeToEpochSecond(bounds.upper, format);
  if (lower > upper) {
    throw new QueryValidationError(
      `Date-time range "${value}" has lower bound greater than upper bound.`,
      "QUERY_INVALID_CONDITION",
      { value, format },
    );
  }
  return { lower, upper };
}
