import { parseCatalogQuery, type SearchParams } from "./storefront-contract";
export function parseAdminQuery(input: SearchParams = {}) {
  const base = parseCatalogQuery(input);
  const scalar = (value: unknown) => typeof value === "string" ? value.slice(0, 100) : "";
  const id = (value: unknown) => /^[a-f0-9]{24}$/i.test(scalar(value)) ? scalar(value).toLowerCase() : "";
  return { ...base, pageSize: Math.min(base.pageSize, 24), page: Math.min(base.page, 10000), status: scalar(input.status), moderation: scalar(input.moderation), role: scalar(input.role), merchant: id(input.merchant), store: id(input.store) };
}
export const literalSearch = (value: string) => ({ $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });
export function adminHref(path: string, query: Record<string, string | number>, page: number) {
  const merged: Record<string, string | number> = { ...query, page };
  const values = new URLSearchParams(); for (const [key, value] of Object.entries(merged)) if (value !== "") values.set(key, String(value));
  return `${path}?${values}`;
}
export type AdminUser = { id: string; name: string; email: string | null; status: string; applicationStatus: string; merchantStatus: string; superAdmin: boolean; createdAt: string | null };
export type AdminStore = { id: string; owner: string; name: string; slug: string; status: string; createdAt: string | null; productCount: number };
export type AdminAudit = { id: string; actor: string; target: string; action: string; targetType: string; at: string | null; reason: string; before: string; after: string; outcome: string };
