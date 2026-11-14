import "server-only";
import type { ClientSession } from "mongoose";
import type { InternalUserDTO } from "../identity-contract";
import { AuthorizationError, type Capability } from "../authorization-contract";
import { requireAuthenticatedUser } from "./authenticated-user";

export function hasCapability(user: InternalUserDTO, capability: Capability): boolean {
  if (user.status !== "active" || user.applicationStatus !== "active") return false;
  if (capability === "customer:access") return true;
  if (user.superAdmin) return true;
  return user.merchantStatus === "approved" && ["merchant:access", "product:create", "product:update:own", "product:delete:own"].includes(capability);
}
export async function requireCapability(capability: Capability, session?: ClientSession) {
  const user = await requireAuthenticatedUser(session);
  if (!hasCapability(user, capability)) throw new AuthorizationError(403, "FORBIDDEN", "You do not have permission for this operation.");
  return user;
}
// Future layouts/handlers call this in addition to service-level checks.
export async function requireRouteAccess(area: "account" | "merchant" | "admin") {
  return requireCapability(area === "account" ? "customer:access" : area === "merchant" ? "merchant:access" : "users:manage");
}
