import "server-only";
import { z } from "zod";
import type { ClientSession } from "mongoose";
import Product from "../db/models/product.model";
import Category from "../db/models/category.model";
import { AuthorizationError } from "../authorization-contract";
import { authorizedMutation } from "./marketplace-transaction";
import { productFieldsSchema, productUpdateSchema, productDeleteSchema, bulkDeleteSchema } from "./marketplace-validation";
import { PRODUCT_FIELDS, toProductDTO } from "./product-dto";

const notFound = () => new AuthorizationError(404, "NOT_FOUND", "Product not found or not available for this operation.");
async function requireCategory(id: string, session: ClientSession) {
  if (!await Category.exists({ _id: id }).session(session)) throw new AuthorizationError(400, "INVALID_CATEGORY", "Select an existing category.");
}
export async function createOwnedProduct(input: unknown) {
  return authorizedMutation("product:create", async (actor, session) => {
    const product = productFieldsSchema.parse(input);
    await requireCategory(product.category, session);
    const [created] = await Product.create([{ ...product, owner: actor.id }], { session });
    const result = await Product.findById(created._id).session(session).select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" });
    return toProductDTO(result);
  });
}
export async function updateOwnedProduct(input: unknown, administrative = false) {
  return authorizedMutation(administrative ? "product:manage:any" : "product:update:own", async (actor, session) => {
    const { productId, product } = productUpdateSchema.parse(input);
    if (product.category) await requireCategory(product.category, session);
    const updated = await Product.findOneAndUpdate({ _id: productId, ...(!administrative ? { owner: actor.id } : {}) },
      { $set: product, $inc: { __v: 1 } }, { new: true, runValidators: true, session })
      .select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" });
    if (!updated) throw notFound();
    return toProductDTO(updated);
  });
}
export async function deleteOwnedProduct(input: unknown, administrative = false) {
  return authorizedMutation(administrative ? "product:manage:any" : "product:delete:own", async (actor, session) => {
    const { productId } = productDeleteSchema.parse(input);
    const result = await Product.deleteOne({ _id: productId, ...(!administrative ? { owner: actor.id } : {}) }, { session });
    if (!result.deletedCount) throw notFound();
    return { deletedCount: result.deletedCount };
  });
}
export async function deleteOwnedProducts(input: unknown, administrative = false) {
  return authorizedMutation(administrative ? "product:manage:any" : "product:delete:own", async (actor, session) => {
    const { productIds } = bulkDeleteSchema.parse(input);
    const filter = { _id: { $in: productIds }, ...(!administrative ? { owner: actor.id } : {}) };
    if (await Product.countDocuments(filter).session(session) !== productIds.length) throw notFound();
    const result = await Product.deleteMany(filter, { session });
    if (result.deletedCount !== productIds.length) throw notFound();
    return { deletedCount: result.deletedCount };
  });
}
export async function deleteAllOwnedProducts(input: unknown = {}) {
  return authorizedMutation("product:delete:own", async (actor, session) => {
    z.object({}).strict().parse(input);
    const result = await Product.deleteMany({ owner: actor.id }, { session });
    return { deletedCount: result.deletedCount };
  });
}
