import type { Condition } from "./condition.js";
import { Store } from "../store/store.js";
import type { FieldName } from "../schema/types.js";
import { DictionaryTrie } from "../text/dictionary-trie.js";
import { extractKeywordTokens } from "../text/keyword-utils.js";
import { stemEnglishToken } from "../text/stemming.js";
import { QueryValidationError } from "../errors.js";

export interface KeywordSearchOptions<T extends object> {
  readonly conditions?: readonly Condition<T>[];
  readonly fields?: readonly FieldName<T>[];
  readonly limit?: number;
}

export interface KeywordSearchResult<T extends object> {
  readonly results: readonly T[];
  readonly matchedKeywords: readonly string[];
  readonly correctedKeywords: Readonly<Record<string, string>>;
  readonly usedKeywords: readonly string[];
  readonly truncated: boolean;
}

function dedupeTokens(tokens: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    unique.push(token);
  }
  return unique;
}

function flattenQueryTokens(input: string | readonly string[]): string[] {
  if (typeof input === "string") {
    return extractKeywordTokens(input);
  }
  const tokens: string[] = [];
  for (const phrase of input) {
    tokens.push(...extractKeywordTokens(phrase));
  }
  return tokens;
}

export class KeywordSearch<T extends object> {
  private readonly store: Store<T>;
  private readonly maxKeywords: number;

  public constructor(store: Store<T>, maxKeywords = 10) {
    this.store = store;
    this.maxKeywords = maxKeywords;
  }

  private resolveFields(fields: readonly FieldName<T>[] | undefined): FieldName<T>[] {
    if (fields !== undefined) {
      for (const field of fields) {
        const schemaField = this.store.schema.fieldMap.get(field);
        if (schemaField === undefined) {
          throw new QueryValidationError(
            `Unknown keyword-search field "${field}".`,
            "QUERY_INVALID_CONDITION",
            { field },
          );
        }
        if (schemaField.ignoreIndex === true) {
          throw new QueryValidationError(
            `Field "${field}" is marked ignoreIndex and cannot participate in keyword search.`,
            "QUERY_INVALID_CONDITION",
            { field },
          );
        }
      }
      return [...fields];
    }

    return this.store.schema.fields
      .filter(
        (field) =>
          (field.kind === "text" || field.kind === "enum") && field.ignoreIndex !== true,
      )
      .map((field) => field.name);
  }

  private resolveRows(options: KeywordSearchOptions<T>): readonly T[] {
    if (options.conditions === undefined || options.conditions.length === 0) {
      return this.store.queryAll();
    }
    return this.store.search(options.conditions);
  }

  private hasStemmedField(fields: readonly FieldName<T>[]): boolean {
    return fields.some((fieldName) => this.store.schema.fieldMap.get(fieldName)?.stemmedIndex === true);
  }

  private createRowTokenSet(row: T, fields: readonly FieldName<T>[]): Set<string> {
    const tokens = new Set<string>();
    for (const fieldName of fields) {
      const value = row[fieldName];
      if (typeof value !== "string") {
        continue;
      }

      const field = this.store.schema.fieldMap.get(fieldName);
      const fieldTokens = extractKeywordTokens(value);
      for (const token of fieldTokens) {
        tokens.add(token);
      }

      if (field?.stemmedIndex === true) {
        for (const token of fieldTokens) {
          tokens.add(stemEnglishToken(token));
        }
      }
    }
    return tokens;
  }

  private normalizeQueryTokens(
    tokens: readonly string[],
    fields: readonly FieldName<T>[],
  ): readonly string[] {
    if (!this.hasStemmedField(fields)) {
      return tokens;
    }

    const expanded = new Set<string>();
    for (const token of tokens) {
      expanded.add(token);
      expanded.add(stemEnglishToken(token));
    }

    return [...expanded];
  }

  private searchByScore(
    tokens: readonly string[],
    rows: readonly T[],
    fields: readonly FieldName<T>[],
    scoreSelector: (scores: readonly number[]) => number,
    limit: number,
  ): readonly T[] {
    const scored = rows.map((row) => {
      const rowTokens = this.createRowTokenSet(row, fields);
      const score = tokens.reduce(
        (count, token) => (rowTokens.has(token) ? count + 1 : count),
        0,
      );
      return { row, score };
    });

    const positiveScores = scored.map((entry) => entry.score).filter((score) => score > 0);
    if (positiveScores.length === 0) {
      return [];
    }

    const targetScore = scoreSelector(positiveScores);
    return scored
      .filter((entry) => entry.score === targetScore)
      .map((entry) => entry.row)
      .slice(0, limit);
  }

  public bestMatch(
    input: string | readonly string[],
    options: KeywordSearchOptions<T> = {},
  ): KeywordSearchResult<T> {
    const rows = this.resolveRows(options);
    const fields = this.resolveFields(options.fields);
    const limit = options.limit ?? 100;

    const rawTokens = dedupeTokens(flattenQueryTokens(input));
    const truncated = rawTokens.length > this.maxKeywords;
    const selectedTokens = rawTokens.slice(0, this.maxKeywords);

    const dictionary = new DictionaryTrie();
    for (const row of rows) {
      for (const field of fields) {
        const value = row[field];
        if (typeof value === "string") {
          dictionary.addText(value);
        }
      }
    }

    const correctedKeywords: Record<string, string> = {};
    const effectiveTokens = selectedTokens.map((token) => {
      if (dictionary.hasWord(token)) {
        return token;
      }
      const candidate = dictionary.getOneEditCandidate(token);
      if (candidate === null) {
        return token;
      }
      correctedKeywords[token] = candidate;
      return candidate;
    });
    const scoringTokens = this.normalizeQueryTokens(effectiveTokens, fields);

    const results = this.searchByScore(
      scoringTokens,
      rows,
      fields,
      (scores) => Math.max(...scores),
      limit,
    );

    const matched = new Set<string>();
    const useStemming = this.hasStemmedField(fields);
    for (const row of results) {
      const tokens = this.createRowTokenSet(row, fields);
      for (const keyword of effectiveTokens) {
        if (tokens.has(keyword) || (useStemming && tokens.has(stemEnglishToken(keyword)))) {
          matched.add(keyword);
        }
      }
    }

    return {
      results,
      matchedKeywords: [...matched],
      correctedKeywords,
      usedKeywords: effectiveTokens,
      truncated,
    };
  }

  public minimumMatch(
    input: string | readonly string[],
    options: KeywordSearchOptions<T> = {},
  ): KeywordSearchResult<T> {
    const rows = this.resolveRows(options);
    const fields = this.resolveFields(options.fields);
    const limit = options.limit ?? 100;

    const best = this.bestMatch(input, options);
    if (best.usedKeywords.length === 0) {
      return best;
    }
    const scoringTokens = this.normalizeQueryTokens(best.usedKeywords, fields);

    const results = this.searchByScore(
      scoringTokens,
      rows,
      fields,
      (scores) => Math.min(...scores),
      limit,
    );

    const matched = new Set<string>();
    const useStemming = this.hasStemmedField(fields);
    for (const row of results) {
      const tokens = this.createRowTokenSet(row, fields);
      for (const keyword of best.usedKeywords) {
        if (tokens.has(keyword) || (useStemming && tokens.has(stemEnglishToken(keyword)))) {
          matched.add(keyword);
        }
      }
    }

    return {
      results,
      matchedKeywords: [...matched],
      correctedKeywords: best.correctedKeywords,
      usedKeywords: best.usedKeywords,
      truncated: best.truncated,
    };
  }
}
