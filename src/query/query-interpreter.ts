import { QueryValidationError } from "../errors.js";
import { normalizeJavaLongKey, normalizeNativeNumber, normalizeText } from "../normalization/numeric.js";
import type { FieldName, SchemaField } from "../schema/types.js";
import { Store } from "../store/store.js";
import { NormalizationProfile } from "../store/types.js";
import { createCondition, type Condition } from "./condition.js";
import { Operator, type Operator as OperatorType } from "./operator.js";

export interface InterpretationFieldOptions {
  readonly aliases?: readonly string[];
  readonly valueAliases?: Readonly<Record<string, string>>;
  /** Numeric records must already use this unit; factors convert input to it. */
  readonly canonicalUnit?: string;
  readonly units?: Readonly<Record<string, number>>;
}

export interface QueryInterpreterOptions<T extends object> {
  readonly fields?: Partial<Readonly<Record<FieldName<T>, InterpretationFieldOptions>>>;
}

export interface QueryFragment {
  readonly id: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export interface InterpretedFilter<T extends object> extends QueryFragment {
  readonly condition: Condition<T>;
}

export interface InterpretationIssue<T extends object> extends QueryFragment {
  readonly kind: "ambiguous" | "unrecognized" | "invalid";
  readonly message: string;
  readonly candidates: readonly Condition<T>[];
}

export interface QueryInterpretation<T extends object> {
  readonly input: string;
  readonly filters: readonly InterpretedFilter<T>[];
  readonly issues: readonly InterpretationIssue<T>[];
}

type Selections<T extends object> = Readonly<Record<string, FieldName<T>>>;
interface SearchField<T extends object> {
  readonly schema: SchemaField<T>;
  readonly names: ReadonlySet<string>;
  readonly aliases: ReadonlyMap<string, string>;
  readonly units: ReadonlyMap<string, number>;
  readonly values: ReadonlySet<string>;
}

const operators: Readonly<Record<string, Exclude<OperatorType, typeof Operator.BETWEEN>>> = {
  ":": Operator.EQUAL, "=": Operator.EQUAL, "!=": Operator.NOT_EQUAL,
  ">": Operator.GREATER_THAN, ">=": Operator.GREATER_THAN_EQUAL,
  "<": Operator.LESS_THAN, "<=": Operator.LESS_THAN_EQUAL,
};
const numericLiteral = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([^\d\s.]*)$/i;
const quotedLiteral = /^"(?:[^"\\]|\\.)*"$/;

function invalid(message: string): never {
  throw new QueryValidationError(message, "QUERY_INVALID_CONDITION");
}

function unitName(value: string): string {
  return value.replace(/[µμ]/g, "u");
}

function valueKey<T extends object>(field: SchemaField<T>, value: string): string {
  return normalizeText(value, field.caseInsensitive === true);
}

function decimalParts(value: string): readonly [bigint, number] {
  const [mantissa, exponent = "0"] = value.toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa!.split(".");
  return [BigInt(whole! + fraction), Number(exponent) - fraction.length];
}

function supported<T extends object>(field: SchemaField<T>): boolean {
  return field.ignoreIndex !== true && field.kind !== "long" &&
    (field.secondaryType === undefined || (field.secondaryType === "commaSeparatedStrings" &&
      (field.kind === "text" || field.kind === "enum")));
}

function fragments(input: string): QueryFragment[] {
  const result: QueryFragment[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index <= input.length; index += 1) {
    const char = input.charAt(index);
    if (index === input.length || (!quoted && /\s/.test(char))) {
      if (index > start) {
        const text = input.slice(start, index);
        result.push({ id: `${start}:${index}`, text, start, end: index });
      }
      start = index + 1;
    } else if (escaped) {
      escaped = false;
    } else if (char === "\\" && quoted) {
      escaped = true;
    } else if (char === '"') {
      quoted = !quoted;
    }
  }
  return result;
}

/** Binds value discovery to one prepared store snapshot; rebuild after reloading it. */
export class QueryInterpreter<T extends object> {
  private readonly fields: readonly SearchField<T>[];
  private readonly snapshot: readonly T[];

