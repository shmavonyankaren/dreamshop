/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");

// Execute the installed next-themes provider against a small hook/storage
// adapter. This verifies its real persistence callbacks, not browser rendering.
function themeHarness() {
  const storage = new Map(), applied = new Set(), effects = [];
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) };
  const fakeReact = { createContext: () => ({ Provider: "provider" }), useContext: () => undefined, createElement: (type,props,...children) => ({ type, props: { ...props,children } }),
    useState: initial => [typeof initial === "function" ? initial() : initial, () => {}], useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => effects.push(fn), memo: fn => fn };
  const loaded = { exports: {} };
  const media = { matches: true, addListener(){}, removeListener(){} };
  const context = { localStorage, window: { matchMedia: () => media, addEventListener(){},removeEventListener(){} }, document: { documentElement: { classList: { remove: (...names) => names.forEach(n=>applied.delete(n)), add: name=>applied.add(name) }, style: {} } }, setTimeout };
  vm.runInNewContext(`(function(require,module,exports){${fs.readFileSync(require.resolve("next-themes"),"utf8")}\n})`,context)(()=>fakeReact,loaded,loaded.exports);
  function value() { effects.length=0; const element=loaded.exports.ThemeProvider({attribute:"class",defaultTheme:"dark",enableSystem:true});const provider=element.type(element.props);for(const effect of effects)effect();return provider.props.value; }
  return {value,storage,applied,media};
}
function fixture(signedIn=false) {
  const theme=themeHarness(), state={signedIn,count:3,path:"/faq",mobileClosed:false,userId:"clerk-a",loaded:true};
  const UserButton=({children})=>React.createElement("div",null,React.createElement("button",{"aria-label":"Account menu","data-avatar":true},"Avatar"),children);
  UserButton.MenuItems=({children})=>React.createElement("nav",{"aria-label":"Account menu items"},children);
  UserButton.Link=({href,label})=>React.createElement("a",{href},label);
  UserButton.Action=({label})=>React.createElement("button",{"data-clerk-action":label},label);
  const wrap=({children})=>React.createElement(React.Fragment,null,children);
  const mocks={
    "@clerk/nextjs":{useUser:()=>({user:{id:state.userId},isLoaded:state.loaded,isSignedIn:state.signedIn}),Show:({when,children})=>(when==="signed-in")===state.signedIn?children:null,SignInButton:({children})=>React.createElement("div",{"data-sign-in-flow":true},children),UserButton},
    "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
    "next/navigation":{usePathname:()=>state.path},
    "next-themes":{useTheme:()=>theme.value()},
    "components/CartContext.tsx":{useCart:()=>({cartItemsCount:state.count})},
    "components/ui/interactive.tsx":{Drawer:({trigger,children,title})=>React.createElement("section",{"data-mobile-drawer":title},trigger,children)},
    "components/ui/dropdown-menu.tsx":{DropdownMenu:wrap,DropdownMenuTrigger:wrap,DropdownMenuContent:({children})=>React.createElement("div",{role:"menu"},children),DropdownMenuRadioGroup:({children,value,...props})=>React.createElement("div",{role:"group","aria-label":props["aria-label"],"data-value":value},children),DropdownMenuRadioItem:({children,value})=>React.createElement("div",{role:"menuitemradio","aria-checked":theme.value().theme===value},children)},
  };
  const cache=new Map();
  function load(spec,parent=path.join(root,"index.ts")) {
    if(mocks[spec])return {__esModule:true,...mocks[spec]};
    if(!spec.startsWith(".")&&!spec.startsWith("@/"))return require(spec);
    let filename=spec.startsWith("@/")?path.join(root,spec.slice(2)):path.resolve(path.dirname(parent),spec);
    if(!/\.(tsx?|cjs)$/.test(filename))filename+=fs.existsSync(filename+".ts")?".ts":".tsx";
    const relative=path.relative(root,filename).replaceAll(path.sep,"/");
    if(mocks[relative])return {__esModule:true,...mocks[relative]};
    if(cache.has(filename))return cache.get(filename).exports;
    const loaded={exports:{}};cache.set(filename,loaded);
    const output=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    vm.runInNewContext(`(function(require,module,exports){${output}\n})`,{console,process,URL},{filename})(name=>load(name,filename),loaded,loaded.exports);
    return loaded.exports;
  }
  return {load,state,theme};
}
function findElement(node,predicate) {
  if(!node||typeof node!=="object")return null;
  if(predicate(node))return node;
  for(const child of React.Children.toArray(node.props?.children)){const found=findElement(child,predicate);if(found)return found;}
  return null;
}
test("signed-out header has one account entry and preserves wishlist/cart",()=>{const f=fixture();const Header=f.load("@/components/shared/Header").default;const html=renderToStaticMarkup(React.createElement(Header));assert.equal((html.match(/Sign in to your account/g)||[]).length,1);assert(!html.includes("data-avatar"));assert(html.includes('href="/favourites"'));assert(html.includes('aria-label="Shopping cart, 3 items"'));});
test("signed-in header has one avatar and account/profile/sign-out menu actions",()=>{const f=fixture(true);const html=renderToStaticMarkup(React.createElement(f.load("@/components/shared/Header").default));assert.equal((html.match(/data-avatar="true"/g)||[]).length,1);assert.equal((html.match(/href="\/account"/g)||[]).length,1);assert(html.includes('data-clerk-action="manageAccount"'));assert(html.includes('data-clerk-action="signOut"'));assert(!html.includes("Sign in to your account"));});
test("mobile drawer retains navigation and theme but does not duplicate account controls",()=>{const f=fixture(true);const html=renderToStaticMarkup(React.createElement(f.load("@/components/shared/Header").default));assert(html.includes('data-mobile-drawer="Explore Dreamshop"'));assert(html.includes('aria-label="Open navigation"'));assert(html.includes('href="/faq"'));assert.equal((html.match(/data-avatar="true"/g)||[]).length,1);assert(html.includes('aria-label="Choose color theme"'));});
test("mobile navigation invokes close callback and recognizes active route",()=>{const f=fixture();const Navigation=f.load("@/components/shared/NavigationMenu").default;const tree=Navigation({onNavigate:()=>{f.state.mobileClosed=true;}});const link=findElement(tree,e=>e.props?.href==="/faq");assert.equal(link.props["aria-current"],"page");link.props.onClick();assert.equal(f.state.mobileClosed,true);});

