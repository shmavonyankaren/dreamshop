"use client";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartContext";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
import ProductList from "@/components/products/ProductList";
import type { ProductDTO } from "@/lib/cart-contract";
import { getLocalCart, mutateGuestCart } from "@/lib/utils/localCart";
import { fetchCartByUser, fetchProductsByIds, removeProductFromUserCart, updateProductQuantity } from "@/lib/utils/cartClient";
type CartProduct = ProductDTO & { quantity: number };
type Action = { type: "update" | "remove"; productId: string; quantity?: number };
export default function CartClient() {
  const [cartProducts, setCartProducts] = useState<CartProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { user, isSignedIn, isLoaded } = useUser();
  const { setCartItemsCount, refreshVersion } = useCart();
  const [optimisticProducts, updateOptimisticProducts] = useOptimistic(cartProducts, (state, action: Action) =>
    action.type === "remove" ? state.filter((item) => item._id !== action.productId)
      : state.map((item) => item._id === action.productId ? { ...item, quantity: action.quantity! } : item));
  useEffect(() => {
    setCartItemsCount(optimisticProducts.reduce((sum, item) => sum + item.quantity, 0));
  }, [optimisticProducts, setCartItemsCount]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isLoaded) return;
      setLoading(true);
      setError(null);
      try {
        let products: CartProduct[];
        if (isSignedIn && user) {
          const cart = await fetchCartByUser();
          products = cart?.items.map((item) => ({ ...item.product, quantity: item.quantity })) ?? [];
        } else {
          const local = getLocalCart();
          products = (await fetchProductsByIds(local.map((item) => item.productId))).map((product) => ({ ...product, quantity: local.find((item) => item.productId === product._id)!.quantity }));
        }
        if (!cancelled) setCartProducts(products);
      } catch (error) {
        if (!cancelled) { setCartProducts([]); setError(error instanceof Error ? error.message : "Unable to load cart."); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user, refreshVersion]);
  const mutate = (productId: string | number, quantity?: number) => {
    if (!isLoaded) return;
    const id = String(productId);
    startTransition(async () => {
      setError(null);
      updateOptimisticProducts({ type: quantity === undefined ? "remove" : "update", productId: id, quantity });
      try {
        if (isSignedIn) {
          const result = quantity === undefined ? await removeProductFromUserCart(id) : await updateProductQuantity(id, quantity);
          setCartProducts(result.cart?.items.map((item) => ({ ...item.product, quantity: item.quantity })) ?? []);
        } else {
          await mutateGuestCart(quantity === undefined ? "remove" : "update", id, quantity);
          setCartProducts((items) => quantity === undefined ? items.filter((item) => item._id !== id) : items.map((item) => item._id === id ? { ...item, quantity } : item));
        }
      } catch (error) { setError(error instanceof Error ? error.message : "Unable to update cart."); }
    });
  };
  const handleQuantityChange = (id: string | number, quantity: number) => mutate(id, quantity);
  const handleRemove = (id: string | number) => mutate(id);
  if (loading) {
    return <p className="p-12">Loading cart...</p>;
  }

  if (error) return <p role="alert" className="p-12">{error} <button onClick={() => window.location.reload()}>Retry</button></p>;

  if (optimisticProducts.length === 0) {
    return <div><CartSyncStatus /><p className="p-12">Your cart is empty.</p></div>;
  }

  return (
    <>
    <CartSyncStatus />
    <div className="grow flex justify-center items-center p-12">
      <ProductList
        products={optimisticProducts}
        isCartView
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemove}
      />
    </div>
    </>
  );
}
