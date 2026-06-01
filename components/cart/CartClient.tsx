"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";

import { useUser } from "@clerk/nextjs";

import { useCart } from "@/components/CartContext";
import ProductList from "@/components/products/ProductList";

import {
  clearLocalCart,
  getLocalCart,
  removeLocalCartItem,
  updateLocalCartItem,
} from "@/lib/utils/localCart";

import {
  fetchCartByUser,
  fetchProductsByIds,
  mergeLocalCartToUserCart,
  removeProductFromUserCart,
  updateProductQuantity,
} from "@/lib/utils/cartClient";

type CartClientProps = {
  initialCart?: any;
};

type OptimisticAction =
  | {
      type: "update";
      productId: string;
      quantity: number;
    }
  | {
      type: "remove";
      productId: string;
    };

export default function CartClient({ initialCart }: CartClientProps) {
  const [cartProducts, setCartProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [, startTransition] = useTransition();

  const { user, isSignedIn } = useUser();
  const { setCartItemsCount } = useCart();

  const getProductId = (product: any) =>
    String(product._id ?? product.id ?? "");

  const [optimisticProducts, updateOptimisticProducts] = useOptimistic(
    cartProducts,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "update":
          return state.map((item) => {
            const currentId = getProductId(item);

            return currentId === action.productId
              ? {
                  ...item,
                  quantity: action.quantity,
                }
              : item;
          });

        case "remove":
          return state.filter(
            (item) => getProductId(item) !== action.productId,
          );

        default:
          return state;
      }
    },
  );

  const updateCountFromProducts = (products: any[]) => {
    const count = products.reduce(
      (total, product) => total + (product.quantity ?? 1),
      0,
    );

    setCartItemsCount(count);
  };

  useEffect(() => {
    updateCountFromProducts(optimisticProducts);
  }, [optimisticProducts]);

  const loadLocalCart = async (localItems: any[]) => {
    if (!localItems.length) {
      setCartProducts([]);
      return;
    }

    const productIds = localItems.map((item) => item.productId);

    const products = await fetchProductsByIds(productIds);

    const merged = products.map((product: any) => {
      const id = getProductId(product);

      const localItem = localItems.find((item) => item.productId === id);

      return {
        ...product,
        quantity: localItem?.quantity ?? 1,
      };
    });

    setCartProducts(merged);
  };

  useEffect(() => {
    const loadCart = async () => {
      if (initialCart) {
        const products =
          initialCart.items?.map((item: any) => ({
            ...item.product,
            quantity: item.quantity,
          })) || [];

        setCartProducts(products);
        setLoading(false);

        return;
      }

      const localItems = getLocalCart();

      const userId = user?.publicMetadata?.userId as string | undefined;

      if (isSignedIn && userId) {
        if (localItems.length > 0) {
          try {
            const merged = await mergeLocalCartToUserCart(userId, localItems);

            clearLocalCart();

            const mergedProducts =
              merged?.cart?.items?.map((item: any) => ({
                ...item.product,
                quantity: item.quantity,
              })) || [];

            setCartProducts(mergedProducts);
            setLoading(false);

            return;
          } catch (error) {
            console.error("Failed to merge local cart to user cart:", error);
          }
        }

        try {
          const cart = await fetchCartByUser(userId);

          const products =
            cart?.items?.map((item: any) => ({
              ...item.product,
              quantity: item.quantity,
            })) || [];

          setCartProducts(products);
          setLoading(false);

          return;
        } catch (error) {
          console.error("Failed to load user cart:", error);
        }
      }

      try {
        await loadLocalCart(localItems);
      } catch (error) {
        console.error("Failed to load local cart products:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [initialCart, isSignedIn, user]);

  const handleQuantityChange = (
    productId: string | number,
    quantity: number,
  ) => {
    const id = String(productId);

    const nextQuantity = Math.max(1, quantity);

    const userId =
      isSignedIn && typeof user?.publicMetadata?.userId === "string"
        ? user.publicMetadata.userId
        : undefined;

    startTransition(async () => {
      // optimistic update
      updateOptimisticProducts({
        type: "update",
        productId: id,
        quantity: nextQuantity,
      });

      try {
        // server cart
        if (userId) {
          const updated = await updateProductQuantity(userId, id, nextQuantity);

          const products =
            updated?.cart?.items?.map((item: any) => ({
              ...item.product,
              quantity: item.quantity,
            })) || [];

          setCartProducts(products);

          return;
        }

        // local cart
        updateLocalCartItem(id, nextQuantity);

        setCartProducts((prev) =>
          prev.map((item) => {
            const currentId = getProductId(item);

            return currentId === id
              ? {
                  ...item,
                  quantity: nextQuantity,
                }
              : item;
          }),
        );
      } catch (error) {
        console.error("Unable to update cart quantity:", error);
      }
    });
  };

  const handleRemove = (productId: string | number) => {
    const id = String(productId);

    const userId =
      isSignedIn && typeof user?.publicMetadata?.userId === "string"
        ? user.publicMetadata.userId
        : undefined;

    startTransition(async () => {
      // optimistic remove
      updateOptimisticProducts({
        type: "remove",
        productId: id,
      });

      try {
        // server cart
        if (userId) {
          const updated = await removeProductFromUserCart(userId, id);

          const products =
            updated?.cart?.items?.map((item: any) => ({
              ...item.product,
              quantity: item.quantity,
            })) || [];

          setCartProducts(products);

          return;
        }

        // local cart
        removeLocalCartItem(id);

        setCartProducts((prev) =>
          prev.filter((item) => getProductId(item) !== id),
        );
      } catch (error) {
        console.error("Unable to remove cart item:", error);
      }
    });
  };

  if (loading) {
    return <p className="p-12">Loading cart...</p>;
  }

  if (optimisticProducts.length === 0) {
    return <p className="p-12">Your cart is empty.</p>;
  }

  return (
    <div className="grow flex justify-center items-center p-12">
      <ProductList
        products={optimisticProducts}
        isCartView
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemove}
      />
    </div>
  );
}
