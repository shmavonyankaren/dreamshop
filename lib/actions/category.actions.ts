"use server";
import { connectDB } from "../db/connection";
import Category from "../db/models/category.model";
import { marketplaceResult } from "../server/marketplace-response";
import { categoryDTO, createManagedCategory, updateManagedCategory, deleteManagedCategory } from "../server/category-service";

export async function createCategory(input: unknown) { return marketplaceResult(() => createManagedCategory(input)); }
export async function updateCategory(input: unknown) { return marketplaceResult(() => updateManagedCategory(input)); }
export async function deleteCategory(input: unknown) { return marketplaceResult(() => deleteManagedCategory(input)); }
export async function getAllCategories() {
  try {
    await connectDB();
    const categories = await Category.find().select("_id name");
    return categories.map(categoryDTO);
  } catch { throw new Error("Unable to load categories. Please retry."); }
}
