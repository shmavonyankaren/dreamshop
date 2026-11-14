import "server-only";
import { unstable_rethrow } from "next/navigation";
import { requireAuthenticatedUser } from "./authenticated-user";
import { hasCapability } from "./authorization";
import { CartError } from "../cart-contract";

export type AccountNavigation = { clerkId: string; merchantDashboard: boolean; adminDashboard: boolean };

export async function resolveAccountNavigation(): Promise<AccountNavigation | null> {
  try {
    const user = await requireAuthenticatedUser();
    return {
      clerkId: user.clerkId,
      // Super Admin's general capability bypass does not imply merchant enrollment.
      merchantDashboard: user.merchantStatus === "approved" && hasCapability(user, "merchant:access"),
      adminDashboard: hasCapability(user, "users:manage"),
    };
  } catch (error) {
    // Preserve Next's dynamic-rendering/redirect control flow during prerendering.
    unstable_rethrow(error);
    // Navigation must remain usable during sign-in, recovery and database outages.
    if (!(error instanceof CartError)) console.error("Account navigation temporarily unavailable");
    return null;
  }
}
