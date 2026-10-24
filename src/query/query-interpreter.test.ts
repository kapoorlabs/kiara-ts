import { describe, expect, it } from "vitest";
import { QueryValidationError } from "../errors.js";
import { defineSchema } from "../schema/define-schema.js";
import { booleanField, enumField, longField, numberField, textField } from "../schema/field-factories.js";
import type { InterpretationFieldOptions, QueryInterpreterOptions } from "./query-interpreter.js";
import { QueryInterpreter, editQueryFragment } from "./query-interpreter.js";
import { Operator } from "./operator.js";
import { Store } from "../store/store.js";
import { NormalizationProfile } from "../store/types.js";

interface Part {
  type: string;
  package: string;
  manufacturer: string;
  capacitance: number | null;
  voltage: number;
  testVoltage: number;
  stock: number;
  available: boolean;
  tags: string;
  ignored: string;
  serial: number;
  date: string;
}

const schema = defineSchema<Part>([
  enumField("type", ["Ceramic", "Film"], { caseInsensitive: true }),
  textField("package"),
  textField("manufacturer", { caseInsensitive: true }),
  numberField("capacitance", { nullable: true }),
  numberField("voltage"),
  numberField("testVoltage"),
  numberField("stock"),
  booleanField("available"),
  textField("tags", { secondaryType: "commaSeparatedStrings", caseInsensitive: true }),
  textField("ignored", { ignoreIndex: true }),
  longField("serial"),
  textField("date", { secondaryType: "dateFormat", format: "yyyy-MM-dd" }),
]);
const rows: Part[] = [
  { type: "Ceramic", package: "0603", manufacturer: "Texas Instruments", capacitance: 0.00001, voltage: 25, testVoltage: 50, stock: 2000, available: true, tags: "RoHS, Automotive", ignored: "secret", serial: 1, date: "2026-01-01" },
  { type: "Film", package: "0805", manufacturer: "Other", capacitance: 0.00002, voltage: 50, testVoltage: 100, stock: 500, available: false, tags: "RoHS", ignored: "secret", serial: 2, date: "2026-02-01" },
  { type: "Ceramic", package: "CaseSensitive", manufacturer: 'A "quoted" maker', capacitance: null, voltage: 10, testVoltage: 25, stock: 0, available: true, tags: "General", ignored: "secret", serial: 3, date: "2026-03-01" },
];
const options: QueryInterpreterOptions<Part> = {
  fields: {
    capacitance: { aliases: ["cap"], canonicalUnit: "F", units: { F: 1, uF: 1e-6, nF: 1e-9 } },
    voltage: { aliases: ["rated voltage"], canonicalUnit: "V", units: { V: 1, mV: 1e-3 } },
    testVoltage: { canonicalUnit: "V", units: { V: 1 } },
    type: { valueAliases: { mlcc: "Ceramic" } },
  },
};

function prepared(
  profile: typeof NormalizationProfile[keyof typeof NormalizationProfile] = NormalizationProfile.NATIVE,
): Store<Part> {
  const store = new Store(schema, { normalizationProfile: profile });
  store.loadRows(rows);
  store.prepare();
  return store;
}

const store = prepared();
const interpreter = new QueryInterpreter(store, options);

