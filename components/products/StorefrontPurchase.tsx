"use client";
import { useCart } from "@/components/CartContext";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityControl } from "@/components/cart/QuantityControl";
export function StorefrontPurchase({
  productId,
  title,
}: {
  productId: string;
  title: string;
}) {
  const {
    cartProducts,
    cartReady,
    cartError,
    cartPending,
    mutateCart,
    reloadCart,
  } = useCart();
  const item = cartProducts.find((product) => product._id === productId);
  const busy = cartPending.includes(productId);
  return (
    <div className="space-y-3">
      {item ? (
        <QuantityControl
          quantity={item.quantity}
          title={title}
          disabled={!cartReady}
          pending={busy}
          unavailable={item.available === false}
          onStep={(delta) => {
            void mutateCart(productId, { type: "step", delta }).catch(() => {});
          }}
          onCommit={(quantity, expectedQuantity) => {
            void mutateCart(productId, {
              type: "set",
              quantity,
              expectedQuantity,
            }).catch(() => {});
          }}
        />
      ) : (
        <Button
          type="button"
          className="w-full whitespace-normal"
          disabled={!cartReady || busy}
          onClick={() => {
            void mutateCart(productId, { type: "add" }).catch(() => {});
          }}
          aria-label={`Add ${title} to cart`}
        >
          <ShoppingCart aria-hidden="true" />
          {busy ? "Adding..." : cartReady ? "Add to cart" : "Loading cart..."}
        </Button>
      )}
      {cartError && (
        <div role="alert" className="text-sm text-destructive">
          <p>{cartError}</p>
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={() => {
              void reloadCart();
            }}
          >
            Refresh cart
          </Button>
        </div>
      )}
    </div>
  );
}
