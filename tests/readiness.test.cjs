/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const { fixture, A, B, D, P, Q, C, product } = require("./helpers/marketplace-fixture.cjs");
const { targetConfiguration, provision, manifest } = require("../scripts/provision-marketplace.cjs");
function ready() {
  const f = fixture(); f.merchant(A); f.merchant(B); f.admin(D); f.state.images.get("6".repeat(24)).store = A;
  f.state.stores.get(A).slug = "ready-store"; f.state.clerkId = "clerk-d";
  return f;
}
const policy = f => f.load("@/lib/server/product-eligibility");
const listing = f => f.load("@/lib/server/storefront-service");
const moderation = f => f.load("@/lib/server/admin-mutations").setProductModeration;
const hold = (revision = 0, status = "held") => ({ id: P, status, expectedRevision: revision, reason: "Please revise this product listing" });
const cases = [
  ["archived product", f => { f.state.products.get(P).status = "archived"; }],
  ["held product", f => { f.state.products.get(P).moderationStatus = "held"; }],
  ["paused store", f => { f.state.stores.get(A).status = "paused"; }],
  ["suspended store", f => { f.state.stores.get(A).status = "suspended"; }],
  ["deactivated store", f => { f.state.stores.get(A).status = "deactivated"; }],
  ["suspended merchant", f => { f.state.users.get(A).merchantStatus = "suspended"; }],
  ["pending merchant", f => { f.state.users.get(A).merchantStatus = "pending"; }],
  ["rejected merchant", f => { f.state.users.get(A).merchantStatus = "rejected"; }],
  ["deleted owner", f => { f.state.users.get(A).status = "deleted"; }],
  ["identity suspension", f => { f.state.users.get(A).status = "suspended"; }],
  ["account suspension", f => { f.state.users.get(A).applicationStatus = "suspended"; }],
  ["missing owner", f => { f.state.users.delete(A); }],
  ["missing store", f => { f.state.stores.delete(A); }],
  ["missing moderation state", f => { delete f.state.products.get(P).moderationStatus; }],
  ["missing owner state", f => { delete f.state.users.get(A).status; }],
  ["wrong store owner", f => { f.state.products.get(P).owner = B; }],
];
for (const [name, change] of cases) test(`${name} is excluded consistently from every public product entry point`, async () => {
  const f = ready(); change(f);
  assert.equal((await policy(f).eligibleProductsByIds([P])).length, 0);
  assert.equal(await listing(f).getStorefrontProduct(P), null);
  assert(!(await listing(f).getCatalog()).products.some(p => p._id === P));
  assert(!(await listing(f).getRelatedProducts({ _id: Q, category: { _id: C } })).some(p => p._id === P));
  assert.equal(await f.products().getProductById(P), null);
  assert(!(await f.products().getProductsByUser(A)).some(p => p._id === P));
  const store = await f.load("@/lib/server/public-stores").getPublicStore("ready-store"); assert(!store || !store.products.some(p => p._id === P));
  const response = await f.load("@/app/api/products/route").GET(new Request(`https://shop.test/api/products?ids=${P}`)); assert.equal((await response.json()).products.length, 0);
});
test("active store product is visible and customer DTOs contain no moderation/private owner fields", async () => {
  const f = ready(); const products = await policy(f).eligibleProductsByIds([P]); assert.equal(products.length, 1);
  const serialized = JSON.stringify(await listing(f).getCatalog()); for (const field of ["moderationStatus", "moderationReason", "moderationRevision", "clerkId", "contactEmail", "owner"]) assert(!serialized.includes('"' + field + '"'));
});
test("restoring a store reveals only active clear products and changes no publication states", async () => {
  const f = ready(); f.state.products.set("7".repeat(24), { ...f.state.products.get(P), _id: "7".repeat(24), status: "archived" }); f.state.products.set("8".repeat(24), { ...f.state.products.get(P), _id: "8".repeat(24), moderationStatus: "held" });
  f.state.stores.get(A).status = "paused"; assert.equal((await policy(f).eligibleProductsByIds([P])).length, 0); f.state.stores.get(A).status = "active";
  const result = await f.load("@/lib/server/public-stores").getPublicStore("ready-store"); assert.deepEqual(result.products.map(p => p._id), [P]); assert.equal(f.state.products.get("7".repeat(24)).status, "archived");
});
for (const actor of ["clerk-a", "clerk-b", null]) test(`non-admin ${actor ?? "anonymous"} cannot hold or release`, async () => {
  const f = ready(); f.state.clerkId = actor;
  for (const status of ["held", "clear"]) await assert.rejects(moderation(f)(hold(0, status)), e => e.status === (actor ? 403 : 401));
});
test("hold and release are independently audited and release does not unarchive", async () => {
  const f = ready(); await moderation(f)(hold()); f.state.products.get(P).status = "archived"; await moderation(f)(hold(1, "clear"));
  assert.equal(f.state.products.get(P).status, "archived"); assert.equal((await policy(f).eligibleProductsByIds([P])).length, 0); assert.deepEqual(f.state.audits.map(a => a.action), ["product.hold", "product.release"]); assert(f.state.audits.every(a => a.targetType === "product" && a.outcome === "success"));
});
test("exact moderation retry is idempotent but stale replay after later decisions is rejected", async () => {
  const f = ready(); await moderation(f)(hold()); await moderation(f)(hold()); assert.equal(f.state.audits.length, 1);
  await moderation(f)(hold(1, "clear")); await assert.rejects(moderation(f)(hold()), e => e.status === 409); assert.equal(f.state.products.get(P).moderationStatus, "clear");
});
test("conflicting moderation decisions cannot silently overwrite each other", async () => {
  const f = ready(); const result = await Promise.allSettled([moderation(f)(hold()), moderation(f)({ ...hold(), reason: "Different decision" })]); assert.equal(result.filter(r => r.status === "fulfilled").length, 1); assert.equal(f.state.audits.length, 1);
});
test("failed audit rolls back hold and revision", async () => { const f = ready(); f.state.auditFail = true; await assert.rejects(moderation(f)(hold())); assert.equal(f.state.products.get(P).moderationStatus, "clear"); assert.equal(f.state.products.get(P).moderationRevision, 0); });
test("transaction failure cannot partially apply moderation", async () => { const f = ready(); f.state.txFail = true; await assert.rejects(moderation(f)(hold())); assert.equal(f.state.products.get(P).moderationStatus, "clear"); assert.equal(f.state.audits.length, 0); });
test("invalid moderation state reason and revision are rejected", async () => {
  const f = ready(); for (const input of [{ ...hold(), status: "approved" }, { ...hold(), reason: "" }, { ...hold(), expectedRevision: -1 }, { ...hold(), expectedRevision: "0" }, { ...hold(), owner: A }]) assert.equal((await f.wrap(() => moderation(f)(input))).error.status, 400);
});
test("merchant edit and hold racing preserve both edited content and admin restriction", async () => {
  const f = ready(), service = f.load("@/lib/server/merchant-products");
  await Promise.all([f.as("clerk-a", () => service.saveMerchantProduct({ id: P, product: product({ title: "Merchant revision" }) })), moderation(f)(hold())]);
  assert.equal(f.state.products.get(P).title, "Merchant revision"); assert.equal(f.state.products.get(P).moderationStatus, "held"); assert.equal(await listing(f).getStorefrontProduct(P), null);
});
test("store suspension during edit denies public availability regardless of edit ordering", async () => {
  const f = ready(), service = f.load("@/lib/server/merchant-products"), admin = f.load("@/lib/server/admin-mutations");
  await Promise.allSettled([f.as("clerk-a", () => service.saveMerchantProduct({ id: P, product: product({ title: "Edited" }) })), admin.changeStoreOperation({ id: A, status: "suspended", expectedStatus: "active", reason: "Store investigation" })]);
  assert.equal(f.state.stores.get(A).status, "suspended"); assert.equal(await listing(f).getStorefrontProduct(P), null);
});
test("merchant cannot inject moderation fields through any ordinary product payload", async () => {
  const f = ready(); f.state.clerkId = "clerk-a";
  for (const extra of [{ moderationStatus: "clear" }, { moderationReason: "Override" }, { moderationRevision: 20 }]) {
    assert.equal((await f.products().updateProduct({ productId: P, product: extra })).error.status, 400);
    assert.equal((await f.wrap(() => f.load("@/lib/server/merchant-products").saveMerchantProduct({ id: P, product: product(extra) }))).error.status, 400);
  }
});
test("merchant archive and restore never clear administrative holds", async () => {
  const f = ready(); await moderation(f)(hold()); f.state.clerkId = "clerk-a"; const service = f.load("@/lib/server/merchant-products");
  await service.archiveMerchantProduct({ id: P, status: "archived" }); await service.archiveMerchantProduct({ id: P, status: "active" });
  assert.equal(f.state.products.get(P).moderationStatus, "held"); assert.equal(await listing(f).getStorefrontProduct(P), null); const own = await service.merchantProduct(P); assert.equal(own.moderationReason, hold().reason);
});
test("product image delivery enforces availability but allows private owner/admin review", async () => {
  const f = ready(), canRead = f.load("@/lib/server/image-visibility").canReadStoreImage, imageId = "6".repeat(24);
  f.state.products.get(Q).imageUrl = "/other.png"; f.state.clerkId = null; assert.equal(await canRead(imageId, A), true);
  f.state.products.get(P).moderationStatus = "held"; assert.equal(await canRead(imageId, A), false);
  f.state.clerkId = "clerk-a"; assert.equal(await canRead(imageId, A), true); f.state.clerkId = "clerk-b"; assert.equal(await canRead(imageId, A), false); f.state.clerkId = "clerk-d"; assert.equal(await canRead(imageId, A), true);
});
test("new Product schema requires store/owner and defaults to clear moderation", () => {
  const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), mongoose = require("mongoose");
  const source = ts.transpileModule(fs.readFileSync("lib/db/models/product.model.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loadedModel = { exports: {} }; vm.runInThisContext(`(function(require,module,exports){${source}})`)(name => name === "../../money" ? fixture().load("@/lib/money") : name.startsWith(".") ? {} : require(name), loadedModel, loadedModel.exports);
  const Model = loadedModel.exports.default, invalid = new Model(product()); assert(invalid.validateSync().errors.store); assert(invalid.validateSync().errors.owner);
  const valid = new Model({ ...product(), priceCents: 1250, store: A, owner: A }); assert.equal(valid.validateSync(), undefined); assert.equal(valid.moderationStatus, "clear"); assert.equal(valid.moderationRevision, 0); assert.equal(Model.schema.options.autoIndex, false); for (const fields of [{ priceCents: 1.5 }, { priceCents: -1 }, { priceCents: 1000000000 }, { currency: "ZZZ", priceCents: 1250 }, { currency: undefined, priceCents: 1250 }]) assert(new Model({ ...product(), store: A, owner: A, ...fields }).validateSync());
  assert.equal(new Model({ ...product({ currency: undefined }), store: A, owner: A }).validateSync(), undefined);
  mongoose.deleteModel("Product");
});
const args = ["--environment", "staging", "--database", "dreamshop_staging", "--confirm-database", "dreamshop_staging", "--check"];
const env = { MONGODB_URI: "mongodb://127.0.0.1:27017/dreamshop_staging" };
test("provisioning requires an explicit verified database and mode", () => {
  assert.equal(targetConfiguration(args, env).apply, false); for (const flags of [[], ["--environment", "staging"], args.filter(v => v !== "--check"), [...args, "--apply"]]) assert.throws(() => targetConfiguration(flags, env));
  assert.throws(() => targetConfiguration(args, { ...env, MONGODB_DB_NAME: "other" })); assert.throws(() => targetConfiguration(args, { MONGODB_URI: "mongodb://localhost/other" }));
});
test("production targeting requires separate explicit safeguards even in check mode", () => {
  assert.throws(() => targetConfiguration(args, { ...env, NODE_ENV: "production" }));
  const flags = args.map(v => v === "staging" ? "production" : v); assert.throws(() => targetConfiguration(flags, env)); assert.equal(targetConfiguration([...flags, "--allow-production", "--confirm-production", "dreamshop_staging"], env).environment, "production");
});
function fakeDb() {
  const collections = new Map(), created = []; let drops = 0;
  return { collections, created, get drops() { return drops; }, listCollections: () => ({ toArray: async () => [...collections.keys()].map(name => ({ name })) }), createCollection: async name => { collections.set(name, [{ key: { _id: 1 }, unique: true }]); },
    collection: name => ({ listIndexes: () => ({ toArray: async () => collections.get(name) ?? [] }), createIndex: async (key, options) => { created.push({ name, key, options }); collections.get(name).push({ key, ...options }); }, dropIndex: async () => { drops++; }, deleteMany: async () => { drops++; } }), dropDatabase: async () => { drops++; } };
}
test("provisioning is repeatable and preserves unrelated indexes and data", async () => {
  const db = fakeDb(); db.collections.set("users", [{ key: { unrelated: 1 } }]); await provision(db, { apply: true }); const first = db.created.length;
  const second = await provision(db, { apply: true }); assert.equal(second.conflicts, 0); assert.equal(db.created.length, first); assert(db.collections.get("users").some(i => i.key.unrelated)); assert.equal(db.drops, 0);
});
test("read-only provisioning reports missing collections/indexes without writes", async () => { const db = fakeDb(); const result = await provision(db, { apply: false }); assert(result.results.some(r => r.collection === "wishlists" && r.status === "missing")); assert.equal(db.collections.size, 0); assert.equal(db.created.length, 0); });
test("conflicting unique index properties fail without dropping indexes", async () => { const db = fakeDb(); db.collections.set("users", [{ key: { clerkId: 1 }, unique: false }]); const result = await provision(db, { apply: true }); assert.equal(result.conflicts, 1); assert.equal(db.collections.get("users")[0].unique, false); assert.equal(db.drops, 0); });
test("index creation errors are reported without raw server details", async () => { const db = fakeDb(); const original = db.collection; db.collection = name => ({ ...original(name), createIndex: async () => { throw { code: 11000, message: "secret server information" }; } }); const result = await provision(db, { apply: true }); assert(result.conflicts > 0); assert(!JSON.stringify(result).includes("secret")); });
test("manifest declares critical unique indexes and no expiry for cart receipts", () => {
  for (const [collection, key] of [["users", "clerkId"], ["stores", "owner"], ["stores", "slug"], ["categories", "name"], ["carts", "user"]]) assert(manifest[collection].some(i => i.key[key] && i.unique));
  assert(!manifest.carts.some(i => i.expireAfterSeconds)); assert.deepEqual(manifest.wishlists, []); assert.deepEqual(manifest.merchantapplications, []);
});

test("provisioning manifest matches all marketplace schema indexes and disables automatic DDL", () => {
  const mongoose = require("mongoose"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
  const collections = new Set();
  for (const name of ["user", "store", "product", "category", "cart", "wishlist", "merchant-application", "store-image", "authorization"]) {
    const filename = path.join(__dirname, "../lib/db/models", name + ".model.ts");
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const loaded = { exports: {} };
    vm.runInThisContext('(function(require,module,exports){' + source + '\n})')(name => name.startsWith(".") ? {} : require(name), loaded, loaded.exports);
    for (const model of Object.values(loaded.exports).filter(value => value?.schema)) {
      collections.add(model.collection.name);
      assert.equal(model.schema.options.autoIndex, false); assert.equal(model.schema.options.autoCreate, false);
      const expected = manifest[model.collection.name].map(i => JSON.stringify([i.key, !!i.unique])).sort();
      const actual = model.schema.indexes().map(([key, options]) => JSON.stringify([key, !!options.unique])).sort();
      assert.deepEqual(actual, expected, model.collection.name); mongoose.deleteModel(model.modelName);
    }
  }
  assert.equal(collections.size, Object.keys(manifest).length);
});