describe("schema-aware query interpretation", () => {
  it("combines recognized values, aliases, units and comparisons into strict AND filters", () => {
    const input = "ceramic cap:10uF voltage>=25V 0603 stock>1000";
    const result = interpreter.interpret(input);
    expect(result.issues).toEqual([]);
    expect(result.filters.map((filter) => filter.condition.field)).toEqual([
      "type", "capacitance", "voltage", "package", "stock",
    ]);
    expect(interpreter.search(input)).toEqual([rows[0]]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("normalizes equivalent units exactly, including micro variants and scientific notation", () => {
    for (const value of ["10uF", "10000nF", "10µF", "10μF", "1e-5F", "0.00001", ".00001F", "+.00001F"]) {
      expect(interpreter.search(`cap:${value}`)).toEqual([rows[0]]);
    }
    expect(interpreter.interpret("cap:0F").filters[0]?.condition.values).toEqual([0]);
    expect(interpreter.interpret("cap:-1e-5F").filters[0]?.condition.values).toEqual([-0.00001]);
    expect(interpreter.interpret("stock:1234567890123456").filters[0]?.condition.values).toEqual([1234567890123456]);
  });

  it("returns field ambiguities and accepts explicit confirmations by source ID", () => {
    const result = interpreter.interpret("25V");
    expect(result.issues[0]?.kind).toBe("ambiguous");
    expect(result.issues[0]?.candidates.map((item) => item.field)).toEqual(["voltage", "testVoltage"]);
    expect(() => interpreter.search("25V")).toThrowError(QueryValidationError);
    expect(interpreter.search("25V", { "0:3": "voltage" })).toEqual([rows[0]]);
    expect(interpreter.interpret("25V", { "0:3": "stock" }).issues[0]?.kind).toBe("invalid");
    expect(interpreter.interpret("25V", { "0:3": "testVoltage" }).filters[0]?.condition.field).toBe("testVoltage");
  });

  it("does not confuse whole values with word matches and preserves case-sensitive fields", () => {
    expect(interpreter.interpret("Texas").issues[0]?.kind).toBe("unrecognized");
    expect(interpreter.search('"texas instruments"')).toEqual([rows[0]]);
    expect(interpreter.interpret("casesensitive").issues[0]?.kind).toBe("unrecognized");
    expect(interpreter.search("CaseSensitive")).toEqual([rows[2]]);
    expect(interpreter.search("MLCC")).toEqual([rows[0], rows[2]]);
    expect(interpreter.search("type:MLCC")).toEqual([rows[0], rows[2]]);
  });

  it("handles quoted field aliases, escaped quotes, and spaces with exact source spans", () => {
    expect(interpreter.search('"rated voltage">=25V')).toEqual([rows[0], rows[1]]);
    expect(interpreter.search('manufacturer:"A \\"quoted\\" maker"')).toEqual([rows[2]]);
    expect(interpreter.search('manufacturer:"Texas\\u0020Instruments"')).toEqual([rows[0]]);
    expect(interpreter.interpret('manufacturer:"literal\\\\q"').issues).toEqual([]);
    const input = '  ceramic\tmanufacturer:"Texas Instruments"\n';
    const result = interpreter.interpret(input);
    for (const fragment of result.filters) {
      expect(input.slice(fragment.start, fragment.end)).toBe(fragment.text);
      expect(fragment.id).toBe(`${fragment.start}:${fragment.end}`);
    }
    expect(interpreter.search(input)).toEqual([rows[0]]);
  });

  it("maps equality, inequality and numeric comparisons to existing operators", () => {
    const cases = [
      ["stock=500", Operator.EQUAL, 1],
      ["stock!=500", Operator.NOT_EQUAL, 2],
      ["stock<500", Operator.LESS_THAN, 1],
      ["stock<=500", Operator.LESS_THAN_EQUAL, 2],
      ["stock>500", Operator.GREATER_THAN, 1],
      ["stock>=500", Operator.GREATER_THAN_EQUAL, 2],
    ] as const;
    for (const [input, operator, count] of cases) {
      expect(interpreter.interpret(input).filters[0]?.condition.operator).toBe(operator);
      expect(interpreter.search(input)).toHaveLength(count);
    }
    expect(interpreter.search("package!=0603")).toEqual([rows[1], rows[2]]);
    expect(interpreter.interpret("package>0603").issues[0]?.message).toContain("equality");
  });

  it("supports inclusive ranges with explicit units on each bound", () => {
    const result = interpreter.interpret("cap:10uF..20uF");
    expect(result.filters[0]?.condition).toEqual({
      field: "capacitance", operator: Operator.BETWEEN, lowerValue: 0.00001, upperValue: 0.00002,
    });
    expect(interpreter.search("cap:10uF..20uF")).toEqual([rows[0], rows[1]]);
    expect(interpreter.search("10uF..20uF")).toEqual([rows[0], rows[1]]);
    expect(interpreter.interpret(">=25V").issues[0]?.kind).toBe("ambiguous");
    for (const input of ["stock>1..2", "stock:1..2..3", "stock:2..1", "stock:x..2", "stock:1..x"]) {
      expect(interpreter.interpret(input).issues[0]?.kind).toBe("invalid");
    }
  });

  it("matches individual collection members and uses exact boolean literals", () => {
    expect(interpreter.search("automotive")).toEqual([rows[0]]);
    expect(interpreter.search("tags:rohs")).toEqual([rows[0], rows[1]]);
    expect(interpreter.search("tags!=rohs")).toEqual([rows[2]]);
    expect(interpreter.search("available:true")).toEqual([rows[0], rows[2]]);
    expect(interpreter.search("available:false")).toEqual([rows[1]]);
    expect(interpreter.search("true")).toEqual([rows[0], rows[2]]);
    expect(interpreter.interpret("available:yes").issues[0]?.message).toContain("true or false");
  });

  it("never executes partial interpretations and reports unknown, invalid and unsupported input", () => {
    for (const input of ["ceramic unknown", "missing:abc", "ignored:secret", "serial:1", "date:2026", "cap:10V", "stock:", 'manufacturer:"unterminated', 'manufacturer:"bad\\q"', 'manufacturer:"bad\ttext"']) {
      const result = interpreter.interpret(input);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(() => interpreter.search(input)).toThrowError("unresolved");
    }
    expect(interpreter.interpret("missing:abc").issues[0]?.message).toContain("Unknown field");
    expect(interpreter.interpret("cap:10V").issues[0]?.message).toContain("incompatible unit");
    expect(interpreter.interpret(">garbage").issues[0]?.kind).toBe("invalid");
    expect(interpreter.interpret('manufacturer:"bad\\q"').issues[0]?.message).toContain("escape");
  });

  it("rejects overflow, underflow and unsafe quantities without silently rounding literals", () => {
    for (const value of ["1e999", "1e-999", "9007199254740993", "NaN", "Infinity"]) {
      expect(interpreter.interpret(`stock:${value}`).issues[0]?.kind).toBe("invalid");
    }
  });

  it("supports empty queries, empty stores, limits and explicit valid no-match conditions", () => {
    expect(interpreter.search("")).toEqual(rows);
    expect(interpreter.search(" \t\n", {}, 1)).toEqual([rows[0]]);
    expect(interpreter.search("ceramic", {}, 1)).toEqual([rows[0]]);
    expect(interpreter.search("stock>100000")).toEqual([]);
    const empty = new Store(schema);
    empty.prepare();
    expect(new QueryInterpreter(empty).search("")).toEqual([]);
    expect(new QueryInterpreter(empty).interpret("ceramic").issues[0]?.kind).toBe("unrecognized");
    expect(interpreter.interpret('"123"').issues[0]?.kind).toBe("unrecognized");
    expect(() => new QueryInterpreter(new Store(schema))).toThrowError("preparation");
    expect(() => interpreter.interpret("a".repeat(4097))).toThrowError("4096");
    expect(() => interpreter.interpret("a".repeat(4096))).not.toThrow();
  });

  it("rejects stale value discovery after reloading and handles schemas with no searchable fields", () => {
    const data = prepared();
    const query = new QueryInterpreter(data);
    data.beginLoading();
    expect(() => query.interpret("ceramic")).toThrowError("preparation");
    data.loadRows(rows);
    data.prepare();
    expect(() => query.search("ceramic")).toThrowError("snapshot changed");
    const ignored = new Store(defineSchema<{ name: string }>([textField("name", { ignoreIndex: true })]));
    ignored.prepare();
    const hidden = new QueryInterpreter(ignored);
    expect(hidden.interpret("anything").issues[0]?.message).toContain("No unique");
    expect(hidden.interpret("name:anything").issues[0]?.message).toContain("Unknown field");
  });
  it("replaces and removes resolved or unresolved chips by their source spans", () => {
    const result = interpreter.interpret("ceramic 25V");
    expect(editQueryFragment(result, "0:7", "film")).toBe("film 25V");
    expect(editQueryFragment(result, "8:11", "")).toBe("ceramic ");
    expect(() => editQueryFragment(result, "missing", "")).toThrowError(QueryValidationError);
  });

  it("preserves ambiguity when aliases collide with names or other aliases", () => {
    const aliased = new QueryInterpreter(store, {
      fields: { manufacturer: { aliases: ["type"] }, package: { aliases: ["TYPE"] } },
    });
    expect(aliased.interpret("type:Ceramic").issues[0]?.candidates).toHaveLength(3);
  });

  it("supports native custom accessors, null accessor values, and nullish fields", () => {
    interface Model { name?: string | null }
    const custom = defineSchema<Model>([textField("name", { nullable: true })], {
      valueAccessor: (row, field) => row[field] === "hidden" ? null : row[field],
    });
    const data = new Store(custom);
    data.loadRows([{ name: "hidden" }, { name: "visible" }, { name: null }, {}]);
    data.prepare();
    const query = new QueryInterpreter(data);
    expect(query.search("visible")).toEqual([{ name: "visible" }]);
    expect(query.interpret("hidden").issues).toHaveLength(1);
  });

  it("does not silently apply JAVA truncation to fractional numeric input", () => {
    const java = new QueryInterpreter(prepared(NormalizationProfile.JAVA));
    expect(java.interpret("stock:1.5").issues[0]?.message).toContain("NATIVE");
    expect(java.search("stock:500")).toEqual([rows[1]]);
    expect(() => new QueryInterpreter(prepared(NormalizationProfile.JAVA), options)).toThrowError("NATIVE");
  });

  it("discovers normalized numeric/boolean source strings and skips incompatible collection kinds", () => {
    interface Encoded { quantity: string; enabled: string; collection: string; flags: string }
    const encoded = defineSchema<Encoded>([
      numberField("quantity"), booleanField("enabled"),
      numberField("collection", { secondaryType: "commaSeparatedStrings" }),
      enumField("flags", ["A", "B"], { secondaryType: "commaSeparatedStrings" }),
    ]);
    for (const profile of [NormalizationProfile.NATIVE, NormalizationProfile.JAVA]) {
      const data = new Store(encoded, { normalizationProfile: profile });
      data.loadRows([{ quantity: "25.0", enabled: " TRUE ", collection: "1,2", flags: "A,B" }]);
      data.prepare();
      const query = new QueryInterpreter(data);
      expect(query.search("25 true")).toHaveLength(1);
      expect(query.search("A")).toHaveLength(1);
      expect(query.interpret("collection:1").issues[0]?.kind).toBe("invalid");
    }
    expect(() => Reflect.apply(interpreter.interpret, interpreter, [null])).toThrowError(QueryValidationError);
  });

  it("requires valid, non-conflicting metadata and compatible canonical units", () => {
    const invalidFields: Record<string, InterpretationFieldOptions>[] = [
      { missing: {} }, { ignored: {} }, { serial: {} }, { date: {} },
      { type: { aliases: [" "] } },
      { type: { valueAliases: { "": "Ceramic" } } },
      { type: { valueAliases: { x: "" } } },
      { stock: { valueAliases: { many: "1000" } } },
      { type: { valueAliases: { a: "Ceramic", A: "Film" } } },
      { type: { canonicalUnit: "V", units: { V: 1 } } },
      { stock: { units: { V: 1 } } },
      { stock: { canonicalUnit: "V" } },
      { stock: { canonicalUnit: "V", units: { V: 2 } } },
      { stock: { canonicalUnit: "V", units: { V: 1, "": 2 } } },
      { stock: { canonicalUnit: "V", units: { V: 1, "a b": 2 } } },
      { stock: { canonicalUnit: "V", units: { V: 1, bad: 0 } } },
      { stock: { canonicalUnit: "V", units: { V: 1, bad: -1 } } },
      { stock: { canonicalUnit: "V", units: { V: 1, bad: Infinity } } },
      { stock: { canonicalUnit: "V", units: { V: 1, uF: 1e-6, "µF": 1e-6 } } },
    ];
    for (const fields of invalidFields) {
      expect(() => new QueryInterpreter(store, { fields })).toThrowError(QueryValidationError);
    }
  });

  it("discovers values across 100 real schema fields without arbitrarily choosing a field", () => {
    type Wide = Record<string, string>;
    const names = Array.from({ length: 100 }, (_, index) => `field${index}`);
    const data = new Store(defineSchema<Wide>(names.map((name) => textField<Wide, string>(name))));
    data.loadRow(Object.fromEntries(names.map((name) => [name, "shared"])));
    data.prepare();
    const query = new QueryInterpreter(data);
    const result = query.interpret("shared");
    expect(result.issues[0]?.candidates).toHaveLength(100);
    expect(query.search("shared", { "0:6": "field99" })).toHaveLength(1);
  });
});
