import "server-only";
import Category from "../db/models/category.model";
import Product from "../db/models/product.model";
import { AuthorizationError } from "../authorization-contract";
import { authorizedMutation } from "./marketplace-transaction";
import { categoryCreateSchema, categoryUpdateSchema, categoryDeleteSchema } from "./marketplace-validation";
import { writeAdminAudit } from "./admin-audit";

export const categoryDTO = (category: { _id: { toString(): string }; name: string }) => ({ _id: category._id.toString(), name: category.name });
export async function createManagedCategory(input: unknown) {
  return authorizedMutation("category:manage", async (actor, session) => {
    const { categoryName } = categoryCreateSchema.parse(input);
    const [category] = await Category.create([{ name: categoryName }], { session });
    await writeAdminAudit(actor.id, String(category._id), "category", "category.create", null, { name: categoryName }, "Category created", session);
    return categoryDTO(category);
  });
}
export async function updateManagedCategory(input: unknown) {
  return authorizedMutation("category:manage", async (actor, session) => {
    const { categoryId, categoryName } = categoryUpdateSchema.parse(input);
    const before = await Category.findById(categoryId).session(session);
    if (!before) throw new AuthorizationError(404, "NOT_FOUND", "Category not found.");
    if (before.name === categoryName) return categoryDTO(before);
    const category = await Category.findOneAndUpdate({ _id: categoryId }, { $set: { name: categoryName } }, { new: true, runValidators: true, session });
    if (!category) throw new AuthorizationError(404, "NOT_FOUND", "Category not found.");
    await writeAdminAudit(actor.id, categoryId, "category", "category.update", { name: before.name }, { name: categoryName }, "Category renamed", session);
    return categoryDTO(category);
  });
}
export async function deleteManagedCategory(input: unknown) {
  return authorizedMutation("category:manage", async (actor, session) => {
    const { categoryId } = categoryDeleteSchema.parse(input);
    const before = await Category.findById(categoryId).session(session);
    if (await Product.exists({ category: categoryId }).session(session)) throw new AuthorizationError(409, "CATEGORY_IN_USE", "Reassign existing products before deleting this category.");
    const result = await Category.deleteOne({ _id: categoryId }, { session });
    if (!result.deletedCount) throw new AuthorizationError(404, "NOT_FOUND", "Category not found.");
    await writeAdminAudit(actor.id, categoryId, "category", "category.delete", { name: before?.name }, null, "Unused category deleted", session);
    return { deletedCount: result.deletedCount };
  });
}
