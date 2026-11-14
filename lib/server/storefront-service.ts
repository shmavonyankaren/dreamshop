import "server-only";
import type { StoreProduct } from "./public-stores";
import { countEligibleProducts, eligibleProductRecords, objectId, toPublicListing } from "./product-eligibility";
import { connectDB } from "../db/connection";
import Category from "../db/models/category.model";
import { productIdSchema, type ProductDTO } from "../cart-contract";
import { parseCatalogQuery, type SearchParams } from "../storefront-contract";

export type PublicCategory = { _id: string; name: string };
export async function getCatalog(input: SearchParams = {}) {
  const query = parseCatalogQuery(input);
  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = objectId(query.category);
  if (query.q) {
    const literal = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["title", "description", "tags"].map(field => ({ [field]: { $regex: literal, $options: "i" } }));
  }
  const sorts: Record<typeof query.sort, Record<string, 1 | -1>> = { newest: { createdAt: -1, _id: -1 }, oldest: { createdAt: 1, _id: 1 }, "name-asc": { title: 1, _id: 1 }, "name-desc": { title: -1, _id: -1 } };
  await connectDB();
  const total = await countEligibleProducts(filter);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const records = await eligibleProductRecords(filter, { sort: sorts[query.sort], skip: (page - 1) * query.pageSize, limit: query.pageSize });
  return { products: records.map(toPublicListing), total, totalPages, query: { ...query, page } };
}
export async function getStorefrontCategories(): Promise<PublicCategory[]> {
  await connectDB();
  const records = await Category.find().select("_id name").sort({ name: 1, _id: 1 }).limit(200).maxTimeMS(5000);
  return records.map((record: { _id: { toString(): string }; name: string }) => ({ _id: record._id.toString(), name: record.name }));
}
export async function getStorefrontProduct(id: string): Promise<StoreProduct | null> {
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) return null;
  await connectDB();
  const [product] = await eligibleProductRecords({ _id: objectId(parsed.data) }, { limit: 1 });
  return product ? toPublicListing(product) : null;
}
export async function getRelatedProducts(product: ProductDTO): Promise<ProductDTO[]> {
  if (!product.category) return [];
  await connectDB();
  const records = await eligibleProductRecords({ category: objectId(product.category._id), _id: { $ne: objectId(product._id) } }, { limit: 4 });
  return records.map(toPublicListing);
}
export async function getHomepageData() {
  const [categories, catalog] = await Promise.allSettled([getStorefrontCategories(), getCatalog({ pageSize: "8" })]);
  return { categories: categories.status === "fulfilled" ? categories.value : [], products: catalog.status === "fulfilled" ? catalog.value.products : [], categoryError: categories.status === "rejected", productError: catalog.status === "rejected" };
}
