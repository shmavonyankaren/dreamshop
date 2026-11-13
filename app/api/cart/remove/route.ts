import { removeFromCart } from "@/lib/actions/cart.actions";
import { requireCartUser } from "@/lib/server/authenticated-user";
import { cartResponse, readCartBody } from "@/lib/server/cart-http";
export async function POST(req: Request) {
  return cartResponse(async () => {
    await requireCartUser();
    const cart = await removeFromCart(await readCartBody(req));
    return { cart, count: cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0 };
  });
}
