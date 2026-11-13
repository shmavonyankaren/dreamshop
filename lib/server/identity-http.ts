import "server-only";
import { ZodError } from "zod";
import { IdentityError } from "../identity-contract";

export async function readWebhookBody(req: Request): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) throw new IdentityError(400, "INVALID_PAYLOAD", "A webhook body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 256 * 1024) {
      await reader.cancel();
      throw new IdentityError(413, "PAYLOAD_TOO_LARGE", "Webhook body is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function identityResponse(operation: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json(await operation(), { headers }); }
  catch (error) {
    if (error instanceof IdentityError) return Response.json({ code: error.code, message: error.message }, { status: error.status, headers });
    if (error instanceof ZodError) return Response.json({ code: "INVALID_PAYLOAD", message: "Invalid identity payload." }, { status: 400, headers });
    // Keep diagnostics server-side; never include the payload or credentials.
    console.error("Identity synchronization failed", { name: error instanceof Error ? error.name : "UnknownError",
      code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined });
    return Response.json({ code: "IDENTITY_UNAVAILABLE", message: "Account synchronization is temporarily unavailable. Please retry." }, { status: 503, headers });
  }
}
