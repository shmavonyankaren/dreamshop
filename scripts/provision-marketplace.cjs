/* eslint-disable @typescript-eslint/no-require-imports */
const manifest = require("./marketplace-index-manifest.cjs");
function targetConfiguration(args, env) {
  const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  const environment = value("--environment"), database = value("--database"), apply = args.includes("--apply");
  if (!["development", "staging", "production"].includes(environment)) throw new Error("Specify --environment development, staging or production.");
  if (!database || !/^[a-zA-Z0-9_-]{1,63}$/.test(database) || ["admin", "local", "config", "test"].includes(database)) throw new Error("Specify an explicit application --database (system/default databases are rejected).");
  if (value("--confirm-database") !== database) throw new Error("Repeat the exact database with --confirm-database.");
  if (!apply && !args.includes("--check")) throw new Error("Choose --check or --apply explicitly.");
  if (apply && args.includes("--check")) throw new Error("Choose only one mode.");
  if (!env.MONGODB_URI) throw new Error("Set MONGODB_URI explicitly in this process; environment files are not automatically loaded.");
  if (env.MONGODB_DB_NAME && env.MONGODB_DB_NAME !== database) throw new Error("MONGODB_DB_NAME conflicts with --database.");
  const uriPath = env.MONGODB_URI.replace(/^mongodb(?:\+srv)?:\/\//, "").split("?")[0];
  const uriDatabase = decodeURIComponent(uriPath.slice(uriPath.indexOf("/", uriPath.lastIndexOf("@") + 1) + 1));
  if (uriPath.includes("/") && uriDatabase && uriDatabase !== database) throw new Error("The URI database conflicts with --database.");
  const productionLike = environment === "production" || env.NODE_ENV === "production" || /(^|[-_])(prod|production)([-_]|$)/i.test(database);
  if (productionLike && (environment !== "production" || !args.includes("--allow-production") || value("--confirm-production") !== database)) throw new Error("Production requires --environment production --allow-production --confirm-production with the exact database name.");
  return { environment, database, apply };
}
function sameKey(a, b) { return JSON.stringify(Object.entries(a)) === JSON.stringify(Object.entries(b)); }
async function provision(db, { apply }, report = () => {}) {
  const results = []; let conflicts = 0;
  const existingCollections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  for (const [name, definitions] of Object.entries(manifest)) {
    if (!existingCollections.has(name)) {
      if (apply) { try { await db.createCollection(name); } catch (error) { if (error.code !== 48) throw error; } }
      const collectionEntry = { collection: name, status: apply ? "collection-ready" : "missing" };
      results.push(collectionEntry); report(collectionEntry);
    }
    const collection = db.collection(name);
    const existing = existingCollections.has(name) || apply ? await collection.listIndexes().toArray() : [];
    for (const definition of definitions) {
      const found = existing.find(i => sameKey(i.key, definition.key));
      const conflict = found && (!!found.unique !== !!definition.unique || found.sparse || found.partialFilterExpression || found.expireAfterSeconds !== undefined || found.collation && found.collation.locale !== "simple");
      const entry = { collection: name, key: definition.key, unique: !!definition.unique, status: conflict ? "conflict" : found ? "present" : "missing" };
      if (conflict) conflicts++;
      if (!found && apply) {
        try { await collection.createIndex(definition.key, definition.unique ? { unique: true } : {}); entry.status = "created"; }
        catch (error) { entry.status = "error"; entry.code = typeof error.code === "number" ? error.code : "INDEX_ERROR"; conflicts++; }
      }
      results.push(entry); report(entry);
    }
  }
  return { results, conflicts };
}
async function main() {
  const target = targetConfiguration(process.argv.slice(2), process.env);
  console.log(JSON.stringify({ environment: target.environment, database: target.database, mode: target.apply ? "apply" : "read-only-check" }));
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const hello = await client.db("admin").command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("A replica set or transactional sharded deployment is required.");
    const result = await provision(client.db(target.database), target, entry => console.log(JSON.stringify(entry)));
    if (result.conflicts || !target.apply && result.results.some(r => r.status === "missing")) process.exitCode = 1;
  } finally { await client.close(); }
}
if (require.main === module) main().catch(() => { console.error("Provisioning stopped. Check explicit target flags, database agreement, replica-set connectivity and permissions. Raw server errors and credentials are not logged."); process.exitCode = 1; });
module.exports = { targetConfiguration, provision, manifest };
