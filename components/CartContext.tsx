"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { clearLocalCart, getLocalCart } from "@/lib/utils/localCart";
import { getCartCount, mergeLocalCartToUserCart } from "@/lib/utils/cartClient";

type CartContextType = {
  cartItemsCount: number;
  setCartItemsCount: React.Dispatch<React.SetStateAction<number>>;
  increaseCartCount: () => void;
  decreaseCartCount: () => void;
  clearCartCount: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn } = useUser();
  const [cartItemsCount, setCartItemsCount] = useState(0);

  useEffect(() => {
    const syncCartCount = async () => {
      const localCart = getLocalCart();

      if (!isSignedIn) {
        setCartItemsCount(localCart.length);
        return;
      }

      const userId = user?.publicMetadata?.userId as string | undefined;

      if (!userId) {
        setCartItemsCount(localCart.length);
        return;
      }

      if (localCart.length > 0) {
        try {
          const mergeResult = await mergeLocalCartToUserCart(userId, localCart);
          clearLocalCart();
          setCartItemsCount(mergeResult.count ?? 0);
          return;
        } catch (error) {
          console.error("Failed to merge local cart to user cart:", error);
        }
      }

      try {
        const count = await getCartCount(userId);
        setCartItemsCount(count ?? localCart.length);
      } catch (error) {
        console.error("Failed to fetch cart count:", error);
      }
    };

    syncCartCount();
  }, [isSignedIn, user]);

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
