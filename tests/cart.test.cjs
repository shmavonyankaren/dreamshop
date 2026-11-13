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
function fixture() {
  const state = { clerkId: "clerk-a", mapped: true, fail: false, conflict: false, carts: new Map(), products: new Map(), queries: [] };
  for (const id of [P, Q]) state.products.set(id, { _id: id, title: "Product", description: "Description", price: "10", imageUrl: "/product.png", tags: ["tag"], category: { _id: P, name: "Category", private: "hidden" }, owner: { email: "private@example.test", clerkId: "secret" }, __v: 7 });
  const query = (get) => ({ select() { return this; }, sort() { return this; }, populate() { this.populated = true; return this; }, then(resolve, reject) { return Promise.resolve().then(() => get(this.populated)).then(resolve, reject); } });
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
    async create(cart) { if (state.carts.has(cart.user)) throw { code: 11000 }; state.carts.set(cart.user, { ...structuredClone(cart), _id: cart.user, __v: 0 }); },
    async updateOne(filter, update) {
      const cart = state.carts.get(filter.user);
      if (state.conflict || !cart || cart.__v !== filter.__v) return { modifiedCount: 0 };
      cart.items = structuredClone(update.$set.items); cart.__v++;
      return { modifiedCount: 1 };
    },
    async deleteOne(filter) { state.carts.delete(filter.user); },
  };
  const mocks = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: state.clerkId }) },
    "lib/db/connection.ts": { connectDB: async () => {} },
    "lib/db/models/user.model.ts": { default: { findOne(filter) { assert.equal(filter.clerkId, state.clerkId); return query(() => state.mapped ? { _id: state.clerkId === "clerk-b" ? B : A } : null); } } },
    "lib/db/models/cart.model.ts": { default: cartModel },
    "lib/db/models/product.model.ts": { default: {
      find(filter) { return query(() => [...state.products.values()].filter((product) => !filter?._id || filter._id.$in.includes(product._id))); },
      findById(id) { return query(() => state.products.get(id)); },
    } },
  };
  const cache = new Map();
  const storage = new Map();
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
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
    const fn = new vm.Script("(function(require,module,exports,localStorage,window,fetch){" + output + "\n})", { filename }).runInThisContext();
    fn((id) => load(id, filename), loaded, loaded.exports, localStorage, {}, (...args) => browser.fetch(...args));
    return loaded.exports;
  }
  async function call(route, body, raw) {
    const handler = load("@/app/api/cart/" + (route ? route + "/" : "") + "route.ts");
    const method = handler.POST ? "POST" : "GET";
    const request = new Request("https://shop.test/api/cart/" + route + "?userId=" + B, { method, ...(method === "POST" ? { body: raw ?? JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });
    return handler[method](request);
  }
  return { state, load, call, storage, browser };
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
  f.browser.fetch = async (url, options) => { requests.push({ url, options }); if (url.endsWith("merge")) await new Promise((resolve) => { release = resolve; }); return Response.json({ cart: { items: [] }, count: 0 }); };
  const local = f.load("@/lib/utils/localCart.ts"), client = f.load("@/lib/utils/cartClient.ts");
  await client.fetchCartByUser(); await client.addProductToUserCart(P); await client.updateProductQuantity(P, 2); await client.removeProductFromUserCart(P); await client.getCartCount();
  local.addToLocalCart(P);
  const first = client.ensureGuestCartMerged("clerk-a"), second = client.ensureGuestCartMerged("clerk-a");
  assert.equal(first, second); release(); await first;
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
