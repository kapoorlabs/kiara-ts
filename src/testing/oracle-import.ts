import { QueryValidationError } from "../errors.js";
import { NormalizationProfile } from "../store/types.js";

export interface OracleExportMetadata {
  readonly sourceSha: string;
  readonly javaVersion: string;
  readonly locale: string;
  readonly timeZone: string;
}

export interface OracleImportedFixture {
  readonly id: string;
  readonly normalizationProfile: string;
  readonly schema: unknown;
  readonly rows: readonly unknown[];
  readonly conditions: readonly unknown[];
  readonly expectedRowIndexes: readonly number[];
  readonly limit?: number;
}

export interface OracleFixtureDocument {
  readonly metadata: OracleExportMetadata;
  readonly fixtures: readonly OracleImportedFixture[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertMetadata(value: unknown): asserts value is OracleExportMetadata {
  if (typeof value !== "object" || value === null) {
    throw new QueryValidationError(
      "Oracle fixture document metadata must be an object.",
      "QUERY_INVALID_CONDITION",
    );
  }

  const metadata = value as Record<string, unknown>;
  if (!isNonEmptyString(metadata.sourceSha) || !isNonEmptyString(metadata.javaVersion) ||
    !isNonEmptyString(metadata.locale) || !isNonEmptyString(metadata.timeZone)) {
    throw new QueryValidationError(
      "Oracle fixture metadata must include sourceSha, javaVersion, locale, and timeZone.",
      "QUERY_INVALID_CONDITION",
      { metadata },
    );
  }
}

function assertFixtures(value: unknown): asserts value is OracleImportedFixture[] {
  if (!Array.isArray(value)) {
    throw new QueryValidationError(
      "Oracle fixture document fixtures must be an array.",
      "QUERY_INVALID_CONDITION",
    );
  }

  const ids = new Set<string>();
  for (const fixture of value) {
    if (typeof fixture !== "object" || fixture === null) {
      throw new QueryValidationError(
        "Oracle fixture entries must be objects.",
        "QUERY_INVALID_CONDITION",
      );
    }
    const entry = fixture as Record<string, unknown>;
    if (!isNonEmptyString(entry.id)) {
      throw new QueryValidationError(
        "Oracle fixture entries must include non-empty id values.",
        "QUERY_INVALID_CONDITION",
      );
    }
    if (
      entry.normalizationProfile !== NormalizationProfile.JAVA &&
      entry.normalizationProfile !== NormalizationProfile.NATIVE
    ) {
      throw new QueryValidationError(
        `Oracle fixture "${entry.id}" has invalid normalizationProfile.`,
        "QUERY_INVALID_CONDITION",
      );
    }
    if (ids.has(entry.id)) {
      throw new QueryValidationError(
        `Oracle fixture id "${entry.id}" is duplicated.`,
        "QUERY_INVALID_CONDITION",
      );
    }
    if (!Array.isArray(entry.expectedRowIndexes)) {
      throw new QueryValidationError(
        `Oracle fixture "${entry.id}" must include expectedRowIndexes array.`,
        "QUERY_INVALID_CONDITION",
      );
    }
    ids.add(entry.id);
  }
}

export function parseOracleFixtureDocument(
  json: string,
): OracleFixtureDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new QueryValidationError(
      "Oracle fixture document must be valid JSON.",
      "QUERY_INVALID_CONDITION",
      { cause: error instanceof Error ? error.message : "unknown" },
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new QueryValidationError(
      "Oracle fixture document must be a JSON object.",
      "QUERY_INVALID_CONDITION",
    );
  }

  const document = parsed as Record<string, unknown>;
  assertMetadata(document.metadata);
  assertFixtures(document.fixtures);

  return {
    metadata: document.metadata,
    fixtures: document.fixtures,
  };
}
