import { z } from "zod";
import { cartItemsSchema, cartItemSchema, MAX_CART_ITEMS, MAX_QUANTITY, operationIdSchema, type LocalCartItem, type MergeOutcome } from "../cart-contract";

export const CART_KEY = "dreamshop_cart";
export const CART_EVENT = "dreamshop-cart-changed";
export const SYNC_EVENT = "dreamshop-cart-sync";
export type PendingMerge = {
  operationId: string;
  actorHash: string;
  items: LocalCartItem[];
  parentOperationId?: string;
};
export type GuestState = {
  format: 2;
  items: LocalCartItem[];
  pending?: PendingMerge;
  settled?: { operation: PendingMerge; outcome: MergeOutcome };
  dirty: boolean;
  warnings: string[];
  recoveryRaw?: string;
  lastCompleted?: string;
};
const pendingSchema = z.object({ operationId: operationIdSchema, actorHash: z.string().regex(/^[a-f0-9]{64}$/), items: cartItemsSchema, parentOperationId: operationIdSchema.optional() }).strict();
const outcomeSchema = z.object({ operationId: z.string(), items: z.array(z.object({
  productId: z.string(), requested: z.number(), applied: z.number(), before: z.number(), after: z.number(),
  reason: z.enum(["PRODUCT_UNAVAILABLE", "QUANTITY_LIMIT", "ITEM_LIMIT", "ACCOUNT_CHANGED"]).optional(),
})) });
const stateSchema = z.object({ format: z.literal(2), items: cartItemsSchema, pending: pendingSchema.optional(),
  settled: z.object({ operation: pendingSchema, outcome: outcomeSchema }).optional(), dirty: z.boolean(),
  warnings: z.array(z.string()), recoveryRaw: z.string().optional(), lastCompleted: operationIdSchema.optional(),
});

export function readGuestState(): GuestState {
  const raw = localStorage.getItem(CART_KEY);
  const empty: GuestState = { format: 2, items: [], dirty: true, warnings: [] };
  if (!raw) return empty;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return { ...empty, warnings: ["Saved guest data is damaged and has been preserved for recovery."], recoveryRaw: raw }; }
  if (!Array.isArray(parsed)) {
    const result = stateSchema.safeParse(parsed);
    if (result.success) return result.data;
    // Never overwrite an unreadable operation record: it might already be committed.
    throw new Error("Saved cart synchronization data needs recovery. It has not been erased.");
  }
  const items = new Map<string, LocalCartItem>();
  const warnings: string[] = [];
  for (const entry of parsed) {
    const candidate = typeof entry === "string" || typeof entry === "number"
      ? { productId: String(entry), quantity: 1 }
      : entry && typeof entry === "object" ? { productId: entry.productId ?? entry.id, quantity: entry.quantity ?? 1 } : null;
    const result = cartItemSchema.safeParse(candidate);
    if (!result.success) { warnings.push("An invalid saved item needs attention; its original data is retained."); continue; }
    const previous = items.get(result.data.productId);
    if (previous) {
      const quantity = previous.quantity + result.data.quantity;
      previous.quantity = Math.min(MAX_QUANTITY, quantity);
      if (quantity > MAX_QUANTITY) warnings.push("A saved quantity was limited to 99; the original data is retained.");
    } else if (items.size < MAX_CART_ITEMS) items.set(result.data.productId, result.data);
    else warnings.push("Saved items beyond the 100-product limit are retained for review.");
  }
  return { ...empty, items: [...items.values()], warnings, ...(warnings.length ? { recoveryRaw: raw } : {}) };
}
export function writeGuestState(state: GuestState) {
  localStorage.setItem(CART_KEY, JSON.stringify(stateSchema.parse(state)));
}
export function notifyCartChanged() {
  if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new Event(CART_EVENT));
}
export async function withGuestLock<T>(operation: () => T | Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return Promise.reject(new Error("Reliable cart synchronization requires a browser with Web Locks on HTTPS. Your cart is preserved."));
  }
  return await navigator.locks.request("dreamshop-guest-cart-v2", operation);
}
