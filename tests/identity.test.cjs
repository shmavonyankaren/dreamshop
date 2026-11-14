/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { Webhook } = require("svix");
const root = path.resolve(__dirname, "..");
// Test-only random signing key. Verification uses the real Svix implementation.
const secret = "whsec_" + require("node:crypto").randomBytes(32).toString("base64");
const profile = (extra = {}) => ({ id: "user_a", created_at: 1000, updated_at: 2000,
  first_name: "Ada", last_name: null, username: null, image_url: null,
  primary_email_address_id: null, email_addresses: [], banned: false, locked: false, ...extra });

function fixture() {
  const state = { users: new Map(), clerkId: "user_a", fail: false, failAfterWrite: false, conflict: false,
    clerkFail: false, clerkCalls: [], logs: [], live: profile(), writes: 0, fetch: () => { throw new Error("Unexpected network call"); } };
  const query = (get) => ({ select() { return this; }, readConcern(value) { assert.equal(value, "majority"); return this; },
    then(resolve, reject) { return Promise.resolve().then(get).then(resolve, reject); } });
  const model = {
    findOne(filter) { return query(() => structuredClone(state.users.get(filter.clerkId) ?? null)); },
    async create([record], options) {
      assert.deepEqual(options.writeConcern, { w: "majority", j: true });
      if (state.fail) throw state.fail;
      if (state.users.has(record.clerkId)) throw { code: 11000, keyPattern: { clerkId: 1 } };
      const stored = { ...structuredClone(record), _id: String(state.users.size + 1).padStart(24, "0"), __v: 0,
        createdAt: new Date(3000), updatedAt: new Date(3000) };
      state.users.set(record.clerkId, stored); state.writes++;
      if (state.failAfterWrite) throw new Error("Lost database acknowledgement");
      return [structuredClone(stored)];
    },
    async updateOne(filter, update, options) {
      assert.deepEqual(options.writeConcern, { w: "majority", j: true }); assert.equal(options.runValidators, true);
      if (state.fail) throw state.fail;
      const current = state.users.get(filter.clerkId);
      const versionMatches = typeof filter.__v === "object" ? current?.__v === undefined : current?.__v === filter.__v;
      if (state.conflict || !current || current._id !== filter._id || !versionMatches || current.status === "deleted") return { modifiedCount: 0 };
      Object.assign(current, structuredClone(update.$set), { __v: (current.__v ?? 0) + 1, updatedAt: new Date(4000) });
      state.writes++;
      if (state.failAfterWrite) throw new Error("Lost database acknowledgement");
      return { modifiedCount: 1 };
    },
  };
  const mocks = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: state.clerkId }), clerkClient: async () => ({ users: {
      getUser: async (id) => {
        state.clerkCalls.push(id); if (state.clerkFail) throw new Error("Private Clerk failure");
        const p = state.live;
        return { id: p.id, createdAt: p.created_at, updatedAt: p.updated_at, firstName: p.first_name,
          lastName: p.last_name, username: p.username, imageUrl: p.image_url, banned: p.banned, locked: p.locked,
          primaryEmailAddressId: p.primary_email_address_id,
          emailAddresses: p.email_addresses.map((e) => ({ id: e.id, emailAddress: e.email_address, verification: e.verification })) };
      },
    } }) },
    "lib/db/connection.ts": { connectDB: async () => {} },
    "lib/db/models/user.model.ts": { default: model },
    "lib/utils/sendEmail.ts": { default: () => {} },
  };
  const cache = new Map();
  function load(spec, parent = path.join(root, "index.ts")) {
    if (spec === "server-only") return {};
    if (mocks[spec]) return mocks[spec];
    if (!spec.startsWith(".") && !spec.startsWith("@/") && !path.isAbsolute(spec)) return require(spec);
    let filename = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(parent), spec);
    if (!path.extname(filename) || filename.endsWith(".actions") || filename.endsWith(".model")) filename += ".ts";
    const relative = path.relative(root, filename).replaceAll(path.sep, "/");
    if (mocks[relative]) return { __esModule: true, ...mocks[relative] };
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    new vm.Script("(function(require,module,exports,process,console,fetch){" + output + "\n})", { filename }).runInThisContext()(
      (id) => load(id, filename), loaded, loaded.exports, { env: { CLERK_WEBHOOK_SIGNING_SECRET: secret } },
      { error: (...args) => state.logs.push(args) }, (...args) => state.fetch(...args));
    return loaded.exports;
  }
  async function webhook(type, data, extra = {}, options = {}) {
    const body = options.raw ?? JSON.stringify({ type, data, timestamp: 5000, ...extra });
    const now = options.date ?? new Date(), id = "msg_test";
    const headers = { "svix-id": id, "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
      "svix-signature": new Webhook(secret).sign(id, now, body), ...options.headers };
    return load("@/app/api/webhooks/clerk/route.ts").POST(new Request("https://shop.test/api/webhooks/clerk", { method: "POST", body, headers }));
  }
  async function recover(options = {}) {
    return load("@/app/api/identity/sync/route.ts").POST(new Request("https://shop.test/api/identity/sync" + (options.search ?? ""),
      { method: "POST", headers: { origin: "https://shop.test", ...options.headers }, ...(options.body ? { body: options.body } : {}) }));
  }
  return { state, load, webhook, recover, service: () => load("@/lib/server/identity-service.ts") };
}

