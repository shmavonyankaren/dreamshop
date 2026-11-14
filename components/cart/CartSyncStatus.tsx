"use client";
import { useCart } from "@/components/CartContext";
import { readGuestState } from "@/lib/utils/guest-state";
import { Button } from "@/components/ui/button";
export default function CartSyncStatus() {
  const { syncStatus, retrySync, dismissSaved } = useCart();
  if (syncStatus.state === "idle") return null;
  let saved;
  try { if (typeof window !== "undefined") saved = readGuestState(); } catch { /* Keep the error message visible. */ }
  const conflicts = saved?.settled?.outcome.items.filter((item) => item.reason) ?? [];
  return <div role="status" aria-live="polite" className="ds-panel my-4 w-full space-y-3 p-4 text-sm wrap-anywhere">
    <p className="font-semibold">{syncStatus.message}</p>
    {conflicts.length > 0 && <ul>{conflicts.map((item) => <li key={item.productId}>
      Product {item.productId}: requested {item.requested}, included {item.applied}.
      {item.reason === "PRODUCT_UNAVAILABLE" ? " Product no longer exists."
        : item.reason === "QUANTITY_LIMIT" ? " Maximum quantity reached."
        : item.reason === "ITEM_LIMIT" ? " Cart has 100 products."
        : " Account cart changed; adjust this item in your account cart."}
    </li>)}</ul>}
    {saved?.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
    {(syncStatus.state === "error" || syncStatus.state === "attention" || syncStatus.state === "syncing") &&
      <Button type="button" onClick={() => void retrySync()}>Retry synchronization</Button>}
    {!saved?.pending && !saved?.dirty && (saved?.settled || saved?.warnings.length) ?
      <Button type="button" variant="outline" className="h-auto whitespace-normal text-left" onClick={() => void dismissSaved()}>Keep account cart and discard unresolved guest items</Button> : null}
  </div>;
}
