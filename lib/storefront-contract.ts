export type SearchParams = Record<string, string | string[] | undefined>;
export const SORTS = { newest: "Newest", oldest: "Oldest", "name-asc": "Name: A–Z", "name-desc": "Name: Z–A" } as const;
export type CatalogQuery = { q: string; category: string; sort: keyof typeof SORTS; page: number; pageSize: number };
const scalar = (value: unknown) => typeof value === "string" ? value : "";
export function parseCatalogQuery(input: SearchParams): CatalogQuery {
  const integer = (value: unknown, fallback: number, max: number) => /^\d{1,15}$/.test(scalar(value)) ? Math.max(1, Math.min(max, Number(value))) : fallback;
  const category = scalar(input.category);
  const sort = scalar(input.sort);
  return { q: scalar(input.q).trim().slice(0, 100), category: /^[a-f\d]{24}$/i.test(category) ? category.toLowerCase() : "",
    sort: Object.hasOwn(SORTS, sort) ? sort as CatalogQuery["sort"] : "newest", page: integer(input.page, 1, Number.MAX_SAFE_INTEGER), pageSize: integer(input.pageSize, 12, 48) };
}
export function catalogHref(query: Partial<CatalogQuery>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== "" && value !== undefined) params.set(key, String(value));
  return `/all-products${params.size ? `?${params}` : ""}`;
}
export function safeProductImage(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^\/(?!\/)/.test(value) && !value.includes("\\")) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
