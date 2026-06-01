import { NextResponse } from "next/server";
import { removeFromCart } from "@/lib/actions/cart.actions";

export async function POST(req: Request) {
  const body = await req.json();
  const userId = String(body.userId || "");
  const productId = String(body.productId || "");

  if (!userId || !productId) {
    return NextResponse.json(
      { message: "Missing userId or productId" },
      { status: 400 },
    );
  }

  const cart = await removeFromCart({ userId, productId });
  const count = cart?.items?.reduce(
    (total: number, item: any) => total + item.quantity,
    0,
  );

  return NextResponse.json({ count: count ?? 0, cart });
}
