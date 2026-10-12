import { QueryValidationError } from "../errors.js";

const DEFAULT_DATE_FORMAT = "yyyy-MM-dd";
const DEFAULT_DATE_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss";
const SUPPORTED_DATE_FORMATS = new Set([DEFAULT_DATE_FORMAT]);
const SUPPORTED_DATE_TIME_FORMATS = new Set([
  DEFAULT_DATE_TIME_FORMAT,
  "yyyy-MM-dd'T'HH:mm:ss",
]);

function ensureSupportedFormat(
  format: string | undefined,
  supported: Set<string>,
  kind: "date" | "dateTime",
): void {
  if (format === undefined) {
    return;
  }
  if (!supported.has(format)) {
    throw new QueryValidationError(
      `Unsupported ${kind} format "${format}".`,
      "QUERY_INVALID_CONDITION",
      { format, kind },
    );
  }
}

function toEpochDay(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

function parseStrictDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return undefined;
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return utc;
}

function parseStrictDateTime(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return undefined;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }

  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day ||
    utc.getUTCHours() !== hour ||
    utc.getUTCMinutes() !== minute ||
    utc.getUTCSeconds() !== second
  ) {
    return undefined;
  }
  return utc;
}

function parseLooseDate(value: string): Date | undefined {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export function normalizeDateToEpochDay(value: unknown, format?: string): number {
  if (typeof value !== "string") {
    throw new QueryValidationError(
      "Date value must be a string.",
      "QUERY_INVALID_CONDITION",
      { valueType: typeof value, value },
    );
  }

  ensureSupportedFormat(format, SUPPORTED_DATE_FORMATS, "date");
  const strict = parseStrictDate(value);
  if (strict !== undefined) {
    return toEpochDay(strict);
  }

  const loose = parseLooseDate(value);
  if (loose !== undefined) {
    return toEpochDay(loose);
  }

  throw new QueryValidationError(
    `Invalid date value "${value}".`,
    "QUERY_INVALID_CONDITION",
    { value, format: format ?? DEFAULT_DATE_FORMAT },
  );
}

export function normalizeDateTimeToEpochSecond(value: unknown, format?: string): number {
  if (typeof value !== "string") {
    throw new QueryValidationError(
      "Date-time value must be a string.",
      "QUERY_INVALID_CONDITION",
      { valueType: typeof value, value },
    );
  }

  ensureSupportedFormat(format, SUPPORTED_DATE_TIME_FORMATS, "dateTime");
  const strict = parseStrictDateTime(value);
  if (strict !== undefined) {
    return Math.floor(strict.getTime() / 1000);
  }

  const loose = parseLooseDate(value);
  if (loose !== undefined) {
    return Math.floor(loose.getTime() / 1000);
  }

  throw new QueryValidationError(
    `Invalid date-time value "${value}".`,
    "QUERY_INVALID_CONDITION",
    { value, format: format ?? DEFAULT_DATE_TIME_FORMAT },
  );
}
