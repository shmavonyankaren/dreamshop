import { currentUser } from "@clerk/nextjs/server";
import { getCartByUser } from "@/lib/actions/cart.actions";
import CartClient from "@/components/cart/CartClient";

export default async function CartPage() {
  const user = await currentUser();

  if (!user) {
    return <CartClient />;
  }

  const userId = user.publicMetadata.userId as string;

  const cart = await getCartByUser(userId);

  return <CartClient initialCart={cart} />;
}
