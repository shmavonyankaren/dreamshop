import "server-only";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "../db/connection";
import User from "../db/models/user.model";
import { CartError } from "../cart-contract";

export async function requireCartUser(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new CartError(401, "UNAUTHORIZED", "Sign in to access your account cart.");
  await connectDB();
  const user = await User.findOne({ clerkId }).select("_id");
  if (!user) throw new CartError(409, "USER_SYNC_PENDING", "Your account is still being synchronized. Please try again shortly.");
  return user._id.toString();
}
