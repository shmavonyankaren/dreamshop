import { NextResponse } from "next/server";
import { updateCartItemQuantity } from "@/lib/actions/cart.actions";

export async function POST(req: Request) {
  const body = await req.json();
  const userId = String(body.userId || "");
  const productId = String(body.productId || "");
  const quantity = Number(body.quantity ?? 0);

  if (!userId || !productId || quantity < 1) {
    return NextResponse.json(
      { message: "Missing userId, productId or invalid quantity" },
      { status: 400 },
    );
  }

  const cart = await updateCartItemQuantity({ userId, productId, quantity });
  const count = cart?.items?.reduce(
    (total: number, item: any) => total + item.quantity,
    0,
  );

  return NextResponse.json({ count: count ?? 0, cart });
}
