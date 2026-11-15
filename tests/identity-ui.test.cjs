/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");

// Run the real provider and banner against deterministic React hook/external-service
// adapters. Network + installed Next adapter coverage lives in identity.test.cjs.
function harness() {
  const state = { user: { id: "user_a" }, fail: false, cartFail: false, mergeFail: false, calls: 0, refreshes: 0, merges: 0, deferred: null };
  const listeners = new Map();
  const slots = [], effects = []; let cursor = 0, value;
  const timers = new Map(); let now = 0, timerId = 0;
  const setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  function advance(ms) { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); } render(); }
  const changed = (before, after) => !before || after.some((v, i) => v !== before[i]);
  const react = {
    ...require("react"), createContext: () => ({ Provider: "provider" }), useContext: () => value,
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: initial }; return [slots[i].value, update => { slots[i].value = typeof update === "function" ? update(slots[i].value) : update; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) slots[i] = { deps, fn }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const router = { refresh() { state.refreshes++; } };
  const mocks = {
    react,
    "next/navigation": { useRouter: () => router },
    "@clerk/nextjs": { useUser: () => ({ user: state.user, isSignedIn: !!state.user, isLoaded: true }) },
    "@/components/cart/useCartState": { useCartState: () => ({ cartProducts: state.products ?? [], cartReady: state.cartReady ?? false }) },
    "@/lib/utils/localCart": { getLocalCart: () => [] },
    "@/lib/utils/identityClient": { recoverAuthenticatedIdentity: async () => { state.calls++; if (state.deferred) await state.deferred; if (state.fail) throw Error("recovery failed"); } },
    "@/lib/utils/cartClient": { setCartSession() {}, getCartCount: async () => { if (state.cartFail) throw Error("count failed"); return 3; }, ensureGuestCartMerged: async () => { state.merges++; if (state.mergeFail) throw Error("Saved cart needs review."); }, getCartSyncStatus: () => ({ state: "idle", message: "" }), dismissGuestConflicts: async () => {} },
    "@/lib/utils/guest-state": { CART_KEY: "cart", CART_EVENT: "cart", CART_BROADCAST_KEY: "cart-broadcast", SYNC_EVENT: "sync", readGuestState: () => ({ warnings: [] }) },
    "@/components/ui/button": { Button: "button" },
    "@/components/CartContext": { useCart: () => value },
  };
  function load(file) {
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} };
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { Error, setTimeout, clearTimeout, window: { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } }, console })(name => mocks[name] ?? require(name), loaded, loaded.exports);
    return loaded.exports;
  }
  const Provider = load("components/CartContext.tsx").CartProvider;
  const Banner = load("components/cart/CartSyncStatus.tsx").default;
  function render() { cursor = 0; value = Provider({ children: null }).props.value; while (effects.length) effects.shift()(); return value; }
  async function settle() { for (let i = 0; i < 5; i++) { await new Promise(resolve => setImmediate(resolve)); render(); } return value; }
  function retryButton(element = Banner()) { if (!element) return; if (element.type === "button" && element.props.children === "Retry synchronization") return element; for (const child of [element.props?.children].flat(Infinity)) { const found = child && typeof child === "object" && retryButton(child); if (found) return found; } }
  return { state, render, settle, advance, emit: (name, event) => listeners.get(name)?.(event), banner: () => Banner(), html: () => renderToStaticMarkup(Banner()), retryButton };
}

test("successful recovery refreshes server account state, removes banner and loads count", async () => {
  const f = harness(); f.render(); const value = await f.settle();
  assert.equal(f.state.refreshes, 1); assert.equal(value.refreshVersion, 1); assert.equal(value.cartItemsCount, 3); assert.equal(f.banner(), null);
});
test("failed recovery keeps the real retry button; successful click clears error and refreshes", async () => {
  const f = harness(); f.state.fail = true; f.render(); await f.settle();
  assert(f.html().includes("Account synchronization failed")); assert.equal(f.state.refreshes, 0); assert.equal(f.state.merges, 0);
  f.state.fail = false; f.retryButton().props.onClick(); await f.settle();
  assert.equal(f.state.calls, 2); assert.equal(f.state.refreshes, 1); assert.equal(f.banner(), null);
});
test("same Clerk identity object replacement after refresh does not restart recovery", async () => {
  const f = harness(); f.render(); await f.settle(); f.state.user = { id: "user_a" }; f.render(); await f.settle();
  assert.equal(f.state.calls, 1); assert.equal(f.state.refreshes, 1); assert.equal(f.banner(), null);
});
test("cart failures do not report a synchronized account as an identity failure", async () => {
  const f = harness(); f.state.cartFail = true; f.render(); await f.settle();
  assert.equal(f.state.refreshes, 1); assert(f.html().includes("account is synchronized")); assert(!f.html().includes("Account synchronization failed"));
});
test("merge failure preserves cart feedback while refreshing recovered server state", async () => {
  const f = harness(); f.state.mergeFail = true; f.render(); const value = await f.settle();
  assert.equal(f.state.refreshes, 1); assert.equal(value.cartItemsCount, 3); assert(f.html().includes("Saved cart needs review"));
});
test("late recovery after sign-out cannot refresh or merge the previous account", async () => {
  const f = harness(); let resolve; f.state.deferred = new Promise(done => { resolve = done; }); f.render();
  f.state.user = null; f.render(); resolve(); await f.settle();
  assert.equal(f.state.refreshes, 0); assert.equal(f.state.merges, 0); assert.equal(f.banner(), null);
});

test("fast account recovery never displays the delayed loading banner", async () => {
  const f = harness(); f.render(); f.render(); assert.equal(f.banner(), null);
  await f.settle(); f.advance(500); assert.equal(f.banner(), null);
});
test("pending account recovery displays loading only after 500 ms and clears on success", async () => {
  const f = harness(); let resolve; f.state.deferred = new Promise(done => { resolve = done; }); f.render();
  f.advance(499); assert.equal(f.banner(), null);
  f.advance(1); assert(f.html().includes("Synchronizing your account"));
  resolve(); await f.settle(); assert.equal(f.banner(), null);
});
test("a quick failure displays immediately and cannot be overwritten by the loading timer", async () => {
  const f = harness(); f.state.fail = true; f.render(); await f.settle();
  assert(f.html().includes("Account synchronization failed"));
  f.advance(500); assert(f.html().includes("Account synchronization failed"));
});
test("sign-out suppresses the previous account's delayed loading message", async () => {
  const f = harness(); let resolve; f.state.deferred = new Promise(done => { resolve = done; }); f.render();
  f.state.user = null; f.render(); f.advance(500); assert.equal(f.banner(), null);
  resolve(); await f.settle(); assert.equal(f.state.refreshes, 0);
});

test("header count derives from the same confirmed cart snapshot and cross-tab events invalidate it",async()=>{
  const f=harness();f.render();await f.settle();f.state.cartReady=true;f.state.products=[{quantity:2},{quantity:3}];assert.equal(f.render().cartItemsCount,5);
  const version=f.render().refreshVersion;f.emit("storage",{key:"cart-broadcast"});assert.equal(f.render().refreshVersion,version+1);
  f.state.products=[{quantity:9}];assert.equal(f.render().cartItemsCount,9);f.emit("focus");assert.equal(f.render().refreshVersion,version+2);
});
