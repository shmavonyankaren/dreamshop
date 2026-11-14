/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const { AsyncLocalStorage } = require("node:async_hooks");
const { bootstrapSuperAdmin } = require("../scripts/bootstrap-super-admin.cjs");
const root = path.resolve(__dirname, ".."), A = "a".repeat(24), B = "b".repeat(24), D = "d".repeat(24);
const P = "1".repeat(24), Q = "2".repeat(24), O = "3".repeat(24), C = "4".repeat(24), E = "5".repeat(24);
const product = (extra = {}) => ({ title: "Item", description: "Description", imageUrl: "/item.png", price: "12.50", category: C, tags: ["test"], ...extra });
function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    const actual = record[key];
    if (value && typeof value === "object") {
      if ("$in" in value) return value.$in.includes(actual ?? null);
      if ("$nin" in value) return !value.$nin.includes(actual);
      if ("$ne" in value) return actual !== value.$ne;
      if ("$exists" in value) return (actual !== undefined) === value.$exists;
    }
    return actual === value;
  });
}
function fixture() {
  const context = new AsyncLocalStorage();
  const state = { clerkId: "clerk-a", users: new Map(), products: new Map(), categories: new Map(), audits: [], control: null,
    queryLog: [], auditFail: false, txFail: false, beforeTransaction: null, indexes: [{ key: { clerkId: 1 }, unique: true }] };
  for (const [id, clerkId] of [[A, "clerk-a"], [B, "clerk-b"], [D, "clerk-d"]]) state.users.set(id,
    { _id: id, clerkId, status: "active", applicationStatus: "active", merchantStatus: "none", superAdmin: false, __v: 0 });
  state.categories.set(C, { _id: C, name: "Category", private: "secret" }); state.categories.set(E, { _id: E, name: "Empty" });
  for (const [id, owner] of [[P, A], [Q, B], [O, undefined]]) state.products.set(id, { _id: id, ...product(), owner, __v: 0 });
  let counter = 100, queue = Promise.resolve();
  function query(get, kind) {
    return { session(value) { assert(value?.testSession); return this; }, select() { return this; }, readConcern(value) { assert.equal(value, "majority"); return this; },
      sort() { return this; }, populate() { this.populateProducts = true; return this; }, then(resolve, reject) {
        return Promise.resolve().then(() => {
          let result = structuredClone(get());
          if (this.populateProducts && kind === "products") {
            const populate = (item) => item ? { ...item, category: state.categories.get(item.category) ?? null } : item;
            result = Array.isArray(result) ? result.map(populate) : populate(result);
          }
          return result;
        }).then(resolve, reject);
      } };
  }
  const apply = (record, update) => {
    Object.assign(record, structuredClone(update.$set ?? {}));
    for (const [key, value] of Object.entries(update.$inc ?? {})) record[key] = (record[key] ?? 0) + value;
  };
  function model(kind) {
    return {
      find(filter) { return query(() => [...state[kind].values()].filter((r) => matches(r, filter)), kind); },
      findOne(filter) { return query(() => [...state[kind].values()].find((r) => matches(r, filter)) ?? null, kind); },
      findById(id) { return query(() => state[kind].get(id) ?? null, kind); },
      exists(filter) { return query(() => [...state[kind].values()].some((r) => matches(r, filter)) ? { _id: "found" } : null); },
      countDocuments(filter) { return query(() => [...state[kind].values()].filter((r) => matches(r, filter)).length); },
      async create(records, options) {
        assert(options.session?.testSession);
        return records.map((record) => {
          if (kind === "categories" && [...state.categories.values()].some((r) => r.name === record.name)) throw { code: 11000 };
          const value = { _id: String(counter++).padStart(24, "0"), ...structuredClone(record), __v: 0 };
          state[kind].set(value._id, value); return structuredClone(value);
        });
      },
      async updateOne(filter, update, options) {
        assert(options.session?.testSession); assert.equal(options.runValidators, true);
        const record = [...state[kind].values()].find((r) => matches(r, filter));
        if (!record) return { modifiedCount: 0 }; apply(record, update); return { modifiedCount: 1 };
      },
      findOneAndUpdate(filter, update, options) {
        assert(options.session?.testSession); assert.equal(options.runValidators, true);
        state.queryLog.push({ kind, filter: structuredClone(filter), update: structuredClone(update) });
        return query(() => {
          const record = [...state[kind].values()].find((r) => matches(r, filter)); if (!record) return null;
          if (kind === "categories" && [...state.categories.values()].some((r) => r._id !== record._id && r.name === update.$set.name)) throw { code: 11000 };
          apply(record, update); return record;
        }, kind);
      },
      async deleteOne(filter, options) {
        assert(options.session?.testSession); state.queryLog.push({ kind, filter: structuredClone(filter) });
        const record = [...state[kind].values()].find((r) => matches(r, filter)); if (!record) return { deletedCount: 0 };
        state[kind].delete(record._id); return { deletedCount: 1 };
      },
      async deleteMany(filter, options) {
        assert(options.session?.testSession); state.queryLog.push({ kind, filter: structuredClone(filter) });
        const records = [...state[kind].values()].filter((r) => matches(r, filter)); records.forEach((r) => state[kind].delete(r._id));
        return { deletedCount: records.length };
      },
    };
  }
  async function transaction(operation, options) {
    assert.equal(options.readConcern.level, "snapshot"); assert.equal(options.writeConcern.w, "majority");
    if (state.txFail) throw new Error("Transactions not supported; private server detail");
    const execute = async () => {
      if (state.beforeTransaction) { const hook = state.beforeTransaction; state.beforeTransaction = null; hook(); }
      const snapshot = structuredClone({ users: state.users, products: state.products, categories: state.categories, audits: state.audits, control: state.control });
      try { return await operation({ testSession: true }); }
      catch (error) { Object.assign(state, snapshot); throw error; }
    };
    const result = queue.then(execute); queue = result.catch(() => {}); return result;
  }
  const control = {
    async updateOne(filter, update, options) {
      assert.equal(filter._id, "marketplace");
      if (!state.control && options.upsert) state.control = { _id: "marketplace", ...update.$setOnInsert };
      if (state.control) apply(state.control, update); return { modifiedCount: 1 };
    },
  };
  const models = { users: model("users"), products: model("products"), categories: model("categories") };
  const mocks = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: context.getStore() ?? state.clerkId }) },
    "lib/db/connection.ts": { connectDB: async () => ({ connection: { transaction } }) },
    "lib/db/models/user.model.ts": { default: models.users }, "lib/db/models/product.model.ts": { default: models.products },
    "lib/db/models/category.model.ts": { default: models.categories },
    "lib/db/models/authorization.model.ts": { AuthorizationControl: control, AuthorizationAudit: { async create(records, options) {
      assert(options.session?.testSession); if (state.auditFail) throw new Error("Audit unavailable"); state.audits.push(...structuredClone(records)); return records;
    } } },
  };
  const cache = new Map();
  function load(spec, parent = path.join(root, "index.ts")) {
    if (spec === "server-only") return {};
    if (mocks[spec]) return mocks[spec];
    if (!spec.startsWith(".") && !spec.startsWith("@/") && !path.isAbsolute(spec)) return require(spec);
    let filename = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(parent), spec);
    if (!path.extname(filename) || filename.endsWith(".actions") || filename.endsWith(".action") || filename.endsWith(".model")) filename += ".ts";
    if (!fs.existsSync(filename) && filename.endsWith(".ts")) filename = filename.slice(0, -3) + ".tsx";
    const relative = path.relative(root, filename).replaceAll(path.sep, "/");
    if (mocks[relative]) return { __esModule: true, ...mocks[relative] };
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    new vm.Script("(function(require,module,exports,console){" + output + "\n})", { filename }).runInThisContext()(
      (id) => load(id, filename), loaded, loaded.exports, { error() {} });
    return loaded.exports;
  }
  const client = {
    db() { return { collection(name) {
      if (name === "authorization_controls") return { ...control,
        async findOneAndUpdate(filter, update, options) { await control.updateOne(filter, update, options); return structuredClone(state.control); } };
      if (name === "authorization_audits") return { async insertOne(record) { if (state.auditFail) throw new Error("Audit unavailable"); state.audits.push(structuredClone(record)); } };
      return { async findOne(filter) { return [...state.users.values()].find((r) => matches(r, filter)) ?? null; },
        async countDocuments(filter) { return [...state.users.values()].filter((r) => matches(r, filter)).length; },
        async updateOne(filter, update) { const user = [...state.users.values()].find((r) => matches(r, filter)); apply(user, update); },
        listIndexes() { return { async toArray() { return state.indexes; } }; } };
    } }; },
    startSession() { return { withTransaction: transaction, async endSession() {} }; },
  };
  return { state, load, client, as: (clerkId, action) => context.run(clerkId, action),
    merchant(id = A) { state.users.get(id).merchantStatus = "approved"; }, admin(id = A) { state.users.get(id).superAdmin = true; },
    products: () => load("@/lib/actions/product.action.ts"), categories: () => load("@/lib/actions/category.actions.ts"),
    access: () => load("@/lib/server/access-management.ts"), wrap: (fn) => load("@/lib/server/marketplace-response.ts").marketplaceResult(fn) };
}
const failure = (result, status, code) => { assert.equal(result.ok, false); assert.equal(result.error.status, status); if (code) assert.equal(result.error.code, code); };
const change = (extra) => ({ userId: B, reason: "Reviewed by platform operator", ...extra });

