"use client";
import { useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_QUANTITY } from "@/lib/cart-contract";
import { addStorefrontItem } from "@/lib/utils/storefront-cart";
export function StorefrontPurchase({ productId, title, quantitySelector = false }: { productId: string; title: string; quantitySelector?: boolean }) {
  const { isLoaded, isSignedIn } = useUser();
  const [quantity, setQuantity] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  async function add() {
    if (!isLoaded || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { await addStorefrontItem(!!isSignedIn, productId, quantity); toast.success(`${quantity} × ${title} added to cart`); }
    catch { setError("Could not add this item. Check your connection and cart quantity, then try again."); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className="space-y-3">{quantitySelector && <div className="space-y-2"><p className="text-sm font-semibold">Quantity</p><div className="inline-flex items-center rounded-xl border border-input bg-card"><Button variant="ghost" size="icon" disabled={busy || quantity <= 1} aria-label="Decrease quantity" onClick={() => setQuantity(q => q - 1)}><Minus /></Button><input aria-label="Quantity" type="number" min={1} max={MAX_QUANTITY} value={quantity} disabled={busy} onChange={event => { const n = Number(event.target.value); if (Number.isInteger(n) && n >= 1 && n <= MAX_QUANTITY) setQuantity(n); }} className="w-16 bg-transparent text-center tabular-nums" /><Button variant="ghost" size="icon" disabled={busy || quantity >= MAX_QUANTITY} aria-label="Increase quantity" onClick={() => setQuantity(q => q + 1)}><Plus /></Button></div></div>}<Button className="w-full whitespace-normal" disabled={!isLoaded || busy} onClick={add} aria-label={`Add ${title} to cart`}><ShoppingCart aria-hidden="true" />{busy ? "Adding…" : "Add to cart"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
