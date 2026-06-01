const CART_KEY = "dreamshop_cart";

type LocalCartItem = {
  productId: string;
  quantity: number;
};

export function getLocalCart(): LocalCartItem[] {
  if (typeof window === "undefined") return [];

  const cart = localStorage.getItem(CART_KEY);
  const parsed = cart ? JSON.parse(cart) : [];

  if (!Array.isArray(parsed)) return [];

  return parsed.map((item) => {
    if (typeof item === "string" || typeof item === "number") {
      return { productId: String(item), quantity: 1 };
    }

    return {
      productId: String(item.productId ?? item.id ?? ""),
      quantity:
        typeof item.quantity === "number" && item.quantity > 0
          ? item.quantity
          : 1,
    };
  });
}

export function addToLocalCart(productId: string | number) {
  const cart = getLocalCart();
  const id = String(productId);

  const existingItem = cart.find((item) => item.productId === id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ productId: id, quantity: 1 });
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
}

export function updateLocalCartItem(
  productId: string | number,
  quantity: number,
) {
  const cart = getLocalCart();
  const id = String(productId);
  const updatedCart = cart
    .map((item) =>
      item.productId === id
        ? { ...item, quantity: Math.max(1, quantity) }
        : item,
    )
    .filter((item) => item.quantity > 0);

  localStorage.setItem(CART_KEY, JSON.stringify(updatedCart));
  return updatedCart;
}

export function removeLocalCartItem(productId: string | number) {
  const cart = getLocalCart();
  const id = String(productId);
  const updatedCart = cart.filter((item) => item.productId !== id);

  localStorage.setItem(CART_KEY, JSON.stringify(updatedCart));
  return updatedCart;
}

export function clearLocalCart() {
  localStorage.removeItem(CART_KEY);
}
