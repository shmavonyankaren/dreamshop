import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ClientSession } from "mongoose";
import type { ApplicationStatus, MerchantStatus } from "../authorization-contract";
import { clerkClient } from "@clerk/nextjs/server";
import { connectDB } from "../db/connection";
import User from "../db/models/user.model";
import { IdentityError, type AccountStatus, type InternalUserDTO, type PublicUserDTO } from "../identity-contract";

const clerkIdSchema = z.string().min(1).max(256);
const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
const optionalText = z.string().max(2048).nullish().transform((value) => value?.trim() || null);
export const clerkProfileSchema = z.object({
  id: clerkIdSchema,
  created_at: timestamp,
  updated_at: timestamp,
  first_name: optionalText,
  last_name: optionalText,
  username: optionalText,
  image_url: optionalText,
  primary_email_address_id: z.string().nullable(),
  email_addresses: z.array(z.object({
    id: z.string(), email_address: z.string().max(320),
    verification: z.object({ status: z.string() }).nullish(),
  })).max(100),
  banned: z.boolean(),
  locked: z.boolean(),
}).refine((value) => value.updated_at >= value.created_at, "Invalid profile version");

type StoredIdentity = {
  _id: { toString(): string }; clerkId?: string; __v?: number;
  firstName?: string | null; lastName?: string | null; username?: string | null;
  photo?: string | null; email?: string | null; status?: AccountStatus;
  applicationStatus?: ApplicationStatus; merchantStatus?: MerchantStatus; superAdmin?: boolean;
  createdAt?: Date; updatedAt?: Date; clerkUpdatedAt?: number; syncFingerprint?: string;
};
const fields = "_id clerkId firstName lastName username photo email status applicationStatus merchantStatus superAdmin createdAt updatedAt";
function toInternal(user: StoredIdentity, clerkId: string): InternalUserDTO {
  return {
    id: user._id.toString(), clerkId,
    displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null,
    avatar: user.photo || null, email: user.email || null, username: user.username || null,
    status: user.status ?? "active", // Legacy records predate status.
    applicationStatus: user.applicationStatus ?? "active",
    merchantStatus: user.merchantStatus ?? "none", superAdmin: user.superAdmin === true,
    createdAt: user.createdAt?.toISOString() ?? null, updatedAt: user.updatedAt?.toISOString() ?? null,
  };
}
export function toPublicUser(user: InternalUserDTO): PublicUserDTO {
  return { displayName: user.displayName, avatar: user.avatar };
}
export async function findIdentity(clerkId: string, session?: ClientSession): Promise<InternalUserDTO | null> {
  clerkIdSchema.parse(clerkId);
  await connectDB();
  const query = User.findOne({ clerkId }).select(fields);
  const user = await (session ? query.session(session) : query.readConcern("majority"));
  return user ? toInternal(user, clerkId) : null;
}

type Change = { clerkId: string; version: number; profile?: {
  email: string | null; username: string | null; firstName: string | null;
  lastName: string | null; photo: string | null; status: "active" | "suspended";
  clerkCreatedAt: number;
}; authoritative?: boolean };

async function persist(change: Change): Promise<InternalUserDTO> {
  await connectDB();
  const fingerprint = createHash("sha256").update(JSON.stringify(change.profile ?? { deleted: true })).digest("hex");
  for (let attempt = 0; attempt < 5; attempt++) {
    const current: StoredIdentity | null = await User.findOne({ clerkId: change.clerkId }).readConcern("majority");
    if (current?.status === "deleted") return toInternal(current, change.clerkId);
    if (current && change.profile) {
      if ((current.clerkUpdatedAt ?? -1) > change.version) return toInternal(current, change.clerkId);
      if (current.clerkUpdatedAt === change.version) {
        if (current.syncFingerprint === fingerprint) return toInternal(current, change.clerkId);
        if (!change.authoritative) throw new IdentityError(409, "IDENTITY_VERSION_CONFLICT", "Account synchronization needs a fresh profile. Please retry account recovery.");
      }
    }
    // Deletion is absorbing. Preserve existing profile/customer data, references and IDs.
    const values = change.profile ?? { status: "deleted", deletedAt: new Date(change.version) };
    const update = { ...values, clerkUpdatedAt: change.version, syncFingerprint: fingerprint };
    if (!current) {
      try {
        const [created] = await User.create([{ clerkId: change.clerkId, ...update }], { writeConcern: { w: "majority", j: true } });
        return toInternal(created, change.clerkId);
      } catch (error) {
        // Only Clerk-ID creation races can be retried. Legacy unique email/username
        // indexes must never cause us to attach somebody else's record.
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000 &&
            "keyPattern" in error && (error.keyPattern as Record<string, unknown>)?.clerkId) continue;
        throw error;
      }
    }
    const result = await User.updateOne(
      { _id: current._id, clerkId: change.clerkId, __v: current.__v ?? { $exists: false }, status: { $ne: "deleted" } },
      { $set: update, $inc: { __v: 1 } },
      { runValidators: true, writeConcern: { w: "majority", j: true } },
    );
    if (result.modifiedCount === 1) {
      // Return the current status if deletion/suspension raced with this write.
      return (await findIdentity(change.clerkId))!;
    }
  }
  throw new IdentityError(409, "IDENTITY_CONFLICT", "Your account changed during synchronization. Please retry.");
}

export async function synchronizeClerkProfile(input: unknown, authoritative = false) {
  const profile = clerkProfileSchema.parse(input);
  const primary = profile.email_addresses.find((email) => email.id === profile.primary_email_address_id);
  const email = primary?.verification?.status === "verified" && z.email().safeParse(primary.email_address).success
    ? primary.email_address : null;
  return persist({ clerkId: profile.id, version: profile.updated_at, authoritative, profile: {
    email, username: profile.username, firstName: profile.first_name, lastName: profile.last_name,
    photo: profile.image_url, status: profile.banned || profile.locked ? "suspended" : "active",
    clerkCreatedAt: profile.created_at,
  } });
}
export async function deleteClerkIdentity(clerkId: string, deletedAt: number) {
  return persist({ clerkId: clerkIdSchema.parse(clerkId), version: timestamp.parse(deletedAt) });
}

// Only the authenticated recovery route calls this; no browser profile is accepted.
export async function recoverClerkIdentity(clerkId: string) {
  clerkIdSchema.parse(clerkId);
  const existing = await findIdentity(clerkId);
  if (existing?.status === "deleted") return existing;
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(clerkId);
  if (user.id !== clerkId) throw new Error("Clerk returned an unexpected identity");
  return synchronizeClerkProfile({
    id: user.id, created_at: user.createdAt, updated_at: user.updatedAt,
    first_name: user.firstName, last_name: user.lastName, username: user.username,
    image_url: user.imageUrl, banned: user.banned, locked: user.locked,
    primary_email_address_id: user.primaryEmailAddressId,
    email_addresses: user.emailAddresses.map((email) => ({ id: email.id, email_address: email.emailAddress,
      verification: email.verification ? { status: email.verification.status } : null })),
  }, true);
}
