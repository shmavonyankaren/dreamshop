/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const root = path.resolve(__dirname, ".."), C = "c".repeat(24), D = "d".repeat(24);
const id = n => String(n).padStart(24, "0");
function fixture() {
  const state = { products: Array.from({ length: 15 }, (_, n) => ({ _id: id(n + 1), title: `Item ${String(n).padStart(2, "0")}`, description: n === 0 ? "Special description" : "Description", tags: [n === 1 ? "unique-tag" : "tag"], price: String(n + 2), imageUrl: "/item.png", createdAt: n, category: n < 10 ? C : D, owner: { email: "private", clerkId: "secret" }, __v: 1 })), categories: [{ _id: C, name: "Category", private: "secret" }, { _id: D, name: "Other" }], log: [], failProducts: false, failCategories: false, connected: 0, requests: [], events: 0 };
  function matches(record, filter) {
    return Object.entries(filter ?? {}).every(([key, value]) => {
      if (key === "$or") return value.some(part => matches(record, part));
      if (value && typeof value === "object") {
        if ("$ne" in value) return record[key] !== value.$ne;
        if ("$regex" in value) return new RegExp(value.$regex, value.$options).test(String(record[key]));
      }
      return record[key] === value;
    });
  }
  function query(kind, filter, single = false, count = false) {
    const record = { kind, filter, count, skip: 0 }; state.log.push(record);
    return { select(fields) { record.fields = fields; return this; }, populate(options) { assert.equal(options.path, "category"); assert.equal(options.select, "_id name"); record.populate = true; return this; }, sort(sort) { record.sort = sort; return this; }, skip(skip) { record.skip = skip; return this; }, limit(limit) { record.limit = limit; return this; }, maxTimeMS(ms) { assert.equal(ms, 5000); return this; }, then(resolve, reject) { return Promise.resolve().then(() => {
      if (kind === "products" ? state.failProducts : state.failCategories) throw new Error("private database failure");
      let rows = state[kind].filter(row => matches(row, filter));
      if (count) return rows.length;
      if (record.sort) rows = rows.toSorted((a, b) => { for (const [key, direction] of Object.entries(record.sort)) { if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * direction; } return 0; });
      rows = rows.slice(record.skip, record.limit === undefined ? undefined : record.skip + record.limit).map(row => ({ ...row, ...(record.populate ? { category: state.categories.find(c => c._id === row.category) ?? null } : {}) }));
      return single ? rows[0] ?? null : rows;
    }).then(resolve, reject); } };
  }
  const storage = new Map();
  const sandbox = { console, URL, URLSearchParams, AbortSignal, Event, crypto: require("node:crypto").webcrypto, setTimeout, clearTimeout,
    window: { dispatchEvent() { state.events++; } }, navigator: { locks: { request: async (_name, action) => action() } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (url, options) => { state.requests.push({ url, options }); return { ok: true, json: async () => ({ count: 3, cart: { items: [] } }) }; } };
  const mocks = {
    "lib/db/connection.ts": { connectDB: async () => { state.connected++; } },
    "lib/db/models/product.model.ts": { default: { find: filter => query("products", filter), countDocuments: filter => query("products", filter, false, true), findById: _id => query("products", { _id }, true) } },
    "lib/db/models/category.model.ts": { default: { find: () => query("categories", {}) } },
  };
  const cache = new Map();
  function load(spec, parent = path.join(root, "index.ts")) {
    if (spec === "server-only") return {};
    if (!spec.startsWith(".") && !spec.startsWith("@/")) return require(spec);
    let filename = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(parent), spec);
    if (!filename.endsWith(".ts")) filename += ".ts";
    const relative = path.relative(root, filename).replaceAll(path.sep, "/");
    if (mocks[relative]) return { __esModule: true, ...mocks[relative] };
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, sandbox, { filename })(name => load(name, filename), loaded, loaded.exports);
    return loaded.exports;
  }
  return { state, load, service: load("@/lib/server/storefront-service"), contract: load("@/lib/storefront-contract") };
}
test("homepage reads real bounded products and public categories", async () => { const f = fixture(); const data = await f.service.getHomepageData(); assert.equal(data.products.length, 8); assert.equal(data.categories.length, 2); assert.equal(data.productError, false); assert.equal(f.state.log.find(q => q.kind === "products" && !q.count).limit, 8); });
test("empty category collection is a successful empty result", async () => { const f = fixture(); f.state.categories = []; const data = await f.service.getHomepageData(); assert.equal(data.categories.length, 0); assert.equal(data.categoryError, false); });
test("empty product collection has correct count and page", async () => { const f = fixture(); f.state.products = []; const data = await f.service.getCatalog({ page: "9" }); assert.equal(data.total, 0); assert.equal(data.products.length, 0); assert.equal(data.query.page, 1); assert.equal(data.totalPages, 1); });
test("homepage failures remain distinct from empty collections without leaking errors", async () => { const f = fixture(); f.state.failProducts = true; const data = await f.service.getHomepageData(); assert.equal(data.productError, true); assert.equal(data.categories.length, 2); assert(!JSON.stringify(data).includes("private")); f.state.failCategories = true; assert.equal((await f.service.getHomepageData()).categoryError, true); });
test("public projections and DTOs omit all owner and private category fields", async () => { const f = fixture(); const data = await f.service.getCatalog(); assert(!JSON.stringify(data).includes("private")); assert(!JSON.stringify(data).includes("owner")); assert(!JSON.stringify(data).includes("clerkId")); const query = f.state.log.find(q => q.kind === "products" && !q.count); assert.equal(query.fields, "_id title description imageUrl price tags category"); assert.equal(Object.keys(data.products[0]).sort().join(), "_id,category,description,imageUrl,price,tags,title"); });
test("search matches title, description and tags case insensitively", async () => { const f = fixture(); for (const q of ["ITEM 00", "special", "unique-tag"]) assert.equal((await f.service.getCatalog({ q })).total, 1); });
test("search metacharacters are literal rather than regular expressions", async () => { const f = fixture(); assert.equal((await f.service.getCatalog({ q: ".*" })).total, 0); f.state.products[0].title = "Special [a]+"; assert.equal((await f.service.getCatalog({ q: "[a]+" })).total, 1); });
test("category filtering uses actual identifiers with matching totals", async () => { const f = fixture(); const data = await f.service.getCatalog({ category: D }); assert.equal(data.total, 5); assert(data.products.every(p => p.category._id === D)); });
test("all supported sorts have deterministic ordering; price sorts are deferred", async () => { const f = fixture(); for (const [sort, first] of [["newest", 15], ["oldest", 1], ["name-asc", 1], ["name-desc", 15]]) assert.equal((await f.service.getCatalog({ sort })).products[0]._id, id(first)); assert.equal(f.contract.parseCatalogQuery({ sort: "price-asc" }).sort, "newest"); f.state.products.forEach(p => { p.createdAt = 1; }); assert.equal((await f.service.getCatalog()).products[0]._id, id(15)); });
test("pagination counts, bounds, and nonoverlapping pages", async () => { const f = fixture(); const a = await f.service.getCatalog({ pageSize: "4" }); const b = await f.service.getCatalog({ pageSize: "4", page: "2" }); assert.equal(a.totalPages, 4); assert(!a.products.some(p => b.products.some(q => q._id === p._id))); const last = await f.service.getCatalog({ pageSize: "4", page: "9999" }); assert.equal(last.query.page, 4); assert.equal(last.products.length, 3); assert.equal(f.contract.parseCatalogQuery({ pageSize: "999", page: "0" }).pageSize, 48); assert.equal(f.contract.parseCatalogQuery({ page: "0" }).page, 1); });
test("invalid and repeated parameters cannot become Mongo operators", async () => { const f = fixture(); const query = f.contract.parseCatalogQuery({ category: { $ne: null }, q: ["one", "two"], sort: "__proto__", page: "-1", pageSize: "NaN" }); assert.equal(query.category, ""); assert.equal(query.q, ""); assert.equal(query.sort, "newest"); assert.equal(query.page, 1); assert.equal(query.pageSize, 12); assert.equal(f.contract.parseCatalogQuery({ q: "x".repeat(500) }).q.length, 100); });
test("pagination URLs preserve active filters and encode search safely", () => { const f = fixture(); const url = new URL(f.contract.catalogHref({ q: "a & b", category: C, sort: "oldest", page: 2, pageSize: 4 }), "https://example.test"); assert.equal(url.searchParams.get("q"), "a & b"); assert.equal(url.searchParams.get("category"), C); assert.equal(url.searchParams.get("page"), "2"); });
test("public detail lookup validates IDs and returns safe records without auth", async () => { const f = fixture(); const product = await f.service.getStorefrontProduct(id(1)); assert.equal(product._id, id(1)); assert(!("owner" in product)); assert.equal(await f.service.getStorefrontProduct("invalid"), null); assert.equal(f.state.connected, 1); });
test("missing products return null", async () => { const f = fixture(); assert.equal(await f.service.getStorefrontProduct(id(999)), null); });
test("related products exclude current item, use same category, and are bounded", async () => { const f = fixture(); const product = await f.service.getStorefrontProduct(id(1)); const related = await f.service.getRelatedProducts(product); assert.equal(related.length, 4); assert(related.every(p => p._id !== product._id && p.category._id === C)); assert.equal((await f.service.getRelatedProducts({ ...product, category: null })).length, 0); });
test("missing and unsafe image sources use fallback; safe paths and HTTPS remain usable", () => { const { contract } = fixture(); for (const value of [null, "", " ", "javascript:alert(1)", "//example.test/image", "http://example.test/a", "/\\evil.test/a", "https://user:pass@example.test/a"]) assert.equal(contract.safeProductImage(value), null); assert.equal(contract.safeProductImage("/image.png"), "/image.png"); assert.equal(contract.safeProductImage("https://example.test/a.png"), "https://example.test/a.png"); });
test("guest add-to-cart applies selected quantity through durable utilities", async () => { const f = fixture(); const cart = f.load("@/lib/utils/storefront-cart"), local = f.load("@/lib/utils/localCart"); await cart.addStorefrontItem(false, id(1), 3); await cart.addStorefrontItem(false, id(1), 2); assert.equal(local.getLocalCart()[0].quantity, 5); assert.equal(f.state.requests.length, 0); assert(f.state.events >= 2); await assert.rejects(cart.addStorefrontItem(false, id(1), 99)); assert.equal(local.getLocalCart()[0].quantity, 5); });
test("authenticated add uses the secure API with no caller-supplied owner", async () => { const f = fixture(); await f.load("@/lib/utils/storefront-cart").addStorefrontItem(true, id(2), 3); assert.equal(f.state.requests[0].url, "/api/cart/add"); assert.deepEqual(JSON.parse(f.state.requests[0].options.body), { productId: id(2), quantity: 3 }); assert.equal(f.state.events, 1); });
test("invalid quantities cannot reach storage or API", async () => { const f = fixture(); const cart = f.load("@/lib/utils/storefront-cart"); for (const signedIn of [true, false]) for (const quantity of [0, -1, 100, 1.5, NaN]) await assert.rejects(cart.addStorefrontItem(signedIn, id(1), quantity)); assert.equal(f.state.requests.length, 0); });
test("middleware keeps product details public", () => { const source = fs.readFileSync(path.join(root, "proxy.ts"), "utf8"); assert(source.includes('"/all-products(.*)"')); assert(source.includes("if (isPublicRoute(req)) return")); });
