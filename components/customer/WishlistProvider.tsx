"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartContext";
import type { WishlistDTO } from "@/lib/wishlist-contract";
const empty: WishlistDTO = { products: [], savedIds: [], unavailableIds: [], count: 0 };
type Value = { data: WishlistDTO; loading: boolean; busy: boolean; error: string; refresh: () => void; change: (id: string, action: "add" | "remove") => Promise<void> };
const Context = createContext<Value | null>(null);
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  return <WishlistSession key={user?.id ?? "guest"} signedIn={isLoaded && !!user}>{children}</WishlistSession>;
}
function WishlistSession({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const [data, setData] = useState(empty), [loading, setLoading] = useState(signedIn), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const alive = useRef(true), queue = useRef(Promise.resolve());
  const { refreshVersion } = useCart();
  const request = useCallback((mutation?: { productId: string; action: "add" | "remove" }) => {
    const work = queue.current.then(async () => {
      if (!signedIn || !alive.current) return;
      if (mutation) setBusy(true);
      try {
        const response = await fetch("/api/wishlist", { cache: "no-store", signal: AbortSignal.timeout(15_000), ...(mutation ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mutation) } : {}) });
        const body = await response.json();
        if (!response.ok) { if (alive.current && [401,403,409].includes(response.status)) setData(empty); throw new Error(body.message || "Unable to update wishlist."); }
        if (alive.current) { setData(body); setError(""); }
        if (mutation) { try { localStorage.setItem("dreamshop_wishlist_changed", String(Date.now()) + Math.random()); } catch { /* Server persistence succeeded even if browser storage is disabled. */ } }
      } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : "Unable to load wishlist."); throw error; }
      finally { if (alive.current) { setLoading(false); setBusy(false); } }
    });
    queue.current = work.catch(() => {});
    return work;
  }, [signedIn]);
  const refresh = useCallback(() => { void request().catch(() => {}); }, [request]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (signedIn) refresh(); }, [signedIn, refresh, refreshVersion]);
  useEffect(() => {
    const storage = (event: StorageEvent) => { if (event.key === "dreamshop_wishlist_changed") refresh(); };
    window.addEventListener("storage", storage); window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  return <Context.Provider value={{ data, loading, busy, error, refresh, change: (productId, action) => request({ productId, action }) }}>{children}</Context.Provider>;
}
export function useWishlist() { const context = useContext(Context); if (!context) throw new Error("WishlistProvider is required"); return context; }