const { fixture: serverFixture, A } = require("./helpers/marketplace-fixture.cjs");
for (const [name, user, merchant, admin] of [
  ["customer", {}, false, false],
  ["approved merchant", { merchantStatus: "approved" }, true, false],
  ["pending merchant", { merchantStatus: "pending" }, false, false],
  ["rejected merchant", { merchantStatus: "rejected" }, false, false],
  ["suspended merchant", { merchantStatus: "suspended" }, false, false],
  ["inactive merchant account", { merchantStatus: "approved", applicationStatus: "suspended" }, false, false],
  ["inactive identity", { superAdmin: true, status: "suspended" }, false, false],
  ["Super Admin", { superAdmin: true }, false, true],
  ["Super Admin and merchant", { superAdmin: true, merchantStatus: "approved" }, true, true],
]) test(name + " receives authoritative workspace links in the single desktop/mobile account menu", async () => {
  const server = serverFixture(); Object.assign(server.state.users.get(A), user);
  const navigation = await server.load("@/lib/server/account-navigation").resolveAccountNavigation();
  if (navigation) assert.deepEqual(Object.keys(navigation).sort(), ["adminDashboard", "clerkId", "merchantDashboard"]);
  const f = fixture(true), AuthHeader = f.load("@/components/shared/AuthHeader").default;
  const html = renderToStaticMarkup(React.createElement(f.load("@/components/shared/Header").default, { accountControl: React.createElement(AuthHeader, { navigation }) }));
  assert.equal(html.includes('href="/merchant"'), merchant); assert.equal(html.includes('href="/admin"'), admin);
  assert(html.includes("My Account")); assert(html.includes("My Favorites"));
  assert.equal((html.match(/data-avatar="true"/g)||[]).length, 1);
  assert.equal((html.match(/data-clerk-action="manageAccount"/g)||[]).length, 1);
  assert.equal((html.match(/data-clerk-action="signOut"/g)||[]).length, 1);
  assert(html.includes('data-mobile-drawer="Explore Dreamshop"'));
  const auth = server.load("@/lib/server/authorization");
  if (!admin) await assert.rejects(auth.requireRouteAccess("admin"), e => e.status === 403);
  if (!merchant && !admin) await assert.rejects(auth.requireRouteAccess("merchant"), e => e.status === 403);
});

test("guest, missing identity and database outage return no privileged navigation", async () => {
  for (const scenario of ["guest", "missing", "outage"]) {
    const f = serverFixture();
    if (scenario === "guest") f.state.clerkId = null;
    if (scenario === "missing") f.state.users.clear();
    if (scenario === "outage") f.state.users.values = () => { throw new Error("Database unavailable"); };
    assert.equal(await f.load("@/lib/server/account-navigation").resolveAccountNavigation(), null);
  }
});

test("loading and changed Clerk sessions suppress stale privileged links", () => {
  const f = fixture(true), AuthHeader = f.load("@/components/shared/AuthHeader").default;
  for (const [loaded, userId] of [[false, "clerk-a"], [true, "clerk-b"]]) {
    Object.assign(f.state, { loaded, userId });
    const html = renderToStaticMarkup(React.createElement(AuthHeader, { navigation: { clerkId: "clerk-a", merchantDashboard: true, adminDashboard: true } }));
    assert(!html.includes('href="/admin"')); assert(!html.includes('href="/merchant"')); assert(html.includes('data-clerk-action="signOut"'));
  }
});

