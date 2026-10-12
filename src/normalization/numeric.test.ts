import { describe, expect, it } from "vitest";
import { NormalizationError } from "../errors.js";
import {
  javaLongRange,
  normalizeJavaLongKey,
  normalizeNativeNumber,
  normalizeText,
} from "./numeric.js";

describe("numeric normalization", () => {
  it("truncates Java long keys toward zero", () => {
    expect(normalizeJavaLongKey(19.8)).toBe(19n);
    expect(normalizeJavaLongKey(-19.8)).toBe(-19n);
  });

  it("saturates Java long keys at long bounds", () => {
    expect(normalizeJavaLongKey("9999999999999999999999")).toBe(javaLongRange.max);
    expect(normalizeJavaLongKey("-9999999999999999999999")).toBe(javaLongRange.min);
  });

  it("maps NaN to zero in Java long mode", () => {
    expect(normalizeJavaLongKey(Number.NaN)).toBe(0n);
  });

  it("rejects non-finite values in native numeric mode", () => {
    expect(() => normalizeNativeNumber(Number.POSITIVE_INFINITY)).toThrowError(
      NormalizationError,
    );
  });

  it("applies case-insensitive text normalization using en-US locale", () => {
    expect(normalizeText("HELLO", true)).toBe("hello");
    expect(normalizeText("HELLO", false)).toBe("HELLO");
  });
});