test("new signed creation creates one canonical identity without returning private data", async () => {
  const f = fixture(), response = await f.webhook("user.created", profile());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { received: true });
  assert.equal(f.state.users.size, 1);
  const user = await f.service().findIdentity("user_a"); assert.equal(user.status, "active"); assert.equal(user.displayName, "Ada");
  assert.equal(user.createdAt, new Date(3000).toISOString()); assert.equal(user.email, null);
  assert.deepEqual(f.service().toPublicUser(user), { displayName: "Ada", avatar: null });
});
test("duplicate and concurrent creations are idempotent", async () => {
  const f = fixture(); const responses = await Promise.all(Array.from({ length: 5 }, () => f.webhook("user.created", profile())));
  assert(responses.every((r) => r.status === 200)); assert.equal(f.state.users.size, 1); assert.equal(f.state.writes, 1);
});
test("updates target only their Clerk identity and duplicate updates do not write", async () => {
  const f = fixture(); await f.webhook("user.created", profile()); await f.webhook("user.created", profile({ id: "user_b" }));
  const update = profile({ updated_at: 3000, first_name: "Grace" });
  await f.webhook("user.updated", update); const writes = f.state.writes; await f.webhook("user.updated", update);
  assert.equal(f.state.writes, writes); assert.equal(f.state.users.get("user_a").firstName, "Grace");
  assert.equal(f.state.users.get("user_b").firstName, "Ada");
});
test("update before create creates a mapping and old creation cannot overwrite it", async () => {
  const f = fixture(); await f.webhook("user.updated", profile({ updated_at: 9000, first_name: "New" }));
  await f.webhook("user.created", profile()); assert.equal(f.state.users.get("user_a").firstName, "New"); assert.equal(f.state.writes, 1);
});
test("concurrent newer and older profiles converge to the newer version", async () => {
  const f = fixture(); await f.webhook("user.created", profile());
  await Promise.all([f.webhook("user.updated", profile({ updated_at: 4000, first_name: "Four" })),
    f.webhook("user.updated", profile({ updated_at: 3000, first_name: "Three" }))]);
  assert.equal(f.state.users.get("user_a").firstName, "Four");
});
test("equal-version conflicting events fail closed and authoritative recovery resolves the tie", async () => {
  const f = fixture(); await f.webhook("user.created", profile());
  assert.equal((await f.webhook("user.updated", profile({ first_name: "Fresh" }))).status, 409);
  f.state.live = profile({ first_name: "Fresh" }); assert.equal((await f.recover()).status, 200);
  assert.equal(f.state.users.get("user_a").firstName, "Fresh");
  assert.equal((await f.webhook("user.created", profile())).status, 409);
});
test("missing optional profile names, username and photo are supported without invented values", async () => {
  const f = fixture(), p = profile(); delete p.first_name; delete p.last_name; delete p.username; delete p.image_url;
  assert.equal((await f.webhook("user.created", p)).status, 200);
  const user = await f.service().findIdentity("user_a");
  assert.equal(user.displayName, null); assert.equal(user.username, null); assert.equal(user.avatar, null);
});
test("matching suggested usernames and email values never link separate identities", async () => {
  const f = fixture();
  for (const id of ["user_a", "user_b"]) await f.webhook("user.created", profile({ id, username: "same", primary_email_address_id: "e",
    email_addresses: [{ id: "e", email_address: "same@example.test", verification: { status: "verified" } }] }));
  assert.equal(f.state.users.size, 2); assert.notEqual(f.state.users.get("user_a")._id, f.state.users.get("user_b")._id);
});
test("verified primary email selection and changes use the primary ID, not array order", async () => {
  const f = fixture(); const emails = [{ id: "a", email_address: "a@example.test", verification: { status: "verified" } },
    { id: "b", email_address: "b@example.test", verification: { status: "verified" } }];
  await f.webhook("user.created", profile({ primary_email_address_id: "b", email_addresses: emails }));
  assert.equal(f.state.users.get("user_a").email, "b@example.test");
  await f.webhook("user.updated", profile({ updated_at: 3000, primary_email_address_id: "a", email_addresses: emails }));
  assert.equal(f.state.users.get("user_a").email, "a@example.test");
});
for (const variant of ["missing", "unverified", "invalid"]) test(variant + " primary email remains null and does not block identity creation", async () => {
  const f = fixture();
  const p = profile({ primary_email_address_id: variant === "missing" ? "missing" : "a", email_addresses: [
    { id: "a", email_address: variant === "invalid" ? "bad" : "a@example.test", verification: { status: variant === "unverified" ? "unverified" : "verified" } },
  ] });
  assert.equal((await f.webhook("user.created", p)).status, 200); assert.equal(f.state.users.get("user_a").email, null);
});
test("failure before persistence returns sanitized retryable error and retry succeeds", async () => {
  const f = fixture(); f.state.fail = new Error("private connection detail");
  const response = await f.webhook("user.created", profile()); assert.equal(response.status, 503);
  assert(!JSON.stringify(await response.json()).includes("private")); assert.equal(f.state.logs.length, 1); assert.equal(f.state.users.size, 0);
  f.state.fail = false; assert.equal((await f.webhook("user.created", profile())).status, 200);
});
test("lost database acknowledgement after creation is recovered without another insert", async () => {
  const f = fixture(); f.state.failAfterWrite = true; assert.equal((await f.webhook("user.created", profile())).status, 503);
  f.state.failAfterWrite = false; assert.equal((await f.webhook("user.created", profile())).status, 200); assert.equal(f.state.writes, 1);
});
test("legacy unique-index conflicts fail safely and can be retried after index remediation", async () => {
  const f = fixture(); f.state.fail = { code: 11000, keyPattern: { email: 1 } };
  assert.equal((await f.webhook("user.created", profile())).status, 503); assert.equal(f.state.users.size, 0);
  f.state.fail = false; assert.equal((await f.webhook("user.created", profile())).status, 200);
});
test("lost acknowledgement after update retries without changing the committed version", async () => {
  const f = fixture(); await f.webhook("user.created", profile()); f.state.failAfterWrite = true;
  const update = profile({ updated_at: 3000, first_name: "Updated" });
  assert.equal((await f.webhook("user.updated", update)).status, 503);
  f.state.failAfterWrite = false; assert.equal((await f.webhook("user.updated", update)).status, 200);
  assert.equal(f.state.writes, 2); assert.equal(f.state.users.get("user_a").__v, 1);
});
test("removing a verified primary email clears the previous stored email", async () => {
  const f = fixture(); await f.webhook("user.created", profile({ primary_email_address_id: "a", email_addresses: [
    { id: "a", email_address: "a@example.test", verification: { status: "verified" } },
  ] }));
  await f.webhook("user.updated", profile({ updated_at: 3000 })); assert.equal(f.state.users.get("user_a").email, null);
});
test("browser recovery coalesces in-flight requests and failed attempts remain retryable", async () => {
  const f = fixture(); let release, calls = 0;
  f.state.fetch = async (url, options) => {
    assert.equal(url, "/api/identity/sync"); assert.equal(options.method, "POST"); assert.equal(options.body, undefined);
    calls++; await new Promise((resolve) => { release = resolve; }); return Response.json({ synchronized: true }, { status: calls === 1 ? 503 : 200 });
  };
  const client = f.load("@/lib/utils/identityClient.ts"), first = client.recoverAuthenticatedIdentity("user_a");
  assert.equal(client.recoverAuthenticatedIdentity("user_a"), first); release(); await assert.rejects(first);
  const retry = client.recoverAuthenticatedIdentity("user_a"); release(); await retry; assert.equal(calls, 2);
});

