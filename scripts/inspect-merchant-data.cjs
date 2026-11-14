/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only deployment inventory. Never modifies products, indexes or ownership.
const { MongoClient } = require("mongodb");
async function inspect(db) {
  const products = db.collection("products");
  const [legacy, unowned, assigned, archived, mismatches, indexes] = await Promise.all([
    products.countDocuments({ store: { $exists: false } }),
    products.countDocuments({ owner: null }),
    products.countDocuments({ store: { $exists: true } }),
    products.countDocuments({ status: "archived" }),
    products.aggregate([{ $match: { store: { $exists: true } } }, { $lookup: { from: "stores", localField: "store", foreignField: "_id", as: "storeRecord" } }, { $match: { $expr: { $ne: ["$owner", { $arrayElemAt: ["$storeRecord.owner", 0] }] } } }, { $count: "count" }], { maxTimeMS: 10000 }).toArray(),
    db.collection("stores").listIndexes().toArray().catch(error => { if (error.code === 26) return []; throw error; }),
  ]);
  return { legacy, unowned, assigned, archived, mismatchedOrMissingStore: mismatches[0]?.count ?? 0, storeIndexes: indexes.map(({ key, unique }) => ({ key, unique: !!unique })) };
}
async function main() {
  if (process.argv[2] !== "--read-only") throw new Error("Run with --read-only after selecting an isolated/staging environment.");
  require("@next/env").loadEnvConfig(process.cwd());
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try { await client.connect(); console.log(JSON.stringify(await inspect(client.db(process.env.MONGODB_DB_NAME?.trim() || undefined)), null, 2)); }
  finally { await client.close(); }
}
if (require.main === module) main().catch(() => { console.error("Read-only inventory failed. Check environment selection and database access; credentials are not logged."); process.exitCode = 1; });
module.exports = { inspect };
