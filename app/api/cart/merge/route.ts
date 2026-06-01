import { NextResponse } from "next/server";
import { mergeLocalCartToUserCart } from "@/lib/actions/cart.actions";

export async function POST(req: Request) {
  const body = await req.json();
  const userId = String(body.userId || "");
  const items = Array.isArray(body.items)
    ? body.items.map((item: any) => ({
        productId: String(item.productId || item.id || ""),
        quantity: Number(item.quantity ?? 1),
      }))
    : [];

  if (!userId || !items.length) {
    return NextResponse.json(
      { message: "Missing userId or items" },
      { status: 400 },
    );
  }

  const cart = await mergeLocalCartToUserCart({ userId, items });
  const count = cart?.items?.reduce(
    (total: number, item: any) => total + item.quantity,
    0,
  );

  return NextResponse.json({ count: count ?? 0, cart });
}
