export type CartApiResponse = {
  count: number;
  cart?: any;
};

export async function fetchProductsByIds(ids: string[]) {
  if (!ids?.length) return [];

  const query = ids.map(encodeURIComponent).join(",");
  const response = await fetch(`/api/products?ids=${query}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch product details");
  }

  return data.products || [];
}

export async function fetchCartByUser(userId: string) {
  const response = await fetch(
    `/api/cart?userId=${encodeURIComponent(userId)}`,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch cart");
  }

  return data.cart;
}

export async function addProductToUserCart(
  userId: string,
  productId: string,
  quantity = 1,
): Promise<CartApiResponse> {
  const response = await fetch("/api/cart/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, productId, quantity }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to add product to cart");
  }

  return {
    count: data.count ?? 0,
    cart: data.cart,
  };
}

export async function updateProductQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartApiResponse> {
  const response = await fetch("/api/cart/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, productId, quantity }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to update cart quantity");
  }

  return {
    count: data.count ?? 0,
    cart: data.cart,
  };
}

export async function removeProductFromUserCart(
  userId: string,
  productId: string,
): Promise<CartApiResponse> {
  const response = await fetch("/api/cart/remove", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, productId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to remove product from cart");
  }

  return {
    count: data.count ?? 0,
    cart: data.cart,
  };
}

export async function mergeLocalCartToUserCart(
  userId: string,
  items: { productId: string; quantity: number }[],
): Promise<CartApiResponse> {
  const response = await fetch("/api/cart/merge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, items }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || "Failed to merge local cart into user cart",
    );
  }

  return {
    count: data.count ?? 0,
    cart: data.cart,
  };
}

export async function getCartCount(userId: string) {
  const response = await fetch(
    `/api/cart/count?userId=${encodeURIComponent(userId)}`,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch cart count");
  }

  return data.count ?? 0;
}
