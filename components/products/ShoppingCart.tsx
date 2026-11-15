"use client";
import { ShoppingCart as CartIcon } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/CartContext";
export default function ShoppingCart() {
  const { cartItemsCount } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={"Shopping cart, " + cartItemsCount + " items"}
      className="relative flex size-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
    >
      <CartIcon className="size-5" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="absolute right-0 top-0 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-white"
      >
        {cartItemsCount > 99 ? "99+" : cartItemsCount}
      </span>
    </Link>
  );
}
