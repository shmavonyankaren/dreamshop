/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");

function fixture() {
  const state = { path: "/account", hash: "", focused: null, scrolled: null, profileOpened: 0, closed: null, hooks: [], effects: [] };
  let hook = 0; const listeners = new Map();
  const targets = new Map(["overview", "profile", "security"].map(id => [id, { focus(options) { assert.equal(options.preventScroll, true); state.focused = id; }, scrollIntoView(options) { assert.equal(options.block, "start"); state.scrolled = id; } }]));
  const window = { location: { get pathname() { return state.path; }, get hash() { return state.hash; } }, history: { pushState(_data, _title, url) { state.hash = url.slice(url.indexOf("#")); } },
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); }, removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }, dispatchEvent(event) { for (const listener of listeners.get(event.type) ?? []) listener(); } };
  const react = { ...React, useEffect(fn) { state.effects.push(fn); }, useSyncExternalStore(_subscribe, snapshot) { return snapshot(); },
    useState(initial) { const i = hook++; if (!state.hooks[i]) state.hooks[i] = { value: initial }; return [state.hooks[i].value, value => { state.hooks[i].value = value; }]; }, useRef(initial) { const i = hook++; return state.hooks[i] ??= { current: initial }; } };
  const mocks = {
    react, "next/navigation": { usePathname: () => state.path }, "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@clerk/nextjs": { useUser: () => ({ user: { fullName: "Customer", primaryEmailAddress: { emailAddress: "customer@example.test" } } }), useClerk: () => ({ openUserProfile() { state.profileOpened++; } }), UserButton: () => React.createElement("button", { "aria-label": "Clerk account menu" }) },
    "components/customer/WishlistProvider.tsx": { useWishlist: () => ({ data: { count: 2 }, loading: false }) },
    "components/CartContext.tsx": { useCart: () => ({ cartItemsCount: 3 }) },
    "components/cart/CartSyncStatus.tsx": { default: () => null },
    "components/shared/MarketingHero.tsx": { MarketingHero: ({ title }) => React.createElement("h1", null, title) },
    "components/ui/interactive.tsx": { Drawer: props => React.createElement("div", { "data-drawer": props.title }, props.trigger, props.children) },
  };
  const cache = new Map(), root = path.join(__dirname, "..");
  function load(spec, parent = path.join(root, "index.ts")) {
    if (mocks[spec]) return { __esModule: true, ...mocks[spec] };
    if (!spec.startsWith(".") && !spec.startsWith("@/")) return require(spec);
    let filename = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(parent), spec);
    if (!/\.tsx?$/.test(filename)) filename += fs.existsSync(filename + ".ts") ? ".ts" : ".tsx";
    const relative = path.relative(root, filename).replaceAll(path.sep, "/");
    if (mocks[relative]) return { __esModule: true, ...mocks[relative] };
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { window, document: { getElementById: id => targets.get(id) }, Event, console })(name => load(name, filename), loaded, loaded.exports);
    return loaded.exports;
  }
  function render(fn) { hook = 0; return fn(); }
  return { state, load, window, targets, render };
}
function find(node, predicate) { if (!node || typeof node !== "object") return null; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props?.children)) { const result = find(child, predicate); if (result) return result; } return null; }
const click = () => ({ button: 0, preventDefault() { this.prevented = true; } });
const profile = { displayName: "Customer", email: null, username: null, avatar: null, joined: null };

