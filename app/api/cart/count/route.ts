import { NextResponse } from "next/server";
import { getCartItemsCount } from "@/lib/actions/cart.actions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "";

  if (!userId) {
    return NextResponse.json({ message: "Missing userId" }, { status: 400 });
  }

  const count = await getCartItemsCount(userId);
  return NextResponse.json({ count: count ?? 0 });
}
