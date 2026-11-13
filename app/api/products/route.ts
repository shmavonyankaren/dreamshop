import { z } from "zod";
import { connectDB } from "@/lib/db/connection";
import Product from "@/lib/db/models/product.model";
import { MAX_CART_ITEMS, productIdSchema } from "@/lib/cart-contract";
import { cartResponse } from "@/lib/server/cart-http";
import { PRODUCT_FIELDS, toProductDTO, type ProductRecord } from "@/lib/server/product-dto";
export async function GET(req: Request) {
  return cartResponse(async () => {
    const raw = new URL(req.url).searchParams.get("ids");
    const ids = z.array(productIdSchema).max(MAX_CART_ITEMS).parse(raw ? raw.split(",") : []);
    if (!ids.length) return { products: [] };
    await connectDB();
    const products = await Product.find({ _id: { $in: [...new Set(ids)] } }).select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" });
    return { products: products.map((product: ProductRecord) => toProductDTO(product)) };
  });
}
