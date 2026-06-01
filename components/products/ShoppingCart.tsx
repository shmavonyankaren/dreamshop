"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/CartContext";

export default function ShoppingCart() {
  const { cartItemsCount } = useCart();

  return (
    <div>
      <Link href="/cart">
        <button className="relative cursor-pointer rounded-full p-2.5 text-accent-dim shadow-sm transition-all">
          <span className="absolute right-0 -top-1 text-err-fg rounded-full bg-surface h-5 w-5 flex text-center justify-center items-center">
            {cartItemsCount}
          </span>
          <ShoppingBag className="h-5 w-5" color="var(--ds-icon-accent)" />
        </button>
      </Link>
    </div>
  );
}
