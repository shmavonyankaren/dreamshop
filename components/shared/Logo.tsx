import Link from "next/link";
import { ShoppingBag } from "lucide-react";
export default function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2 rounded-lg font-bold tracking-tight"
      aria-label="Dreamshop home"
    >
      <ShoppingBag className="size-8 text-coral" aria-hidden="true" />
      <span className="text-xl sm:text-2xl">Dreamshop</span>
    </Link>
  );
}
