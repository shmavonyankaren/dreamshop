import "server-only";
import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import Cart from "../db/models/cart.model";
import { eligibleProductsByIds } from "../server/product-eligibility";
import { requireCartUser } from "../server/authenticated-user";
import { unavailableProduct } from "../cart-contract";
import { addCartSchema, updateCartSchema, cartItemsSchema, removeCartSchema, mergeCartSchema, CartError, MAX_MERGE_RECEIPTS, MAX_QUANTITY, MAX_CART_ITEMS, type MergeOutcome, type MergeItemOutcome, type CartDTO, type LocalCartItem } from "../cart-contract";

type MergeReceipt = { operationId: string; fingerprint: string; version: number; outcome: MergeOutcome };
type StoredCart = { _id: unknown; __v?: number; mergeReceipts?: MergeReceipt[]; items: { product: { toString(): string }; quantity: number }[] };
async function readCart(user: string): Promise<CartDTO | null> {
  const cart = await Cart.findOne({ user });
  if (!cart) return null;
  const ids = cart.items.map((item: { product: { toString(): string } }) => String(item.product));
  const available = new Map((await eligibleProductsByIds(ids)).map(product => [product._id, product]));
  return { items: cart.items.map((item: { product: { toString(): string }; quantity: number }) => {
    const id = String(item.product), product = available.get(id);
    return product ? { product, quantity: item.quantity } : { product: unavailableProduct(id), quantity: item.quantity, available: false };
  }) };
}
// Server-only entry points always resolve ownership from the session.
export async function getCartByUser() { return readCart(await requireCartUser()); }
export async function getCartItemsCount() {
  const cart = await getCartByUser();
  return cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}
