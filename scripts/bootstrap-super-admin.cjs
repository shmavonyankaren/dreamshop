/* eslint-disable @typescript-eslint/no-require-imports */
// Operator-only command, never imported by an application route or Server Action.
const { MongoClient } = require("mongodb");
const { z } = require("zod");
const inputSchema = z.object({ clerkId: z.string().min(1).max(256), operator: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(500) }).strict();

async function bootstrapSuperAdmin(client, database, input) {
  const { clerkId, operator, reason } = inputSchema.parse(input);
  const db = client.db(database), controls = db.collection("authorization_controls"), users = db.collection("users");
  // Abort on a concurrent initialization conflict; an explicit rerun is safe.
  await controls.updateOne({ _id: "marketplace" }, { $setOnInsert: { revision: 0, bootstrapCompleted: false } },
    { upsert: true, writeConcern: { w: "majority", j: true } });
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const control = await controls.findOneAndUpdate({ _id: "marketplace" }, { $inc: { revision: 1 } }, { session, returnDocument: "after" });
      if (!control || control.bootstrapCompleted || await users.countDocuments({ superAdmin: true }, { session })) {
        throw new Error("Bootstrap already completed or an administrator already exists");
      }
      // Do not bootstrap against an ambiguous/missing identity index.
      const indexes = await users.listIndexes().toArray();
      if (!indexes.some((index) => index.unique && index.key.clerkId === 1 && Object.keys(index.key).length === 1 && !index.partialFilterExpression && !index.sparse)) {
        throw new Error("A full unique Clerk ID index is required");
      }
      const user = await users.findOne({ clerkId }, { session });
      if (!user || (user.status ?? "active") !== "active" || (user.applicationStatus ?? "active") !== "active") {
        throw new Error("Target must be an existing active synchronized identity");
      }
      await users.updateOne({ _id: user._id }, { $set: { superAdmin: true, updatedAt: new Date() }, $inc: { __v: 1 } }, { session });
      await db.collection("authorization_audits").insertOne({ actor: "operator:" + operator, target: user._id,
        action: "superAdmin.bootstrap", before: false, after: true, reason, at: new Date() }, { session });
      await controls.updateOne({ _id: "marketplace" }, { $set: { bootstrapCompleted: true } }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority", j: true }, readPreference: "primary" });
  } finally { await session.endSession(); }
}

async function main() {
  if (process.argv[2] !== "--confirm-bootstrap" || process.argv.length !== 3) throw new Error("Explicit --confirm-bootstrap is required");
  const { MONGODB_URI, MONGODB_DATABASE, BOOTSTRAP_CLERK_ID, BOOTSTRAP_OPERATOR, BOOTSTRAP_REASON } = process.env;
  if (!MONGODB_URI || !MONGODB_DATABASE) throw new Error("Explicit MongoDB URI and database are required");
  const input = inputSchema.parse({ clerkId: BOOTSTRAP_CLERK_ID, operator: BOOTSTRAP_OPERATOR, reason: BOOTSTRAP_REASON });
  const client = new MongoClient(MONGODB_URI);
  try { await client.connect(); await bootstrapSuperAdmin(client, MONGODB_DATABASE, input); console.log("Super Admin bootstrap committed with an audit record."); }
  finally { await client.close(); }
}
if (require.main === module) {
  main().catch(() => { console.error("Bootstrap did not complete. Check configuration, target status, indexes and transaction support; no credentials are printed."); process.exitCode = 1; });
}
module.exports = { bootstrapSuperAdmin };