test("real bodyless browser recovery survives the installed Next Node request adapter", async (t) => {
  const { createServer } = require("node:http");
  const { NodeNextRequest } = require("next/dist/server/base-http/node");
  const { NextRequestAdapter } = require("next/dist/server/web/spec-extension/adapters/next-request");
  const f = fixture(); let streamedRequests = 0;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const nodeRequest = new NodeNextRequest(incoming);
      nodeRequest.url = `http://localhost:${server.address().port}${incoming.url}`;
      const request = NextRequestAdapter.fromNodeNextRequest(nodeRequest, new AbortController().signal);
      if (request.body !== null) streamedRequests++;
      const response = await f.load("@/app/api/identity/sync/route.ts").POST(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(await response.text());
    } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  f.state.fetch = (url, options) => {
    assert.equal(options.body, undefined); assert.equal(options.headers, undefined);
    assert.equal(options.method, "POST"); assert.equal(options.cache, "no-store");
    const origin = `http://localhost:${server.address().port}`;
    return fetch(origin + url, { ...options, headers: { origin } }).then(async response => { assert.equal(response.status, 200, await response.clone().text()); return response; });
  };
  const client = f.load("@/lib/utils/identityClient.ts");
  await client.recoverAuthenticatedIdentity("user_a");
  const resolver = f.load("@/lib/server/authenticated-user.ts");
  const id = await resolver.requireCartUser(), writes = f.state.writes;
  await client.recoverAuthenticatedIdentity("user_a");
  assert.equal(await resolver.requireCartUser(), id); assert.equal(f.state.writes, writes);
  assert.equal(f.state.users.size, 1); assert.equal(streamedRequests, 2);
});

