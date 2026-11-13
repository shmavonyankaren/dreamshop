import { Webhook } from "svix";
import { z } from "zod";
import { synchronizeClerkProfile, deleteClerkIdentity } from "@/lib/server/identity-service";
import { identityResponse, readWebhookBody } from "@/lib/server/identity-http";
import { IdentityError } from "@/lib/identity-contract";

const envelopeSchema = z.object({ type: z.string(), data: z.unknown() });
const deletionSchema = z.object({
  data: z.object({ id: z.string().min(1).max(256), deleted: z.literal(true) }),
  timestamp: z.number().int().nonnegative().max(8_640_000_000_000_000),
});

export async function POST(req: Request) {
  return identityResponse(async () => {
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!secret) throw new Error("Clerk webhook signing secret is not configured");
    const id = req.headers.get("svix-id");
    const timestamp = req.headers.get("svix-timestamp");
    const signature = req.headers.get("svix-signature");
    if (!id || !timestamp || !signature) throw new IdentityError(400, "INVALID_SIGNATURE", "Webhook verification failed.");
    const body = await readWebhookBody(req);
    let verified: unknown;
    try {
      verified = new Webhook(secret).verify(body, { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature });
    } catch {
      throw new IdentityError(400, "INVALID_SIGNATURE", "Webhook verification failed.");
    }
    const event = envelopeSchema.parse(verified);
    if (event.type === "user.created" || event.type === "user.updated") {
      await synchronizeClerkProfile(event.data);
    } else if (event.type === "user.deleted") {
      const deletion = deletionSchema.parse(verified);
      await deleteClerkIdentity(deletion.data.id, deletion.timestamp);
    }
    return { received: true };
  });
}
