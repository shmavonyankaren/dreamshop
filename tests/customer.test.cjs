/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const { aggregate: eligibilityAggregate, fixtures: eligibilityFixtures } = require("./helpers/eligibility-aggregate.cjs");
const root = path.resolve(__dirname,".."), A="a".repeat(24), B="b".repeat(24), P="1".repeat(24), Q="2".repeat(24);
function fixture() {
  const state = { actor:A, mapped:true, status:"active", applicationStatus:"active", lists:new Map(), products:new Map(), writes:[], saved:[], guest:false, wishlistError:"", fail:false };
  for(const id of [P,Q])state.products.set(id,{_id:id,title:"Product",description:"Description",price:"10.00",imageUrl:"/image.png",tags:[],category:{_id:P,name:"Category",private:"secret"},owner:A,store:A,status:"active",moderationStatus:"clear"});
  const query = value => ({ select(){return this;},populate(){return this;},limit(){return this;},then(resolve,reject){return Promise.resolve().then(value).then(resolve,reject);} });
  const wishlist = {
    findById(id){return query(()=>state.lists.has(id)?{products:[...state.lists.get(id)]}:null);},
    async updateOne(filter,update,options){
      if(state.fail)throw new Error("private storage failure");
      state.writes.push({filter,update,options});
      if(update.$setOnInsert){if(!state.lists.has(filter._id))state.lists.set(filter._id,[]);return {matchedCount:1};}
      const items=state.lists.get(filter._id);if(!items)return {matchedCount:0};
      if(update.$pull){state.lists.set(filter._id,items.filter(id=>id!==update.$pull.products));return {matchedCount:1};}
      assert.equal(filter.$or[0]["products.499"].$exists,false);
      if(items.length>=500&&!items.includes(filter.$or[1].products))return {matchedCount:0};
      if(!items.includes(update.$addToSet.products))items.push(update.$addToSet.products);
      return {matchedCount:1};
    },
  };
  const mocks={
    "@clerk/nextjs/server":{auth:async()=>({userId:state.actor})},
    "@clerk/nextjs":{useUser:()=>({isLoaded:true,isSignedIn:!state.guest,user:state.guest?null:{fullName:"Customer",primaryEmailAddress:{emailAddress:"own@example.test"}}}),useClerk:()=>({openUserProfile(){}}),SignInButton:({children})=>React.createElement("div",{"data-sign-in":true},children),UserButton:()=>React.createElement("span",null,"Profile")},
    "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
    "lib/db/connection.ts":{connectDB:async()=>{}},
    "lib/server/identity-service.ts":{findIdentity:async()=>state.mapped?{id:state.actor,clerkId:"private-clerk",displayName:"Customer",email:state.actor+"@example.test",avatar:null,username:"customer",createdAt:null,status:state.status,applicationStatus:state.applicationStatus,merchantStatus:"none",superAdmin:false}:null},
    "lib/db/models/wishlist.model.ts":{default:wishlist},
    "lib/db/models/product.model.ts":{default:{aggregate:pipeline=>({option:async()=>eligibilityAggregate(pipeline,eligibilityFixtures(state.products.values()))}),exists:async({_id,status})=>state.products.has(_id)&&(!status||state.products.get(_id).status!==status.$ne),find:({_id,status})=>query(()=>[...state.products.values()].filter(p=>_id.$in.includes(p._id)&&(!status||p.status!==status.$ne)))}},
    "components/customer/WishlistProvider.tsx":{useWishlist:()=>({data:{products:[...state.products.values()],savedIds:state.saved,unavailableIds:[],count:state.saved.length},loading:false,busy:false,error:state.wishlistError,refresh(){},change:async()=>{}})},
    "components/CartContext.tsx":{useCart:()=>({cartItemsCount:2})},
    "components/cart/CartSyncStatus.tsx":{default:()=>null},
    "components/products/StorefrontPurchase.tsx":{StorefrontPurchase:({productId})=>React.createElement("button",{"data-cart-product":productId},"Add to cart")},
    "components/products/StorefrontImage.tsx":{StorefrontImage:({title})=>React.createElement("span",null,title)},
    "components/shared/MarketingHero.tsx":{MarketingHero:({title})=>React.createElement("header",null,title),ElectronicsArtwork:()=>null},
    "lib/server/storefront-service.ts":{getHomepageData:async()=>({products:[...state.products.values()],categories:[],productError:false,categoryError:false})},
  };
  const cache=new Map();
  function load(spec,parent=path.join(root,"index.ts")){
    if(spec==="server-only")return {};
    if(mocks[spec])return {__esModule:true,...mocks[spec]};
    if(!spec.startsWith(".")&&!spec.startsWith("@/"))return require(spec);
    let filename=spec.startsWith("@/")?path.join(root,spec.slice(2)):path.resolve(path.dirname(parent),spec);
    if(!/\.(tsx?|cjs)$/.test(filename))filename+=fs.existsSync(filename+".ts")?".ts":".tsx";
    const relative=path.relative(root,filename).replaceAll(path.sep,"/");
    if(mocks[relative])return {__esModule:true,...mocks[relative]};
    if(cache.has(filename))return cache.get(filename).exports;
    const loaded={exports:{}};cache.set(filename,loaded);
    const source=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`,{console,Response,Request,URL,Buffer,process},{filename})(name=>load(name,filename),loaded,loaded.exports);
    return loaded.exports;
  }
  return {state,load,service:load("@/lib/server/wishlist-service")};
}
test("account and wishlist require authentication",async()=>{const f=fixture();f.state.actor=null;await assert.rejects(f.service.getWishlist(),e=>e.status===401);await assert.rejects(f.load("@/lib/server/customer-service").getCustomerProfile(),e=>e.status===401);});
test("account projection exposes only the authenticated customer's profile",async()=>{const f=fixture();const profile=await f.load("@/lib/server/customer-service").getCustomerProfile(B);assert.equal(profile.email,A+"@example.test");assert.equal(Object.keys(profile).sort().join(),"avatar,displayName,email,joined,username");assert(!JSON.stringify(profile).includes("private-clerk"));});
test("missing identity mapping remains recoverable and does not write",async()=>{const f=fixture();f.state.mapped=false;await assert.rejects(f.service.mutateWishlist({productId:P,action:"add"}),e=>e.status===409);assert.equal(f.state.writes.length,0);});
test("inactive application and identity accounts cannot read or mutate favorites",async()=>{for(const field of ["status","applicationStatus"]){const f=fixture();f.state[field]="suspended";await assert.rejects(f.service.getWishlist(),e=>e.status===403);await assert.rejects(f.service.mutateWishlist({productId:P,action:"add"}),e=>e.status===403);}});
test("first addition creates an owned wishlist with safe public products",async()=>{const f=fixture();const data=await f.service.mutateWishlist({productId:P,action:"add"});assert.equal(data.count,1);assert.equal(f.state.lists.get(A)[0],P);assert(!JSON.stringify(data).includes("owner"));assert(!JSON.stringify(data).includes("secret"));});
test("duplicate additions and repeated removals are idempotent",async()=>{const f=fixture();for(let i=0;i<3;i++)await f.service.mutateWishlist({productId:P,action:"add"});assert.equal((await f.service.getWishlist()).count,1);for(let i=0;i<2;i++)await f.service.mutateWishlist({productId:P,action:"remove"});assert.equal((await f.service.getWishlist()).count,0);});
test("different customers cannot read or remove one another's favorites",async()=>{const f=fixture();await f.service.mutateWishlist({productId:P,action:"add"});f.state.actor=B;assert.equal((await f.service.getWishlist()).count,0);await f.service.mutateWishlist({productId:P,action:"remove"});assert.equal(f.state.lists.get(A).length,1);});
test("client-supplied ownership, operators, and invalid IDs are rejected",async()=>{const f=fixture();for(const input of [{productId:"bad",action:"add"},{productId:P,action:"add",userId:B},{productId:{$ne:null},action:"add"},{productId:P,action:"toggle"}])await assert.rejects(f.service.mutateWishlist(input));assert.equal(f.state.writes.length,0);});
test("missing products cannot be added",async()=>{const f=fixture();f.state.products.delete(P);await assert.rejects(f.service.mutateWishlist({productId:P,action:"add"}),e=>e.status===404);});
test("deleted products remain removable without leaking stale details",async()=>{const f=fixture();await f.service.mutateWishlist({productId:P,action:"add"});f.state.products.delete(P);const data=await f.service.getWishlist();assert.equal(data.products.length,0);assert.equal(data.unavailableIds[0],P);assert.equal(data.count,1);assert.equal((await f.service.mutateWishlist({productId:P,action:"remove"})).count,0);});
test("saved-state and count stay consistent across additions and removals",async()=>{const f=fixture();await f.service.mutateWishlist({productId:P,action:"add"});await f.service.mutateWishlist({productId:Q,action:"add"});const data=await f.service.mutateWishlist({productId:P,action:"remove"});assert.equal(data.count,1);assert.equal(data.savedIds.join(),Q);assert.equal(data.products[0]._id,Q);});
test("concurrent duplicate first additions create one document and one favorite",async()=>{const f=fixture();await Promise.all(Array.from({length:20},()=>f.service.mutateWishlist({productId:P,action:"add"})));assert.equal(f.state.lists.size,1);assert.equal((await f.service.getWishlist()).count,1);});
test("concurrent distinct additions retain both favorites",async()=>{const f=fixture();await Promise.all([P,Q].map(productId=>f.service.mutateWishlist({productId,action:"add"})));assert.equal((await f.service.getWishlist()).count,2);});
test("concurrent additions and removals preserve unrelated items without duplicates",async()=>{const f=fixture();await f.service.mutateWishlist({productId:Q,action:"add"});await Promise.all(Array.from({length:12},(_,i)=>f.service.mutateWishlist({productId:P,action:i%2?"remove":"add"})));const ids=f.state.lists.get(A);assert(ids.includes(Q));assert(ids.filter(id=>id===P).length<=1);await f.service.mutateWishlist({productId:P,action:"remove"});assert.equal((await f.service.getWishlist()).savedIds.join(),Q);});
test("concurrent additions enforce capacity atomically and duplicates remain idempotent at capacity",async()=>{const f=fixture();f.state.lists.set(A,Array.from({length:499},(_,i)=>String(i+100).padStart(24,"0")));const results=await Promise.allSettled([P,Q].map(productId=>f.service.mutateWishlist({productId,action:"add"})));assert.equal(f.state.lists.get(A).length,500);assert.equal(results.filter(r=>r.status==="rejected").length,1);const saved=f.state.lists.get(A).includes(P)?P:Q;await f.service.mutateWishlist({productId:saved,action:"add"});assert.equal(f.state.lists.get(A).length,500);});
test("API rejects ownership query parameters and cross-origin mutations",async()=>{const f=fixture();const route=f.load("@/app/api/wishlist/route");assert.equal((await route.GET(new Request("https://shop.test/api/wishlist?userId="+B))).status,400);assert.equal((await route.POST(new Request("https://shop.test/api/wishlist",{method:"POST",headers:{origin:"https://evil.test"},body:JSON.stringify({productId:P,action:"add"})}))).status,403);});
test("API errors are controlled and private responses are not cached",async()=>{const f=fixture();const route=f.load("@/app/api/wishlist/route");f.state.fail=true;const response=await route.POST(new Request("https://shop.test/api/wishlist",{method:"POST",body:JSON.stringify({productId:P,action:"add"})}));assert.equal(response.status,500);assert.equal(response.headers.get("cache-control"),"private, no-store");assert(!(await response.text()).includes("private storage failure"));});
test("API rejects malformed, oversized, and owner-injecting bodies",async()=>{const f=fixture();const route=f.load("@/app/api/wishlist/route");for(const [body,status] of [["{",400],["x".repeat(17000),413],[JSON.stringify({productId:P,action:"add",owner:B}),400]]){const result=await route.POST(new Request("https://shop.test/api/wishlist",{method:"POST",body}));assert.equal(result.status,status);}assert.equal(f.state.writes.length,0);});
test("guest favorite button is a sign-in prompt",()=>{const f=fixture();f.state.guest=true;const {FavoriteButton}=f.load("@/components/customer/FavoriteButton");const html=renderToStaticMarkup(React.createElement(FavoriteButton,{productId:P,title:"Product"}));assert(html.includes('data-sign-in="true"'));assert(html.includes("Sign in to save Product"));});
test("saved favorite buttons render pressed state",()=>{const f=fixture();f.state.saved=[P];const {FavoriteButton}=f.load("@/components/customer/FavoriteButton");assert(renderToStaticMarkup(React.createElement(FavoriteButton,{productId:P,title:"Product"})).includes('aria-pressed="true"'));});
test("product cards contain a favorite control and existing cart integration",()=>{const f=fixture();const {ProductCard}=f.load("@/components/products/StorefrontProducts");const html=renderToStaticMarkup(React.createElement(ProductCard,{product:f.state.products.get(P)}));assert(html.includes("Save Product to wishlist"));assert(html.includes('data-cart-product="'+P+'"'));});
test("wishlist cards expose removal and existing add-to-cart control",()=>{const f=fixture();f.state.saved=[P,Q];const {WishlistPage}=f.load("@/components/customer/WishlistPage");const html=renderToStaticMarkup(React.createElement(WishlistPage));assert(html.includes('data-cart-product="'+P+'"'));assert(html.includes("Remove"));assert(html.includes("2 Saved Items"));});
test("product details integrate the shared favorite and quantity cart controls",()=>{const source=fs.readFileSync(path.join(root,"app/(root)/all-products/[productId]/page.tsx"),"utf8").replace(/\s+/g," ");assert(source.includes("<FavoriteButton productId={product._id}"));assert(source.includes("<StorefrontPurchase productId={product._id} title={product.title}"));});
test("cart empty state provides a working catalog link",()=>{const f=fixture();const {CartPresentation}=f.load("@/components/cart/CartPresentation");const html=renderToStaticMarkup(React.createElement(CartPresentation,{products:[],pending:false,onRemove(){},onQuantityChange(){}}));assert(html.includes("Your cart is empty"));assert(html.includes('href="/all-products"'));});
test("cart renders quantity bounds, removal, listed prices and unavailable checkout",()=>{const f=fixture();const {CartPresentation}=f.load("@/components/cart/CartPresentation");const html=renderToStaticMarkup(React.createElement(CartPresentation,{products:[{...f.state.products.get(P),quantity:99}],pending:false,onRemove(){},onQuantityChange(){}}));assert(html.includes("Increase quantity of Product"));assert(html.includes("Remove Product from cart"));assert(html.includes("10.00"));assert(html.includes("No order will be placed"));assert(html.includes("disabled"));});
test("price summary never invents currency or sums unrestricted price strings",()=>{const f=fixture();const {cartPriceSummary}=f.load("@/lib/customer-pricing");for(const price of ["10.00","$10","1,000","NaN","-20","10.999","Infinity"]){const result=cartPriceSummary([{price,quantity:2}]);assert.equal(result.itemCount,2);assert.equal(result.subtotal,undefined);assert(result.reason.includes("currency")||result.reason.includes("cannot be safely"));}assert.equal(cartPriceSummary([]).itemCount,0);});

test("archived wishlist products become unavailable without losing saved IDs",async()=>{const f=fixture();f.state.lists.set(A,[P]);f.state.products.get(P).status="archived";const data=await f.service.getWishlist();assert.equal(data.products.length,0);assert(data.unavailableIds.includes(P));await assert.rejects(f.service.mutateWishlist({productId:P,action:"add"}));});

test("held favorites retain only saved IDs and remain removable",async()=>{const f=fixture();await f.service.mutateWishlist({productId:P,action:"add"});Object.assign(f.state.products.get(P),{moderationStatus:"held",moderationReason:"private reason"});const data=await f.service.getWishlist();assert.equal(data.products.length,0);assert(data.unavailableIds.includes(P));assert(!JSON.stringify(data).includes("private reason"));await assert.rejects(f.service.mutateWishlist({productId:P,action:"add"}),e=>e.status===404);assert.equal((await f.service.mutateWishlist({productId:P,action:"remove"})).count,0);});
test("unavailable cart presentation disables increases and omits product links",()=>{const f=fixture();const {CartPresentation}=f.load("@/components/cart/CartPresentation");const html=renderToStaticMarkup(React.createElement(CartPresentation,{products:[{_id:P,title:"Unavailable product",imageUrl:"",price:"",category:null,quantity:2,available:false}],pending:false,onRemove(){},onQuantityChange(){}}));assert(!html.includes('/all-products/'+P));assert(html.includes("Unavailable. Remove"));assert(/disabled=""[^>]*aria-label="Increase/.test(html));assert(html.includes("Remove Unavailable product from cart"));});

test("wishlist DTO and shared storefront/cart views preserve and render explicit EUR cents", async()=>{
  const f=fixture();Object.assign(f.state.products.get(P),{priceCents:1250,currency:"EUR",price:"incorrect legacy string"});
  const data=await f.service.mutateWishlist({productId:P,action:"add"});const product=data.products[0];
  assert.equal(product.priceCents,1250);assert.equal(product.currency,"EUR");assert.equal(product.price,"12.50");
  const {ProductPrice}=f.load("@/components/products/StorefrontProducts");
  assert(renderToStaticMarkup(React.createElement(ProductPrice,product)).includes("\u20ac12.50"));
  const {CartPresentation}=f.load("@/components/cart/CartPresentation");
  const html=renderToStaticMarkup(React.createElement(CartPresentation,{products:[{...product,quantity:2}],pending:false,onRemove(){},onQuantityChange(){}}));
  assert(html.includes("\u20ac12.50"));assert(html.includes("\u20ac25.00"));assert(!html.includes("incorrect legacy string"));
});

for(const currency of ["EUR","USD"])test("homepage product cards retain links, favorites, cart and "+currency+" formatting",async()=>{
  const f=fixture();Object.assign(f.state.products.get(P),{currency,priceCents:1250,title:"A long product title with descriptive words that should stay accessible when clamped"});
  const html=renderToStaticMarkup(await f.load("@/app/page").default());
  assert(html.includes("Explore Our Products"));assert(html.includes('href="/all-products/'+P+'"'));assert(html.includes('data-cart-product="'+P+'"'));assert(html.includes("to wishlist"));
  assert(html.includes(currency==="EUR"?"\u20ac12.50":"$12.50"));assert(html.includes('title="A long product title'));
  assert(html.includes("auto-rows-fr"));for(const breakpoint of ["sm:grid-cols-2","md:gap-6","lg:grid-cols-3","xl:grid-cols-4"])assert(html.includes(breakpoint));
  assert(html.includes("aspect-[4/3]"));assert(html.includes("line-clamp-2"));assert(html.includes("mt-auto"));assert(!html.includes('class="ds-panel marketing-product"'));
});
test("catalog cards keep category and merchant links while homepage uses the same shopping controls",()=>{
  const f=fixture(),{ProductCard}=f.load("@/components/products/StorefrontProducts");const product={...f.state.products.get(P),publicStore:{name:"Merchant shop",slug:"merchant-shop"}};
  const catalog=renderToStaticMarkup(React.createElement(ProductCard,{product}));const home=renderToStaticMarkup(React.createElement(ProductCard,{product,variant:"home"}));
  assert(catalog.includes('href="/stores/merchant-shop"'));assert(catalog.includes("Category"));assert(!home.includes('href="/stores/merchant-shop"'));
  for(const html of [home,catalog]){assert(html.includes('data-cart-product="'+P+'"'));assert(html.includes("currency unspecified"));assert(html.includes("absolute right-2 top-2"));}
});
