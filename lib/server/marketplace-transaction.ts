import "server-only";
import type { ClientSession } from "mongoose";
import { connectDB } from "../db/connection";
import { AuthorizationControl } from "../db/models/authorization.model";
import User from "../db/models/user.model";
import { AuthorizationError, type Capability } from "../authorization-contract";
import type { InternalUserDTO } from "../identity-contract";
import { requireCapability } from "./authorization";

export async function authorizedMutation<T>(capability: Capability, operation: (user: InternalUserDTO, session: ClientSession) => Promise<T>): Promise<T> {
  await requireCapability(capability);
  const db = await connectDB();
  // Idempotent infrastructure initialization only; this never grants a privilege.
  try {
    await AuthorizationControl.updateOne({ _id: "marketplace" }, { $setOnInsert: { revision: 0, bootstrapCompleted: false } },
      { upsert: true, writeConcern: { w: "majority", j: true } });
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
  }
  return db.connection.transaction(async (session) => {
    const coordination = await AuthorizationControl.updateOne({ _id: "marketplace" }, { $inc: { revision: 1 } }, { session });
    if (coordination.modifiedCount !== 1) throw new AuthorizationError(503, "UNAVAILABLE", "Marketplace coordination is unavailable. Please retry.");
    // Re-read after acquiring the shared write, including on transaction retries.
    const user = await requireCapability(capability, session);
    // Write-lock the actor too: a concurrent Clerk deletion/ban or policy update
    // must conflict and retry, rather than authorize from an obsolete snapshot.
    const actorWrite = await User.updateOne({ _id: user.id }, { $inc: { __v: 1 } }, { session, runValidators: true });
    if (actorWrite.modifiedCount !== 1) throw new AuthorizationError(403, "ACCOUNT_INACTIVE", "This account is not available.");
    return operation(user, session);
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority", j: true }, readPreference: "primary" });
}
