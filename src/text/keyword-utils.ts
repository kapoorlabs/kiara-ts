export function sanitizeKeywordText(input: string): string {
  return input
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractKeywordTokens(input: string): string[] {
  const sanitized = sanitizeKeywordText(input).toLocaleLowerCase("en-US");
  if (sanitized.length === 0) {
    return [];
  }
  return sanitized.split(" ").filter((token) => token.length > 0);
}