  public constructor(
    private readonly store: Store<T>,
    options: QueryInterpreterOptions<T> = {},
  ) {
    const rows = store.queryAll();
    this.snapshot = rows;
    const metadata: NonNullable<QueryInterpreterOptions<T>["fields"]> = options.fields ?? {};
    for (const name of Object.keys(metadata)) {
      const schema = store.schema.fields.find((field) => field.name === name);
      if (schema === undefined || !supported(schema)) {
        invalid(`Unknown or unsupported interpreter field "${name}".`);
      }
    }
    this.fields = store.schema.fields.filter(supported).map((schema) => {
      const config: InterpretationFieldOptions = metadata[schema.name] ?? {};
      const names = new Set([schema.name.toLowerCase()]);
      for (const alias of config.aliases ?? []) {
        if (!alias.trim()) invalid("Field aliases must be non-empty.");
        names.add(alias.trim().toLowerCase());
      }
      const aliases = new Map<string, string>();
      for (const [alias, value] of Object.entries(config.valueAliases ?? {})) {
        if (!alias.trim() || !value.trim() || (schema.kind !== "text" && schema.kind !== "enum")) {
          invalid("Value aliases require non-empty text values on text or enum fields.");
        }
        const key = valueKey(schema, alias.trim());
        if (aliases.has(key)) invalid(`Duplicate normalized value alias "${alias}".`);
        aliases.set(key, value);
      }
      const units = new Map<string, number>();
      if (config.units !== undefined || config.canonicalUnit !== undefined) {
        if (schema.kind !== "number" || schema.secondaryType !== undefined ||
          config.units === undefined || config.canonicalUnit === undefined ||
          config.units[config.canonicalUnit] !== 1) {
          invalid("Units require a scalar number field and a canonical unit with factor 1.");
        }
        if (store.normalizationProfile !== NormalizationProfile.NATIVE) {
          invalid("Unit-aware fields require NATIVE normalization.");
        }
        for (const [name, factor] of Object.entries(config.units)) {
          const key = unitName(name);
          if (!key || /\s|\d|\./.test(key) || !Number.isFinite(factor) || factor <= 0 || units.has(key)) {
            invalid(`Invalid or duplicate unit "${name}".`);
          }
          units.set(key, factor);
        }
      }
      const values = new Set<string>();
      for (const row of rows) {
        const value = store.schema.valueAccessor === undefined
          ? row[schema.name] : store.schema.valueAccessor(row, schema.name);
        if (value === null || value === undefined) continue;
        const normalized = schema.kind === "number"
          ? store.normalizationProfile === NormalizationProfile.JAVA
            ? normalizeJavaLongKey(value) : normalizeNativeNumber(value)
          : schema.kind === "boolean" ? String(value).trim().toLowerCase() : value;
        const parts = schema.secondaryType === "commaSeparatedStrings"
          ? String(normalized).split(",").map((part) => part.trim()) : [String(normalized)];
        for (const part of parts) values.add(valueKey(schema, part));
      }
      return { schema, names, aliases, units, values };
    });
  }

