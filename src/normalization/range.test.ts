import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { NormalizationProfile } from "../store/types.js";
import {
  parseDateRangeValue,
  parseDateTimeRangeValue,
  parseNumericRangeValue,
} from "./range.js";

describe("parseNumericRangeValue", () => {
  it("parses Java-profile ranges with truncation", () => {
    const parsed = parseNumericRangeValue("code10.9->20.4", NormalizationProfile.JAVA, 4);
    expect(parsed).toEqual({
      prefix: "code",
      lower: 10n,
      upper: 20n,
    });
  });

  it("parses native ranges as numbers", () => {
    const parsed = parseNumericRangeValue("1.25->3.75", NormalizationProfile.NATIVE);
    expect(parsed).toEqual({
      prefix: "",
      lower: 1.25,
      upper: 3.75,
    });
  });

  it("rejects out-of-order ranges", () => {
    expect(() =>
      parseNumericRangeValue("10->1", NormalizationProfile.JAVA),
    ).toThrowError(QueryValidationError);
  });

  it("parses date ranges", () => {
    const parsed = parseDateRangeValue("1970-01-02->1970-01-03");
    expect(parsed).toEqual({ lower: 1, upper: 2 });
  });

  it("parses date-time ranges", () => {
    const parsed = parseDateTimeRangeValue("1970-01-01 00:00:01->1970-01-01 00:00:03");
    expect(parsed).toEqual({ lower: 1, upper: 3 });
  });
});
