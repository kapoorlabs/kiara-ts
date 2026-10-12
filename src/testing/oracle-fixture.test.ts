import { describe, expect, it } from "vitest";
import { createCondition } from "../query/condition.js";
import { Operator } from "../query/operator.js";
import { defineSchema } from "../schema/define-schema.js";
import { numberField, textField } from "../schema/field-factories.js";
import { NormalizationProfile } from "../store/types.js";
import { runOracleFixture } from "./oracle-fixture.js";

interface FlightRule {
  country: string;
  surcharge: number;
  carriers: string;
}

const schema = defineSchema<FlightRule>([
  textField("country", { caseInsensitive: true }),
  numberField("surcharge"),
  textField("carriers", { secondaryType: "commaSeparatedStrings", caseInsensitive: true }),
]);

describe("oracle fixture scaffolding", () => {
  it("runs fixture scenarios and reports pass/fail data", () => {
    const rows: FlightRule[] = [
      { country: "usa", surcharge: 2.5, carriers: "dl,aa" },
      { country: "usa", surcharge: 4.5, carriers: "aa" },
      { country: "in", surcharge: 1.5, carriers: "ai" },
    ];

    const fixtureResult = runOracleFixture({
      id: "country-carrier-filter",
      normalizationProfile: NormalizationProfile.JAVA,
      schema,
      rows,
      conditions: [
        createCondition<FlightRule, "country">({ field: "country", values: ["USA"] }),
        createCondition<FlightRule, "carriers">({
          field: "carriers",
          operator: Operator.CONTAINS_EITHER,
          values: ["aa"],
        }),
      ],
      expectedRowIndexes: [0, 1],
    });

    expect(fixtureResult.passed).toBe(true);
    expect(fixtureResult.actualRowIndexes).toEqual([0, 1]);
  });
});
