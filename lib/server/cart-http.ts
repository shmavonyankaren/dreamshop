import "server-only";
import { ZodError } from "zod";
import { CartError, MAX_CART_BODY_BYTES } from "../cart-contract";

export async function readCartBody(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new CartError(400, "INVALID_JSON", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_CART_BODY_BYTES) {
      await reader.cancel();
      throw new CartError(413, "PAYLOAD_TOO_LARGE", "Cart request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CartError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

export async function cartResponse(operation: () => Promise<unknown>) {
  try {
    return Response.json(await operation(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof CartError;
    const validation = error instanceof ZodError;
    return Response.json({
      code: known ? error.code : validation ? "INVALID_INPUT" : "INTERNAL_ERROR",
      message: known ? error.message : validation ? "Invalid cart input. Check product IDs, quantities, duplicates, and item limits." : "Unable to process the cart request. Please try again.",
    }, { status: known ? error.status : validation ? 400 : 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