  public interpret(input: string, selections: Selections<T> = {}): QueryInterpretation<T> {
    if (typeof input !== "string" || input.length > 4096) invalid("Query input must be a string of at most 4096 characters.");
    if (this.store.queryAll() !== this.snapshot) invalid("Store snapshot changed; rebuild the query interpreter.");
    const filters: InterpretedFilter<T>[] = [];
    const issues: InterpretationIssue<T>[] = [];
    for (const fragment of fragments(input)) {
      const raw = fragment.text;
      const explicit = quotedLiteral.test(raw) ? null
        : /^(?:"((?:[^"\\]|\\.)*)"|([^:<>!=]+))?(:|>=|<=|!=|=|>|<)(.*)$/.exec(raw);
      const fieldName = explicit?.[1] ?? explicit?.[2];
      const name = fieldName?.toLowerCase();
      const symbol = explicit === null ? "=" : explicit[3]!;
      const value = explicit === null ? raw : explicit[4]!;
      const decodedValue = decode(value);
      const fields = name === undefined ? this.fields : this.fields.filter((field) => field.names.has(name));
      const candidates: Condition<T>[] = [];
      const errors: string[] = [];
      for (const field of fields) {
        const condition = this.compile(field, symbol, value);
        if (typeof condition === "string") {
          errors.push(condition);
        } else if (name !== undefined || field.values.has(valueKey(field.schema, String(condition.values?.[0]))) ||
          (decodedValue !== undefined && field.aliases.has(valueKey(field.schema, decodedValue))) ||
          (field.schema.kind === "number" && (condition.operator !== Operator.EQUAL ||
            (numericLiteral.exec(value)?.[2] ?? "") !== ""))) {
          candidates.push(condition);
        }
      }
      const selection = selections[fragment.id];
      const chosen = candidates.filter((candidate) => selection === undefined || candidate.field === selection);
      if (chosen.length === 1) {
        filters.push({ ...fragment, condition: chosen[0]! });
      } else {
        const kind = candidates.length > 1 && selection === undefined ? "ambiguous"
          : explicit !== null || selection !== undefined ? "invalid" : "unrecognized";
        const message = kind === "ambiguous" ? "Choose a field for this value."
          : selection !== undefined ? "The selected field is not a valid candidate."
            : fields.length === 0 && name !== undefined ? `Unknown field "${name}".`
            : errors[0] ?? "No unique matching field/value; specify a field explicitly.";
        issues.push({ ...fragment, kind, message, candidates });
      }
    }
    return { input, filters, issues };
  }

  public search(input: string, selections: Selections<T> = {}, limit?: number): readonly T[] {
    const interpretation = this.interpret(input, selections);
    if (interpretation.issues.length > 0) {
      throw new QueryValidationError(
        "Cannot search with unresolved query fragments.", "QUERY_INVALID_CONDITION", { interpretation },
      );
    }
    return interpretation.filters.length === 0
      ? this.store.queryAll(limit)
      : this.store.search(interpretation.filters.map((filter) => filter.condition), limit);
  }

  private compile(field: SearchField<T>, symbol: string, raw: string): Condition<T> | string {
    const schema = field.schema;
    if (!raw || (raw.includes('"') && !quotedLiteral.test(raw))) return "Expected a value or a valid quoted string.";
    const value = decode(raw);
    if (value === undefined) return "Invalid quoted string escape.";
    let operator = operators[symbol]!;
    if (schema.kind === "number") {
      const bounds = raw.split("..");
      if (bounds.length > 1) {
        if (operator !== Operator.EQUAL || bounds.length !== 2) return "A range requires equality and exactly two bounds.";
        const lower = this.quantity(field, bounds[0]!);
        const upper = this.quantity(field, bounds[1]!);
        if (typeof lower === "string") return lower;
        if (typeof upper === "string") return upper;
        if (lower > upper) return "Range lower bound must not exceed its upper bound.";
        return createCondition<T, FieldName<T>>({ field: schema.name, operator: Operator.BETWEEN, lowerValue: lower, upperValue: upper });
      }
      const number = this.quantity(field, value);
      if (typeof number === "string") return number;
      return createCondition<T, FieldName<T>>({ field: schema.name, operator, values: [number] });
    }
    if (operator !== Operator.EQUAL && operator !== Operator.NOT_EQUAL) return "This field only supports equality or inequality.";
    if (schema.kind === "boolean") {
      if (value !== "true" && value !== "false") return "Boolean values must be true or false.";
      return createCondition<T, FieldName<T>>({ field: schema.name, operator, values: [value === "true"] });
    }
    if (schema.secondaryType === "commaSeparatedStrings") {
      operator = operator === Operator.EQUAL ? Operator.CONTAINS_EITHER : Operator.NOT_CONTAINS;
    }
    const resolved = field.aliases.get(valueKey(schema, value)) ?? value;
    return createCondition<T, FieldName<T>>({ field: schema.name, operator, values: [resolved] });
  }

  private quantity(field: SearchField<T>, raw: string): number | string {
    const match = numericLiteral.exec(raw);
    if (match === null) return `Invalid numeric quantity "${raw}".`;
    const suffix = unitName(match[2]!);
    const factor = suffix === "" ? 1 : field.units.get(suffix);
    if (factor === undefined) return `Unknown or incompatible unit "${suffix}".`;
    const [coefficient, power] = decimalParts(match[1]!);
    const [unitCoefficient, unitPower] = decimalParts(String(factor));
    // Convert decimal factors before rounding once to the store's JavaScript number.
    const value = Number(`${coefficient * unitCoefficient}e${power + unitPower}`);
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER ||
      (value === 0 && coefficient !== 0n)) return "Quantity is outside the supported numeric range.";
    if (this.store.normalizationProfile !== NormalizationProfile.NATIVE && !Number.isSafeInteger(value)) {
      return "Fractional or unsafe quantities require NATIVE normalization.";
    }
    return value;
  }
}

function decode(raw: string): string | undefined {
  if (!quotedLiteral.test(raw)) return raw;
  if (!/^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"$/.test(raw)) return undefined;
  return JSON.parse(raw) as string;
}

export function editQueryFragment<T extends object>(
  interpretation: QueryInterpretation<T>, id: string, replacement: string,
): string {
  const fragment = [...interpretation.filters, ...interpretation.issues].find((item) => item.id === id);
  if (fragment === undefined) invalid(`Unknown query fragment "${id}".`);
  return interpretation.input.slice(0, fragment.start) + replacement + interpretation.input.slice(fragment.end);
}
