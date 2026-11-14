import { connectDB } from "@/lib/db/connection";
import StoreImage from "@/lib/db/models/store-image.model";
import { productIdSchema } from "@/lib/cart-contract";
import { canReadStoreImage } from "@/lib/server/image-visibility";
export const runtime = "nodejs";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = productIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  try {
    await connectDB();
    const image = await StoreImage.findById(parsed.data).select("+data mime store").maxTimeMS(5000);
    if (!image) return new Response(null, { status: 404 });
    if (!await canReadStoreImage(parsed.data, String(image.store))) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return new Response(new Uint8Array(image.data), { headers: { "Content-Type": image.mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "private, no-store" } });
  } catch { return new Response(null, { status: 503 }); }
}