test("public product/category browsing remains available to signed-out and suspended users", async () => {
  const f = fixture(); f.state.clerkId = null;
  assert.equal((await f.products().getAllProducts()).length, 3); assert.equal((await f.categories().getAllCategories()).length, 2);
  const item = await f.products().getProductById(P); assert.equal(item._id, P); assert.equal(item.owner, undefined);
  assert.equal((await f.products().getProductsByUser(A)).length, 1);
  f.state.clerkId = "clerk-a"; f.state.users.get(A).applicationStatus = "suspended";
  assert.equal((await f.products().getAllProducts()).length, 3);
});
test("unauthenticated mutation returns a controlled 401", async () => {
  const f = fixture(); f.state.clerkId = null; failure(await f.products().createProduct(product()), 401);
});
for (const status of ["none", "pending", "rejected", "suspended"]) test(status + " merchants cannot create products", async () => {
  const f = fixture(); f.state.users.get(A).merchantStatus = status; failure(await f.products().createProduct(product()), 403);
  assert.equal(f.state.products.size, 3);
});
test("customers cannot update or delete products, including ones they historically own", async () => {
  const f = fixture(); failure(await f.products().updateProduct({ productId: P, product: { title: "Changed" } }), 403);
  failure(await f.products().deleteProduct({ productId: P }), 403); failure(await f.products().deleteAllProductsByUser(), 403);
});
test("approved merchants create products with server-derived ownership and safe DTOs", async () => {
  const f = fixture(); f.merchant(); const result = await f.products().createProduct(product());
  assert.equal(result.ok, true); assert.equal(f.state.products.get(result.data._id).owner, A);
  assert.equal(result.data.owner, undefined); assert.equal(result.data.category.private, undefined);
});
test("client-supplied creation owner and role fields are rejected", async () => {
  const f = fixture(); f.merchant();
  for (const extra of [{ owner: B }, { userId: B }, { superAdmin: true }, { $set: { owner: B } }]) failure(await f.products().createProduct(product(extra)), 400);
  assert.equal(f.state.products.size, 3);
});
test("merchants update their own product using an owner-constrained validated mutation", async () => {
  const f = fixture(); f.merchant(); const result = await f.products().updateProduct({ productId: P, product: { title: "Updated" } });
  assert.equal(result.ok, true); assert.equal(result.data.title, "Updated");
  assert.deepEqual(f.state.queryLog.at(-1).filter, { _id: P, owner: A }); assert.equal(f.state.products.get(P).__v, 1);
});
test("other-owner and missing products have the same controlled update/delete response", async () => {
  const f = fixture(); f.merchant();
  for (const id of [Q, "f".repeat(24), O]) {
    failure(await f.products().updateProduct({ productId: id, product: { title: "Steal" } }), 404, "NOT_FOUND");
    failure(await f.products().deleteProduct({ productId: id }), 404, "NOT_FOUND");
  }
  assert.equal(f.state.products.size, 3);
});
test("ordinary and administrative updates cannot transfer ownership or change internal fields", async () => {
  const f = fixture(); f.merchant(); f.admin();
  for (const update of [{ owner: B }, { __v: 99 }, { createdAt: "now" }, { $set: { owner: B } }]) {
    failure(await f.products().updateProduct({ productId: P, product: update }), 400);
    failure(await f.products().adminUpdateProduct({ productId: P, product: update }), 400);
  }
  failure(await f.products().updateProduct({ productId: P, userId: A, product: { title: "x" } }), 400);
  assert.equal(f.state.products.get(P).owner, A);
});
test("invalid product fields, IDs and category references are rejected", async () => {
  const f = fixture(); f.merchant();
  for (const input of [product({ title: " " }), product({ price: "-1" }), product({ price: 2 }), product({ price: "1e3" }),
    product({ category: "bad" }), product({ imageUrl: "javascript:alert(1)" }), product({ tags: [4] })]) failure(await f.products().createProduct(input), 400);
  failure(await f.products().createProduct(product({ category: "f".repeat(24) })), 400, "INVALID_CATEGORY");
  failure(await f.products().updateProduct({ productId: P, product: {} }), 400);
  failure(await f.products().updateProduct({ productId: P, product: { category: "f".repeat(24) } }), 400);
});
test("merchant single deletion is owner-scoped and leaves unrelated products", async () => {
  const f = fixture(); f.merchant(); assert.equal((await f.products().deleteProduct({ productId: P })).ok, true);
  assert(f.state.products.has(Q)); assert(f.state.products.has(O)); assert.deepEqual(f.state.queryLog.at(-1).filter, { _id: P, owner: A });
});
test("mixed-owner or missing bulk deletion is atomic and rejects the whole request", async () => {
  const f = fixture(); f.merchant();
  for (const productIds of [[P, Q], [P, O], [P, "f".repeat(24)]]) failure(await f.products().deleteProducts({ productIds }), 404);
  assert.equal(f.state.products.size, 3); failure(await f.products().deleteProducts({ productIds: [P, P] }), 400);
  assert.equal((await f.products().deleteProducts({ productIds: [P] })).ok, true); assert(f.state.products.has(Q));
});
test("legacy bulk action rejects supplied owner IDs and deletes only the actor's records", async () => {
  const f = fixture(); f.merchant(); failure(await f.products().deleteAllProductsByUser(B), 400);
  failure(await f.products().deleteAllProductsByUser({ userId: B }), 400);
  assert.deepEqual(await f.products().deleteAllProductsByUser(), { ok: true, data: { deletedCount: 1 } }); assert(f.state.products.has(Q));
});
test("administrative product operations require explicit platform capability", async () => {
  const f = fixture(); f.merchant(); failure(await f.products().adminUpdateProduct({ productId: Q, product: { title: "No" } }), 403);
  failure(await f.products().adminDeleteProduct({ productId: Q }), 403);
  f.admin(); assert.equal((await f.products().adminUpdateProduct({ productId: O, product: { title: "Repair text" } })).ok, true);
  assert.equal(f.state.products.get(O).owner, undefined);
  assert.equal((await f.products().adminDeleteProducts({ productIds: [P, Q] })).ok, true);
});
test("Super Admin may create products but cannot supply an arbitrary owner", async () => {
  const f = fixture(); f.admin(); assert.equal((await f.products().createProduct(product())).ok, true);
  failure(await f.products().createProduct(product({ owner: B })), 400);
});
for (const merchant of [false, true]) test((merchant ? "merchants" : "customers") + " cannot mutate categories", async () => {
  const f = fixture(); if (merchant) f.merchant();
  failure(await f.categories().createCategory({ categoryName: "New" }), 403);
  failure(await f.categories().updateCategory({ categoryId: C, categoryName: "New" }), 403);
  failure(await f.categories().deleteCategory({ categoryId: E }), 403);
});
test("Super Admin creates and renames categories with validated safe responses", async () => {
  const f = fixture(); f.admin(); const created = await f.categories().createCategory({ categoryName: "  New  " });
  assert.equal(created.ok, true); assert.equal(created.data.name, "New"); assert.deepEqual(Object.keys(created.data).sort(), ["_id", "name"]);
  assert.equal((await f.categories().updateCategory({ categoryId: C, categoryName: "Renamed" })).ok, true);
  failure(await f.categories().createCategory({ categoryName: " " }), 400);
  failure(await f.categories().createCategory({ categoryName: "Renamed" }), 409);
});
test("category deletion preserves referenced categories and removes unused ones", async () => {
  const f = fixture(); f.admin(); failure(await f.categories().deleteCategory({ categoryId: C }), 409, "CATEGORY_IN_USE");
  assert.equal((await f.categories().deleteCategory({ categoryId: E })).ok, true); assert(f.state.categories.has(C));
});
test("category deletion versus product creation cannot leave a dangling reference", async () => {
  const f = fixture(); f.admin(); const outcomes = await Promise.all([f.categories().deleteCategory({ categoryId: E }), f.products().createProduct(product({ category: E }))]);
  assert.equal(outcomes.filter((r) => r.ok).length, 1);
  for (const item of f.state.products.values()) assert(f.state.categories.has(item.category));
});
for (const flags of [{ status: "deleted" }, { status: "suspended" }, { applicationStatus: "suspended" }]) test(JSON.stringify(flags) + " denies all privileged mutation even with admin and merchant flags", async () => {
  const f = fixture(); f.admin(); f.merchant(); Object.assign(f.state.users.get(A), flags);
  failure(await f.products().createProduct(product()), 403); failure(await f.categories().createCategory({ categoryName: "No" }), 403);
  failure(await f.wrap(() => f.access().reviewMerchantAccess(change({ status: "approved" }))), 403);
});
test("authorization is rechecked after transaction acquisition", async () => {
  const f = fixture(); f.merchant(); f.state.beforeTransaction = () => { f.state.users.get(A).merchantStatus = "suspended"; };
  failure(await f.products().createProduct(product()), 403); assert.equal(f.state.products.size, 3);
});
test("transaction-unavailable failures are sanitized and never fall back to unprotected writes", async () => {
  const f = fixture(); f.merchant(); f.state.txFail = true; const result = await f.products().createProduct(product());
  failure(result, 503); assert(!JSON.stringify(result).includes("private")); assert.equal(f.state.products.size, 3);
});
test("merchant application remains pending, is idempotent, and grants no product capability", async () => {
  const f = fixture(), actions = f.load("@/lib/actions/merchant.actions.ts");
  assert.equal((await actions.applyForMerchant()).ok, true); assert.equal((await actions.applyForMerchant()).ok, true);
  assert.equal(f.state.users.get(A).merchantStatus, "pending"); assert.equal(f.state.audits.length, 1);
  failure(await f.products().createProduct(product()), 403);
});
test("merchant approval, suspension and revocation require an admin and are audited", async () => {
  const f = fixture(); f.state.users.get(B).merchantStatus = "pending";
  failure(await f.wrap(() => f.access().reviewMerchantAccess(change({ status: "approved" }))), 403);
  f.admin();
  for (const status of ["approved", "suspended", "approved", "none"]) assert.equal((await f.wrap(() => f.access().reviewMerchantAccess(change({ status })))).ok, true);
  assert.equal(f.state.audits.length, 4); assert(f.state.audits.every((r) => r.actor === A && r.target === B && r.reason));
});
test("rejected and suspended applicants cannot self-approve or bypass review by reapplying", async () => {
  const f = fixture(); for (const merchantStatus of ["rejected", "suspended"]) {
    f.state.users.get(A).merchantStatus = merchantStatus;
    failure(await f.wrap(() => f.access().requestMerchantAccess()), 409);
  }
  f.admin(); failure(await f.wrap(() => f.access().reviewMerchantAccess(change({ status: "approved" }))), 409);
});
test("audit failure rolls back the permission change", async () => {
  const f = fixture(); f.admin(); f.state.users.get(B).merchantStatus = "pending"; f.state.auditFail = true;
  failure(await f.wrap(() => f.access().reviewMerchantAccess(change({ status: "approved" }))), 503);
  assert.equal(f.state.users.get(B).merchantStatus, "pending"); assert.equal(f.state.audits.length, 0);
});
test("privileged role assignment requires admin authority and an active target", async () => {
  const f = fixture(); failure(await f.wrap(() => f.access().setSuperAdminAccess(change({ enabled: true }))), 403);
  f.admin(); f.state.users.get(B).status = "deleted"; failure(await f.wrap(() => f.access().setSuperAdminAccess(change({ enabled: true }))), 409);
  f.state.users.get(B).status = "active"; assert.equal((await f.wrap(() => f.access().setSuperAdminAccess(change({ enabled: true })))).ok, true);
  assert.equal(f.state.users.get(B).superAdmin, true); assert.equal(f.state.audits.at(-1).action, "superAdmin.access");
});
test("last active Super Admin cannot be demoted or locally suspended", async () => {
  const f = fixture(); f.admin();
  failure(await f.wrap(() => f.access().setSuperAdminAccess(change({ userId: A, enabled: false }))), 409, "LAST_ADMIN");
  failure(await f.wrap(() => f.access().setApplicationStatus(change({ userId: A, status: "suspended" }))), 409, "LAST_ADMIN");
  f.admin(B); f.state.users.get(B).status = "deleted";
  failure(await f.wrap(() => f.access().setSuperAdminAccess(change({ userId: A, enabled: false }))), 409, "LAST_ADMIN");
});
test("concurrent cross-demotions cannot remove both remaining active administrators", async () => {
  const f = fixture(); f.admin(); f.admin(B);
  const results = await Promise.all([
    f.as("clerk-a", () => f.wrap(() => f.access().setSuperAdminAccess(change({ userId: B, enabled: false })))),
    f.as("clerk-b", () => f.wrap(() => f.access().setSuperAdminAccess(change({ userId: A, enabled: false })))),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1); assert.equal([...f.state.users.values()].filter((r) => r.superAdmin).length, 1);
});
test("application suspension is independent of Clerk and merchant state and is audited", async () => {
  const f = fixture(); f.admin(); f.merchant(B);
  assert.equal((await f.wrap(() => f.access().setApplicationStatus(change({ status: "suspended" })))).ok, true);
  assert.equal(f.state.users.get(B).status, "active"); assert.equal(f.state.users.get(B).merchantStatus, "approved");
  failure(await f.as("clerk-b", () => f.products().createProduct(product())), 403);
});
test("route policy keeps merchant/admin areas distinct and approved merchants retain customer capability", async () => {
  const f = fixture(), policy = f.load("@/lib/server/authorization.ts");
  await policy.requireRouteAccess("account"); await assert.rejects(policy.requireRouteAccess("merchant")); await assert.rejects(policy.requireRouteAccess("admin"));
  f.merchant(); await policy.requireRouteAccess("account"); await policy.requireRouteAccess("merchant"); await assert.rejects(policy.requireRouteAccess("admin"));
  f.admin(); await policy.requireRouteAccess("admin");
});
test("legacy users default to customers and ownerless products require explicit administration", async () => {
  const f = fixture(), user = f.state.users.get(A); delete user.superAdmin; delete user.applicationStatus; delete user.merchantStatus;
  failure(await f.products().createProduct(product()), 403); f.merchant(); failure(await f.products().deleteProduct({ productId: O }), 404);
  f.admin(); assert.equal((await f.products().adminDeleteProduct({ productId: O })).ok, true);
});
test("operator bootstrap grants exactly one initial admin with an atomic audit and durable marker", async () => {
  const f = fixture(); await bootstrapSuperAdmin(f.client, "isolated", { clerkId: "clerk-a", operator: "test-operator", reason: "Initial provisioning" });
  assert.equal(f.state.users.get(A).superAdmin, true); assert.equal(f.state.control.bootstrapCompleted, true);
  assert.equal(f.state.audits[0].action, "superAdmin.bootstrap"); assert.equal(f.state.audits[0].actor, "operator:test-operator");
  await assert.rejects(bootstrapSuperAdmin(f.client, "isolated", { clerkId: "clerk-b", operator: "test", reason: "Again" }));
  assert.equal(f.state.users.get(B).superAdmin, false);
});
test("concurrent bootstrap attempts cannot create two initial administrators", async () => {
  const f = fixture(); const results = await Promise.allSettled(["clerk-a", "clerk-b"].map((clerkId) =>
    bootstrapSuperAdmin(f.client, "isolated", { clerkId, operator: "test", reason: "Initial provisioning" })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(f.state.audits.length, 1);
});
test("bootstrap audit failures, missing index, missing user and inactive user grant nothing", async () => {
  for (const variant of ["audit", "index", "missing", "inactive"]) {
    const f = fixture(); if (variant === "audit") f.state.auditFail = true; if (variant === "index") f.state.indexes = [];
    if (variant === "inactive") f.state.users.get(A).applicationStatus = "suspended";
    await assert.rejects(bootstrapSuperAdmin(f.client, "isolated", { clerkId: variant === "missing" ? "unknown" : "clerk-a", operator: "test", reason: "Initial provisioning" }));
    assert.equal(f.state.users.get(A).superAdmin, false); assert.equal(f.state.audits.length, 0); assert.equal(f.state.control.bootstrapCompleted, false);
  }
});
test("role assignment remains server-only with no exported role-changing Server Action", () => {
  const f = fixture(); assert.deepEqual(Object.keys(f.load("@/lib/actions/merchant.actions.ts")).sort(), ["applyForMerchant", "reviewMerchantApplication"]);
  assert.match(fs.readFileSync(path.join(root, "lib/server/access-management.ts"), "utf8"), /import "server-only"/);
});
test("corrupt account states do not count as an active replacement administrator", async () => {
  const f = fixture(); f.admin(); f.admin(B); f.state.users.get(B).applicationStatus = "unknown";
  failure(await f.wrap(() => f.access().setSuperAdminAccess(change({ userId: A, enabled: false }))), 409, "LAST_ADMIN");
});
test("real authorization schemas use fixed collections and validate audit identity/reason fields", () => {
  const mongoose = require("mongoose"), filename = path.join(root, "lib/db/models/authorization.model.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} }; new vm.Script("(function(require,module,exports){" + output + "\n})").runInThisContext()(require, loaded, loaded.exports);
  const { AuthorizationControl, AuthorizationAudit } = loaded.exports;
  assert.equal(AuthorizationControl.collection.name, "authorization_controls"); assert.equal(AuthorizationAudit.collection.name, "authorization_audits");
  const control = new AuthorizationControl({ _id: "marketplace" }); assert.equal(control.validateSync(), undefined); assert.equal(control.bootstrapCompleted, false);
  assert(new AuthorizationAudit({}).validateSync());
  const audit = new AuthorizationAudit({ actor: A, target: B, action: "superAdmin.access", before: false, after: true, reason: "Approved" });
  assert.equal(audit.validateSync(), undefined); assert.equal(audit.target.toString(), B);
  assert.equal(AuthorizationControl.schema.options.autoIndex, false); assert.equal(AuthorizationAudit.schema.options.autoIndex, false);
  mongoose.deleteModel("AuthorizationControl"); mongoose.deleteModel("AuthorizationAudit");
});

for (const area of ["account", "merchant", "admin"]) test("protected " + area + " layout enforces policy before returning its shell", async () => {
  const f = fixture();
  const { ProtectedWorkspace } = f.load("@/components/layout/ProtectedWorkspace.tsx");
  f.state.clerkId = null; await assert.rejects(ProtectedWorkspace({ area, children: "private" }));
  f.state.clerkId = "clerk-a";
  if (area !== "account") await assert.rejects(ProtectedWorkspace({ area, children: "private" }));
  if (area === "merchant") f.merchant();
  if (area === "admin") f.admin();
  const shell = await ProtectedWorkspace({ area, children: "private" });
  assert.equal(shell.props.area, area); assert.deepEqual(Object.keys(shell.props).sort(), ["area", "children"]);
  f.state.users.get(A).applicationStatus = "suspended";
  await assert.rejects(ProtectedWorkspace({ area, children: "private" }));
});
