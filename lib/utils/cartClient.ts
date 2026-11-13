import type { CartApiResponse, CartDTO, ProductDTO, MergeResponse } from "../cart-contract";
import { readGuestState, writeGuestState, withGuestLock, notifyCartChanged, SYNC_EVENT, type PendingMerge } from "./guest-state";
export type { CartApiResponse } from "../cart-contract";
async function request<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal, ...(body === undefined ? {} : {
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
export function mergeLocalCartToUserCart(operation: PendingMerge) {
  return request<MergeResponse>("/api/cart/merge", operation, AbortSignal.timeout(15_000));
}
export async function getCartCount() {
  return (await request<{ count: number }>("/api/cart/count")).count;
}
export type SyncStatus = { state: "idle" | "syncing" | "success" | "attention" | "error"; message: string };
let status: SyncStatus = { state: "idle", message: "" };
let currentSession: string | null | undefined;
export function setCartSession(session: string | null) { currentSession = session; }
export function getCartSyncStatus() { return status; }
function report(next: SyncStatus) {
  status = next;
  if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new Event(SYNC_EVENT));
}
async function actorFingerprint(session: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const sameItems = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const merges = new Map<string, Promise<void>>();
export function ensureGuestCartMerged(sessionKey: string): Promise<void> {
  const existing = merges.get(sessionKey);
  if (existing) return existing;
  if (currentSession === undefined) currentSession = sessionKey;
  const pending = synchronize(sessionKey).catch((error) => {
    if (currentSession === sessionKey) report({ state: "error", message: error instanceof Error ? error.message : "Synchronization failed. Retry to resume safely." });
    throw error;
  }).finally(() => { merges.delete(sessionKey); });
  merges.set(sessionKey, pending);
  return pending;
}
async function synchronize(sessionKey: string) {
  const actorHash = await actorFingerprint(sessionKey);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (currentSession !== sessionKey) return;
    const operation = await withGuestLock(() => {
      const state = readGuestState();
      const owner = state.pending?.actorHash ?? state.settled?.operation.actorHash;
      if (owner && owner !== actorHash) throw new Error("A saved merge belongs to another signed-in account. Sign in to that account to resume it.");
      if (state.pending) return state.pending;
      if (state.settled && !state.dirty) {
        report({ state: "attention", message: "Some guest items need attention. Review the saved reconciliation details in your cart." });
        return null;
      }
      if (!state.items.length && !state.settled) {
        report(state.warnings.length ? { state: "attention", message: state.warnings[0] } : { state: "idle", message: "" });
        return null;
      }
      const next: PendingMerge = { operationId: crypto.randomUUID(), actorHash, items: state.items,
        ...(state.settled ? { parentOperationId: state.settled.operation.operationId } : {}) };
      writeGuestState({ ...state, pending: next });
      return next;
    });
    if (!operation) return;
    report({ state: "syncing", message: "Synchronizing your cart..." });
    if (currentSession !== sessionKey) return;
    const result = await mergeLocalCartToUserCart(operation);
    if (!result.reconciliation || result.reconciliation.operationId !== operation.operationId) {
      throw new Error("Synchronization acknowledgement was incomplete. Retry safely.");
    }
    if (currentSession !== sessionKey) return;
    const more = await withGuestLock(() => {
      const state = readGuestState();
      // Another tab may already have acknowledged or started a newer operation.
      if (state.pending?.operationId !== operation.operationId) return !!state.pending || state.dirty;
      const changed = !sameItems(state.items, operation.items);
      const conflicts = result.reconciliation.items.filter((item) => item.reason);
      if (!changed && !conflicts.length) {
        writeGuestState({ format: 2, items: [], dirty: false, warnings: state.warnings, recoveryRaw: state.recoveryRaw, lastCompleted: operation.operationId });
      } else {
        writeGuestState({ ...state, pending: undefined, settled: { operation, outcome: result.reconciliation }, dirty: changed });
      }
      report(changed ? { state: "syncing", message: "Synchronizing your newer guest changes..." } : conflicts.length || state.warnings.length ? { state: "attention", message: "Some items could not be fully synchronized. Their saved details are retained for review." }
        : { state: "success", message: "Cart synchronized successfully." });
      return changed;
    });
    notifyCartChanged();
    if (!more) return;
  }
  report({ state: "attention", message: "More guest changes are saved. Retry synchronization to finish." });
}
// Explicit customer acknowledgement, never automatic discard of conflicts.
export async function dismissGuestConflicts() {
  await withGuestLock(() => {
    const state = readGuestState();
    if (state.pending || state.dirty && state.settled) throw new Error("Finish the pending synchronization before dismissing saved items.");
    writeGuestState({ format: 2, items: [], dirty: false, warnings: [] });
  });
  report({ state: "idle", message: "" });
  notifyCartChanged();
}
