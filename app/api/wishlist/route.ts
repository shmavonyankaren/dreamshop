import { ZodError } from "zod";
import { CartError } from "@/lib/cart-contract";
import { getWishlist, mutateWishlist } from "@/lib/server/wishlist-service";
import { readCartBody } from "@/lib/server/cart-http";
const headers = { "Cache-Control": "private, no-store" };
async function response(operation: () => Promise<unknown>) {
  try { return Response.json(await operation(), { headers }); }
  catch (error) { return Response.json({ message: error instanceof CartError ? error.message : error instanceof ZodError ? "Invalid wishlist request." : "Unable to load or update your wishlist. Please retry." }, { status: error instanceof CartError ? error.status : error instanceof ZodError ? 400 : 500, headers }); }
}
export async function GET(req: Request) {
  return response(async () => { if (new URL(req.url).search) throw new CartError(400, "INVALID_INPUT", "Wishlist queries do not accept user identifiers or filters."); return getWishlist(); });
}
export async function POST(req: Request) {
  return response(async () => {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) throw new CartError(403, "INVALID_ORIGIN", "Request origin is not permitted.");
    return mutateWishlist(await readCartBody(req));
  });
}
