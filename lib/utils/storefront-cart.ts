import { cartItemSchema } from "../cart-contract";
import { addProductToUserCart } from "./cartClient";
import { addGuestCartQuantity } from "./localCart";
import { notifyCartChanged } from "./guest-state";
export async function addStorefrontItem(signedIn: boolean, productId: string, quantity: number) {
  const item = cartItemSchema.parse({ productId, quantity });
  if (signedIn) { await addProductToUserCart(item.productId, item.quantity); notifyCartChanged(); }
  else await addGuestCartQuantity(item.productId, item.quantity);
}
