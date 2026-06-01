"use client";

import {
  useOptimistic,
  useTransition,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useCart } from "@/components/CartContext";

import { useUser } from "@clerk/nextjs";
import SearchAndFilters from "./SearchAndFilters";
import ProductList from "./ProductList";
import { ProductType } from "@/lib/types";
import {
  addToLocalCart,
  getLocalCart,
  removeLocalCartItem,
  updateLocalCartItem,
} from "@/lib/utils/localCart";
import {
  addProductToUserCart,
  fetchCartByUser,
  removeProductFromUserCart,
  updateProductQuantity,
} from "@/lib/utils/cartClient";

export default function ProductsClient({
  products,
}: {
  products: ProductType[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { setCartItemsCount } = useCart();
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [optimisticCart, updateOptimisticCart] = useOptimistic(
    cartItems,
    (
      state,
      action: {
        type: "update" | "increment" | "remove" | "replace";
        productId?: string;
        quantity?: number;
        items?: Record<string, number>;
      },
    ) => {
      switch (action.type) {
        case "update":
          return {
            ...state,
            [action.productId as string]: action.quantity ?? 1,
          };

        case "increment":
          return {
            ...state,
            [action.productId as string]:
              (state[action.productId as string] ?? 0) + 1,
          };

        case "remove": {
          const next = { ...state };
          delete next[action.productId as string];
          return next;
        }

        case "replace":
          return action.items ?? state;
        default:
          return state;
      }
    },
  );

  const [isPending, startTransition] = useTransition();

  const { user, isSignedIn } = useUser();

  const loadCartItems = async () => {
    const currentUserId =
      typeof user?.publicMetadata?.userId === "string"
        ? user.publicMetadata.userId
        : "";

    if (isSignedIn && currentUserId) {
      try {
        const cart = await fetchCartByUser(currentUserId);
        const items = cart?.items || [];
        const map: Record<string, number> = {};

        items.forEach((item: any) => {
          const productId = String(
            item.product?._id ?? item.product?.id ?? item.product ?? "",
          );
          if (productId) {
            map[productId] = item.quantity ?? 1;
          }
        });

        setCartItems(map);
        return;
      } catch (error) {
        console.error("Failed to load user cart items:", error);
      }
    }

    const localItems = getLocalCart();
    const map: Record<string, number> = {};
    localItems.forEach((item) => {
      map[item.productId] = item.quantity;
    });
    setCartItems(map);
  };

  useEffect(() => {
    const count = Object.values(optimisticCart).reduce(
      (total, quantity) => total + quantity,
      0,
    );

    setCartItemsCount(count);
  }, [optimisticCart]);

  useEffect(() => {
    startTransition(() => {
      updateOptimisticCart({ type: "replace", items: cartItems });
    });
  }, [cartItems, updateOptimisticCart, startTransition]);

  const handleAddToCart = async (productId: string | number) => {
    const id = String(productId);
    const currentUserId =
      typeof user?.publicMetadata?.userId === "string"
        ? user.publicMetadata.userId
        : "";

    startTransition(() => {
      updateOptimisticCart({
        type: "increment",
        productId: id,
      });

      setCartItems((prev) => ({
        ...prev,
        [id]: (prev[id] ?? 0) + 1,
      }));
    });

    if (!isSignedIn || !currentUserId) {
      const currentQuantity = cartItems[id] ?? 0;
      if (currentQuantity === 0) {
        addToLocalCart(id);
      } else {
        updateLocalCartItem(id, currentQuantity + 1);
      }
      return;
    }

    try {
      await addProductToUserCart(currentUserId, id, 1);
    } catch (error) {
      console.error("Failed to add product to cart:", error);
    }
  };

  const handleQuantityChange = (
    productId: string | number,
    quantity: number,
  ) => {
    const id = String(productId);

    const currentUserId =
      typeof user?.publicMetadata?.userId === "string"
        ? user.publicMetadata.userId
        : "";

    startTransition(async () => {
      // optimistic UI update
      updateOptimisticCart({
        type: "update",
        productId: id,
        quantity,
      });

      try {
        if (isSignedIn && currentUserId) {
          await updateProductQuantity(currentUserId, id, quantity);
        } else {
          updateLocalCartItem(id, quantity);
        }

        // commit real state
        setCartItems((prev) => ({
          ...prev,
          [id]: quantity,
        }));
      } catch (error) {
        console.error(error);

        // rollback automatically:
        // optimistic state disappears because real state never changed
      }
    });
  };

  const handleRemoveItem = (productId: string | number) => {
    const id = String(productId);

    const currentUserId =
      typeof user?.publicMetadata?.userId === "string"
        ? user.publicMetadata.userId
        : "";

    startTransition(async () => {
      updateOptimisticCart({
        type: "remove",
        productId: id,
      });

      try {
        if (isSignedIn && currentUserId) {
          await removeProductFromUserCart(currentUserId, id);
        } else {
          removeLocalCartItem(id);
        }

        setCartItems((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch (error) {
        console.error(error);

        // rollback automatic
      }
    });
  };

  useEffect(() => {
    loadCartItems();
  }, [isSignedIn, user]);

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
