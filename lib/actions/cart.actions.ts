import "server-only";
import Cart from "../db/models/cart.model";
import Product from "../db/models/product.model";
import { requireCartUser } from "../server/authenticated-user";
import { PRODUCT_FIELDS, toProductDTO, type ProductRecord } from "../server/product-dto";
import { addCartSchema, cartItemSchema, cartItemsSchema, removeCartSchema, mergeCartSchema, CartError, type CartDTO, type LocalCartItem } from "../cart-contract";

type StoredCart = { _id: unknown; __v?: number; items: { product: { toString(): string }; quantity: number }[] };
async function readCart(user: string): Promise<CartDTO | null> {
  const cart = await Cart.findOne({ user }).populate({ path: "items.product", model: Product, select: PRODUCT_FIELDS, populate: { path: "category", select: "_id name" } });
  if (!cart) return null;
  return { items: (cart.items as { product: ProductRecord | null; quantity: number }[])
    .filter((item): item is { product: ProductRecord; quantity: number } => item.product !== null)
    .map((item) => ({ product: toProductDTO(item.product), quantity: item.quantity })) };
}
// Server-only entry points always resolve ownership from the session.
export async function getCartByUser() { return readCart(await requireCartUser()); }
export async function getCartItemsCount() {
  const cart = await getCartByUser();
  return cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}
async function requireProducts(items: LocalCartItem[]) {
  const found = await Product.find({ _id: { $in: items.map((item) => item.productId) } }).select("_id");
  if (found.length !== items.length) throw new CartError(404, "PRODUCT_NOT_FOUND", "One or more products are no longer available.");
}
async function changeCart(user: string, change: (items: LocalCartItem[]) => LocalCartItem[], create = false) {
  // Compare-and-swap keeps aggregate limits valid across concurrent mutations.
  for (let attempt = 0; attempt < 3; attempt++) {
    const cart: StoredCart | null = await Cart.findOne({ user });
    if (!cart && !create) throw new CartError(404, "CART_NOT_FOUND", "Cart not found.");
    const items = cartItemsSchema.parse(change(cart?.items.map((item) => ({ productId: item.product.toString(), quantity: item.quantity })) ?? []));
    const storedItems = items.map((item) => ({ product: item.productId, quantity: item.quantity }));
    if (!cart) {
      try { await Cart.create({ user, items: storedItems }); return readCart(user); }
      catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) continue;
        throw error;
      }
    }
    const result = await Cart.updateOne({ _id: cart._id, user, __v: cart.__v ?? { $exists: false } }, { $set: { items: storedItems }, $inc: { __v: 1 } }, { runValidators: true });
    if (result.modifiedCount === 1) return readCart(user);
  }
  throw new CartError(409, "CART_CONFLICT", "Your cart changed. Please retry.");
}
export async function addToCart(input: unknown) {
  const user = await requireCartUser();
  const item = addCartSchema.parse(input);
  await requireProducts([item]);
  return changeCart(user, (items) => {
    const existing = items.find((entry) => entry.productId === item.productId);
    if (existing) existing.quantity += item.quantity;
    else items.push(item);
    return items;
  }, true);
}
export async function mergeLocalCartToUserCart(input: unknown) {
  const user = await requireCartUser();
  const { items: incoming } = mergeCartSchema.parse(input);
  await requireProducts(incoming);
  return changeCart(user, (items) => {
    for (const item of incoming) {
      const existing = items.find((entry) => entry.productId === item.productId);
      if (existing) existing.quantity += item.quantity;
      else items.push(item);
    }
    return items;
  }, true);
}
export async function updateCartItemQuantity(input: unknown) {
  const user = await requireCartUser();
  const item = cartItemSchema.parse(input);
  await requireProducts([item]);
  return changeCart(user, (items) => {
    const existing = items.find((entry) => entry.productId === item.productId);
    if (!existing) throw new CartError(404, "ITEM_NOT_FOUND", "Product not found in cart.");
    existing.quantity = item.quantity;
    return items;
  });
}
export async function removeFromCart(input: unknown) {
  const user = await requireCartUser();
  const { productId } = removeCartSchema.parse(input);
  // Deleted products must still be removable.
  return changeCart(user, (items) => items.filter((item) => item.productId !== productId));
}
export async function clearCart() { return changeCart(await requireCartUser(), () => []); }
export async function deleteCart() {
  await Cart.deleteOne({ user: await requireCartUser() });
  return null;
}
