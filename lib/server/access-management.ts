import "server-only";
import { z } from "zod";
import type { ClientSession } from "mongoose";
import User from "../db/models/user.model";
import { AuthorizationAudit } from "../db/models/authorization.model";
import { AuthorizationError, type ApplicationStatus, type MerchantStatus } from "../authorization-contract";
import { productIdSchema } from "../cart-contract";
import { authorizedMutation } from "./marketplace-transaction";

const targetSchema = z.object({ userId: productIdSchema, reason: z.string().trim().min(1).max(500) });
const merchantSchema = targetSchema.extend({ status: z.enum(["none", "pending", "approved", "rejected", "suspended"]) }).strict();
const accountSchema = targetSchema.extend({ status: z.enum(["active", "suspended"]) }).strict();
const adminSchema = targetSchema.extend({ enabled: z.boolean() }).strict();
const transitions: Record<MerchantStatus, MerchantStatus[]> = {
  none: ["pending"], pending: ["approved", "rejected", "none"], approved: ["suspended", "none"],
  rejected: ["pending", "none"], suspended: ["approved", "none"],
};
async function audit(actor: string, target: string, action: string, before: unknown, after: unknown, reason: string, session: ClientSession) {
  await AuthorizationAudit.create([{ actor, target, action, before, after, reason, at: new Date() }], { session });
}
async function targetUser(id: string, session: ClientSession) {
  const user = await User.findById(id).session(session);
  if (!user) throw new AuthorizationError(404, "NOT_FOUND", "Account not found.");
  return user;
}
async function protectLastAdmin(id: string, isAdmin: boolean, session: ClientSession) {
  if (!isAdmin) return;
  const remaining = await User.countDocuments({ _id: { $ne: id }, superAdmin: true,
    status: { $in: ["active", null] }, applicationStatus: { $in: ["active", null] } }).session(session);
  if (!remaining) throw new AuthorizationError(409, "LAST_ADMIN", "Provision another active Super Admin before removing this access.");
}
export async function requestMerchantAccess() {
  return authorizedMutation("customer:access", async (actor, session) => {
    if (actor.merchantStatus === "pending") return { status: "pending" as const };
    if (actor.merchantStatus !== "none") throw new AuthorizationError(409, "INVALID_TRANSITION", "Merchant access requires administrative review.");
    await User.updateOne({ _id: actor.id }, { $set: { merchantStatus: "pending" }, $inc: { __v: 1 } }, { session, runValidators: true });
    await audit(actor.id, actor.id, "merchant.application", "none", "pending", "Account requested merchant review", session);
    return { status: "pending" as const };
  });
}
export async function reviewMerchantAccess(input: unknown) {
  return authorizedMutation("merchant:approve", async (actor, session) => {
    const { userId, status, reason } = merchantSchema.parse(input);
    const user = await targetUser(userId, session), before: MerchantStatus = user.merchantStatus ?? "none";
    if (before === status) return { changed: false };
    if (!transitions[before].includes(status)) throw new AuthorizationError(409, "INVALID_TRANSITION", "This merchant transition is not allowed.");
    if (status === "approved" && ((user.status ?? "active") !== "active" || (user.applicationStatus ?? "active") !== "active")) {
      throw new AuthorizationError(409, "ACCOUNT_INACTIVE", "An inactive account cannot be approved.");
    }
    await User.updateOne({ _id: userId }, { $set: { merchantStatus: status }, $inc: { __v: 1 } }, { session, runValidators: true });
    await audit(actor.id, userId, "merchant.review", before, status, reason, session);
    return { changed: true };
  });
}
export async function setApplicationStatus(input: unknown) {
  return authorizedMutation("users:manage", async (actor, session) => {
    const { userId, status, reason } = accountSchema.parse(input);
    const user = await targetUser(userId, session), before: ApplicationStatus = user.applicationStatus ?? "active";
    if (before === status) return { changed: false };
    if (status === "suspended") await protectLastAdmin(userId, user.superAdmin === true, session);
    await User.updateOne({ _id: userId }, { $set: { applicationStatus: status }, $inc: { __v: 1 } }, { session, runValidators: true });
    await audit(actor.id, userId, "account.status", before, status, reason, session);
    return { changed: true };
  });
}
// No Server Action or HTTP endpoint exposes role assignment in this phase.
export async function setSuperAdminAccess(input: unknown) {
  return authorizedMutation("users:manage", async (actor, session) => {
    const { userId, enabled, reason } = adminSchema.parse(input);
    const user = await targetUser(userId, session), before = user.superAdmin === true;
    if (before === enabled) return { changed: false };
    if (!enabled) await protectLastAdmin(userId, before, session);
    if (enabled && ((user.status ?? "active") !== "active" || (user.applicationStatus ?? "active") !== "active")) {
      throw new AuthorizationError(409, "ACCOUNT_INACTIVE", "An inactive account cannot receive administrative access.");
    }
    await User.updateOne({ _id: userId }, { $set: { superAdmin: enabled }, $inc: { __v: 1 } }, { session, runValidators: true });
    await audit(actor.id, userId, "superAdmin.access", before, enabled, reason, session);
    return { changed: true };
  });
}
