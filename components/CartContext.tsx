"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getLocalCart } from "@/lib/utils/localCart";
import { recoverAuthenticatedIdentity } from "@/lib/utils/identityClient";
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
  const router = useRouter();
  const userId = isSignedIn ? user?.id : undefined;
  const activeSession = useRef<string | undefined>(undefined);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle", message: "" });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const synchronizeAccount = useCallback(async (id: string, isCurrent: () => boolean) => {
    setSyncStatus({ state: "idle", message: "" });
    const loadingTimer = setTimeout(() => {
      if (isCurrent()) setSyncStatus({ state: "syncing", message: "Synchronizing your account..." });
    }, 500);
    try { await recoverAuthenticatedIdentity(id); }
    catch {
      if (isCurrent()) setSyncStatus({ state: "error", message: "Account synchronization failed. Retry synchronization to recover your account." });
      return;
    } finally { clearTimeout(loadingTimer); }
    if (!isCurrent()) return;
    // Refresh server components independently of cart reconciliation success.
    router.refresh();
    setRefreshVersion(version => version + 1);
    setSyncStatus({ state: "idle", message: "" });
    try {
      await ensureGuestCartMerged(id);
      if (isCurrent()) setSyncStatus(getCartSyncStatus());
    } catch (error) {
      if (isCurrent()) setSyncStatus({ state: "error", message: error instanceof Error ? error.message : "Cart synchronization failed. Please retry." });
    }
    if (!isCurrent()) return;
    try {
      const count = await getCartCount();
      if (isCurrent()) setCartItemsCount(count);
    } catch {
      if (isCurrent()) setSyncStatus({ state: "error", message: "Your account is synchronized, but the cart could not be loaded. Please retry." });
    }
  }, [router]);
  const retrySync = async () => {
    if (!userId) return;
    await synchronizeAccount(userId, () => activeSession.current === userId);
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
    activeSession.current = userId;
    if (isLoaded) setCartSession(userId ?? null);
    const syncCartCount = async () => {
      if (!isLoaded) return;
      if (userId) return synchronizeAccount(userId, () => !cancelled);
      setSyncStatus({ state: "idle", message: "" });
      try { setCartItemsCount(getLocalCart().reduce((sum, item) => sum + item.quantity, 0)); }
      catch { setSyncStatus({ state: "error", message: "Saved cart data needs recovery." }); }
    };
    void syncCartCount();
    return () => { cancelled = true; activeSession.current = undefined; };
  }, [isLoaded, userId, synchronizeAccount]);

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
