"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getLocalCart } from "@/lib/utils/localCart";
import { getCartCount, ensureGuestCartMerged } from "@/lib/utils/cartClient";

type CartContextType = {
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

  useEffect(() => {
    let cancelled = false;
    const syncCartCount = async () => {
      if (!isLoaded) return;
      try {
        let count = getLocalCart().reduce((sum, item) => sum + item.quantity, 0);
        if (isSignedIn && user) {
          await ensureGuestCartMerged(user.id);
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
