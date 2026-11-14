import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import { eligibleProductsByIds } from "@/lib/server/product-eligibility";
import { MAX_CART_ITEMS, productIdSchema } from "@/lib/cart-contract";
import { cartResponse } from "@/lib/server/cart-http";
export async function GET(req: Request) {
  return cartResponse(async () => {
    const raw = new URL(req.url).searchParams.get("ids");
    const ids = z.array(productIdSchema).max(MAX_CART_ITEMS).parse(raw ? raw.split(",") : []);
    if (!ids.length) return { products: [] };
    await connectDB();
    const products = await eligibleProductsByIds(ids);
    return { products: products };
  });
}
