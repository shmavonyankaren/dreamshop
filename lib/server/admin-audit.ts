import "server-only";
import type { ClientSession } from "mongoose";
import { AuthorizationAudit } from "../db/models/authorization.model";
export async function writeAdminAudit(actor: string, target: string, targetType: "store" | "product" | "category", action: string, before: unknown, after: unknown, reason: string, session: ClientSession) {
  await AuthorizationAudit.create([{ actor, target, targetType, action, before, after, reason, outcome: "success", at: new Date() }], { session });
}
