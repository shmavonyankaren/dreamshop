import { MAX_IMAGE_BYTES } from "@/lib/merchant-contract";
import { ownedStore } from "@/lib/server/store-service";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { uploadStoreImage, deleteStoreImage } from "@/lib/server/store-images";
import { marketplaceResult } from "@/lib/server/marketplace-response";
import { AuthorizationError } from "@/lib/authorization-contract";
export const runtime = "nodejs";
function origin(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) throw new AuthorizationError(403, "FORBIDDEN", "Invalid request origin.");
}
export async function POST(req: Request) {
  const result = await marketplaceResult(async () => {
    origin(req);
    await ownedStore(await requireAuthenticatedUser());
    const reader = req.body?.getReader();
    if (!reader) throw new AuthorizationError(400, "INVALID_IMAGE", "An image is required.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new AuthorizationError(413, "IMAGE_TOO_LARGE", "Choose an image up to 2 MB."); }
      chunks.push(value);
    }
    return uploadStoreImage(Buffer.concat(chunks), req.headers.get("content-type") ?? "");
  });
  return Response.json(result, { status: result.ok ? 201 : result.error.status, headers: { "Cache-Control": "private, no-store" } });
}
export async function DELETE(req: Request) {
  const result = await marketplaceResult(async () => { origin(req); return deleteStoreImage(new URL(req.url).searchParams.get("id")); });
  return Response.json(result, { status: result.ok ? 200 : result.error.status, headers: { "Cache-Control": "private, no-store" } });
}
