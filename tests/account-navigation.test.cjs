/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");

function fixture() {
  const state = { path: "/account", profileOpened: 0, closed: false, hooks: [] };
  let hook = 0;
  const react = { ...React,
    useState(initial) { const i = hook++; if (!state.hooks[i]) state.hooks[i] = { value: initial }; return [state.hooks[i].value, value => { state.hooks[i].value = value; }]; } };
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
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { console })(name => load(name, filename), loaded, loaded.exports);
    return loaded.exports;
  }
  function render(fn) { hook = 0; return fn(); }
  return { state, load, render };
}
function find(node, predicate) { if (!node || typeof node !== "object") return null; if (predicate(node)) return node; for (const child of React.Children.toArray(node.props?.children)) { const result = find(child, predicate); if (result) return result; } return null; }
const profile = { displayName: "Customer", email: null, username: null, avatar: null, joined: null };

test("sidebar contains only Overview and Wishlist routes plus planned placeholders", () => {
  const f = fixture(), Nav = f.load("@/components/customer/AccountNavigation").AccountNavigation;
  const tree = Nav({ onNavigate: () => { f.state.closed = true; } });
  const overview = find(tree, n => n.props.href === "/account");
  assert.equal(overview.props["aria-current"], "page"); overview.props.onClick(); assert(f.state.closed);
  const html = renderToStaticMarkup(tree); assert(!html.includes("Personal Information")); assert(!html.includes("Security")); assert(!html.includes("/account#")); assert(!html.includes("On this page"));
  f.state.path = "/favourites"; assert.equal(find(Nav({}), n => n.props.href === "/account").props["aria-current"], undefined);
});
test("security and profile sections retain Clerk management without a redundant return link", () => {
  const f = fixture(), tree = f.load("@/components/customer/AccountOverview").AccountOverview({ profile });
  const security = find(tree, n => n.props.id === "security"); find(security, n => !!n.props.onClick).props.onClick();
  find(find(tree, n => n.props.id === "profile"), n => !!n.props.onClick).props.onClick(); assert.equal(f.state.profileOpened, 2);
  assert(!find(tree, n => n.props.href === "#overview")); const html = renderToStaticMarkup(tree); assert(html.includes("Clerk manages")); assert(html.includes("available for your account")); assert(!html.includes('type="password"'));
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
test("mobile account navigation closes the drawer with default focus restoration", () => {
  const f = fixture(), Shell = f.load("@/components/layout/WorkspaceShell").WorkspaceShell;
  let tree = f.render(() => Shell({ area: "account", children: null })); let drawer = find(tree, n => n.props.title === "My account"); drawer.props.onOpenChange(true);
  tree = f.render(() => Shell({ area: "account", children: null })); drawer = find(tree, n => n.props.title === "My account");
  const nav = find(drawer, n => typeof n.props.onNavigate === "function"); nav.props.onNavigate();
  tree = f.render(() => Shell({ area: "account", children: null })); drawer = find(tree, n => n.props.title === "My account");
  assert.equal(drawer.props.open, false); assert.equal(drawer.props.onCloseAutoFocus, undefined);
});
