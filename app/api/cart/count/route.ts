import { getCartItemsCount } from "@/lib/actions/cart.actions";
import { cartResponse } from "@/lib/server/cart-http";
export async function GET() { return cartResponse(async () => ({ count: await getCartItemsCount() })); }
