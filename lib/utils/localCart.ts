import { cartItemsSchema, cartItemSchema, productIdSchema, MAX_CART_ITEMS, MAX_QUANTITY, type LocalCartItem } from "../cart-contract";
const CART_KEY = "dreamshop_cart";
export function getLocalCart(): LocalCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const items = new Map<string, LocalCartItem>();
    for (const raw of parsed) {
      const candidate = typeof raw === "string" || typeof raw === "number"
        ? { productId: String(raw), quantity: 1 }
        : raw && typeof raw === "object" ? { productId: raw.productId ?? raw.id, quantity: raw.quantity ?? 1 } : null;
      const result = cartItemSchema.safeParse(candidate);
      if (!result.success) continue;
      const item = result.data;
      const previous = items.get(item.productId);
      if (previous) previous.quantity = Math.min(MAX_QUANTITY, previous.quantity + item.quantity);
      else if (items.size < MAX_CART_ITEMS) items.set(item.productId, item);
    }
    return [...items.values()];
  } catch { return []; }
}
function save(items: LocalCartItem[]) {
  const valid = cartItemsSchema.parse(items);
  localStorage.setItem(CART_KEY, JSON.stringify(valid));
  return valid;
}
export function addToLocalCart(productId: string | number) {
  const id = productIdSchema.parse(String(productId));
  const items = getLocalCart();
  const existing = items.find((item) => item.productId === id);
  if (existing) existing.quantity++;
  else items.push({ productId: id, quantity: 1 });
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
export function clearLocalCart() { localStorage.removeItem(CART_KEY); }
