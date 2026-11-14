import "server-only";
import { z } from "zod";
import type { ClientSession } from "mongoose";
import Product from "../db/models/product.model";
import Category from "../db/models/category.model";
import { AuthorizationError } from "../authorization-contract";
import { authorizedMutation } from "./marketplace-transaction";
import { productFieldsSchema, productUpdateSchema, productDeleteSchema, bulkDeleteSchema } from "./marketplace-validation";
import { PRODUCT_FIELDS, toProductDTO } from "./product-dto";
import { ownedStore, requireStoreImage } from "./store-service";
import { writeAdminAudit } from "./admin-audit";

async function ownScope(actor: Parameters<typeof ownedStore>[0], session: ClientSession) {
  const store = await ownedStore(actor, session);
  return { owner: actor.id, store: store._id };
}

const notFound = () => new AuthorizationError(404, "NOT_FOUND", "Product not found or not available for this operation.");
async function requireCategory(id: string, session: ClientSession) {
  if (!await Category.exists({ _id: id }).session(session)) throw new AuthorizationError(400, "INVALID_CATEGORY", "Select an existing category.");
}
export async function createOwnedProduct(input: unknown) {
  return authorizedMutation("product:create", async (actor, session) => {
    const product = productFieldsSchema.parse(input);
    await requireCategory(product.category, session);
    const store = await ownedStore(actor, session);
    await requireStoreImage(product.imageUrl, String(store._id), session);
    const [created] = await Product.create([{ ...product, owner: actor.id, store: store._id, status: "active", moderationStatus: "clear", moderationRevision: 0 }], { session });
    const result = await Product.findById(created._id).session(session).select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" });
    return toProductDTO(result);
  });
}
export async function updateOwnedProduct(input: unknown, administrative = false) {
  return authorizedMutation(administrative ? "product:manage:any" : "product:update:own", async (actor, session) => {
    const { productId, product } = productUpdateSchema.parse(input);
    if (product.category) await requireCategory(product.category, session);
    const scope = administrative ? {} : await ownScope(actor, session);
    if (!administrative && "store" in scope && product.imageUrl) await requireStoreImage(product.imageUrl, String(scope.store), session);
    if (administrative) {
      const before = await Product.findOne({ _id: productId }).session(session);
      if (!before) throw notFound();
      const unchanged = Object.entries(product).every(([key, value]) => value === undefined || (key === "category" ? String(before[key]) === value : JSON.stringify(before[key]) === JSON.stringify(value)));
      if (unchanged) {
        const record = await Product.findById(productId).session(session).select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" });
        return toProductDTO(record);
      }
    }
    const updated = await Product.findOneAndUpdate({ _id: productId, ...scope },
      { $set: product, $inc: { __v: 1 } }, { new: true, runValidators: true, session })
      .select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" });
    if (!updated) throw notFound();
    if (administrative) await writeAdminAudit(actor.id, productId, "product", "product.update", null, { changedFields: Object.keys(product) }, "Platform product edit", session);
    return toProductDTO(updated);
  });
}
export async function deleteOwnedProduct(input: unknown, administrative = false) {
  return authorizedMutation(administrative ? "product:manage:any" : "product:delete:own", async (actor, session) => {
    const { productId } = productDeleteSchema.parse(input);
    const scope = administrative ? {} : await ownScope(actor, session);
    // Store products use archival through the merchant workspace.
    if (!administrative) {
      const target = await Product.findOne({ _id: productId, ...scope }).session(session);
      if (!target) throw notFound();
      if (target.store) throw new AuthorizationError(409, "ARCHIVE_REQUIRED", "Archive store products in your workspace.");
    }
    const result = await Product.deleteOne({ _id: productId, ...scope }, { session });
    if (!result.deletedCount) throw notFound();
    if (administrative) await writeAdminAudit(actor.id, productId, "product", "product.delete", { existed: true }, null, "Platform product deletion", session);
    return { deletedCount: result.deletedCount };
  });
}
export async function deleteOwnedProducts(input: unknown, administrative = false) {
  return authorizedMutation(administrative ? "product:manage:any" : "product:delete:own", async (actor, session) => {
    const { productIds } = bulkDeleteSchema.parse(input);
    const filter = { _id: { $in: productIds }, ...(!administrative ? await ownScope(actor, session) : {}) };
    if (await Product.countDocuments(filter).session(session) !== productIds.length) throw notFound();
    if (!administrative) throw new AuthorizationError(409, "ARCHIVE_REQUIRED", "Archive products individually in your workspace.");
    const result = await Product.deleteMany(filter, { session });
    if (result.deletedCount !== productIds.length) throw notFound();
    if (administrative) for (const id of productIds) await writeAdminAudit(actor.id, id, "product", "product.delete", { existed: true }, null, "Platform product deletion", session);
    return { deletedCount: result.deletedCount };
  });
}
export async function deleteAllOwnedProducts(input: unknown = {}) {
  return authorizedMutation("product:delete:own", async (actor, session) => {
    z.object({}).strict().parse(input);
    await ownScope(actor, session);
    throw new AuthorizationError(409, "ARCHIVE_REQUIRED", "Archive products individually in your workspace.");
  });
}
