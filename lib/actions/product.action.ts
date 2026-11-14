"use server";
import { connectDB } from "../db/connection";
import { eligibleProductsByIds, eligibleProductRecords, objectId } from "../server/product-eligibility";
import { productIdSchema } from "../cart-contract";
import { toProductDTO, type ProductRecord } from "../server/product-dto";
import { marketplaceResult } from "../server/marketplace-response";
import { createOwnedProduct, updateOwnedProduct, deleteOwnedProduct, deleteOwnedProducts, deleteAllOwnedProducts } from "../server/product-service";

export async function createProduct(input: unknown) { return marketplaceResult(() => createOwnedProduct(input)); }
export async function updateProduct(input: unknown) { return marketplaceResult(() => updateOwnedProduct(input)); }
export async function deleteProduct(input: unknown) { return marketplaceResult(() => deleteOwnedProduct(input)); }
export async function deleteProducts(input: unknown) { return marketplaceResult(() => deleteOwnedProducts(input)); }
// Retained name, but no caller-supplied user ID is accepted anymore.
export async function deleteAllProductsByUser(input: unknown = {}) { return marketplaceResult(() => deleteAllOwnedProducts(input)); }
export async function adminUpdateProduct(input: unknown) { return marketplaceResult(() => updateOwnedProduct(input, true)); }
export async function adminDeleteProduct(input: unknown) { return marketplaceResult(() => deleteOwnedProduct(input, true)); }
export async function adminDeleteProducts(input: unknown) { return marketplaceResult(() => deleteOwnedProducts(input, true)); }

export async function getAllProducts() {
  try {
    await connectDB();
    const products = await eligibleProductRecords({}, { limit: 48 });
    return products.map((product: ProductRecord) => toProductDTO(product));
  } catch { throw new Error("Unable to load products. Please retry."); }
}
export async function getProductById(id: string) {
  try {
    const productId = productIdSchema.parse(id);
    await connectDB();
    return (await eligibleProductsByIds([productId]))[0] ?? null;
  } catch { throw new Error("Unable to load this product. Please retry."); }
}
export async function getProductsByUser(id: string) {
  try {
    const userId = productIdSchema.parse(id);
    await connectDB();
    const products = await eligibleProductRecords({ owner: objectId(userId) }, { limit: 48 });
    return products.map((product: ProductRecord) => toProductDTO(product));
  } catch { throw new Error("Unable to load products. Please retry."); }
}
