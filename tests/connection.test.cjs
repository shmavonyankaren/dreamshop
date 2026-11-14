/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync(require("node:path").join(__dirname, "../lib/db/connection.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function fixture(env = {}) {
  let resolve, reject, initial;
  const mongoose = { calls: 0, connection: { readyState: 0, asPromise: () => initial }, connect(_uri, options) {
    assert.equal(options.bufferCommands, false);
    this.options = options;
    this.calls++;
    if (this.connection.readyState === 2) return Promise.resolve(this);
    this.connection.readyState = 2;
    initial = new Promise((yes, no) => { resolve = () => { this.connection.readyState = 1; yes(this); }; reject = () => { this.connection.readyState = 0; no(new Error("connection failed")); }; });
    return initial;
  } };
  const context = vm.createContext({ process: { env: { MONGODB_URI: "mongodb://test.invalid/test", ...env } } });
  function load() {
    const loaded = { exports: {} };
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(() => mongoose, loaded, loaded.exports);
    return loaded.exports.connectDB;
  }
  return { mongoose, load, ready: () => resolve(), fail: () => reject() };
}
test("concurrent module evaluations await one initial connection", async () => {
  const f = fixture(), first = f.load(), second = f.load();
  let completed = false;
  const a = first(), b = second().then(value => { completed = true; return value; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(completed, false); assert.equal(f.mongoose.calls, 1);
  f.ready(); assert.equal(await a, f.mongoose); assert.equal(await b, f.mongoose);
});
test("already connecting Mongoose is awaited without calling connect again", async () => {
  const f = fixture(); const external = f.mongoose.connect("unused", { bufferCommands: false });
  let completed = false; const pending = f.load()().then(() => { completed = true; });
  await Promise.resolve(); await Promise.resolve(); assert.equal(completed, false);
  assert.equal(f.mongoose.calls, 1); f.ready(); await external; await pending;
});
test("failed attempts are cleared and can be retried", async () => {
  const f = fixture(), connect = f.load(); const pending = connect();
  f.fail(); await assert.rejects(pending, /connection failed/);
  const retry = connect(); assert.equal(f.mongoose.calls, 2); f.ready(); await retry;
});
test("disconnected cached connection is reopened", async () => {
  const f = fixture(), connect = f.load(); const first = connect(); f.ready(); await first;
  f.mongoose.connection.readyState = 0;
  const second = connect(); assert.equal(f.mongoose.calls, 2); f.ready(); await second;
});
test("connected instance is reused without reconnecting", async () => {
  const f = fixture(); f.mongoose.connection.readyState = 1;
  assert.equal(await f.load()(), f.mongoose); assert.equal(f.mongoose.calls, 0);
});
test("closing connections fail rather than permitting a query", async () => {
  const f = fixture(); f.mongoose.connection.readyState = 3;
  await assert.rejects(f.load()(), /closing/); assert.equal(f.mongoose.calls, 0);
});
test("connection attempts are bounded without overriding the URI database or TLS", async () => {
  const f = fixture(); const pending = f.load()();
  assert.equal(f.mongoose.options.serverSelectionTimeoutMS, 10000);
  assert.equal(f.mongoose.options.connectTimeoutMS, 10000);
  assert.equal(f.mongoose.options.dbName, undefined);
  assert.equal(f.mongoose.options.tlsAllowInvalidCertificates, undefined);
  assert.equal(f.mongoose.options.tls, undefined);
  f.ready(); await pending;
});
test("database name override is explicit and trimmed", async () => {
  const f = fixture({ MONGODB_DB_NAME: " dreamshop " }); const pending = f.load()();
  assert.equal(f.mongoose.options.dbName, "dreamshop"); f.ready(); await pending;
});