for (const hash of ["#profile", "#security"]) test(hash + " navigation focuses and scrolls the named section and updates selection", () => {
  const f = fixture(), Overview = f.load("@/components/customer/AccountOverview").AccountOverview;
  const overview = Overview({ profile }); f.state.effects.forEach(fn => fn());
  const section = find(overview, n => n.props.id === hash.slice(1)); assert.equal(section.props.tabIndex, -1); assert(section.props.className.includes("ds-account-section")); assert.equal(section.props["aria-labelledby"], hash.slice(1) + "-heading");
  const Nav = f.load("@/components/customer/AccountNavigation").AccountNavigation;
  const tree = Nav({ onNavigate: value => { f.state.closed = value; } });
  const event = click(); find(tree, n => n.props.href === "/account" + hash).props.onClick(event);
  assert(event.prevented); assert.equal(f.state.closed, hash); assert.equal(f.state.focused, hash.slice(1)); assert.equal(f.state.scrolled, hash.slice(1));
  const selected = find(Nav({}), n => n.props["aria-current"] === "location"); assert.equal(selected.props.href, "/account" + hash);
});
test("deep links and browser history focus the correct account section", () => {
  const f = fixture(); f.state.hash = "#security";
  f.load("@/components/customer/AccountOverview").AccountOverview({ profile }); const cleanups = f.state.effects.map(fn => fn());
  assert.equal(f.state.focused, "security"); f.state.hash = "#profile"; f.window.dispatchEvent(new Event("popstate")); assert.equal(f.state.focused, "profile"); cleanups.forEach(fn => fn());
});
test("security and profile actions open Clerk management; overview return is available", () => {
  const f = fixture(), tree = f.load("@/components/customer/AccountOverview").AccountOverview({ profile });
  const security = find(tree, n => n.props.id === "security"); find(security, n => !!n.props.onClick).props.onClick();
  find(find(tree, n => n.props.id === "profile"), n => !!n.props.onClick).props.onClick(); assert.equal(f.state.profileOpened, 2);
  assert(find(security, n => n.props.href === "#overview")); const html = renderToStaticMarkup(tree); assert(html.includes("Clerk manages")); assert(html.includes("available for your account")); assert(!html.includes('type="password"'));
});
test("wishlist is a real route and planned features are noninteractive placeholders", () => {
  const f = fixture(), tree = f.load("@/components/customer/AccountNavigation").AccountNavigation({});
  assert(find(tree, n => n.props.href === "/favourites"));
  for (const label of ["Addresses", "Payment Methods", "Orders", "Notifications", "Preferences"]) { const item = find(tree, n => n.props["aria-label"] === `${label}: Planned`); assert(item); assert.equal(item.type, "div"); assert.equal(item.props["aria-disabled"], "true"); assert.equal(item.props.onClick, undefined); assert.equal(item.props.tabIndex, undefined); }
});
test("customer sidebar stays expanded while other workspaces retain working collapse controls", () => {
  for (const area of ["account", "merchant", "admin"]) {
    const f = fixture(), Shell = f.load("@/components/layout/WorkspaceShell").WorkspaceShell;
    let tree = f.render(() => Shell({ area, children: null })); const toggle = find(tree, n => n.props.label === "Collapse sidebar");
    assert.equal(!!toggle, area !== "account"); assert.equal(find(tree, n => n.props.trigger)?.props.trigger.props.label, "Open workspace navigation");
    if (toggle) { toggle.props.onClick(); tree = f.render(() => Shell({ area, children: null })); assert(find(tree, n => n.props.label === "Expand sidebar")); assert(find(tree, n => n.type === "aside").props.className.includes("w-20")); }
    else assert(find(tree, n => n.type === "aside").props.className.includes("w-64"));
  }
});
test("mobile section navigation closes the drawer and moves focus after its focus trap closes", () => {
  const f = fixture(), Shell = f.load("@/components/layout/WorkspaceShell").WorkspaceShell;
  let tree = f.render(() => Shell({ area: "account", children: null })); let drawer = find(tree, n => n.props.title === "My account"); drawer.props.onOpenChange(true);
  tree = f.render(() => Shell({ area: "account", children: null })); drawer = find(tree, n => n.props.title === "My account");
  const nav = find(drawer, n => typeof n.props.onNavigate === "function"); nav.props.onNavigate("#security"); const event = click(); drawer.props.onCloseAutoFocus(event);
  assert(event.prevented); assert.equal(f.state.focused, "security"); tree = f.render(() => Shell({ area: "account", children: null })); assert.equal(find(tree, n => n.props.title === "My account").props.open, false);
  const ordinaryClose = click(); find(tree, n => n.props.title === "My account").props.onCloseAutoFocus(ordinaryClose); assert(!ordinaryClose.prevented);
});
test("modified anchor clicks preserve browser link behavior", () => {
  const f = fixture(); const tree = f.load("@/components/customer/AccountNavigation").AccountNavigation({ onNavigate: () => { f.state.closed = true; } }); const event = { ...click(), ctrlKey: true };
  find(tree, n => n.props.href === "/account#profile").props.onClick(event); assert(!event.prevented); assert.equal(f.state.closed, null);
});
