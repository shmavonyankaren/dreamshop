"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { changeStorefrontQuantity, loadCartProducts, type CartProduct, type QuantityAction } from "@/lib/utils/cart-quantity";
import { setCartSession } from "@/lib/utils/cartClient";

export function useCartState(session: string | null | undefined, version: number) {
  const active = useRef(session), request = useRef(0);
  active.current = session;
  const flights = useRef(new Map<string, Promise<void>>());
  const [state, setState] = useState<{ session: typeof session; products: CartProduct[]; ready: boolean; error: string }>({ session, products: [], ready: false, error: "" });
  const [mutationError, setMutationError] = useState<{ session: typeof session; message: string } | null>(null);
  const projected = useRef(new Map<string, number>());
  const [optimistic, setOptimistic] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<string[]>([]);
  const reload = useCallback(async () => {
    if (session === undefined) return;
    const ticket = ++request.current;
    try {
      const products = await loadCartProducts(session);
      if (active.current === session && ticket === request.current) setState({ session, products, ready: true, error: "" });
    } catch (error) {
      if (active.current === session && ticket === request.current) setState(previous => ({ session, products: previous.session === session ? previous.products : [], ready: previous.session === session && previous.ready, error: error instanceof Error ? error.message : "Unable to load your cart." }));
    }
  }, [session]);
  useEffect(() => {
    if (session === undefined) return;
    setCartSession(session);
    void reload();
    const invalidate = () => { request.current++; };
    return invalidate;
  }, [session, version, reload]);
  const mutate = useCallback((productId: string, action: QuantityAction): Promise<void> => {
    if (session === undefined || active.current !== session) return Promise.reject(new Error("Your cart is still loading."));
    const key = `${session}:${productId}`;
    const existing = flights.current.get(key);
    if (existing && (action.type === "add" || action.type === "remove")) return existing;
    if (action.type === "step" || action.type === "set") {
      const current = projected.current.get(key) ?? state.products.find(item => item._id === productId)?.quantity;
      if (current === undefined) return Promise.reject(new Error("Reload your cart before editing this item."));
      const next = action.type === "step" ? current + action.delta : action.quantity;
      if (!Number.isInteger(next) || next < 1 || next > 99) return Promise.resolve();
      projected.current.set(key, next);
      setOptimistic(values => ({ ...values, [key]: next }));
    }
    if (!existing) setPending(ids => [...ids, key]);
    setMutationError(null);
    setState(previous => ({ ...previous, error: "" }));
    const operation: Promise<void> = Promise.resolve().then(async () => {
      try {
        // Every accepted edit runs in order. A failed/ambiguous write cancels its
        // queued successors rather than replaying them against uncertain state.
        await existing;
        if (active.current !== session) throw new Error("Your account changed. Reload your cart.");
        await changeStorefrontQuantity(session, productId, action);
      } catch (error) {
        if (active.current === session) setMutationError({ session, message: error instanceof Error ? error.message : "Unable to update your cart." });
        throw error;
      } finally {
        if (flights.current.get(key) === operation) {
          await reload();
          // More edits may have been queued during the refresh.
          if (flights.current.get(key) === operation) {
            flights.current.delete(key);
            projected.current.delete(key);
            setOptimistic(values => { const next = { ...values }; delete next[key]; return next; });
            setPending(ids => ids.filter(id => id !== key));
          }
        }
      }
    });
    flights.current.set(key, operation);
    return operation;
  }, [session, reload, state.products]);
  return {
    cartProducts: state.session === session ? state.products.map(item => ({ ...item, quantity: optimistic[`${session}:${item._id}`] ?? item.quantity })) : [],
    cartReady: state.session === session && state.ready,
    cartError: mutationError && mutationError.session === session ? mutationError.message : state.session === session ? state.error : "",
    cartPending: pending.filter(key => key.startsWith(`${session}:`)).map(key => key.slice(key.indexOf(":") + 1)),
    reloadCart: () => { setMutationError(null); return reload(); },
    mutateCart: mutate,
  };
}
