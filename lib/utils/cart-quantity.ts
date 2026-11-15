import { cartItemSchema, MAX_QUANTITY, productIdSchema, unavailableProduct, type ProductDTO, type CartDTO } from "../cart-contract";
import { addProductToUserCart, updateProductQuantity, removeProductFromUserCart, fetchCartByUser, fetchProductsByIds, getCartSession, CartRequestError } from "./cartClient";
import { readGuestState, withGuestLock, notifyCartChanged } from "./guest-state";
import { addToLocalCart, updateLocalCartItem, removeLocalCartItem } from "./localCart";
export type CartProduct = ProductDTO & { quantity: number; available?: boolean };
type QuantityEdit = { type: "step"; delta: -1 | 1 } | { type: "set"; quantity: number; expectedQuantity: number };
export type QuantityAction = { type: "add" } | { type: "remove" } | QuantityEdit;
const flatten = (cart: CartDTO | null): CartProduct[] => cart?.items.map(item => ({ ...item.product, quantity: item.quantity, available: item.available })) ?? [];
function checkSession(session: string | null) {
  if (getCartSession() !== session) throw new Error("Your account changed. Reload your cart before editing it.");
}
export async function loadCartProducts(session: string | null): Promise<CartProduct[]> {
  checkSession(session);
  if (session) return flatten(await fetchCartByUser());
  const items = readGuestState().items;
  const found = new Map((await fetchProductsByIds(items.map(item => item.productId))).map(product => [product._id, product]));
  return items.map(item => ({ ...(found.get(item.productId) ?? unavailableProduct(item.productId)), quantity: item.quantity, available: found.has(item.productId) }));
}
function targetQuantity(current: number, action: QuantityEdit) {
  if (!current) throw new Error("This item was removed. Add it again to change its quantity.");
  if (action.type === "set" && current !== action.expectedQuantity) throw new Error("This quantity changed in another view. Review the latest quantity before editing again.");
  const target = action.type === "step" ? current + action.delta : action.quantity;
  if (!Number.isInteger(target) || target < 1 || target > MAX_QUANTITY) throw new Error("Choose a whole quantity from 1 to 99.");
  return target;
}
let localQueue: Promise<unknown> = Promise.resolve();
async function withQuantityLock<T>(session: string | null, operation: () => Promise<T>): Promise<T> {
  if (navigator.locks) return await navigator.locks.request("dreamshop-cart-quantity", operation);
  if (!session) return Promise.reject(new Error("Reliable guest cart updates require a browser with Web Locks on HTTPS. Your cart is preserved."));
  // Authenticated requests still have server CAS when Web Locks are unavailable.
  const next = localQueue.then(operation);
  localQueue = next.catch(() => {});
  return next;
}
// Web Locks coordinate read/modify/write across tabs. Server CAS remains authoritative.
export async function changeStorefrontQuantity(session: string | null, productId: string, action: QuantityAction): Promise<void> {
  productIdSchema.parse(productId);
  try {
    await withQuantityLock(session, async () => {
      checkSession(session);
      if (!session) {
        await withGuestLock(async () => {
          checkSession(session);
          const current = readGuestState().items.find(item => item.productId === productId)?.quantity ?? 0;
          if (action.type === "remove") { removeLocalCartItem(productId); return; }
          if (action.type === "add" && current) return;
          const quantity = action.type === "add" ? 1 : targetQuantity(current, action);
          if (quantity > current && !(await fetchProductsByIds([productId])).length) throw new Error("This product is currently unavailable.");
          checkSession(session);
          if (action.type === "add") addToLocalCart(productId, quantity); else updateLocalCartItem(productId, quantity);
        });
        return;
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const cart = await fetchCartByUser();
        checkSession(session);
        const current = cart?.items.find(item => item.product._id === productId)?.quantity ?? 0;
        if (action.type === "remove") { if (current) await removeProductFromUserCart(productId); return; }
        if (action.type === "add" && current) return;
        try {
          if (action.type === "add") await addProductToUserCart(productId, 1, 0);
          else {
            const quantity = targetQuantity(current, action);
            cartItemSchema.parse({ productId, quantity });
            if (quantity !== current) await updateProductQuantity(productId, quantity, current);
          }
          return;
        } catch (error) {
          // Retry only known rejected CAS writes. Never replay an ambiguous network failure.
          if (!(error instanceof CartRequestError) || error.code !== "QUANTITY_CONFLICT" || action.type === "set" || attempt === 2) throw error;
        }
      }
    });
  } finally {
    // A lost response may still have committed; every tab must re-read.
    notifyCartChanged();
  }
}
