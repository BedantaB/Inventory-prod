/** Helpers for list pages: ?q= search, ?page= paging, and filter values from the URL. */

export const PAGE_SIZE = 20;

type SearchParamValue = string | string[] | undefined;

export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Page number from the URL; anything odd becomes 1. */
export function parsePage(value: SearchParamValue): number {
  const page = Number(firstParam(value));
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

/** A filter value that must be one of `allowed`, else the default. */
export function parseChoice<T extends string>(
  value: SearchParamValue,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = firstParam(value);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * Search words for ILIKE: "toor  dal" → ["%toor%", "%dal%"]. Each word must match
 * somewhere, so word order doesn't matter. LIKE wildcards typed by the user are escaped.
 */
export function searchPatterns(query: string | undefined): string[] {
  if (!query) return [];
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => `%${word.replace(/[%_\\]/g, "\\$&")}%`);
}
