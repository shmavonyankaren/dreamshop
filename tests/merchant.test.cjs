/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const sharp = require("sharp");
const { fixture, A, B, P, Q, product } = require("./helpers/marketplace-fixture.cjs");
const application = { name: "Dream audio", description: "Headphones and audio accessories", contactEmail: "owner@example.test", supportingInformation: "Audio products" };
const setup = { name: application.name, description: application.description, contactEmail: application.contactEmail, slug: "dream-audio" };
const service = f => f.load("@/lib/server/store-service");
const products = f => f.load("@/lib/server/merchant-products");
const images = f => f.load("@/lib/server/store-images");
const rejects = async (promise, status) => assert.rejects(promise, e => e.status === status);
test("merchant application records private details and pending state without creating a store", async () => {
  const f = fixture(); await service(f).submitApplication(application);
  assert.equal(f.state.users.get(A).merchantStatus, "pending"); assert.equal(f.state.applications.get(A).contactEmail, application.contactEmail); assert.equal(f.state.stores.size, 0); assert.equal(f.state.audits.length, 1);
});
test("concurrent duplicate applications do not duplicate audits or overwrite the first application", async () => {
  const f = fixture(); await Promise.all([service(f).submitApplication(application), service(f).submitApplication({ ...application, name: "Other" })]);
  assert.equal(f.state.applications.size, 1); assert.equal(f.state.audits.length, 1); assert.equal(f.state.applications.get(A).name, application.name);
});
test("application rejects privileged input and malformed email", async () => {
  const f = fixture(); for (const input of [{ ...application, owner: B }, { ...application, merchantStatus: "approved" }, { ...application, contactEmail: "invalid" }]) assert.equal((await f.wrap(() => service(f).submitApplication(input))).error.status, 400);
});
for (const status of ["none", "pending", "rejected", "suspended"]) test(`${status} merchant cannot create a store or manage products`, async () => {
  const f = fixture(); f.state.users.get(A).merchantStatus = status;
  await rejects(service(f).createStore(setup), 403); await rejects(products(f).saveMerchantProduct({ product: product() }), 403); await rejects(products(f).merchantProducts(), 403);
});
test("approved merchant creates one owned store without changing existing product references", async () => {
  const f = fixture(); f.merchant(A, false); const result = await service(f).createStore(setup);
  assert.equal(f.state.stores.get(result.id).owner, A); assert.equal(f.state.products.get(P).store, A); assert.equal(result.owner, undefined); assert.equal(f.state.users.get(A).merchantStatus, "approved");
});
test("concurrent store creation permits only one store per owner", async () => {
  const f = fixture(); f.merchant(A, false); const result = await Promise.allSettled([service(f).createStore(setup), service(f).createStore({ ...setup, slug: "another-store" })]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1); assert.equal(f.state.stores.size, 1);
});
test("unique slugs reject collisions between merchants", async () => {
  const f = fixture(); f.merchant(A, false); f.merchant(B, false);
  const result = await Promise.allSettled([f.as("clerk-a", () => service(f).createStore(setup)), f.as("clerk-b", () => service(f).createStore(setup))]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1); assert.equal(f.state.stores.size, 1);
});
test("store setup rejects owner, status, role and unsafe slug fields", async () => {
  const f = fixture(); f.merchant(A, false);
  for (const extra of [{ owner: B }, { status: "active" }, { superAdmin: true }, { slug: "../other" }, { slug: "UPPER" }]) assert.equal((await f.wrap(() => service(f).createStore({ ...setup, ...extra }))).error.status, 400);
});
test("store settings allowlist and owned updates isolate tenants", async () => {
  const f = fixture(); f.merchant(); f.merchant(B); const input = { name: "Updated name", description: application.description, contactEmail: application.contactEmail, logo: "", banner: "" };
  await service(f).updateStore(input); assert.equal(f.state.stores.get(A).name, "Updated name"); assert.equal(f.state.stores.get(B).name, "Test store");
  for (const extra of [{ owner: B }, { id: B }, { slug: "take-over" }, { status: "suspended" }, { merchantStatus: "approved" }]) assert.equal((await f.wrap(() => service(f).updateStore({ ...input, ...extra }))).error.status, 400);
});
for (const flag of ["status", "applicationStatus"]) test(`${flag} suspension denies store writes`, async () => {
  const f = fixture(); f.merchant(); f.state.users.get(A)[flag] = "suspended"; await rejects(service(f).createStore(setup), 403); await rejects(products(f).saveMerchantProduct({ product: product() }), 403);
});
test("deleted owner cannot exploit a retained store reference", async () => { const f = fixture(); f.merchant(); f.state.users.get(A).status = "deleted"; await rejects(products(f).merchantProducts(), 403); });
test("suspended store rejects all merchant management", async () => { const f = fixture(); f.merchant(); f.state.stores.get(A).status = "suspended"; await rejects(products(f).saveMerchantProduct({ product: product() }), 403); await rejects(products(f).merchantProducts(), 403); });
test("approved merchant without a store receives a setup requirement", async () => { const f = fixture(); f.merchant(A, false); await rejects(products(f).saveMerchantProduct({ product: product() }), 409); });
test("store product creation derives both ownership references and public DTO hides them", async () => {
  const f = fixture(); f.merchant(); const result = await products(f).saveMerchantProduct({ product: product() });
  const row = f.state.products.get(result.id); assert.equal(row.owner, A); assert.equal(row.store, A); assert.equal(row.status, "active");
  const dto = await f.products().getProductById(result.id); assert.equal(dto.store, undefined); assert.equal(dto.owner, undefined); assert.equal(dto.category.private, undefined);
});
test("merchant cannot create using another store image", async () => { const f = fixture(); f.merchant(); f.state.images.get("6".repeat(24)).store = B; await rejects(products(f).saveMerchantProduct({ product: product() }), 400); });
test("merchant editing preserves ownership and validates category and price", async () => {
  const f = fixture(); f.merchant(); const { id } = await products(f).saveMerchantProduct({ product: product() });
  await products(f).saveMerchantProduct({ id, product: product({ title: "Updated" }) }); assert.equal(f.state.products.get(id).title, "Updated"); assert.equal(f.state.products.get(id).owner, A);
  for (const fields of [{ price: "-1" }, { price: "1e4" }, { category: "9".repeat(24) }, { store: B }, { owner: B }]) assert.equal((await f.wrap(() => products(f).saveMerchantProduct({ id, product: product(fields) }))).error.status, 400);
});
test("cross-store read edit and archive attempts do not reveal or mutate products", async () => {
  const f = fixture(); f.merchant(); Object.assign(f.state.products.get(Q), { store: B, status: "active" });
  assert.equal(await products(f).merchantProduct(Q), null); await rejects(products(f).saveMerchantProduct({ id: Q, product: product() }), 404); await rejects(products(f).archiveMerchantProduct({ id: Q, status: "archived" }), 404); assert.equal(f.state.products.get(Q).status, "active");
});
test("archival hides public products and restoration makes them available", async () => {
  const f = fixture(); f.merchant(); const { id } = await products(f).saveMerchantProduct({ product: product() });
  await products(f).archiveMerchantProduct({ id, status: "archived" }); assert.equal(await f.products().getProductById(id), null); assert.equal((await products(f).merchantProduct(id)).status, "archived");
  await products(f).archiveMerchantProduct({ id, status: "active" }); assert.equal((await f.products().getProductById(id))._id, id);
});
test("store product cannot be hard deleted by legacy merchant actions", async () => {
  const f = fixture(); f.merchant(); const { id } = await products(f).saveMerchantProduct({ product: product() });
  assert.equal((await f.products().deleteProduct({ productId: id })).error.status, 409); assert.equal((await f.products().deleteProducts({ productIds: [id] })).error.status, 409); await f.products().deleteAllProductsByUser(); assert(f.state.products.has(id));
});
test("unassigned products are hidden and outside store listings and archival", async () => {
  const f = fixture(); f.merchant(); delete f.state.products.get(P).store; assert.equal((await products(f).merchantProducts()).total, 0); assert.equal(await f.products().getProductById(P), null); await rejects(products(f).archiveMerchantProduct({ id: P, status: "archived" }), 404);
});
test("dashboard statistics use only store products", async () => {
  const f = fixture(); f.merchant(); const { id } = await products(f).saveMerchantProduct({ product: product() }); await products(f).saveMerchantProduct({ product: product() }); await products(f).archiveMerchantProduct({ id, status: "archived" });
  Object.assign(f.state.products.get(Q), { store: B, status: "active" }); assert.deepEqual(await products(f).merchantStatistics(), { total: 3, active: 2, archived: 1, categories: 1 });
});
test("product list pagination is bounded and store scoped", async () => { const f = fixture(); f.merchant(); for (let i = 0; i < 4; i++) await products(f).saveMerchantProduct({ product: product() }); const data = await products(f).merchantProducts({ pageSize: "2", page: "2" }); assert.equal(data.total, 5); assert.equal(data.products.length, 2); assert.equal(data.totalPages, 3); });
test("image validation rejects SVG, spoofed MIME and oversized content", async () => {
  const f = fixture(), { validateImage, MAX_IMAGE_BYTES } = f.load("@/lib/merchant-contract");
  for (const [bytes, mime] of [[Buffer.from("<svg/>"), "image/svg+xml"], [Buffer.from("not a png"), "image/png"], [Buffer.alloc(MAX_IMAGE_BYTES + 1), "image/jpeg"]]) assert.throws(() => validateImage(bytes, mime));
});
test("upload decodes and normalizes real images with server store association", async () => {
  const f = fixture(); f.merchant(); const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer(); const image = await images(f).uploadStoreImage(bytes, "image/png");
  const stored = f.state.images.get(image.id); assert.equal(stored.store, A); assert.equal(stored.mime, "image/webp"); assert.equal((await sharp(Buffer.from(stored.data)).metadata()).format, "webp");
});
test("truncated image signatures do not pass server decoding", async () => { const f = fixture(); f.merchant(); await rejects(images(f).uploadStoreImage(Buffer.from("89504e470d0a1a0a", "hex"), "image/png"), 400); });
test("image quota rejects additional uploads", async () => { const f = fixture(); f.merchant(); for (let i = 0; i < 100; i++) f.state.images.set(String(i), { _id: String(i), store: A }); const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer(); await rejects(images(f).uploadStoreImage(bytes, "image/png"), 409); });
test("image deletion rejects references and isolates stores", async () => {
  const f = fixture(); f.merchant(); const id = "6".repeat(24); await products(f).saveMerchantProduct({ product: product() }); await rejects(images(f).deleteStoreImage(id), 409);
  f.state.images.set("7".repeat(24), { _id: "7".repeat(24), store: B }); await images(f).deleteStoreImage("7".repeat(24)); assert(f.state.images.has("7".repeat(24)));
});
test("onboarding DTO never includes owner Clerk identity or privileged flags", async () => { const f = fixture(); f.merchant(); const dto = await service(f).merchantOnboarding(); assert.equal(dto.status, "approved"); assert.equal(dto.clerkId, undefined); assert.equal(dto.store.owner, undefined); assert.equal(dto.superAdmin, undefined); });
test("store schema declares unique owner and slug indexes and immutable ownership", () => {
  const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm");
  const source = ts.transpileModule(fs.readFileSync("lib/db/models/store.model.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} }; vm.runInThisContext(`(function(require,module,exports){${source}})`)(require, loaded, loaded.exports); const schema = loaded.exports.default.schema;
  for (const field of ["owner", "slug"]) assert(schema.indexes().some(([keys, options]) => keys[field] === 1 && options.unique)); assert.equal(schema.path("owner").options.immutable, true); assert.equal(schema.options.autoIndex, false);
});
test("application details are restricted to Super Admin reviewers", async () => {
  const f = fixture(); await service(f).submitApplication(application); await rejects(service(f).getApplicationForReview(A), 403);
  f.admin(); const result = await service(f).getApplicationForReview(A); assert.equal(result.contactEmail, application.contactEmail); assert.equal(result.clerkId, undefined);
});
test("merchant search escapes regex and combines store/category filters", async () => {
  const f = fixture(); f.merchant(); await products(f).saveMerchantProduct({ product: product({ title: "Headphones [Pro]" }) });
  assert.equal((await products(f).merchantProducts({ q: "[Pro]" })).total, 1); assert.equal((await products(f).merchantProducts({ q: ".*" })).total, 0); assert.equal((await products(f).merchantProducts({ category: "9".repeat(24) })).total, 0);
});
test("upload HTTP endpoint rejects foreign origin and unauthenticated requests", async () => {
  const f = fixture(), route = f.load("@/app/api/merchant/images/route");
  let response = await route.POST(new Request("https://shop.test/api/merchant/images", { method: "POST", headers: { origin: "https://evil.test", "content-type": "image/png" }, body: "bytes" })); assert.equal(response.status, 403);
  f.state.clerkId = null; response = await route.POST(new Request("https://shop.test/api/merchant/images", { method: "POST", headers: { origin: "https://shop.test", "content-type": "image/png" }, body: "bytes" })); assert.equal(response.status, 401);
});
test("upload HTTP endpoint bounds the streamed request body", async () => {
  const f = fixture(); f.merchant(); const route = f.load("@/app/api/merchant/images/route");
  const response = await route.POST(new Request("https://shop.test/api/merchant/images", { method: "POST", headers: { origin: "https://shop.test", "content-type": "image/png" }, body: Buffer.alloc(2 * 1024 * 1024 + 1) })); assert.equal(response.status, 413);
});
test("direct legacy edit cannot attach a foreign image to a store product", async () => {
  const f = fixture(); f.merchant(); const { id } = await products(f).saveMerchantProduct({ product: product() });
  const result = await f.products().updateProduct({ productId: id, product: { imageUrl: "/foreign.png" } }); assert.equal(result.ok, false); assert.equal(result.error.status, 400);
});
test("future public store DTO omits contact email and internal ownership", async () => {
  const f = fixture(); f.merchant(); const { store } = await service(f).merchantOnboarding();
  assert.deepEqual(Object.keys(service(f).publicStoreDTO(store)).sort(), ["banner", "description", "logo", "name", "slug"]);
});
