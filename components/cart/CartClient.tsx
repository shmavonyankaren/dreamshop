"use client";
import { useCart } from "@/components/CartContext";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
import { CartPresentation } from "./CartPresentation";
import { LoadingIndicator, ErrorFeedback } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export default function CartClient() {
  const { cartProducts, cartReady, cartError, cartPending, mutateCart, reloadCart } = useCart();
  return <>
    <CartSyncStatus />
    {cartError && <ErrorFeedback action={<Button onClick={() => { void reloadCart(); }}>Refresh cart</Button>}>{cartError}</ErrorFeedback>}
    {!cartReady ? (!cartError && <LoadingIndicator label="Loading your cart..." />) : <div className="mt-5">
      <CartPresentation products={cartProducts} pending={false} pendingIds={cartPending}
        onQuantityStep={(id, delta) => { void mutateCart(id, { type: "step", delta }).catch(() => {}); }}
        onQuantityChange={(id, quantity, expectedQuantity) => { void mutateCart(id, { type: "set", quantity, expectedQuantity: expectedQuantity! }).catch(() => {}); }}
        onRemove={id => { void mutateCart(id, { type: "remove" }).catch(() => {}); }} />
    </div>}
  </>;
}
