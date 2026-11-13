import { cartItemsSchema, cartItemSchema, productIdSchema, type LocalCartItem } from "../cart-contract";
import { CART_KEY, readGuestState, writeGuestState, withGuestLock, notifyCartChanged } from "./guest-state";
export function getLocalCart(): LocalCartItem[] {
  if (typeof window === "undefined") return [];
  try { return readGuestState().items; } catch { return []; }
}
function save(items: LocalCartItem[]) {
  const valid = cartItemsSchema.parse(items);
  const state = readGuestState();
  writeGuestState({ ...state, items: valid, dirty: true });
  return valid;
}
// Synchronous helpers are called inside mutateGuestCart by application callers.
export function addToLocalCart(productId: string | number) {
  const id = productIdSchema.parse(String(productId));
  const items = getLocalCart();
  const existing = items.find((item) => item.productId === id);
  if (existing) existing.quantity++; else items.push({ productId: id, quantity: 1 });
  return save(items);
}
export function updateLocalCartItem(productId: string | number, quantity: number) {
  const item = cartItemSchema.parse({ productId: String(productId), quantity });
  return save(getLocalCart().map((entry) => entry.productId === item.productId ? item : entry));
}
export function removeLocalCartItem(productId: string | number) {
  const id = productIdSchema.parse(String(productId));
  return save(getLocalCart().filter((item) => item.productId !== id));
}
export function clearLocalCart() {
  const state = readGuestState();
  if (state.pending || state.settled) writeGuestState({ ...state, items: [], dirty: true });
  else localStorage.removeItem(CART_KEY);
}
export async function mutateGuestCart(operation: "add" | "update" | "remove", productId: string, quantity = 1) {
  const items = await withGuestLock(() => operation === "add" ? addToLocalCart(productId)
    : operation === "remove" ? removeLocalCartItem(productId) : updateLocalCartItem(productId, quantity));
  notifyCartChanged();
  return items;
}
