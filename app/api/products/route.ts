import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connection";
import Product from "@/lib/db/models/product.model";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!ids.length) {
    return NextResponse.json({ products: [] });
  }

  await connectDB();

  const validIds = ids.filter(Types.ObjectId.isValid);
  if (!validIds.length) {
    return NextResponse.json({ products: [] });
  }

  const products = await Product.find({ _id: { $in: validIds } });
  return NextResponse.json({ products: JSON.parse(JSON.stringify(products)) });
}
