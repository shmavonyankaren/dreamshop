import "server-only";
import { requireEnabledPrice } from "./currency-service";
import { z } from "zod";
import Product from "../db/models/product.model";
import Category from "../db/models/category.model";
import { requireAuthenticatedUser } from "./authenticated-user";
import { ownedStore, storeDTO, requireStoreImage } from "./store-service";
import { authorizedMutation } from "./marketplace-transaction";
import { productFieldsSchema } from "./marketplace-validation";
import { productIdSchema } from "../cart-contract";
import { AuthorizationError } from "../authorization-contract";
import { parseCatalogQuery, type SearchParams } from "../storefront-contract";
import { PRODUCT_FIELDS, toProductDTO, type ProductRecord } from "./product-dto";

export async function merchantProducts(input: SearchParams = {}) {
  const store = await ownedStore(await requireAuthenticatedUser());
  const query = parseCatalogQuery(input);
  const filter: Record<string, unknown> = { store: store._id };
  if (query.q) filter.title = { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (query.category) filter.category = query.category;
  const sorts: Record<string, Record<string, 1 | -1>> = { newest: { createdAt: -1, _id: -1 }, oldest: { createdAt: 1, _id: 1 }, "name-asc": { title: 1, _id: 1 }, "name-desc": { title: -1, _id: -1 } };
  const total = await Product.countDocuments(filter).maxTimeMS(5000), totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const records = await Product.find(filter).select(PRODUCT_FIELDS + " status moderationStatus +moderationReason createdAt").populate({ path: "category", select: "_id name" }).sort(sorts[query.sort]).skip((page - 1) * query.pageSize).limit(query.pageSize).maxTimeMS(5000);
  return { store: storeDTO(store), total, totalPages, query: { ...query, page }, products: records.map((p: ProductRecord & { status?: string; moderationStatus?: string; moderationReason?: string; createdAt: Date }) => ({ ...toProductDTO(p), status: p.status ?? "active", moderationStatus: p.moderationStatus ?? "clear", moderationReason: p.moderationReason ?? "", createdAt: p.createdAt.toISOString() })) };
}
export async function merchantProduct(id: string) {
  const store = await ownedStore(await requireAuthenticatedUser());
  const product = await Product.findOne({ _id: productIdSchema.parse(id), store: store._id }).select(PRODUCT_FIELDS + " status moderationStatus +moderationReason").populate({ path: "category", select: "_id name" });
  return product ? { ...toProductDTO(product), status: product.status ?? "active", moderationStatus: product.moderationStatus ?? "clear", moderationReason: product.moderationReason ?? "" } : null;
}
export async function saveMerchantProduct(input: unknown) {
  return authorizedMutation("product:create", async (actor, session) => {
    const { id, product } = z.object({ id: productIdSchema.optional(), product: productFieldsSchema }).strict().parse(input);
    const store = await ownedStore(actor, session);
    if (!await Category.exists({ _id: product.category }).session(session)) throw new AuthorizationError(400, "INVALID_CATEGORY", "Select an existing category.");
    await requireStoreImage(product.imageUrl, String(store._id), session);
    const previous = id ? await Product.findOne({ _id: id, store: store._id, owner: actor.id }).session(session) : null;
    if (id && !previous) throw new AuthorizationError(404, "NOT_FOUND", "Product not found.");
    await requireEnabledPrice(product, previous, session);
    if (id) {
      const result = await Product.updateOne({ _id: id, store: store._id, owner: actor.id }, { $set: product, $inc: { __v: 1 } }, { session, runValidators: true });
      if (!result.matchedCount) throw new AuthorizationError(404, "NOT_FOUND", "Product not found.");
      return { id };
    }
    const [record] = await Product.create([{ ...product, owner: actor.id, store: store._id, status: "active", moderationStatus: "clear", moderationRevision: 0 }], { session });
    return { id: String(record._id) };
  });
}
export async function archiveMerchantProduct(input: unknown) {
  return authorizedMutation("product:delete:own", async (actor, session) => {
    const { id, status } = z.object({ id: productIdSchema, status: z.enum(["active", "archived"]) }).strict().parse(input);
    const store = await ownedStore(actor, session);
    const result = await Product.updateOne({ _id: id, store: store._id, owner: actor.id }, { $set: { status }, $inc: { __v: 1 } }, { session, runValidators: true });
    if (!result.matchedCount) throw new AuthorizationError(404, "NOT_FOUND", "Product not found.");
    return { status };
  });
}
export async function merchantStatistics() {
  const store = await ownedStore(await requireAuthenticatedUser());
  const result = await Product.aggregate([{ $match: { store: store._id } }, { $group: { _id: null, total: { $sum: 1 }, archived: { $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] } }, categories: { $addToSet: "$category" } } }]).option({ maxTimeMS: 5000 });
  const stats = result[0];
  return { total: stats?.total ?? 0, archived: stats?.archived ?? 0, active: (stats?.total ?? 0) - (stats?.archived ?? 0), categories: (stats?.categories ?? []).filter(Boolean).length };
}
