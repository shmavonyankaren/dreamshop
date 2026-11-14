import "server-only";
import type { ClientSession } from "mongoose";
import Store from "../db/models/store.model";
import StoreImage from "../db/models/store-image.model";
import Application from "../db/models/merchant-application.model";
import User from "../db/models/user.model";
import { AuthorizationAudit } from "../db/models/authorization.model";
import { AuthorizationError } from "../authorization-contract";
import { applicationSchema, storeSetupSchema, storeSettingsSchema, type StoreDTO } from "../merchant-contract";
import type { InternalUserDTO } from "../identity-contract";
import { requireAuthenticatedUser } from "./authenticated-user";
import { authorizedMutation } from "./marketplace-transaction";
import { requireCapability } from "./authorization";
import { productIdSchema } from "../cart-contract";

// Server-only reviewer read; no public application listing or applicant-selected approval.
export async function getApplicationForReview(userId: unknown) {
  await requireCapability("merchant:approve");
  const id = productIdSchema.parse(userId);
  const record = await Application.findById(id);
  if (!record) return null;
  return { userId: id, name: record.name, description: record.description, contactEmail: record.contactEmail, supportingInformation: record.supportingInformation };
}

export function requireApprovedMerchant(actor: InternalUserDTO) {
  if (actor.merchantStatus !== "approved") throw new AuthorizationError(403, "FORBIDDEN", "Approved merchant access is required.");
}
export async function ownedStore(actor: InternalUserDTO, session?: ClientSession) {
  requireApprovedMerchant(actor);
  const query = Store.findOne({ owner: actor.id });
  const store = await (session ? query.session(session) : query);
  if (!store) throw new AuthorizationError(409, "STORE_REQUIRED", "Complete your store setup first.");
  if (store.status === "suspended") throw new AuthorizationError(403, "FORBIDDEN", "This store is suspended.");
  return store;
}
export function storeDTO(store: { _id: { toString(): string }; name: string; slug: string; description: string; contactEmail: string; logo?: string; banner?: string; status: string }): StoreDTO {
  return { id: String(store._id), name: store.name, slug: store.slug, description: store.description, contactEmail: store.contactEmail, logo: store.logo ?? "", banner: store.banner ?? "", status: store.status };
}
export function publicStoreDTO(store: StoreDTO) {
  return { name: store.name, slug: store.slug, description: store.description, logo: store.logo, banner: store.banner };
}
export async function merchantOnboarding() {
  const actor = await requireAuthenticatedUser();
  const application = await Application.findById(actor.id);
  const store = await Store.findOne({ owner: actor.id });
  return { status: actor.merchantStatus, application: application ? { name: application.name, description: application.description, contactEmail: application.contactEmail } : null, store: store ? storeDTO(store) : null };
}
export async function submitApplication(input: unknown) {
  return authorizedMutation("customer:access", async (actor, session) => {
    const data = applicationSchema.parse(input);
    if (actor.merchantStatus === "pending") return { status: "pending" };
    if (actor.merchantStatus !== "none") throw new AuthorizationError(409, "INVALID_TRANSITION", "Your application requires administrative review.");
    await Application.updateOne({ _id: actor.id }, { $set: data }, { upsert: true, session, runValidators: true });
    await User.updateOne({ _id: actor.id, merchantStatus: { $in: ["none", null] } }, { $set: { merchantStatus: "pending" }, $inc: { __v: 1 } }, { session, runValidators: true });
    await AuthorizationAudit.create([{ actor: actor.id, target: actor.id, action: "merchant.application", before: "none", after: "pending", reason: "Store application submitted", at: new Date() }], { session });
    return { status: "pending" };
  });
}
export async function createStore(input: unknown) {
  return authorizedMutation("merchant:access", async (actor, session) => {
    requireApprovedMerchant(actor);
    const data = storeSetupSchema.parse(input);
    if (await Store.exists({ owner: actor.id }).session(session)) throw new AuthorizationError(409, "CONFLICT", "You already have a store.");
    if (await Store.exists({ slug: data.slug }).session(session)) throw new AuthorizationError(409, "CONFLICT", "This store address is already taken.");
    const [store] = await Store.create([{ ...data, owner: actor.id, status: "active" }], { session });
    return storeDTO(store);
  });
}
export async function requireStoreImage(url: string, store: string, session: ClientSession) {
  if (!url) return;
  const id = /^\/api\/store-images\/([a-f0-9]{24})$/.exec(url)?.[1];
  if (!id || !await StoreImage.exists({ _id: id, store }).session(session)) throw new AuthorizationError(400, "INVALID_IMAGE", "Upload an image to your store first.");
}
export async function updateStore(input: unknown) {
  return authorizedMutation("merchant:access", async (actor, session) => {
    const data = storeSettingsSchema.parse(input), store = await ownedStore(actor, session);
    await requireStoreImage(data.logo, String(store._id), session);
    await requireStoreImage(data.banner, String(store._id), session);
    const updated = await Store.findOneAndUpdate({ _id: store._id, owner: actor.id, status: { $ne: "suspended" } }, { $set: data }, { session, new: true, runValidators: true });
    if (!updated) throw new AuthorizationError(409, "CONFLICT", "Store changed. Please retry.");
    return storeDTO(updated);
  });
}
