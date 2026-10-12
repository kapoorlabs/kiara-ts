import type { Condition } from "../query/condition.js";
import type { CompiledSchema, FieldName, SchemaField } from "../schema/types.js";

export const NormalizationProfile = {
  JAVA: "java",
  NATIVE: "native",
} as const;

export type NormalizationProfile = (typeof NormalizationProfile)[keyof typeof NormalizationProfile];
export type AnyModel = Record<string, unknown>;

export interface StoreOptions {
  readonly normalizationProfile?: NormalizationProfile;
}

export type NormalizedScalar = string | number | bigint | boolean | null;

export interface NormalizedNumericRange {
  readonly prefix: string;
  readonly lower: number | bigint;
  readonly upper: number | bigint;
}

export interface NormalizedRow<T extends object> {
  readonly id: number;
  readonly source: T;
  readonly values: ReadonlyMap<FieldName<T>, NormalizedFieldValue>;
}

export interface NormalizedFieldValue {
  readonly isCollection: boolean;
  readonly scalar: NormalizedScalar | undefined;
  readonly collectionValues: readonly NormalizedScalar[] | undefined;
  readonly rangeValues: readonly NormalizedNumericRange[] | undefined;
}

export interface TrieNode {
  readonly id: number;
  readonly level: number;
  readonly fieldName: string | null;
  readonly key: NormalizedScalar | null;
  readonly parentId: number | null;
  readonly childIds: ReadonlyMap<string, number>;
  readonly rowIds: readonly number[];
}

export interface TrieSnapshot {
  readonly nodes: readonly TrieNode[];
}

export interface FieldIndex {
  readonly field: SchemaField<AnyModel, string>;
  readonly equality: ReadonlyMap<string, readonly number[]>;
  readonly numericOrder: readonly {
    readonly key: number | bigint;
    readonly rowIds: readonly number[];
  }[];
  readonly collectionFullKeys: ReadonlyMap<string, readonly number[]>;
  readonly rangeEntries: readonly {
    readonly rowId: number;
    readonly ranges: readonly NormalizedNumericRange[];
  }[];
}

export interface PreparedStoreData<T extends object> {
  readonly schema: CompiledSchema<T>;
  readonly normalizationProfile: NormalizationProfile;
  readonly rows: readonly T[];
  readonly normalizedRows: readonly NormalizedRow<T>[];
  readonly rowIds: readonly number[];
  readonly rowById: ReadonlyMap<number, NormalizedRow<T>>;
  readonly trie: TrieSnapshot;
  readonly indexes: ReadonlyMap<FieldName<T>, FieldIndex>;
}

export interface SearchRequest<T extends object> {
  readonly conditions: readonly Condition<T>[];
  readonly limit?: number;
}