test("streamed server account control passes the authoritative projection to Clerk menu", async () => {
  const f = serverFixture(); f.admin();
  const element = await f.load("@/components/shared/WorkspaceAccountMenu").WorkspaceAccountMenu();
  assert.deepEqual(element.props.navigation, { clerkId: "clerk-a", merchantDashboard: false, adminDashboard: true });
});

test("navigation preserves Next dynamic-rendering control flow", async () => {
  const f = serverFixture(); const signal = Object.assign(new Error("Dynamic rendering"), { digest: "DYNAMIC_SERVER_USAGE" });
  f.state.users.values = () => { throw signal; };
  await assert.rejects(f.load("@/lib/server/account-navigation").resolveAccountNavigation(), error => error === signal);
});
test("cart badge retains full accessible count and capped visual count",()=>{const f=fixture();f.state.count=123;const html=renderToStaticMarkup(React.createElement(f.load("@/components/products/ShoppingCart").default));assert(html.includes("Shopping cart, 123 items"));assert(html.includes("99+"));});
test("theme menu delegates Light, Dark and System to real next-themes persistence",()=>{const f=fixture();const Toggle=f.load("@/components/shared/ModeToggle").ModeToggle;for(const value of ["light","dark","system"]){const tree=Toggle();const group=findElement(tree,e=>typeof e.props?.onValueChange==="function");group.props.onValueChange(value);assert.equal(f.theme.storage.get("theme"),value);assert.equal(f.theme.value().theme,value);assert(f.theme.applied.has(value==="system"?"dark":value));}});
test("theme preference survives provider recreation and System follows device preference",()=>{const f=fixture();f.theme.value().setTheme("system");assert.equal(f.theme.value().theme,"system");assert.equal(f.theme.value().resolvedTheme,"dark");f.theme.media.matches=false;assert.equal(f.theme.value().resolvedTheme,"light");assert(f.theme.applied.has("light"));});
test("theme selector rejects unsupported values",()=>{const f=fixture();const tree=f.load("@/components/shared/ModeToggle").ModeToggle();findElement(tree,e=>typeof e.props?.onValueChange==="function").props.onValueChange("purple");assert.equal(f.theme.storage.has("theme"),false);});
test("theme options have accessible radio semantics and selected state",()=>{const f=fixture();f.theme.value().setTheme("dark");const html=renderToStaticMarkup(React.createElement(f.load("@/components/shared/ModeToggle").ModeToggle));assert(html.includes('aria-label="Choose color theme"'));assert(html.includes('aria-label="Color theme"'));assert.equal((html.match(/role="menuitemradio"/g)||[]).length,3);assert.equal((html.match(/aria-checked="true"/g)||[]).length,1);});
test("dropdown uses installed Radix radio primitives for keyboard and focus behavior",()=>{const source=fs.readFileSync(path.join(root,"components/ui/dropdown-menu.tsx"),"utf8");assert(source.includes("DropdownMenuPrimitive.RadioGroup"));assert(source.includes("DropdownMenuPrimitive.RadioItem"));assert(source.includes("DropdownMenuPrimitive.ItemIndicator"));assert(source.includes("data-[highlighted]:bg-accent"));const toggle=fs.readFileSync(path.join(root,"components/shared/ModeToggle.tsx"),"utf8");assert(!toggle.includes("text-body-tertiary"));assert(toggle.includes("collisionPadding={12}"));});
test("theme trigger is stable before preference hydration",()=>{const f=fixture();const Toggle=f.load("@/components/shared/ModeToggle").ModeToggle;const label=()=>findElement(Toggle(),e=>e.props?.["aria-label"]==="Choose color theme").props;const before=label();f.theme.value().setTheme("light");const after=label();assert.equal(before["aria-label"],after["aria-label"]);assert.equal(before.className,after.className);});
test("FAQ uses compact native accordions and real contact navigation",()=>{const f=fixture();const html=renderToStaticMarkup(React.createElement(f.load("@/app/(root)/faq/page").default));assert.equal((html.match(/<details /g)||[]).length,12);assert.equal((html.match(/<summary /g)||[]).length,12);assert(html.includes('name="faq-shopping"'));assert(!html.includes('<details open'));assert(html.includes('href="/contact"'));assert(html.includes('aria-label="FAQ topics"'));assert(!/purple|indigo/.test(html));});
test("FAQ explicitly distinguishes available features from unavailable commerce",()=>{const f=fixture();const {faqGroups}=f.load("@/lib/faq-content");const answers=faqGroups.flatMap(g=>g.items);const answer=q=>answers.find(item=>item.question===q).answer;assert(answer("Can I place an order or pay now?").includes("payments, and completed orders are not available"));assert(answer("Are shipment tracking, returns, or exchanges available?").includes("does not currently process"));assert(answer("Can I save addresses or payment methods?").includes("not currently available"));assert(answer("How do I save a product to my wishlist?").includes("Sign in"));assert(answer("How can I contact Dreamshop?").includes("no response-time guarantee"));});
