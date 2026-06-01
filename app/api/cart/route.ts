import { NextResponse } from "next/server";
import { getCartByUser } from "@/lib/actions/cart.actions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = String(url.searchParams.get("userId") || "");

  if (!userId) {
    return NextResponse.json({ message: "Missing userId" }, { status: 400 });
  }

  const cart = await getCartByUser(userId);
  return NextResponse.json({ cart });
}
