import "server-only";
import Store from "../db/models/store.model";
import User from "../db/models/user.model";
import { connectDB } from "../db/connection";
import { parseCatalogQuery, type SearchParams } from "../storefront-contract";
import { literalSearch } from "../admin-contract";
import { activeOwnerFilter, countEligibleProducts, eligibleProductRecords, toPublicListing, objectId } from "./product-eligibility";
import type { ProductDTO } from "../cart-contract";
export type PublicStoreLink = { name: string; slug: string };
export type StoreProduct = ProductDTO & { publicStore?: PublicStoreLink };
export async function eligiblePublicStore(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 60) return null;
  await connectDB();
  const store = await Store.findOne({ slug, status: "active" }).select("_id owner name slug description logo banner").maxTimeMS(5000);
  if (!store) return null;
  const owner = await User.exists({ _id: store.owner, ...activeOwnerFilter }).maxTimeMS(5000);
  return owner ? store : null;
}
export async function getPublicStore(slug: string, input: SearchParams = {}) {
  const store = await eligiblePublicStore(slug);
  if (!store) return null;
  const query = parseCatalogQuery(input), filter: Record<string, unknown> = { store: store._id, owner: store.owner };
  if (query.category) filter.category = objectId(query.category);
  if (query.q) filter.$or = ["title", "description", "tags"].map(key => ({ [key]: literalSearch(query.q) }));
  const total = await countEligibleProducts(filter), totalPages = Math.max(1, Math.ceil(total / query.pageSize)), page = Math.min(query.page, totalPages);
  const sorts: Record<string, Record<string, 1 | -1>> = { newest: { createdAt: -1, _id: -1 }, oldest: { createdAt: 1, _id: 1 }, "name-asc": { title: 1, _id: 1 }, "name-desc": { title: -1, _id: -1 } };
  const records = await eligibleProductRecords(filter, { sort: sorts[query.sort], skip: (page - 1) * query.pageSize, limit: query.pageSize });
  // Whitelist public presentation only. The private owner/contact data never leaves this service.
  return { store: { name: store.name as string, slug: store.slug as string, description: store.description as string, logo: (store.logo ?? "") as string, banner: (store.banner ?? "") as string }, total, totalPages, query: { ...query, page }, products: records.map(toPublicListing) };
}
