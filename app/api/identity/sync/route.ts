import { auth } from "@clerk/nextjs/server";
import { recoverClerkIdentity } from "@/lib/server/identity-service";
import { identityResponse } from "@/lib/server/identity-http";
import { IdentityError } from "@/lib/identity-contract";

export async function POST(req: Request) {
  return identityResponse(async () => {
    const { userId } = await auth();
    if (!userId) throw new IdentityError(401, "UNAUTHORIZED", "Sign in to recover your account.");
    // Browser calls must originate here. No target user ID or profile body is accepted.
    if (req.headers.get("origin") !== new URL(req.url).origin) throw new IdentityError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
    if (req.body !== null || new URL(req.url).search) throw new IdentityError(400, "INVALID_PAYLOAD", "Account recovery does not accept input.");
    const user = await recoverClerkIdentity(userId);
    if (user.status !== "active" || user.applicationStatus !== "active") throw new IdentityError(403, "ACCOUNT_INACTIVE", "This account is not available.");
    return { synchronized: true };
  });
}
