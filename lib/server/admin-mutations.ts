import "server-only";
import { z } from "zod";
import Store from "../db/models/store.model";
import Product from "../db/models/product.model";
import User from "../db/models/user.model";
import { productIdSchema } from "../cart-contract";
import { AuthorizationError } from "../authorization-contract";
import { authorizedMutation } from "./marketplace-transaction";
import { writeAdminAudit } from "./admin-audit";
const fields = { id: productIdSchema, reason: z.string().trim().min(3).max(500) };
export async function changeStoreOperation(input: unknown) {
  return authorizedMutation("merchant:approve", async (actor, session) => {
    const { id, status, expectedStatus, reason } = z.object({ ...fields, status: z.enum(["active", "paused", "suspended"]), expectedStatus: z.enum(["active", "paused", "suspended"]) }).strict().parse(input);
    const store = await Store.findById(id).session(session);
    if (!store) throw new AuthorizationError(404, "NOT_FOUND", "Store not found.");
    const owner = await User.findById(store.owner).session(session);
    if (!owner || owner.status === "deleted") throw new AuthorizationError(409, "ACCOUNT_INACTIVE", "The store owner is unavailable.");
    if (store.status === status) return { changed: false };
    if (store.status !== expectedStatus) throw new AuthorizationError(409, "CONFLICT", "Store status changed. Refresh before continuing.");
    if (status === "active" && ((owner.status ?? "active") !== "active" || (owner.applicationStatus ?? "active") !== "active" || owner.merchantStatus !== "approved")) throw new AuthorizationError(409, "ACCOUNT_INACTIVE", "Approve and reactivate the merchant before activating this store.");
    await User.updateOne({ _id: store.owner }, { $inc: { __v: 1 } }, { session, runValidators: true });
    await Store.updateOne({ _id: id, status: expectedStatus }, { $set: { status } }, { session, runValidators: true });
    await writeAdminAudit(actor.id, id, "store", "store.status", store.status, status, reason, session);
    return { changed: true };
  });
}
export async function moderateProduct(input: unknown) {
  return authorizedMutation("product:manage:any", async (actor, session) => {
    const { id, status, expectedStatus, reason } = z.object({ ...fields, status: z.enum(["active", "archived"]), expectedStatus: z.enum(["active", "archived"]) }).strict().parse(input);
    const product = await Product.findById(id).session(session);
    if (!product) throw new AuthorizationError(404, "NOT_FOUND", "Product not found.");
    const before = product.status ?? "active";
    if (before === status) return { changed: false };
    if (before !== expectedStatus) throw new AuthorizationError(409, "CONFLICT", "Product changed. Refresh before continuing.");
    await Product.updateOne({ _id: id }, { $set: { status }, $inc: { __v: 1 } }, { session, runValidators: true });
    await writeAdminAudit(actor.id, id, "product", "product.status", before, status, reason, session);
    return { changed: true };
  });
}
export async function setProductModeration(input: unknown) {
  return authorizedMutation("product:manage:any", async (actor, session) => {
    const { id, status, expectedRevision, reason } = z.object({ ...fields, status: z.enum(["clear", "held"]), expectedRevision: z.number().int().nonnegative() }).strict().parse(input);
    const product = await Product.findById(id).session(session).select("moderationStatus moderationRevision +moderationReason");
    if (!product) throw new AuthorizationError(404, "NOT_FOUND", "Product not found.");
    const before = product.moderationStatus, revision = product.moderationRevision;
    // An exact retry is harmless; a delayed retry must not override a later decision.
    if (before === status && revision === expectedRevision + 1 && product.moderationReason === reason) return { changed: false };
    if (revision !== expectedRevision) throw new AuthorizationError(409, "CONFLICT", "Moderation changed. Refresh before continuing.");
    if (before === status) return { changed: false };
    if (!["clear", "held"].includes(before)) throw new AuthorizationError(409, "INVALID_TRANSITION", "This product's moderation state requires review.");
    const result = await Product.updateOne({ _id: id, moderationRevision: expectedRevision }, { $set: { moderationStatus: status, moderationReason: reason }, $inc: { moderationRevision: 1, __v: 1 } }, { session, runValidators: true });
    if (!result.matchedCount) throw new AuthorizationError(409, "CONFLICT", "Moderation changed. Refresh before continuing.");
    await writeAdminAudit(actor.id, id, "product", status === "held" ? "product.hold" : "product.release", { status: before, revision }, { status, revision: revision + 1 }, reason, session);
    return { changed: true };
  });
}