async function requireProducts(items: LocalCartItem[]) {
  const found = await eligibleProductsByIds(items.map(item => item.productId));
  if (found.length !== items.length) throw new CartError(404, "PRODUCT_NOT_FOUND", "One or more products are no longer available.");
}
async function changeCart(user: string, change: (items: LocalCartItem[]) => LocalCartItem[] | Promise<LocalCartItem[]>, create = false) {
  // Compare-and-swap keeps aggregate limits valid across concurrent mutations.
  for (let attempt = 0; attempt < 3; attempt++) {
    const cart: StoredCart | null = await Cart.findOne({ user });
    if (!cart && !create) throw new CartError(404, "CART_NOT_FOUND", "Cart not found.");
    const items = cartItemsSchema.parse(await change(cart?.items.map((item) => ({ productId: item.product.toString(), quantity: item.quantity })) ?? []));
    const storedItems = items.map((item) => ({ product: item.productId, quantity: item.quantity }));
    if (!cart) {
      try { await Cart.create({ user, items: storedItems }); return readCart(user); }
      catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) continue;
        throw error;
      }
    }
    const result = await Cart.updateOne({ _id: cart._id, user, __v: cart.__v ?? { $exists: false } }, { $set: { items: storedItems }, $inc: { __v: 1 } }, { runValidators: true });
    if (result.modifiedCount === 1) return readCart(user);
  }
  throw new CartError(409, "CART_CONFLICT", "Your cart changed. Please retry.");
}
export async function addToCart(input: unknown) {
  const user = await requireCartUser();
  const item = addCartSchema.parse(input);
  return changeCart(user, async (items) => {
    await requireProducts([item]);
    const existing = items.find((entry) => entry.productId === item.productId);
    if (item.expectedQuantity !== undefined && item.expectedQuantity !== (existing?.quantity ?? 0)) throw new CartError(409, "QUANTITY_CONFLICT", "This quantity changed in another view. Please review the latest cart.");
    if (existing) existing.quantity += item.quantity;
    else items.push({ productId: item.productId, quantity: item.quantity });
    return items;
  }, true);
}
export async function mergeLocalCartToUserCart(input: unknown) {
  const user = await requireCartUser();
  const request = mergeCartSchema.parse(input);
  if (request.actorHash) {
    const identity = await auth();
    const actual = createHash("sha256").update(identity.userId ?? "").digest("hex");
    if (request.actorHash !== actual) throw new CartError(409, "SESSION_CHANGED", "Your signed-in account changed. Resume with the original account.");
  }
  const incoming = [...request.items].sort((a, b) => a.productId.localeCompare(b.productId));
  const fingerprint = createHash("sha256").update(JSON.stringify({ items: incoming, parent: request.parentOperationId ?? null })).digest("hex");
  // Old clients have no random operation ID. Content-derived IDs fail closed on
  // replay, preserving their strict all-or-nothing policy during rollout.
  const operationId = request.operationId ?? "legacy-" + fingerprint;
  for (let attempt = 0; attempt < 5; attempt++) {
    const cart: StoredCart | null = await Cart.findOne({ user }).readConcern("majority");
    const receipts = cart?.mergeReceipts ?? [];
    const receipt = receipts.find((entry) => entry.operationId === operationId);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new CartError(409, "OPERATION_REUSED", "This merge ID belongs to a different snapshot.");
      return { cart: await readCart(user), reconciliation: receipt.outcome };
    }
    if (receipts.length >= MAX_MERGE_RECEIPTS) throw new CartError(409, "RECEIPT_CAPACITY", "Automatic cart synchronization needs support. Your guest cart is preserved.");
    const parent = request.parentOperationId ? receipts.find((entry) => entry.operationId === request.parentOperationId) : undefined;
    if (request.parentOperationId && !parent) throw new CartError(409, "PARENT_NOT_FOUND", "Previous synchronization is not available for this account.");
    const items = cartItemsSchema.parse(cart?.items.map((item) => ({ productId: item.product.toString(), quantity: item.quantity })) ?? []);
    const found = await eligibleProductsByIds(incoming.map(item => item.productId));
    const available = new Set<string>(found.map((product: { _id: { toString(): string } }) => product._id.toString()));
    if (!request.operationId) await requireProducts(incoming);
    const desired = new Map(incoming.map((item) => [item.productId, item.quantity]));
    const ids = [...new Set([...desired.keys(), ...(parent?.outcome.items.filter((item) => item.requested > 0 || item.applied > 0).map((item) => item.productId) ?? [])])].sort();
    if (ids.length > 200) throw new CartError(409, "RECONCILIATION_CAPACITY", "Too many unresolved guest changes. Review the saved reconciliation before continuing.");
    const outcomes: MergeItemOutcome[] = [];
    ids.sort((a, b) => (desired.get(a) ?? 0) - (desired.get(b) ?? 0) || a.localeCompare(b));
    for (const productId of ids) {
      const requested = desired.get(productId) ?? 0;
      const previous = parent?.outcome.items.find((item) => item.productId === productId);
      const existing = items.find((item) => item.productId === productId);
      const current = existing?.quantity ?? 0;
      // Unchanged contributions must never be added a second time.
      if (previous && requested === previous.requested) {
        outcomes.push({ ...previous });
        continue;
      }
      if (previous && previous.applied > 0 &&
          (cart?.__v !== parent!.version || current !== previous.after)) {
        outcomes.push({ ...previous, requested, reason: "ACCOUNT_CHANGED" });
        continue;
      }
      const before = previous && previous.applied > 0 ? previous.before : current;
      let applied = Math.min(requested, MAX_QUANTITY - before);
      let reason: MergeItemOutcome["reason"];
      if (requested > 0 && !available.has(productId)) { applied = previous ? Math.min(requested, previous.applied) : 0; reason = "PRODUCT_UNAVAILABLE"; }
      else if (applied < requested) reason = "QUANTITY_LIMIT";
      if (!existing && before + applied > 0 && items.length >= MAX_CART_ITEMS) { applied = 0; reason = "ITEM_LIMIT"; }
      const after = before + applied;
      if (existing) {
        if (after === 0) items.splice(items.indexOf(existing), 1);
        else existing.quantity = after;
      } else if (after > 0) items.push({ productId, quantity: after });
      outcomes.push({ productId, requested, applied, before, after, ...(reason ? { reason } : {}) });
    }
    if (!request.operationId && outcomes.some((item) => item.reason)) throw new CartError(400, "INVALID_INPUT", "The combined cart exceeds cart limits.");
    cartItemsSchema.parse(items);
    const version = cart ? (cart.__v ?? 0) + 1 : 0;
    const outcome: MergeOutcome = { operationId, items: outcomes };
    const nextReceipt = { operationId, fingerprint, version, outcome };
    const storedItems = items.map((item) => ({ product: item.productId, quantity: item.quantity }));
    if (!cart) {
      try {
        await Cart.create([{ user, items: storedItems, mergeReceipts: [nextReceipt] }], { writeConcern: { w: "majority", j: true } });
        return { cart: await readCart(user), reconciliation: outcome };
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) continue;
        throw error;
      }
    }
    const result = await Cart.updateOne(
      { _id: cart._id, user, __v: cart.__v ?? { $exists: false } },
      { $set: { items: storedItems, mergeReceipts: [...receipts, nextReceipt] }, $inc: { __v: 1 } },
      { runValidators: true, writeConcern: { w: "majority", j: true } },
    );
    if (result.modifiedCount === 1) return { cart: await readCart(user), reconciliation: outcome };
  }
  throw new CartError(409, "CART_CONFLICT", "Your cart changed. Please retry the same synchronization.");
}
export async function updateCartItemQuantity(input: unknown) {
  const user = await requireCartUser();
  const item = updateCartSchema.parse(input);
  return changeCart(user, async (items) => {
    const existing = items.find((entry) => entry.productId === item.productId);
    if (!existing) throw new CartError(404, "ITEM_NOT_FOUND", "Product not found in cart.");
    if (item.expectedQuantity !== undefined && item.expectedQuantity !== existing.quantity) throw new CartError(409, "QUANTITY_CONFLICT", "This quantity changed in another view. Please review the latest cart.");
    if (item.quantity > existing.quantity) await requireProducts([item]);
    existing.quantity = item.quantity;
    return items;
  });
}
export async function removeFromCart(input: unknown) {
  const user = await requireCartUser();
  const { productId } = removeCartSchema.parse(input);
  // Deleted products must still be removable.
  return changeCart(user, (items) => items.filter((item) => item.productId !== productId));
}
export async function clearCart() { return changeCart(await requireCartUser(), () => []); }
export async function deleteCart() {
  const user = await requireCartUser();
  // Keep receipt-bearing documents as tombstones: deleting one would permit replay.
  const cart: StoredCart | null = await Cart.findOne({ user });
  if (cart?.mergeReceipts?.length) await changeCart(user, () => []);
  else await Cart.deleteOne({ user, mergeReceipts: { $in: [[], null] } });
  return null;
}
