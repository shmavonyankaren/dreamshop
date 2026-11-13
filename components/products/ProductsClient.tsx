"use client";
import { useOptimistic, useTransition, useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/CartContext";
import { useUser } from "@clerk/nextjs";
import SearchAndFilters from "./SearchAndFilters";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
import ProductList from "./ProductList";
import { ProductType } from "@/lib/types";
import { getLocalCart, mutateGuestCart } from "@/lib/utils/localCart";
import { addProductToUserCart, fetchCartByUser, removeProductFromUserCart, updateProductQuantity } from "@/lib/utils/cartClient";
export default function ProductsClient({ products }: { products: ProductType[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const { setCartItemsCount, refreshVersion } = useCart();
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [optimisticCart, updateOptimisticCart] = useOptimistic(cartItems, (state, action: { id: string; quantity: number }) => {
    const next = { ...state };
    if (action.quantity === 0) delete next[action.id]; else next[action.id] = action.quantity;
    return next;
  });
  const [, startTransition] = useTransition();
  const { user, isSignedIn, isLoaded } = useUser();
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isLoaded) return;
      try {
        let entries: [string, number][];
        if (isSignedIn && user) {
          const cart = await fetchCartByUser();
          entries = cart?.items.map((item) => [item.product._id, item.quantity]) ?? [];
        } else entries = getLocalCart().map((item) => [item.productId, item.quantity]);
        if (!cancelled) { setCartItems(Object.fromEntries(entries)); setError(null); }
      } catch (error) {
        if (!cancelled) { setCartItems({}); setError(error instanceof Error ? error.message : "Unable to load cart."); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user, refreshVersion]);
  useEffect(() => {
    setCartItemsCount(Object.values(optimisticCart).reduce((sum, quantity) => sum + quantity, 0));
  }, [optimisticCart, setCartItemsCount]);
  const mutate = (productId: string | number, operation: "add" | "update" | "remove", quantity = 1) => {
    if (!isLoaded) return;
    const id = String(productId);
    startTransition(async () => {
      setError(null);
      updateOptimisticCart({ id, quantity: operation === "remove" ? 0 : operation === "add" ? (cartItems[id] ?? 0) + 1 : quantity });
      try {
        if (isSignedIn) {
          const result = operation === "add" ? await addProductToUserCart(id) : operation === "remove" ? await removeProductFromUserCart(id) : await updateProductQuantity(id, quantity);
          setCartItems(Object.fromEntries(result.cart?.items.map((item) => [item.product._id, item.quantity]) ?? []));
        } else {
          const items = await mutateGuestCart(operation, id, quantity);
          setCartItems(Object.fromEntries(items.map((item) => [item.productId, item.quantity])));
        }
      } catch (error) { setError(error instanceof Error ? error.message : "Unable to update cart."); }
    });
  };
  const handleAddToCart = (id: string | number) => mutate(id, "add");
  const handleQuantityChange = (id: string | number, quantity: number) => mutate(id, "update", quantity);
  const handleRemoveItem = (id: string | number) => mutate(id, "remove");
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryLabel =
        typeof product.category === "string"
          ? product.category
          : (product.category?.name ?? "");

      const matchesSearch = product.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesCategory = category === "all" || categoryLabel === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, category]);

  return (
    <section className="flex flex-col justify-start items-start">
      <CartSyncStatus />
      {error && <p role="alert">{error}</p>}
      <SearchAndFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        category={category}
        setCategory={setCategory}
      />

      <ProductList
        products={filteredProducts}
        cartItems={optimisticCart}
        onAdd={handleAddToCart}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemoveItem}
      />
    </section>
  );
}
