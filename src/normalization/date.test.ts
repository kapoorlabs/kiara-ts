import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { normalizeDateTimeToEpochSecond, normalizeDateToEpochDay } from "./date.js";

describe("date normalization", () => {
  it("normalizes yyyy-MM-dd values to epoch day", () => {
    const epochDay = normalizeDateToEpochDay("1970-01-03");
    expect(epochDay).toBe(2);
  });

  it("normalizes yyyy-MM-dd HH:mm:ss values to epoch second", () => {
    const epochSecond = normalizeDateTimeToEpochSecond("1970-01-01 00:00:02");
    expect(epochSecond).toBe(2);
  });

  it("rejects unsupported explicit formats", () => {
    expect(() => normalizeDateToEpochDay("2020-01-01", "MM/dd/yyyy")).toThrowError(
      QueryValidationError,
    );
  });
});
