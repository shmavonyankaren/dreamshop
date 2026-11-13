"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getLocalCart } from "@/lib/utils/localCart";
import { getCartCount, ensureGuestCartMerged, setCartSession, getCartSyncStatus, dismissGuestConflicts, type SyncStatus } from "@/lib/utils/cartClient";

import { CART_KEY, CART_EVENT, SYNC_EVENT, readGuestState } from "@/lib/utils/guest-state";

type CartContextType = {
  syncStatus: SyncStatus;
  refreshVersion: number;
  retrySync: () => Promise<void>;
  dismissSaved: () => Promise<void>;
  cartItemsCount: number;
  setCartItemsCount: React.Dispatch<React.SetStateAction<number>>;
  increaseCartCount: () => void;
  decreaseCartCount: () => void;
  clearCartCount: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser();
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle", message: "" });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const retrySync = async () => {
    if (!isSignedIn || !user) return;
    try { await ensureGuestCartMerged(user.id); }
    catch { /* The coordinator publishes the recoverable error. */ }
    setRefreshVersion((version) => version + 1);
  };
  const dismissSaved = async () => {
    try { await dismissGuestConflicts(); }
    catch (error) { setSyncStatus({ state: "error", message: error instanceof Error ? error.message : "Unable to dismiss saved items." }); }
  };
  useEffect(() => {
    let cancelled = false;
    const statusChanged = () => setSyncStatus(getCartSyncStatus());
    const refresh = () => {
      setRefreshVersion((version) => version + 1);
      if (isSignedIn) {
        void getCartCount().then((count) => { if (!cancelled) setCartItemsCount(count); }).catch(() => {});
      } else setCartItemsCount(getLocalCart().reduce((sum, item) => sum + item.quantity, 0));
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== CART_KEY) return;
      try {
        const saved = readGuestState();
        setSyncStatus(saved.pending ? { state: "syncing", message: "A cart synchronization is pending. Retry if the other tab closed." }
          : saved.settled || saved.warnings.length ? { state: "attention", message: "Saved guest items need review." }
          : saved.items.length || saved.dirty || !saved.lastCompleted ? { state: "idle", message: "" }
          : { state: "success", message: "Cart synchronized." });
      } catch { setSyncStatus({ state: "error", message: "Saved cart data needs recovery." }); }
      refresh();
    };
    window.addEventListener(SYNC_EVENT, statusChanged);
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener("storage", storageChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(SYNC_EVENT, statusChanged);
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener("storage", storageChanged);
    };
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (isLoaded) setCartSession(isSignedIn && user ? user.id : null);
    const syncCartCount = async () => {
      if (!isLoaded) return;
      try {
        let count = getLocalCart().reduce((sum, item) => sum + item.quantity, 0);
        if (isSignedIn && user) {
          try { await ensureGuestCartMerged(user.id); }
          catch { /* A recoverable merge failure must not hide the account count. */ }
          count = await getCartCount();
        }
        if (!cancelled) setCartItemsCount(count);
      } catch (error) {
        if (!cancelled) setCartItemsCount(0);
        console.error("Unable to synchronize cart:", error);
      }
    };
    void syncCartCount();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user]);

  const increaseCartCount = () => {
    setCartItemsCount((prev) => prev + 1);
  };

  const decreaseCartCount = () => {
    setCartItemsCount((prev) => (prev > 0 ? prev - 1 : 0));
  };

  const clearCartCount = () => {
    setCartItemsCount(0);
  };

  return (
    <CartContext.Provider
      value={{
        syncStatus, refreshVersion, retrySync, dismissSaved,
        cartItemsCount,
        setCartItemsCount,
        increaseCartCount,
        decreaseCartCount,
        clearCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