test("recovery accepts empty streams but rejects every nonempty serialization before Clerk lookup", async () => {
  for (const body of ["", "{}", "null", "undefined", "\"\"", " ", "false", "x".repeat(100000)]) {
    const f = fixture();
    const request = new Request("https://shop.test/api/identity/sync", { method: "POST", body, headers: { origin: "https://shop.test", "Content-Length": "0" } });
    assert.notEqual(request.body, null);
    const response = await f.load("@/app/api/identity/sync/route.ts").POST(request);
    assert.equal(response.status, body === "" ? 200 : 400);
    if (body) { assert.equal((await response.json()).code, "INVALID_PAYLOAD"); assert.equal(f.state.clerkCalls.length, 0); assert.equal(f.state.writes, 0); }
  }
});

test("client rejects failed or incomplete acknowledgements and permits subsequent recovery", async () => {
  const f = fixture(), client = f.load("@/lib/utils/identityClient.ts");
  for (const data of [{}, null, { synchronized: false }]) {
    f.state.fetch = async () => Response.json(data);
    await assert.rejects(client.recoverAuthenticatedIdentity("user_a"), /not confirmed/);
  }
  f.state.fetch = async () => Response.json({ synchronized: true });
  await client.recoverAuthenticatedIdentity("user_a");
});
test("contention exhaustion preserves data and retry succeeds", async () => {
  const f = fixture(); await f.webhook("user.created", profile()); f.state.conflict = true;
  const update = profile({ updated_at: 3000, first_name: "New" });
  assert.equal((await f.webhook("user.updated", update)).status, 409); assert.equal(f.state.users.get("user_a").firstName, "Ada");
  f.state.conflict = false; assert.equal((await f.webhook("user.updated", update)).status, 200);
});
test("invalid, missing and expired Svix signatures are rejected before mutation", async () => {
  const f = fixture();
  for (const options of [{ headers: { "svix-signature": "v1,wrong" } }, { headers: { "svix-id": "" } }, { date: new Date(1000) }]) {
    assert.equal((await f.webhook("user.created", profile(), {}, options)).status, 400);
  }
  assert.equal(f.state.users.size, 0);
});
test("signed malformed JSON and invalid supported payloads are rejected", async () => {
  const f = fixture(); assert.equal((await f.webhook("user.created", profile(), {}, { raw: "{" })).status, 400);
  for (const data of [null, {}, profile({ updated_at: -1 }), profile({ banned: undefined }), profile({ email_addresses: "bad" })]) {
    assert.equal((await f.webhook("user.created", data)).status, 400);
  }
  assert.equal((await f.webhook("user.deleted", { id: "user_a" })).status, 400); assert.equal(f.state.users.size, 0);
});
test("oversized webhook bodies are rejected and unsupported signed event types are ignored", async () => {
  const f = fixture(); assert.equal((await f.webhook("user.created", profile(), {}, { raw: "x".repeat(256 * 1024 + 1) })).status, 413);
  assert.equal((await f.webhook("session.created", {})).status, 200); assert.equal(f.state.users.size, 0);
});
test("identity persistence is server-only and public action exports contain only contact behavior", () => {
  const f = fixture(); assert.deepEqual(Object.keys(f.load("@/lib/actions/user.actions.ts")), ["sendContactForm"]);
  assert.match(fs.readFileSync(path.join(root, "lib/server/identity-service.ts"), "utf8"), /import "server-only"/);
});
test("deletion retains customer identity and profile while denying resolution; repeats are no-ops", async () => {
  const f = fixture(); await f.webhook("user.created", profile()); const before = structuredClone(f.state.users.get("user_a"));
  await f.webhook("user.deleted", { id: "user_a", deleted: true }); const writes = f.state.writes;
  await f.webhook("user.deleted", { id: "user_a", deleted: true });
  const after = f.state.users.get("user_a"); assert.equal(after._id, before._id); assert.equal(after.firstName, before.firstName); assert.equal(after.status, "deleted");
  assert.equal(f.state.writes, writes);
  await assert.rejects(f.load("@/lib/server/authenticated-user.ts").requireCartUser(), (e) => e.status === 403);
});
test("delete-before-create tombstone blocks historical and even later snapshots and recovery", async () => {
  const f = fixture(); await f.webhook("user.deleted", { id: "user_a", deleted: true });
  await f.webhook("user.created", profile()); await f.webhook("user.updated", profile({ updated_at: 10000 }));
  assert.equal((await f.recover()).status, 403); assert.equal(f.state.users.get("user_a").status, "deleted"); assert.equal(f.state.writes, 1);
  assert.deepEqual(f.state.clerkCalls, []);
});
test("concurrent deletion and updates always leave a tombstone", async () => {
  const f = fixture(); await f.webhook("user.created", profile());
  await Promise.all([f.webhook("user.updated", profile({ updated_at: 10000 })), f.webhook("user.deleted", { id: "user_a", deleted: true })]);
  assert.equal(f.state.users.get("user_a").status, "deleted");
});
test("authenticated recovery creates incomplete profiles and cart resolver returns the stable ID", async () => {
  const f = fixture(); assert.equal((await f.recover()).status, 200);
  const resolver = f.load("@/lib/server/authenticated-user.ts"); const id = await resolver.requireCartUser();
  await f.webhook("user.created", profile()); assert.equal(await resolver.requireCartUser(), id);
  assert.deepEqual(f.state.clerkCalls, ["user_a"]);
});
test("missing mappings and unauthenticated resolution retain predictable Phase 1 errors", async () => {
  const f = fixture(), resolver = f.load("@/lib/server/authenticated-user.ts");
  await assert.rejects(resolver.requireCartUser(), (e) => e.status === 409 && e.code === "USER_SYNC_PENDING");
  f.state.clerkId = null; await assert.rejects(resolver.requireCartUser(), (e) => e.status === 401);
});
test("banned or locked identities cannot resolve carts and metadata cannot grant privileges", async () => {
  const f = fixture(); await f.webhook("user.created", profile({ banned: true, public_metadata: { status: "active", role: "admin" }, unsafe_metadata: { role: "admin" } }));
  await assert.rejects(f.load("@/lib/server/authenticated-user.ts").requireCartUser(), (e) => e.status === 403);
  assert.equal(f.state.users.get("user_a").role, undefined);
  await f.webhook("user.updated", profile({ updated_at: 3000, locked: true }));
  await assert.rejects(f.load("@/lib/server/authenticated-user.ts").requireCartUser(), (e) => e.status === 403);
});
test("recovery rejects unauthenticated, cross-origin and arbitrary profile/target input", async () => {
  const f = fixture(); f.state.clerkId = null; assert.equal((await f.recover()).status, 401); f.state.clerkId = "user_a";
  assert.equal((await f.recover({ headers: { origin: "https://attacker.test" } })).status, 403);
  assert.equal((await f.recover({ body: JSON.stringify({ clerkId: "user_b", status: "active" }) })).status, 400);
  assert.equal((await f.recover({ search: "?userId=user_b" })).status, 400);
  assert.equal(f.state.users.size, 0); assert.deepEqual(f.state.clerkCalls, []);
});
test("Clerk recovery outage is retryable and a mismatched Backend API identity is rejected", async () => {
  const f = fixture(); f.state.clerkFail = true; assert.equal((await f.recover()).status, 503); assert.equal(f.state.users.size, 0);
  f.state.clerkFail = false; f.state.live = profile({ id: "user_b" }); assert.equal((await f.recover()).status, 503);
  assert.equal(f.state.users.size, 0); f.state.live = profile(); assert.equal((await f.recover()).status, 200);
});
test("legacy identity update preserves MongoDB ID and adds synchronization metadata", async () => {
  const f = fixture(); f.state.users.set("user_a", { _id: "a".repeat(24), clerkId: "user_a", firstName: "Legacy" });
  assert.equal(await f.load("@/lib/server/authenticated-user.ts").requireCartUser(), "a".repeat(24));
  await f.webhook("user.updated", profile()); assert.equal(f.state.users.get("user_a")._id, "a".repeat(24));
  assert.equal(f.state.users.get("user_a").clerkUpdatedAt, 2000);
});
test("real Mongoose schema preserves the Clerk unique index and declares non-unique admin indexes", () => {
  const mongoose = require("mongoose"), filename = path.join(root, "lib/db/models/user.model.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} }; new vm.Script("(function(require,module,exports){" + output + "\n})").runInThisContext()(require, loaded, loaded.exports);
  const Model = loaded.exports.default, record = new Model({ clerkId: "user_a" });
  assert.equal(record.validateSync(), undefined); assert.equal(record.email, null); assert.equal(record.username, null);
  assert.equal(record.superAdmin, false); assert.equal(record.merchantStatus, "none"); assert.equal(record.applicationStatus, "active");
  assert.equal(Model.schema.options.autoIndex, false);
  assert.deepEqual(Model.schema.indexes().map(([keys, options]) => [keys, options.unique]), [[{ clerkId: 1 }, true], [{ createdAt: -1, _id: -1 }, undefined], [{ merchantStatus: 1, createdAt: -1, _id: -1 }, undefined], [{ status: 1, applicationStatus: 1, merchantStatus: 1 }, undefined]]);
  mongoose.deleteModel("User");
});

test("Clerk profile metadata cannot grant application privileges", async () => {
  const f = fixture();
  await f.webhook("user.created", profile({ superAdmin: true, merchantStatus: "approved", applicationStatus: "active",
    public_metadata: { superAdmin: true, role: "superAdmin" }, unsafe_metadata: { merchantStatus: "approved" } }));
  const user = await f.service().findIdentity("user_a");
  assert.equal(user.superAdmin, false); assert.equal(user.merchantStatus, "none");
});
test("webhooks, duplicates, older events and authenticated recovery preserve application policy", async () => {
  const f = fixture(); await f.webhook("user.created", profile());
  const stored = f.state.users.get("user_a");
  Object.assign(stored, { superAdmin: true, merchantStatus: "approved", applicationStatus: "suspended" });
  const update = profile({ updated_at: 4000, first_name: "New", public_metadata: { applicationStatus: "active", superAdmin: false } });
  await f.webhook("user.updated", update); await f.webhook("user.updated", update); await f.webhook("user.created", profile());
  f.state.live = profile({ updated_at: 5000 }); assert.equal((await f.recover()).status, 403);
  const current = await f.service().findIdentity("user_a");
  assert.equal(current.superAdmin, true); assert.equal(current.merchantStatus, "approved"); assert.equal(current.applicationStatus, "suspended");
  assert.deepEqual(f.service().toPublicUser(current), { displayName: "Ada", avatar: null });
});
