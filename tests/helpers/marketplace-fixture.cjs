/* eslint-disable @typescript-eslint/no-require-imports */
const { aggregate: eligibilityAggregate } = require("./eligibility-aggregate.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const { AsyncLocalStorage } = require("node:async_hooks");
const { bootstrapSuperAdmin } = require("../../scripts/bootstrap-super-admin.cjs");
const root = path.resolve(__dirname, "../.."), A = "a".repeat(24), B = "b".repeat(24), D = "d".repeat(24);
const P = "1".repeat(24), Q = "2".repeat(24), O = "3".repeat(24), C = "4".repeat(24), E = "5".repeat(24);
const product = (extra = {}) => ({ title: "Item", description: "Description", imageUrl: "/api/store-images/666666666666666666666666", price: "12.50", currency: "EUR", category: C, tags: ["test"], ...extra });
function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some(part => matches(record, part));
    if (key === "$and") return value.every(part => matches(record, part));
    const actual = record[key];
    if (value && typeof value === "object") {
      if ("$regex" in value) return new RegExp(value.$regex, value.$options).test(String(actual));
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
  const state = { clerkId: "clerk-a", users: new Map(), products: new Map(), categories: new Map(), audits: [], control: null, stores: new Map(), images: new Map(), applications: new Map(),
    queryLog: [], readLog: [], auditFail: false, txFail: false, beforeTransaction: null, indexes: [{ key: { clerkId: 1 }, unique: true }] };
  for (const [id, clerkId] of [[A, "clerk-a"], [B, "clerk-b"], [D, "clerk-d"]]) state.users.set(id,
    { _id: id, clerkId, status: "active", applicationStatus: "active", merchantStatus: "none", superAdmin: false, __v: 0 });
  state.categories.set(C, { _id: C, name: "Category", private: "secret" }); state.categories.set(E, { _id: E, name: "Empty" });
  for (const [id, owner] of [[P, A], [Q, B], [O, undefined]]) state.products.set(id, { _id: id, ...product({ currency: undefined }), owner, store: owner, status: "active", moderationStatus: "clear", moderationRevision: 0, __v: 0 });
  let counter = 100, queue = Promise.resolve();
  function query(get, kind) {
    const log = { kind }; state.readLog.push(log);
    return { session(value) { assert(value?.testSession); return this; }, select(fields) { log.fields = fields; return this; }, readConcern(value) { assert.equal(value, "majority"); return this; },
      maxTimeMS(ms) { log.timeout = ms; return this; }, limit(n) { log.limit = n; this.limitValue = n; return this; }, skip(n) { this.skipValue = n; return this; }, sort(value) { this.sortValue = value; log.sort = value; return this; }, populate() { this.populateProducts = true; return this; }, then(resolve, reject) {
        return Promise.resolve().then(() => {
          let result = structuredClone(get());
          if (this.populateProducts && kind === "products") {
            const populate = (item) => item ? { ...item, category: state.categories.get(item.category) ?? null } : item;
            result = Array.isArray(result) ? result.map(populate) : populate(result);
          }
          if (Array.isArray(result) && this.sortValue) result.sort((a, b) => { for (const [key, direction] of Object.entries(this.sortValue)) { if (a[key] > b[key]) return direction; if (a[key] < b[key]) return -direction; } return 0; });
          if (Array.isArray(result)) result = result.slice(this.skipValue ?? 0, this.limitValue === undefined ? undefined : (this.skipValue ?? 0) + this.limitValue);
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
      aggregate(pipeline) { if (pipeline.some(stage => stage.$lookup)) return { option: async () => eligibilityAggregate(pipeline, { products: [...state.products.values()], stores: [...state.stores.values()], users: [...state.users.values()], categories: [...state.categories.values()] }) }; const rows = [...state[kind].values()].filter(r => matches(r, pipeline[0].$match)); return { option: async () => rows.length ? [{ total: rows.length, archived: rows.filter(r => r.status === "archived").length, categories: [...new Set(rows.map(r => r.category))] }] : [] }; },
      find(filter) { return query(() => [...state[kind].values()].filter((r) => matches(r, filter)), kind); },
      findOne(filter) { return query(() => [...state[kind].values()].find((r) => matches(r, filter)) ?? null, kind); },
      findById(id) { return query(() => state[kind].get(id) ?? null, kind); },
      exists(filter) { return query(() => [...state[kind].values()].some((r) => matches(r, filter)) ? { _id: "found" } : null); },
      countDocuments(filter) { return query(() => [...state[kind].values()].filter((r) => matches(r, filter)).length); },
      async create(records, options) {
        assert(options.session?.testSession);
        return records.map((record) => {
          if (kind === "stores" && [...state.stores.values()].some(r => r.owner === record.owner || r.slug === record.slug)) throw { code: 11000 };
          if (kind === "categories" && [...state.categories.values()].some((r) => r.name === record.name)) throw { code: 11000 };
          const value = { _id: String(counter++).padStart(24, "0"), createdAt: new Date(), ...structuredClone(record), __v: 0 };
          state[kind].set(value._id, value); return structuredClone(value);
        });
      },
      async updateOne(filter, update, options) {
        assert(options.session?.testSession); assert.equal(options.runValidators, true);
        let record = [...state[kind].values()].find((r) => matches(r, filter));
        if (!record && options.upsert) { record = { _id: filter._id }; state[kind].set(record._id, record); }
        if (!record) return { modifiedCount: 0, matchedCount: 0 }; apply(record, update); return { modifiedCount: 1, matchedCount: 1 };
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
      const snapshot = structuredClone({ users: state.users, products: state.products, categories: state.categories, audits: state.audits, control: state.control, stores: state.stores, images: state.images, applications: state.applications });
      try { return await operation({ testSession: true }); }
      catch (error) { Object.assign(state, snapshot); throw error; }
    };
    const result = queue.then(execute); queue = result.catch(() => {}); return result;
  }
  const control = {
    findOne() { return query(() => state.control, "control"); },
    async updateOne(filter, update, options) {
      assert.equal(filter._id, "marketplace");
      if (!state.control && options.upsert) state.control = { _id: "marketplace", ...update.$setOnInsert };
      if (state.control) apply(state.control, update); return { modifiedCount: 1 };
    },
  };
  const models = { stores: model("stores"), images: model("images"), applications: model("applications"), users: model("users"), products: model("products"), categories: model("categories") };
  const mocks = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: context.getStore() ?? state.clerkId }) },
    "lib/db/connection.ts": { connectDB: async () => ({ connection: { transaction } }) },
    "lib/db/models/store.model.ts": { default: models.stores }, "lib/db/models/store-image.model.ts": { default: models.images }, "lib/db/models/merchant-application.model.ts": { default: models.applications },
    "lib/db/models/user.model.ts": { default: models.users }, "lib/db/models/product.model.ts": { default: models.products },
    "lib/db/models/category.model.ts": { default: models.categories },
    "lib/db/models/authorization.model.ts": { AuthorizationControl: control, AuthorizationAudit: { find(filter) { return query(() => state.audits.filter(r => matches(r, filter)).map((r, i) => ({ _id: String(i), ...r })), "audits"); }, async create(records, options) {
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
    merchant(id = A, setup = true) { state.users.get(id).merchantStatus = "approved"; if (setup) { state.stores.set(id, { _id: id, owner: id, name: "Test store", slug: id, description: "Store description", contactEmail: "owner@example.test", status: "active" }); state.images.set("6".repeat(24), { _id: "6".repeat(24), store: id, mime: "image/webp" }); } }, admin(id = A) { state.users.get(id).superAdmin = true; },
    products: () => load("@/lib/actions/product.action.ts"), categories: () => load("@/lib/actions/category.actions.ts"),
    access: () => load("@/lib/server/access-management.ts"), wrap: (fn) => load("@/lib/server/marketplace-response.ts").marketplaceResult(fn) };
}

module.exports = { fixture, A, B, D, P, Q, O, C, E, product, root, bootstrapSuperAdmin };
