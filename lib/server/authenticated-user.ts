import "server-only";
import type { ClientSession } from "mongoose";
import { auth } from "@clerk/nextjs/server";
import { findIdentity } from "./identity-service";
import type { InternalUserDTO } from "../identity-contract";
import { CartError } from "../cart-contract";

export async function requireAuthenticatedUser(session?: ClientSession): Promise<InternalUserDTO> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new CartError(401, "UNAUTHORIZED", "Sign in to access your account cart.");
  const user = await findIdentity(clerkId, session);
  if (!user) throw new CartError(409, "USER_SYNC_PENDING", "Your account is still being synchronized. Please try again shortly.");
  if (user.status !== "active" || user.applicationStatus !== "active") throw new CartError(403, "ACCOUNT_INACTIVE", "This account is not available.");
  return user;
}

export async function requireCartUser(): Promise<string> {
  return (await requireAuthenticatedUser()).id;
}
