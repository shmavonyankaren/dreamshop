/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const A = "a".repeat(24), B = "b".repeat(24), P = "1".repeat(24), Q = "2".repeat(24);

// Compile TS in memory. Only auth and persistence boundaries are mocked;
// route handlers, resolver, validation, services and DTO code are real.
function fixture(shared = {}) {
  const state = shared.state ?? { clerkId: "clerk-a", mapped: true, fail: false, conflict: false, carts: new Map(), products: new Map(), queries: [] };
  for (const id of [P, Q]) state.products.set(id, { _id: id, title: "Product", description: "Description", price: "10", imageUrl: "/product.png", tags: ["tag"], category: { _id: P, name: "Category", private: "hidden" }, owner: { email: "private@example.test", clerkId: "secret" }, __v: 7 });
  const query = (get) => ({ select() { return this; }, readConcern(value) { assert.equal(value, "majority"); return this; }, sort() { return this; }, populate() { this.populated = true; return this; }, then(resolve, reject) { return Promise.resolve().then(() => get(this.populated)).then(resolve, reject); } });
  const cartModel = {
    findOne(filter) {
      state.queries.push(filter);
      return query((populated) => {
        if (state.fail) throw new Error("sensitive database detail");
        const cart = state.carts.get(filter.user);
        if (!cart) return null;
        const copy = structuredClone(cart);
        if (populated) copy.items = copy.items.map((item) => ({ ...item, product: state.products.get(item.product) ?? null }));
        return copy;
      });
    },
    async create(input) { const cart = Array.isArray(input) ? input[0] : input; if (state.writeFail) throw new Error("write failed"); if (state.carts.has(cart.user)) throw { code: 11000 }; state.carts.set(cart.user, { ...structuredClone(cart), _id: cart.user, __v: 0 }); },
    async updateOne(filter, update) {
      if (state.writeFail) throw new Error("write failed");
      const cart = state.carts.get(filter.user);
      if (state.conflict || !cart || cart.__v !== filter.__v) return { modifiedCount: 0 };
      Object.assign(cart, structuredClone(update.$set)); cart.__v++;
      return { modifiedCount: 1 };
    },
    async deleteOne(filter) { if (!state.carts.get(filter.user)?.mergeReceipts?.length) state.carts.delete(filter.user); },
  };
  const mocks = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: state.clerkId }) },
    "lib/db/connection.ts": { connectDB: async () => {} },
    "lib/db/models/user.model.ts": { default: { findOne(filter) { assert.equal(filter.clerkId, state.clerkId); return query(() => state.mapped ? { _id: state.clerkId === "clerk-b" ? B : A, status: state.accountStatus, applicationStatus: state.applicationStatus, merchantStatus: state.merchantStatus, superAdmin: state.superAdmin } : null); } } },
    "lib/db/models/cart.model.ts": { default: cartModel },
    "lib/db/models/product.model.ts": { default: {
      find(filter) { return query(() => [...state.products.values()].filter((product) => !filter?._id || filter._id.$in.includes(product._id))); },
      findById(id) { return query(() => state.products.get(id)); },
    } },
  };
  const cache = new Map();
  const storage = shared.storage ?? new Map();
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  const locks = shared.locks ?? (() => { let tail = Promise.resolve(); return { request(_name, action) { const result = tail.then(action); tail = result.catch(() => {}); return result; } }; })();
  const events = new EventTarget();
  const browser = { fetch: (...args) => fetch(...args) };
  function load(spec, parent = path.join(root, "index.ts")) {
    if (spec === "server-only") return {};
    if (mocks[spec]) return mocks[spec];
    if (!spec.startsWith(".") && !spec.startsWith("@/") && !path.isAbsolute(spec)) return require(spec);
    let filename = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(parent), spec);
    if (!path.extname(filename) || filename.endsWith(".actions") || filename.endsWith(".model")) filename += ".ts";
    const relative = path.relative(root, filename).replaceAll(path.sep, "/");
    if (mocks[relative]) return { __esModule: true, ...mocks[relative] };
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const fn = new vm.Script("(function(require,module,exports,localStorage,window,fetch,navigator){" + output + "\n})", { filename }).runInThisContext();
    fn((id) => load(id, filename), loaded, loaded.exports, localStorage, events, (...args) => browser.fetch(...args), shared.noLocks ? {} : { locks });
    return loaded.exports;
  }
  async function call(route, body, raw) {
    const handler = load("@/app/api/cart/" + (route ? route + "/" : "") + "route.ts");
    const method = handler.POST ? "POST" : "GET";
    const request = new Request("https://shop.test/api/cart/" + route + "?userId=" + B, { method, ...(method === "POST" ? { body: raw ?? JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });
    return handler[method](request);
  }
  return { state, load, call, storage, browser, locks, events };
}
const payloads = { "": undefined, count: undefined, add: { productId: P, quantity: 1 }, update: { productId: P, quantity: 2 }, remove: { productId: P }, merge: { items: [{ productId: P, quantity: 1 }] } };
for (const [route, payload] of Object.entries(payloads)) test("unauthenticated " + (route || "read"), async () => {
  const f = fixture(); f.state.clerkId = null;
  const response = await f.call(route, payload);
  assert.equal(response.status, 401); assert.equal((await response.json()).code, "UNAUTHORIZED"); assert.equal(f.state.queries.length, 0);
});
for (const [route, payload] of Object.entries(payloads)) test("missing user mapping " + (route || "read"), async () => {
  const f = fixture(); f.state.mapped = false;
  const response = await f.call(route, payload);
  assert.equal(response.status, 409); assert.equal((await response.json()).code, "USER_SYNC_PENDING");
});
test("valid lifecycle and foreign query ID cannot select another cart", async () => {
  const f = fixture();
  f.state.carts.set(B, { _id: B, user: B, __v: 0, items: [{ product: Q, quantity: 7 }] });
  assert.equal((await f.call("add", { productId: P, quantity: 2 })).status, 200);
  assert.equal((await (await f.call("count")).json()).count, 2);
  assert.equal((await (await f.call("update", { productId: P, quantity: 3 })).json()).count, 3);
  assert.equal((await (await f.call("merge", { items: [{ productId: Q, quantity: 2 }] })).json()).count, 5);
  const response = await f.call("");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const data = await response.json();
  assert.equal(data.cart.items.length, 2);
  assert.deepEqual(Object.keys(data.cart), ["items"]);
  assert.deepEqual(Object.keys(data.cart.items[0].product).sort(), ["_id", "category", "description", "imageUrl", "price", "tags", "title"]);
  assert(!JSON.stringify(data).includes("private")); assert(!JSON.stringify(data).includes("clerk"));
  assert.equal((await (await f.call("remove", { productId: P })).json()).count, 2);
  assert.equal(f.state.carts.get(B).items[0].quantity, 7);
  assert(f.state.queries.every((query) => query.user === A));
});
for (const route of ["add", "update", "remove", "merge"]) test("reject supplied owner in " + route, async () => {
  const f = fixture(); assert.equal((await f.call(route, { ...payloads[route], userId: B })).status, 400); assert.equal(f.state.carts.size, 0);
});
test("direct services authenticate including clear/delete and ignore foreign read arguments", async () => {
  const f = fixture(); const service = f.load("@/lib/actions/cart.actions.ts");
  f.state.clerkId = null;
  for (const [name, input] of [["getCartByUser", B], ["getCartItemsCount", B], ["clearCart", B], ["deleteCart", B], ["addToCart", payloads.add], ["updateCartItemQuantity", payloads.update], ["removeFromCart", payloads.remove], ["mergeLocalCartToUserCart", payloads.merge]]) await assert.rejects(service[name](input), (error) => error.status === 401);
  f.state.clerkId = "clerk-a";
  await service.addToCart(payloads.add); await service.clearCart(B); assert.equal(await service.getCartItemsCount(B), 0);
  await service.deleteCart(B); assert.equal(f.state.carts.size, 0);
});
test("reject invalid IDs, missing products and invalid numeric inputs", async () => {
  const f = fixture();
  for (const productId of ["bad", "", "g".repeat(24), null, { $ne: null }]) assert.equal((await f.call("add", { productId, quantity: 1 })).status, 400);
  assert.equal((await f.call("add", { productId: "3".repeat(24), quantity: 1 })).status, 404);
  for (const quantity of [-1, 0, 1.5, 100, "2", null]) assert.equal((await f.call("add", { productId: P, quantity })).status, 400);
  const service = f.load("@/lib/actions/cart.actions.ts");
  for (const quantity of [NaN, Infinity, -Infinity]) await assert.rejects(service.addToCart({ productId: P, quantity }));
});
test("reject duplicate and oversized merge bodies, malformed JSON and aggregate overflow", async () => {
  const f = fixture();
  assert.equal((await f.call("merge", { items: Array(101).fill({ productId: P, quantity: 1 }) })).status, 400);
  assert.equal((await f.call("merge", { items: [payloads.add, payloads.add] })).status, 400);
  assert.equal((await f.call("merge", { items: [] })).status, 400);
  assert.equal((await f.call("add", null, "{" )).status, 400);
  assert.equal((await f.call("add", null, " ".repeat(17000))).status, 413);
  assert.equal((await f.call("add", { productId: P, quantity: 99 })).status, 200);
  assert.equal((await f.call("add", { productId: P, quantity: 1 })).status, 400);
  assert.equal((await f.call("merge", { items: [payloads.add] })).status, 400);
  assert.equal(f.state.carts.get(A).items[0].quantity, 99);
});
test("cart item cap, conflicts, removed products, and sanitized failures", async () => {
  const f = fixture();
  f.state.carts.set(A, { _id: A, user: A, __v: 0, items: Array.from({ length: 100 }, (_, i) => ({ product: (i + 100).toString(16).padStart(24, "0"), quantity: 1 })) });
  assert.equal((await f.call("add", payloads.add)).status, 400);
  f.state.carts.get(A).items = [{ product: P, quantity: 1 }];
  f.state.conflict = true; assert.equal((await f.call("update", payloads.update)).status, 409);
  f.state.conflict = false; f.state.products.delete(P);
  assert.equal((await f.call("remove", payloads.remove)).status, 200);
  f.state.fail = true; const response = await f.call(""); assert.equal(response.status, 500); assert(!(await response.text()).includes("sensitive"));
});
test("public product route and catalog strip private fields", async () => {
  const f = fixture(); const route = f.load("@/app/api/products/route.ts");
  const response = await route.GET(new Request("https://shop.test/api/products?ids=" + P));
  const body = await response.text(); assert(!body.includes("private")); assert(!body.includes("owner")); assert(!body.includes("__v"));
  assert.equal((await route.GET(new Request("https://shop.test/api/products?ids=bad"))).status, 400);
  const catalog = f.load("@/lib/actions/product.action.ts");
  assert(!(JSON.stringify(await catalog.getAllProducts())).includes("owner"));
  assert(!(JSON.stringify(await catalog.getProductById(P))).includes("clerk"));
});
test("guest storage add/update/remove/count and corrupt data recovery", () => {
  const f = fixture(); const local = f.load("@/lib/utils/localCart.ts");
  local.addToLocalCart(P); local.addToLocalCart(P); local.addToLocalCart(Q);
  assert.equal(local.getLocalCart().reduce((sum, item) => sum + item.quantity, 0), 3);
  local.updateLocalCartItem(P, 5); assert.equal(local.getLocalCart()[0].quantity, 5);
  local.removeLocalCartItem(Q); assert.equal(local.getLocalCart().length, 1);
  assert.throws(() => local.updateLocalCartItem(P, 1.5));
  f.storage.set("dreamshop_cart", "{"); assert.deepEqual(local.getLocalCart(), []);
  f.storage.set("dreamshop_cart", JSON.stringify([P, { id: P, quantity: 2 }, null, { productId: Q, quantity: -1 }]));
  assert.deepEqual(local.getLocalCart(), [{ productId: P, quantity: 3 }]);
  local.clearLocalCart(); assert.deepEqual(local.getLocalCart(), []);
});
test("client transport sends no identity and coalesces simultaneous merges", async () => {
  const f = fixture(); const requests = []; let release;
  f.browser.fetch = async (url, options) => { requests.push({ url, options }); if (url.endsWith("merge")) await new Promise((resolve) => { release = resolve; }); return Response.json({ cart: { items: [] }, count: 0, reconciliation: { operationId: options.body ? JSON.parse(options.body).operationId : undefined, version: 0, items: [] } }); };
  const local = f.load("@/lib/utils/localCart.ts"), client = f.load("@/lib/utils/cartClient.ts");
  await client.fetchCartByUser(); await client.addProductToUserCart(P); await client.updateProductQuantity(P, 2); await client.removeProductFromUserCart(P); await client.getCartCount();
  local.addToLocalCart(P);
  const first = client.ensureGuestCartMerged("clerk-a"), second = client.ensureGuestCartMerged("clerk-a");
  assert.equal(first, second);
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  release(); await first;
  assert.equal(requests.filter((entry) => entry.url.endsWith("merge")).length, 1);
  assert(!JSON.stringify(requests).includes("userId")); assert(!JSON.stringify(requests).includes("clerk-a")); assert.deepEqual(local.getLocalCart(), []);
});
test("failed merge preserves guest cart", async () => {
  const f = fixture(); const local = f.load("@/lib/utils/localCart.ts"), client = f.load("@/lib/utils/cartClient.ts");
  local.addToLocalCart(P); f.browser.fetch = async () => Response.json({ message: "Account synchronizing" }, { status: 409 });
  await assert.rejects(client.ensureGuestCartMerged("clerk-a")); assert.equal(local.getLocalCart().length, 1);
});

test("concurrent creates and updates retain additions without exceeding the cap", async () => {
  const f = fixture();
  const created = await Promise.all([f.call("add", payloads.add), f.call("add", payloads.add)]);
  assert(created.every((response) => response.status === 200));
  assert.equal(f.state.carts.get(A).items[0].quantity, 2);
  await f.call("update", { productId: P, quantity: 98 });
  const responses = await Promise.all([f.call("add", payloads.add), f.call("add", payloads.add)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
  assert.equal(f.state.carts.get(A).items[0].quantity, 99);
});
test("a second authenticated identity resolves its own MongoDB account", async () => {
  const f = fixture();
  await f.call("add", payloads.add);
  f.state.clerkId = "clerk-b";
  await f.call("add", { productId: Q, quantity: 3 });
  const data = await (await f.call("")).json();
  assert.equal(data.cart.items[0].product._id, Q);
  assert.equal(data.cart.items[0].quantity, 3);
  assert.equal(f.state.carts.get(A).items[0].quantity, 1);
});

const uuid = () => require("node:crypto").randomUUID();
test("application suspension denies cart access even with merchant and admin privileges", async () => {
  const f = fixture(); f.state.applicationStatus = "suspended"; f.state.merchantStatus = "approved"; f.state.superAdmin = true;
  for (const [route, body] of Object.entries(payloads)) assert.equal((await f.call(route, body)).status, 403);
  assert.equal(f.state.carts.size, 0);
});
test("approved merchants and Super Admins retain normal customer cart functionality", async () => {
  const f = fixture(); f.state.merchantStatus = "approved";
  assert.equal((await f.call("add", payloads.add)).status, 200);
  f.state.merchantStatus = "none"; f.state.superAdmin = true;
  assert.equal((await f.call("merge", { operationId: uuid(), items: [payloads.add] })).status, 200);
  assert.equal(f.state.carts.get(A).items[0].quantity, 2);
});
for (const status of ["suspended", "deleted"]) test(status + " identities cannot read or mutate carts and retain receipts", async () => {
  const f = fixture(); await f.call("merge", { operationId: uuid(), items: [payloads.add] });
  const before = structuredClone(f.state.carts.get(A)); f.state.accountStatus = status;
  for (const [route, body] of Object.entries(payloads)) assert.equal((await f.call(route, body)).status, 403);
  assert.deepEqual(f.state.carts.get(A), before);
});
const operation = (items = [payloads.add], extra = {}) => ({ operationId: uuid(), items, ...extra });
function connectBrowser(f, intercept) {
  const requests = [];
  f.browser.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    requests.push({ url, body });
    const route = url.split("/api/cart/")[1] ?? "";
    if (intercept) return intercept(route, body, () => f.call(route, body));
    return f.call(route, body);
  };
  return requests;
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise((resolve) => setImmediate(resolve)); }
  throw new Error("Expected asynchronous checkpoint was not reached");
}

test("durable first merge and repeated/lost-response requests return the committed outcome", async () => {
  const f = fixture(), input = operation([{ productId: P, quantity: 4 }]);
  const first = await (await f.call("merge", input)).json();
  await f.call("add", { productId: Q, quantity: 2 });
  const retry = await (await f.call("merge", input)).json();
  assert.deepEqual(retry.reconciliation, first.reconciliation);
  assert.equal(retry.count, 6); // Current cart, immutable reconciliation outcome.
  assert.equal(f.state.carts.get(A).items.find((item) => item.product === P).quantity, 4);
  assert.equal(f.state.carts.get(A).mergeReceipts.length, 1);
  assert(!JSON.stringify(first).includes("fingerprint")); assert(!JSON.stringify(first).includes("clerk"));
});
test("concurrent identical operations commit one mutation", async () => {
  const f = fixture(), input = operation();
  const results = await Promise.all([f.call("merge", input), f.call("merge", input), f.call("merge", input)]);
  assert(results.every((result) => result.status === 200));
  const bodies = await Promise.all(results.map((response) => response.json()));
  assert.deepEqual(bodies[0].reconciliation, bodies[1].reconciliation);
  assert.equal(f.state.carts.get(A).items[0].quantity, 1);
  assert.equal(f.state.carts.get(A).mergeReceipts.length, 1);
});
test("different IDs are independent and reused IDs reject altered snapshots", async () => {
  const f = fixture(), first = operation();
  await f.call("merge", first); await f.call("merge", operation());
  assert.equal(f.state.carts.get(A).items[0].quantity, 2);
  assert.equal((await f.call("merge", { ...first, items: [{ productId: P, quantity: 9 }] })).status, 409);
  assert.equal(f.state.carts.get(A).items[0].quantity, 2);
});
test("receipts are user-scoped and actor changes cannot redirect a browser operation", async () => {
  const f = fixture(), input = operation();
  await f.call("merge", input);
  f.state.clerkId = "clerk-b";
  assert.equal((await f.call("merge", { ...input, parentOperationId: input.operationId, operationId: uuid() })).status, 409);
  assert.equal((await f.call("merge", input)).status, 200);
  const actorHash = require("node:crypto").createHash("sha256").update("clerk-a").digest("hex");
  assert.equal((await f.call("merge", operation([payloads.add], { actorHash }))).status, 409);
  assert.equal(f.state.carts.get(B).items[0].quantity, 1);
});
test("failed writes and contention do not record a completed receipt", async () => {
  const f = fixture(), input = operation();
  f.state.writeFail = true;
  assert.equal((await f.call("merge", input)).status, 500);
  assert.equal(f.state.carts.size, 0);
  f.state.writeFail = false;
  assert.equal((await f.call("merge", input)).status, 200);
  f.state.conflict = true;
  const next = operation(); assert.equal((await f.call("merge", next)).status, 409);
  assert.equal(f.state.carts.get(A).mergeReceipts.length, 1);
  f.state.conflict = false; assert.equal((await f.call("merge", next)).status, 200);
  assert.equal(f.state.carts.get(A).items[0].quantity, 2);
});
test("valid items survive deleted products and quantity overflow reconciliation", async () => {
  const f = fixture(); await f.call("add", { productId: P, quantity: 98 });
  const missing = "3".repeat(24);
  const input = operation([{ productId: P, quantity: 5 }, { productId: Q, quantity: 2 }, { productId: missing, quantity: 1 }]);
  const response = await f.call("merge", input); assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.count, 101);
  assert.deepEqual(result.reconciliation.items.find((item) => item.productId === P), { productId: P, requested: 5, applied: 1, before: 98, after: 99, reason: "QUANTITY_LIMIT" });
  assert.equal(result.reconciliation.items.find((item) => item.productId === missing).reason, "PRODUCT_UNAVAILABLE");
  assert.equal((await (await f.call("merge", input)).json()).count, 101);
});
test("100-product limit is enforced without dropping existing or valid overlapping items", async () => {
  const f = fixture();
  f.state.carts.set(A, { _id: A, user: A, __v: 0, items: [{ product: P, quantity: 1 }, ...Array.from({ length: 99 }, (_, i) => ({ product: (i + 100).toString(16).padStart(24, "0"), quantity: 1 }))] });
  const result = await (await f.call("merge", operation([payloads.add, { productId: Q, quantity: 1 }]))).json();
  assert.equal(result.reconciliation.items.find((item) => item.productId === Q).reason, "ITEM_LIMIT");
  assert.equal(f.state.carts.get(A).items.length, 100);
  assert.equal(f.state.carts.get(A).items[0].quantity, 2);
});
test("new merge protocol preserves strict invalid quantity, duplicate and body limits", async () => {
  const f = fixture();
  for (const quantity of [0, -1, 100, 1.2, "3", null]) assert.equal((await f.call("merge", operation([{ productId: P, quantity }]))).status, 400);
  assert.equal((await f.call("merge", operation([payloads.add, payloads.add]))).status, 400);
  assert.equal((await f.call("merge", operation(Array(101).fill(payloads.add)))).status, 400);
  assert.equal((await f.call("merge", operation(), " ".repeat(17000))).status, 413);
  assert.equal(f.state.carts.size, 0);
});
test("follow-up changes replace only their acknowledged contribution", async () => {
  const f = fixture(); await f.call("add", { productId: P, quantity: 10 });
  const first = operation([{ productId: P, quantity: 3 }]); await f.call("merge", first);
  const second = operation([{ productId: P, quantity: 5 }, { productId: Q, quantity: 2 }], { parentOperationId: first.operationId });
  assert.equal((await (await f.call("merge", second)).json()).count, 17);
  const remove = operation([{ productId: Q, quantity: 2 }], { parentOperationId: second.operationId });
  const result = await (await f.call("merge", remove)).json();
  assert.equal(result.count, 12);
  assert.equal(f.state.carts.get(A).items.find((item) => item.product === P).quantity, 10);
  await f.call("merge", remove); assert.equal((await (await f.call("count")).json()).count, 12);
});
test("follow-up does not overwrite a concurrent account edit", async () => {
  const f = fixture(), first = operation([{ productId: P, quantity: 3 }]); await f.call("merge", first);
  await f.call("update", { productId: P, quantity: 8 });
  const result = await (await f.call("merge", operation([], { parentOperationId: first.operationId }))).json();
  assert.equal(result.reconciliation.items[0].reason, "ACCOUNT_CHANGED"); assert.equal(result.count, 8);
});
test("receipt tombstones survive clear and delete operations", async () => {
  const f = fixture(), input = operation(); await f.call("merge", input);
  const service = f.load("@/lib/actions/cart.actions.ts");
  await service.clearCart(); await service.deleteCart();
  assert.equal((await (await f.call("merge", input)).json()).count, 0);
  assert.equal(f.state.carts.get(A).mergeReceipts.length, 1);
});
test("receipt capacity fails closed without pruning old protection", async () => {
  const f = fixture(); const input = operation(); await f.call("merge", input);
  const cart = f.state.carts.get(A), first = structuredClone(cart.mergeReceipts[0]);
  cart.mergeReceipts = [first, ...Array.from({ length: 255 }, () => ({ ...first, operationId: uuid() }))];
  assert.equal((await f.call("merge", operation())).status, 409);
  assert.equal((await f.call("merge", input)).status, 200); assert.equal(cart.items[0].quantity, 1);
});
test("two browser tabs persist one snapshot ID and server mutation", async () => {
  const first = fixture(), second = fixture({ state: first.state, storage: first.storage, locks: first.locks });
  const requests = connectBrowser(first); const requests2 = connectBrowser(second);
  first.load("@/lib/utils/localCart.ts").addToLocalCart(P);
  await Promise.all([first.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a"), second.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a")]);
  assert.equal(first.state.carts.get(A).items[0].quantity, 1);
  assert.equal(first.state.carts.get(A).mergeReceipts.length, 1);
  assert.deepEqual(second.load("@/lib/utils/localCart.ts").getLocalCart(), []);
  assert(new Set([...requests, ...requests2].filter((entry) => entry.body?.operationId).map((entry) => entry.body.operationId)).size <= 1);
});
test("lost HTTP response survives refresh and retries the same committed operation", async () => {
  const f = fixture(); let lost = true;
  const requests = connectBrowser(f, async (_route, _body, send) => { const response = await send(); if (lost) { lost = false; throw new Error("Connection lost"); } return response; });
  const local = f.load("@/lib/utils/localCart.ts"); local.addToLocalCart(P);
  await assert.rejects(f.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a"));
  const pending = JSON.parse(f.storage.get("dreamshop_cart")).pending;
  assert.equal(local.getLocalCart().length, 1);
  const reload = fixture({ state: f.state, storage: f.storage, locks: f.locks }); const retried = connectBrowser(reload);
  await reload.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a");
  assert.equal(retried[0].body.operationId, pending.operationId);
  assert.equal(requests[0].body.operationId, pending.operationId);
  assert.equal(f.state.carts.get(A).items[0].quantity, 1);
  assert.deepEqual(local.getLocalCart(), []);
});
for (const edit of ["add", "update", "remove"]) test("guest " + edit + " during in-flight merge is preserved without replay", async () => {
  const f = fixture(); let release, intercepted = false;
  connectBrowser(f, async (_route, _body, send) => { const response = await send(); if (!intercepted) { intercepted = true; await new Promise((resolve) => { release = resolve; }); } return response; });
  const local = f.load("@/lib/utils/localCart.ts"), client = f.load("@/lib/utils/cartClient.ts");
  local.addToLocalCart(P);
  const sync = client.ensureGuestCartMerged("clerk-a"); await until(() => release);
  await local.mutateGuestCart(edit, edit === "add" ? Q : P, 4);
  release(); await sync;
  const cart = f.state.carts.get(A);
  if (edit === "add") assert.equal(cart.items.reduce((sum, item) => sum + item.quantity, 0), 2);
  if (edit === "update") assert.equal(cart.items[0].quantity, 4);
  if (edit === "remove") assert.equal(cart.items.length, 0);
  assert.equal(cart.mergeReceipts.length, 2);
  assert.deepEqual(local.getLocalCart(), []);
});
test("storefront quantity addition during an in-flight merge is applied exactly once", async () => {
  const f = fixture(); let release, intercepted = false;
  connectBrowser(f, async (_route, _body, send) => { const response = await send(); if (!intercepted) { intercepted = true; await new Promise(resolve => { release = resolve; }); } return response; });
  const local = f.load("@/lib/utils/localCart.ts"), client = f.load("@/lib/utils/cartClient.ts");
  local.addToLocalCart(P);
  const sync = client.ensureGuestCartMerged("clerk-a"); await until(() => release);
  await local.addGuestCartQuantity(P, 3);
  release(); await sync;
  assert.equal(f.state.carts.get(A).items[0].quantity, 4);
  assert.equal(f.state.carts.get(A).mergeReceipts.length, 2);
  await client.ensureGuestCartMerged("clerk-a");
  assert.equal(f.state.carts.get(A).items[0].quantity, 4);
  assert.deepEqual(local.getLocalCart(), []);
});

test("sign-out retains pending acknowledgement for the original account", async () => {
  const f = fixture(); let release;
  connectBrowser(f, async (_route, _body, send) => { const response = await send(); await new Promise((resolve) => { release = resolve; }); return response; });
  const local = f.load("@/lib/utils/localCart.ts"), client = f.load("@/lib/utils/cartClient.ts"); local.addToLocalCart(P);
  const sync = client.ensureGuestCartMerged("clerk-a"); await until(() => release);
  client.setCartSession(null); release(); await sync;
  assert(JSON.parse(f.storage.get("dreamshop_cart")).pending);
  client.setCartSession("clerk-b"); await assert.rejects(client.ensureGuestCartMerged("clerk-b"));
  connectBrowser(f); client.setCartSession("clerk-a"); await client.ensureGuestCartMerged("clerk-a");
  assert.equal(f.state.carts.get(A).items[0].quantity, 1); assert.deepEqual(local.getLocalCart(), []);
});
test("partial merge retains conflicts and duplicate notifications cannot create new mutations", async () => {
  const f = fixture(); f.state.products.delete(Q); const requests = connectBrowser(f);
  const local = f.load("@/lib/utils/localCart.ts"), client = f.load("@/lib/utils/cartClient.ts"); local.addToLocalCart(P); local.addToLocalCart(Q);
  await client.ensureGuestCartMerged("clerk-a");
  assert.equal(client.getCartSyncStatus().state, "attention");
  const saved = JSON.parse(f.storage.get("dreamshop_cart")); assert(saved.settled); assert.equal(saved.items.length, 2);
  f.events.dispatchEvent(new Event("storage")); f.events.dispatchEvent(new Event("dreamshop-cart-changed"));
  await client.ensureGuestCartMerged("clerk-a");
  assert.equal(requests.length, 1); assert.equal(f.state.carts.get(A).items[0].quantity, 1);
  await client.dismissGuestConflicts(); assert.deepEqual(local.getLocalCart(), []);
});
test("malformed legacy entries are retained and reported while valid entries merge", async () => {
  const f = fixture(); connectBrowser(f);
  const raw = JSON.stringify([{ productId: P, quantity: 2 }, { productId: Q, quantity: -9 }, null]); f.storage.set("dreamshop_cart", raw);
  const client = f.load("@/lib/utils/cartClient.ts"); await client.ensureGuestCartMerged("clerk-a");
  const saved = JSON.parse(f.storage.get("dreamshop_cart"));
  assert.equal(saved.recoveryRaw, raw); assert(saved.warnings.length > 0);
  assert.equal(client.getCartSyncStatus().state, "attention"); assert.equal(f.state.carts.get(A).items[0].quantity, 2);
});
test("failed browser storage and corrupted operation records never start a new merge", async () => {
  const f = fixture(); const requests = connectBrowser(f);
  f.storage.set("dreamshop_cart", JSON.stringify({ format: 2, pending: { operationId: "broken" } }));
  await assert.rejects(f.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a"));
  assert.equal(requests.length, 0); assert(f.storage.get("dreamshop_cart").includes("broken"));
});

test("missing Web Locks fails safely without sending or clearing a snapshot", async () => {
  const f = fixture({ noLocks: true }); const requests = connectBrowser(f);
  const local = f.load("@/lib/utils/localCart.ts"); local.addToLocalCart(P);
  await assert.rejects(f.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a"), /Web Locks/);
  assert.equal(requests.length, 0); assert.equal(local.getLocalCart().length, 1);
});
test("storage quota failure preserves the prior snapshot and never sends an unpersisted ID", async () => {
  const f = fixture(); const requests = connectBrowser(f); f.load("@/lib/utils/localCart.ts").addToLocalCart(P);
  const saved = f.storage.get("dreamshop_cart");
  f.storage.set = () => { throw new Error("Quota exceeded"); };
  await assert.rejects(f.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a"), /Quota/);
  assert.equal(requests.length, 0); assert.equal(f.storage.get("dreamshop_cart"), saved);
});
test("a second tab closes the first tab's pending operation using the same ID", async () => {
  const first = fixture(); let resume;
  connectBrowser(first, async (_route, _body, send) => { const response = await send(); await new Promise((resolve) => { resume = resolve; }); return response; });
  first.load("@/lib/utils/localCart.ts").addToLocalCart(P);
  const pending = first.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a"); await until(() => resume);
  const second = fixture({ state: first.state, storage: first.storage, locks: first.locks }); connectBrowser(second);
  await second.load("@/lib/utils/cartClient.ts").ensureGuestCartMerged("clerk-a");
  // A new guest edit after acknowledgement must survive the stale first response.
  second.load("@/lib/utils/localCart.ts").addToLocalCart(Q);
  first.load("@/lib/utils/cartClient.ts").setCartSession(null);
  resume(); await pending;
  assert.deepEqual(second.load("@/lib/utils/localCart.ts").getLocalCart(), [{ productId: Q, quantity: 1 }]);
  assert.equal(first.state.carts.get(A).items[0].quantity, 1);
});
test("missing mapping preserves an operation ID until synchronization recovers", async () => {
  const f = fixture(); connectBrowser(f); f.load("@/lib/utils/localCart.ts").addToLocalCart(P); f.state.mapped = false;
  const client = f.load("@/lib/utils/cartClient.ts"); await assert.rejects(client.ensureGuestCartMerged("clerk-a"));
  const id = JSON.parse(f.storage.get("dreamshop_cart")).pending.operationId;
  f.state.mapped = true; await client.ensureGuestCartMerged("clerk-a");
  assert.equal(f.state.carts.get(A).mergeReceipts[0].operationId, id);
});
test("receipt schema preserves atomic outcome fields and declares the existing unique owner index", () => {
  const mongoose = require("mongoose");
  const filename = path.join(root, "lib/db/models/cart.model.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  new vm.Script("(function(require,module,exports){" + output + "\n})").runInThisContext()(require, loaded, loaded.exports);
  const Model = loaded.exports.default;
  assert(Model.schema.indexes().some(([keys, options]) => keys.user === 1 && options.unique === true));
  const record = new Model({ user: A, items: [], mergeReceipts: [{ operationId: uuid(), fingerprint: "hash", version: 0, outcome: { items: [] } }] });
  assert.equal(record.validateSync(), undefined);
  assert.equal(record.toObject().mergeReceipts[0].version, 0);
  assert.deepEqual(record.toObject().mergeReceipts[0].outcome.items, []);
  mongoose.deleteModel("Cart");
});
