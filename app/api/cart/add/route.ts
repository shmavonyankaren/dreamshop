import { NextResponse } from "next/server";
import { addToCart } from "@/lib/actions/cart.actions";

export async function POST(req: Request) {
  const body = await req.json();
  const userId = String(body.userId || "");
  const productId = String(body.productId || "");
  const quantity = Number(body.quantity ?? 1);

  if (!userId || !productId) {
    return NextResponse.json(
      { message: "Missing userId or productId" },
      { status: 400 },
    );
  }

  const cart = await addToCart({ userId, productId, quantity });
  const count = cart?.items?.reduce(
    (total: number, item: any) => total + item.quantity,
    0,
  );

  return NextResponse.json({ count: count ?? 0, cart });
}
