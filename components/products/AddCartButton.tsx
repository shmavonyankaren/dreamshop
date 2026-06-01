"use client";

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
  const { user, isSignedIn } = useUser();
  const { increaseCartCount, setCartItemsCount } = useCart();

  const handleAddToCart = async () => {
    const id = String(productId);

    if (onAdd) {
      await onAdd(productId);
      return;
    }

    if (!isSignedIn || !user) {
      addToLocalCart(id);
      increaseCartCount();
      return;
    }

    const userId = user.publicMetadata?.userId as string | undefined;
    if (!userId) {
      addToLocalCart(id);
      increaseCartCount();
      return;
    }

    try {
      const result = await addProductToUserCart(userId, id);
      if (typeof result?.count === "number") {
        setCartItemsCount(result.count);
      } else {
        increaseCartCount();
      }
    } catch (error) {
      console.error("Unable to add product to cart:", error);
    }
  };

  return (
    <button
      onClick={handleAddToCart}
      className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand to-accent-ds px-5 py-4 font-semibold text-white transition-all hover:shadow-lg group"
    >
      Add To Cart
      <ShoppingCart className="h-5 w-5 transition-transform group-hover:translate-x-1" />
    </button>
  );
}
