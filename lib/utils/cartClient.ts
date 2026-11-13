import type { CartApiResponse, CartDTO, LocalCartItem, ProductDTO } from "../cart-contract";
import { clearLocalCart, getLocalCart } from "./localCart";
export type { CartApiResponse } from "../cart-contract";
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...(body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to update your cart. Please retry.");
  return data as T;
}
export async function fetchProductsByIds(ids: string[]): Promise<ProductDTO[]> {
  if (!ids.length) return [];
  return (await request<{ products: ProductDTO[] }>("/api/products?ids=" + ids.map(encodeURIComponent).join(","))).products;
}
export async function fetchCartByUser(): Promise<CartDTO | null> {
  return (await request<{ cart: CartDTO | null }>("/api/cart")).cart;
}
export function addProductToUserCart(productId: string, quantity = 1) {
  return request<CartApiResponse>("/api/cart/add", { productId, quantity });
}
export function updateProductQuantity(productId: string, quantity: number) {
  return request<CartApiResponse>("/api/cart/update", { productId, quantity });
}
export function removeProductFromUserCart(productId: string) {
  return request<CartApiResponse>("/api/cart/remove", { productId });
}
export function mergeLocalCartToUserCart(items: LocalCartItem[]) {
  return request<CartApiResponse>("/api/cart/merge", { items });
}
export async function getCartCount() {
  return (await request<{ count: number }>("/api/cart/count")).count;
}
// Coalesce simultaneous provider/page effects in this tab, including Strict Mode.
// This is not durable idempotency: a lost response or another tab can still replay.
const merges = new Map<string, Promise<void>>();
export function ensureGuestCartMerged(sessionKey: string): Promise<void> {
  const existing = merges.get(sessionKey);
  if (existing) return existing;
  const items = getLocalCart();
  if (!items.length) return Promise.resolve();
  const pending = mergeLocalCartToUserCart(items).then(() => {
    // Do not discard guest edits made while the request was in flight.
    if (JSON.stringify(getLocalCart()) === JSON.stringify(items)) clearLocalCart();
  }).finally(() => { merges.delete(sessionKey); });
  merges.set(sessionKey, pending);
  return pending;
}
