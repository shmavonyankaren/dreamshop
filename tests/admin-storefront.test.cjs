/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const { fixture, A, B, D, P, Q, O, C, E, product } = require("./helpers/marketplace-fixture.cjs");
const queries = f => f.load("@/lib/server/admin-queries");
const mutations = f => f.load("@/lib/server/admin-mutations");
const publicStores = f => f.load("@/lib/server/public-stores");
const reject = (promise, status) => assert.rejects(promise, e => e.status === status);
function publicFixture() {
  const f = fixture(); f.merchant(); f.merchant(B); const store = f.state.stores.get(A); store.slug = "audio-store"; store.logo = "/logo.png"; store.banner = "/banner.png";
  Object.assign(f.state.products.get(P), { store: A, status: "active", createdAt: new Date("2026-01-02"), title: "Headphones [Pro]" });
  Object.assign(f.state.products.get(Q), { store: B, status: "active", createdAt: new Date("2026-01-01") });
  return f;
}
for (const merchant of [false, true]) test(`${merchant ? "merchant" : "customer"} cannot access any administrative read service`, async () => {
  const f = fixture(); if (merchant) f.merchant();
  const q = queries(f); for (const action of [() => q.adminDashboard(), () => q.adminUsers(), () => q.adminUsers({}, "merchants"), () => q.adminUserDetail(B), () => q.adminCategories(), () => q.adminProducts(), () => q.adminAudit(), () => q.adminProductFilterOptions()]) await reject(action(), 403);
});
test("signed-out users cannot read admin information", async () => { const f = fixture(); f.state.clerkId = null; await reject(queries(f).adminDashboard(), 401); });
for (const field of ["status", "applicationStatus"]) test(`suspended admin ${field} is denied`, async () => { const f = fixture(); f.admin(); f.state.users.get(A)[field] = "suspended"; await reject(queries(f).adminUsers(), 403); });
test("dashboard counts actual records and active customer capability includes approved merchants", async () => {
  const f = publicFixture(); f.admin(); f.state.users.get(D).status = "deleted"; f.state.products.get(Q).status = "archived"; const result = await queries(f).adminDashboard();
  assert.deepEqual(result.metrics, { users: 3, activeCustomers: 2, merchants: 2, pending: 0, stores: 2, activeStores: 2, products: 3, archived: 1, categories: 2 });
  assert.equal(result.stores.length, 2); assert.equal(result.products.length, 3); assert.equal(result.metrics.revenue, undefined);
});
test("dashboard excludes account-suspended merchants from active merchant metric", async () => { const f = publicFixture(); f.admin(); f.state.users.get(B).applicationStatus = "suspended"; assert.equal((await queries(f).adminDashboard()).metrics.merchants, 1); });
test("admin directories cap pagination, project limited fields and do not expose Clerk secrets", async () => {
  const f = fixture(); f.admin(); for (let i = 0; i < 40; i++) f.state.users.set(String(i).padStart(24, "0"), { _id: String(i).padStart(24, "0"), firstName: "Customer " + i, clerkId: "private", syncFingerprint: "secret", status: "active", applicationStatus: "active", createdAt: new Date() });
  const data = await queries(f).adminUsers({ pageSize: "999", page: "2" }); assert.equal(data.query.pageSize, 24); assert.equal(data.rows.length, 19); assert.equal(data.total, 43); assert(!JSON.stringify(data).includes("syncFingerprint")); assert(!JSON.stringify(data).includes("clerkId"));
  assert(f.state.readLog.some(log => log.kind === "users" && log.limit === 24 && log.timeout === 5000));
});
test("admin user filters distinguish deleted accounts and marketplace suspension", async () => {
  const f = fixture(); f.admin(); f.state.users.get(B).applicationStatus = "suspended"; f.state.users.get(D).status = "deleted";
  assert.deepEqual((await queries(f).adminUsers({ status: "suspended" })).rows.map(u => u.id), [B]); assert.deepEqual((await queries(f).adminUsers({ status: "deleted" })).rows.map(u => u.id), [D]); assert.equal((await queries(f).adminUsers({ role: "admin" })).total, 1);
});
test("application details and registration sorting are available only to admin", async () => {
  const f = fixture(); await f.load("@/lib/server/store-service").submitApplication({ name: "Audio store", description: "Headphones and audio equipment", contactEmail: "private@example.test", supportingInformation: "Our proposal" });
  f.admin(B); f.state.clerkId = "clerk-b"; const result = await queries(f).adminUsers({ status: "pending" }, "applications"); assert.equal(result.rows.length, 1); assert.equal(result.rows[0].application.name, "Audio store"); assert.equal(result.rows[0].application.supportingInformation, "Our proposal");
});
test("conflicting concurrent application decisions produce one audit and one outcome", async () => {
  const f = fixture(); f.admin(); f.state.users.get(B).merchantStatus = "pending";
  const results = await Promise.allSettled(["approved", "rejected"].map(status => f.access().reviewMerchantAccess({ userId: B, status, expectedStatus: "pending", reason: "Reviewed proposal" })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(f.state.audits.length, 1); assert.equal(f.state.audits[0].action, "merchant.review");
});
test("duplicate approvals remain idempotent and invalid transitions fail", async () => {
  const f = fixture(); f.admin(); f.state.users.get(B).merchantStatus = "pending"; const request = { userId: B, status: "approved", expectedStatus: "pending", reason: "Approved proposal" };
  await f.access().reviewMerchantAccess(request); assert.equal((await f.access().reviewMerchantAccess(request)).changed, false); assert.equal(f.state.audits.length, 1); await reject(f.access().reviewMerchantAccess({ ...request, status: "rejected" }), 409);
});
test("deleted target identities cannot be changed or restored by administrators", async () => {
  const f = fixture(); f.admin(); f.state.users.get(B).status = "deleted";
  await reject(f.access().setApplicationStatus({ userId: B, status: "suspended", reason: "Policy review" }), 409); await reject(f.access().reviewMerchantAccess({ userId: B, status: "pending", reason: "Policy review" }), 409); assert.equal(f.state.audits.length, 0);
});
test("account reactivation does not change Clerk suspension and stale writes fail", async () => {
  const f = fixture(); f.admin(); f.state.users.get(B).status = "suspended"; f.state.users.get(B).applicationStatus = "suspended";
  await f.access().setApplicationStatus({ userId: B, status: "active", expectedStatus: "suspended", reason: "Policy reviewed" }); assert.equal(f.state.users.get(B).status, "suspended");
  await reject(f.access().setApplicationStatus({ userId: B, status: "suspended", expectedStatus: "suspended", reason: "Stale decision" }), 409);
});
test("last active Super Admin cannot be suspended through the new action", async () => { const f = fixture(); f.admin(); const result = await f.load("@/lib/actions/admin.actions").changeAccountStatus({ userId: A, status: "suspended", expectedStatus: "active", reason: "Account review" }); assert.equal(result.error.code, "LAST_ADMIN"); });
for (const merchant of [false, true]) test(`${merchant ? "merchant" : "customer"} cannot mutate store or product administrative status`, async () => {
  const f = publicFixture(); if (!merchant) f.state.users.get(A).merchantStatus = "none";
  await reject(mutations(f).changeStoreOperation({ id: A, status: "suspended", expectedStatus: "active", reason: "Review store" }), 403); await reject(mutations(f).moderateProduct({ id: P, status: "archived", expectedStatus: "active", reason: "Review product" }), 403);
});
test("store suspension is distinct from account and merchant state and is audited", async () => {
  const f = publicFixture(); f.admin(); await mutations(f).changeStoreOperation({ id: B, status: "suspended", expectedStatus: "active", reason: "Store investigation" });
  assert.equal(f.state.stores.get(B).status, "suspended"); assert.equal(f.state.users.get(B).status, "active"); assert.equal(f.state.users.get(B).merchantStatus, "approved"); assert.equal(f.state.audits[0].targetType, "store"); assert.equal(f.state.audits[0].outcome, "success");
});
test("reactivating a store requires an active approved owner", async () => { const f = publicFixture(); f.admin(); f.state.stores.get(B).status = "paused"; f.state.users.get(B).merchantStatus = "suspended"; await reject(mutations(f).changeStoreOperation({ id: B, status: "active", expectedStatus: "paused", reason: "Reopen storefront" }), 409); });
test("store status duplicate retries create one audit and stale changes fail", async () => {
  const f = publicFixture(); f.admin(); const input = { id: B, status: "paused", expectedStatus: "active", reason: "Pause storefront" }; await mutations(f).changeStoreOperation(input); await mutations(f).changeStoreOperation(input); assert.equal(f.state.audits.length, 1); await reject(mutations(f).changeStoreOperation({ ...input, status: "suspended" }), 409);
});
test("failed audit rolls back store changes", async () => { const f = publicFixture(); f.admin(); f.state.auditFail = true; await assert.rejects(mutations(f).changeStoreOperation({ id: B, status: "paused", expectedStatus: "active", reason: "Pause storefront" })); assert.equal(f.state.stores.get(B).status, "active"); });
test("category create rename and delete operations produce transactional audits", async () => {
  const f = fixture(); f.admin(); const created = await f.categories().createCategory({ categoryName: "New category" }); await f.categories().updateCategory({ categoryId: created.data._id, categoryName: "Renamed" }); await f.categories().deleteCategory({ categoryId: created.data._id });
  assert.deepEqual(f.state.audits.map(a => a.action), ["category.create", "category.update", "category.delete"]); assert(f.state.audits.every(a => a.targetType === "category"));
});
test("category audit failure rolls back creation and rename", async () => { const f = fixture(); f.admin(); f.state.auditFail = true; assert.equal((await f.categories().createCategory({ categoryName: "Blocked" })).ok, false); assert.equal(f.state.categories.size, 2); assert.equal((await f.categories().updateCategory({ categoryId: C, categoryName: "Changed" })).ok, false); assert.equal(f.state.categories.get(C).name, "Category"); });
test("archived products still prevent category deletion", async () => { const f = fixture(); f.admin(); f.state.products.get(P).status = "archived"; assert.equal((await f.categories().deleteCategory({ categoryId: C })).error.code, "CATEGORY_IN_USE"); assert.equal(f.state.audits.length, 0); });
test("category directory counts associations and safely escapes search", async () => { const f = fixture(); f.admin(); const result = await queries(f).adminCategories({ q: "Category" }); assert.equal(result.rows[0].productCount, 3); assert.equal((await queries(f).adminCategories({ q: ".*" })).total, 0); });
test("product admin filters are bounded and include real store ownership", async () => { const f = publicFixture(); f.admin(); const result = await queries(f).adminProducts({ merchant: A, category: C, status: "active", pageSize: "1" }); assert.equal(result.rows.length, 1); assert.equal(result.rows[0].store.name, "Test store"); assert.equal(result.rows[0].owner, A); assert.equal(result.rows[0].clerkId, undefined); });
test("admin product archive and restore cannot transfer ownership", async () => {
  const f = publicFixture(); f.admin(); const input = { id: Q, status: "archived", expectedStatus: "active", reason: "Listing policy review" }; await mutations(f).moderateProduct(input); await mutations(f).moderateProduct(input); assert.equal(f.state.audits.length, 1); assert.equal(f.state.products.get(Q).owner, B);
  assert.equal((await f.wrap(() => mutations(f).moderateProduct({ ...input, owner: A }))).error.status, 400); await mutations(f).moderateProduct({ ...input, status: "active", expectedStatus: "archived" }); assert.equal(f.state.audits.length, 2);
});
test("failed product moderation audit rolls back state", async () => { const f = publicFixture(); f.admin(); f.state.auditFail = true; await assert.rejects(mutations(f).moderateProduct({ id: P, status: "archived", expectedStatus: "active", reason: "Listing policy review" })); assert.equal(f.state.products.get(P).status, "active"); });
test("existing explicit platform edit and deletion are now audited", async () => { const f = fixture(); f.admin(); await f.products().adminUpdateProduct({ productId: Q, product: { title: "Moderated title" } }); await f.products().adminDeleteProduct({ productId: Q }); assert.deepEqual(f.state.audits.map(a => a.action), ["product.update", "product.delete"]); });
test("identical platform edit retries do not duplicate audit events", async () => { const f = fixture(); f.admin(); const input = { productId: Q, product: { title: "Reviewed title" } }; await f.products().adminUpdateProduct(input); await f.products().adminUpdateProduct(input); assert.equal(f.state.audits.length, 1); });
test("audit history is target scoped and limited to twenty records", async () => { const f = fixture(); f.admin(); for (let i = 0; i < 30; i++) f.state.audits.push({ actor: A, target: i % 2 ? A : B, action: "merchant.review", reason: "Decision", at: new Date(i), before: "pending", after: "approved" }); assert.equal((await queries(f).adminAudit()).length, 20); assert.equal((await queries(f).adminAudit(B)).length, 15); });
test("public active store is accessible signed out with only its eligible products", async () => {
  const f = publicFixture(); f.state.clerkId = null; const data = await publicStores(f).getPublicStore("audio-store"); assert.equal(data.total, 1); assert.equal(data.products[0]._id, P); assert.equal(data.store.name, "Test store");
  const json = JSON.stringify(data); for (const field of ["contactEmail", "owner", "clerkId", "superAdmin", "merchantStatus"]) assert(!json.includes(`"${field}"`));
});
for (const status of ["suspended", "paused", "deactivated"]) test(`${status} store is unavailable publicly`, async () => { const f = publicFixture(); f.state.stores.get(A).status = status; assert.equal(await publicStores(f).getPublicStore("audio-store"), null); });
for (const change of [{ status: "deleted" }, { status: "suspended" }, { applicationStatus: "suspended" }, { merchantStatus: "suspended" }, { merchantStatus: "pending" }, { merchantStatus: "rejected" }]) test(`store owner ${JSON.stringify(change)} makes storefront unavailable`, async () => { const f = publicFixture(); Object.assign(f.state.users.get(A), change); assert.equal(await publicStores(f).getPublicStore("audio-store"), null); });
test("missing owner, missing slug and malformed slug return uniform null", async () => { const f = publicFixture(); for (const slug of ["missing-store", "../audio-store", "AUDIO", "x".repeat(61)]) assert.equal(await publicStores(f).getPublicStore(slug), null); f.state.users.delete(A); assert.equal(await publicStores(f).getPublicStore("audio-store"), null); });
test("archived, draft and wrong-owner products are absent from public stores", async () => {
  const f = publicFixture(); for (const status of ["archived", "draft"]) { f.state.products.get(P).status = status; assert.equal((await publicStores(f).getPublicStore("audio-store")).total, 0); }
  f.state.products.get(P).status = "active"; f.state.products.get(P).owner = B; assert.equal((await publicStores(f).getPublicStore("audio-store")).total, 0);
});
test("store product search, category filters, sorting and pagination are scoped", async () => {
  const f = publicFixture(); for (let i = 0; i < 4; i++) f.state.products.set(String(i).padStart(24, "0"), { _id: String(i).padStart(24, "0"), ...product(), store: A, owner: A, status: "active", moderationStatus: "clear", title: "Item " + i, createdAt: new Date(i), category: E });
  const first = await publicStores(f).getPublicStore("audio-store", { pageSize: "2", sort: "name-asc" }); const second = await publicStores(f).getPublicStore("audio-store", { pageSize: "2", sort: "name-asc", page: "2" }); assert.equal(first.total, 5); assert.equal(first.totalPages, 3); assert(!first.products.some(p => second.products.some(q => q._id === p._id)));
  assert.equal((await publicStores(f).getPublicStore("audio-store", { q: "[Pro]" })).total, 1); assert.equal((await publicStores(f).getPublicStore("audio-store", { q: ".*" })).total, 0); assert.equal((await publicStores(f).getPublicStore("audio-store", { category: E })).total, 4);
});
test("unassigned products have no public detail", async () => { const f = publicFixture(); assert.equal(await f.products().getProductById(O), null); assert.equal(f.state.products.get(O).store, undefined); });
test("catalog enrichment exposes only eligible store name and slug", async () => {
  const f = publicFixture(); const listing = f.load("@/lib/server/storefront-service"); const rows = (await listing.getCatalog()).products; assert.deepEqual(rows[0].publicStore, { name: "Test store", slug: "audio-store" }); assert.equal(rows[0].owner, undefined);
  f.state.users.get(A).merchantStatus = "suspended"; assert.equal(await listing.getStorefrontProduct(P), null);
});
test("public store route is explicitly excluded from Clerk protection", () => { const source = require("node:fs").readFileSync("proxy.ts", "utf8"); assert(source.includes('"/stores/(.*)"')); });
test("new admin action module exposes no arbitrary role assignment", () => { const f = fixture(); assert.deepEqual(Object.keys(f.load("@/lib/actions/admin.actions")).sort(), ["changeAccountStatus", "changeAdminProductStatus", "changeProductModeration", "changeStoreStatus"]); });
