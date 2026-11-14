"use server";
import { connectDB } from "../db/connection";
import Product from "../db/models/product.model";
import { productIdSchema } from "../cart-contract";
import { PRODUCT_FIELDS, toProductDTO, type ProductRecord } from "../server/product-dto";
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
    const products = await Product.find().select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" }).sort({ createdAt: -1 });
    return products.map((product: ProductRecord) => toProductDTO(product));
  } catch { throw new Error("Unable to load products. Please retry."); }
}
export async function getProductById(id: string) {
  try {
    const productId = productIdSchema.parse(id);
    await connectDB();
    const product = await Product.findById(productId).select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" });
    return product ? toProductDTO(product) : null;
  } catch { throw new Error("Unable to load this product. Please retry."); }
}
export async function getProductsByUser(id: string) {
  try {
    const userId = productIdSchema.parse(id);
    await connectDB();
    const products = await Product.find({ owner: userId }).select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" }).sort({ createdAt: -1 });
    return products.map((product: ProductRecord) => toProductDTO(product));
  } catch { throw new Error("Unable to load products. Please retry."); }
}
