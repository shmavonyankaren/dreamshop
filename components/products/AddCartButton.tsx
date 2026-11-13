"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartContext";
import { addToLocalCart } from "@/lib/utils/localCart";
import { addProductToUserCart } from "@/lib/utils/cartClient";

type AddCartButtonProps = {
  productId: string | number;
  onAdd?: (productId: string | number) => void | Promise<void>;
};

export default function AddCartButton({
  productId,
  onAdd,
}: AddCartButtonProps) {
  const { isSignedIn, isLoaded } = useUser();
  const [error, setError] = useState<string | null>(null);
  const { setCartItemsCount } = useCart();

  const handleAddToCart = async () => {
    if (!isLoaded) return;
    const id = String(productId);
    setError(null);
    try {
      if (onAdd) { await onAdd(productId); return; }
      if (!isSignedIn) {
        const items = addToLocalCart(id);
        setCartItemsCount(items.reduce((sum, item) => sum + item.quantity, 0));
      } else {
        const result = await addProductToUserCart(id);
        setCartItemsCount(result.count);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to add product."); }
  };

  return (
    <>
    <button
      disabled={!isLoaded}
      onClick={handleAddToCart}
      className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand to-accent-ds px-5 py-4 font-semibold text-white transition-all hover:shadow-lg group"
    >
      Add To Cart
      <ShoppingCart className="h-5 w-5 transition-transform group-hover:translate-x-1" />
    </button>
    {error && <p role="alert">{error}</p>}
    </>
  );
}
