/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { fixture, product, P } = require('./helpers/marketplace-fixture.cjs');
const money = fixture().load('@/lib/money');

test('EUR decimal input is converted exactly to bounded integer cents', () => {
  for (const [value, cents] of [['0',0],['0.01',1],['0.29',29],['12.5',1250],['9999999.99',999999999]]) assert.equal(money.parseEuroCents(value),cents);
  for (const value of ['-1','1.001','1e2','1,20',' 1','01','Infinity','10000000','999999999999999999999']) assert.equal(money.parseEuroCents(value),null);
});
test('formatting uses cents and explicit EUR; legacy and corrupt records never acquire a euro label', () => {
  assert.equal(money.formatPrice({price:'999',priceCents:1250,currency:'EUR'}),'\u20ac12.50');
  assert.equal(money.formatPrice({priceCents:0,currency:'EUR'}),'\u20ac0.00');
  assert.equal(money.formatPrice({price:'12.50'}),'12.50 (currency unspecified)');
  for(const value of [{price:'12',currency:'EUR'},{priceCents:1250},{priceCents:-1,currency:'EUR'},{priceCents:12.5,currency:'EUR'},{priceCents:1200,currency:'ZZZ'}]) assert.equal(money.formatPrice(value),'Price unavailable');
});
test('create and patch contracts require explicit currency and reject excessive precision or client cents', () => {
  const {productFieldsSchema,productUpdateSchema}=fixture().load('@/lib/server/marketplace-validation');
  assert.equal(productFieldsSchema.parse(product({price:'0.29'})).priceCents,29);
  for(const extra of [{currency:undefined},{currency:'ZZZ'},{price:'0.001'},{priceCents:1}]) assert.equal(productFieldsSchema.safeParse(product(extra)).success,false);
  for(const value of [{price:'12'},{currency:'EUR'},{price:'12',currency:'ZZZ'},{priceCents:1200,currency:'EUR'}]) assert.equal(productUpdateSchema.safeParse({productId:P,product:value}).success,false);
  assert.equal(productUpdateSchema.parse({productId:P,product:{price:'12',currency:'EUR'}}).product.priceCents,1200);
  assert.equal(productUpdateSchema.safeParse({productId:P,product:{title:'Title'}}).success,true);
});
test('merchant saves integer cents and explicitly reprices legacy products without changing ownership', async () => {
  const f=fixture();f.merchant(); const service=f.load('@/lib/server/merchant-products');
  const {id}=await service.saveMerchantProduct({product:product({price:'0.29'})});
  assert.equal(f.state.products.get(id).priceCents,29);assert.equal((await service.merchantProduct(id)).currency,'EUR');
  const old=f.state.products.get(P),owner=old.owner;
  assert.equal((await service.merchantProduct(P)).currency,undefined);
  await service.saveMerchantProduct({id:P,product:product({price:'24.50'})});
  assert.equal(old.owner,owner);assert.equal(f.state.products.get(P).priceCents,2450);
  const listings=await f.products().getAllProducts(); assert.equal(listings.find(p=>p._id===id).priceCents,29);
});
test('cart totals cents accurately and refuses mixed legacy, invalid or unavailable items', () => {
  const {cartPriceSummary}=fixture().load('@/lib/customer-pricing');
  const item={priceCents:29,currency:'EUR',quantity:3};
  assert.equal(cartPriceSummary([item,{...item,priceCents:10,quantity:1}]).subtotal,'\u20ac0.97');
  for(const extra of [{price:'12',quantity:1},{...item,available:false},{...item,quantity:100},{...item,currency:'ZZZ'}]) assert.equal(cartPriceSummary([item,extra]).subtotal,undefined);
});

function formHarness(existing, currencies={enabled:['EUR','USD'],defaultCurrency:'EUR',revision:0}) {
  const slots=[];let cursor=0;
  const state={requests:[],toasts:[],replaces:[],pushes:[],refreshes:0,result:{ok:true,data:{id:P}},deferred:null};
  const react={...require('react'),useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,v=>{slots[i].value=v;}];},useRef(initial){return slots[cursor++]??={current:initial};}};
  const f=fixture();
  const mocks={react,'next/navigation':{useRouter:()=>({replace:p=>state.replaces.push(p),push:p=>state.pushes.push(p),refresh:()=>state.refreshes++})},sonner:{toast:{success:m=>state.toasts.push(m)}},'next/image':{default:'img'},'@/components/ui/button':{Button:'button'},'@/components/ui/foundation':{Input:'input',Textarea:'textarea',Select:'select',FormField:'label'},'@/lib/actions/store.actions':{saveStoreProduct:async input=>{state.requests.push(input);if(state.deferred)await state.deferred;if(state.result instanceof Error)throw state.result;return state.result;}},'@/lib/money':money,'@/lib/merchant-contract':{}};
  const compiled=ts.transpileModule(fs.readFileSync('components/merchant/MerchantForms.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const loaded={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${compiled}})`,{FormData:class{constructor(data){this.data=data;}get(key){return this.data[key];}},console})(name=>mocks[name]??require(name),loaded,loaded.exports);
  function render(){cursor=0;return loaded.exports.ProductForm({product:existing,categories:[{_id:'4'.repeat(24),name:'Category'}],images:[],currencies});}
  function find(node,check){if(!node||typeof node!=='object')return; if(check(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,check);if(found)return found;}}
  if (!existing) find(render(),n=>n.props?.label==="Product image").props.onChange(product().imageUrl);
  const event={preventDefault(){},currentTarget:{...product(),tags:'test'}};
  async function settle(){for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}
  return {state,render,find,setAmount:value=>find(render(),n=>n.props?.name==='price').props.onChange({target:{value}}),submit:()=>render().props.onSubmit(event),settle,f};
}
test('actual create form sends EUR, blocks rapid submissions and stays disabled through redirect with toast', async () => {
  const h=formHarness();let resolve;h.state.deferred=new Promise(r=>resolve=r);
  h.submit();h.submit();assert.equal(h.state.requests.length,1);assert.equal(h.state.requests[0].product.currency,'EUR');
  resolve();await h.settle();h.submit();assert.equal(h.state.requests.length,1);
  assert.deepEqual(h.state.replaces,['/merchant/products']);assert.equal(h.state.toasts.length,1);
  assert.equal(h.find(h.render(),n=>n.type==='fieldset').props.disabled,true);
  const schema=h.f.load('@/lib/server/marketplace-validation').productFieldsSchema;
  assert.equal(schema.parse(h.state.requests[0].product).priceCents,1250);
});
for(const result of [{ok:false,error:{message:'Save denied'}},new Error('network')]) test('failed creation remains editable and can retry without navigating',async()=>{
  const h=formHarness();h.state.result=result;h.submit();await h.settle();assert.equal(h.state.replaces.length,0);assert.equal(h.state.toasts.length,0);assert.equal(h.find(h.render(),n=>n.type==='fieldset').props.disabled,false);
  h.state.result={ok:true,data:{id:P}};h.submit();await h.settle();assert.equal(h.state.requests.length,2);assert.equal(h.state.replaces.length,1);
});
test('editing keeps existing push/refresh behavior and legacy price requires explicit entry',async()=>{
  const h=formHarness({_id:P,...product(),currency:undefined});assert.equal(h.find(h.render(),n=>n.props?.name==='price').props.value,'');
  h.submit();await h.settle();assert.equal(h.state.requests[0].id,P);assert.deepEqual(h.state.pushes,['/merchant/products']);assert.equal(h.state.refreshes,1);assert.equal(h.state.toasts.length,0);assert.equal(h.find(h.render(),n=>n.type==='fieldset').props.disabled,false);
  const priced=formHarness({_id:P,...product(),priceCents:1250});assert.equal(priced.find(priced.render(),n=>n.props?.name==='price').props.value,'12.50');
});

test('new product uses the configured default and only enabled currency options',async()=>{
  const h=formHarness(undefined,{enabled:['USD'],defaultCurrency:'USD',revision:2});const selector=h.find(h.render(),n=>n.props?.name==='currency');assert.equal(selector.props.value,'USD');
  assert.equal(h.find(h.render(),n=>n.props?.name==='price').props.value,'');
  const options=[selector.props.children].flat(Infinity).filter(Boolean);assert.equal(options.map(n=>n.props.value).join(),'USD');h.submit();await h.settle();assert.equal(h.state.requests[0].product.currency,'USD');
});
test('editing reloads saved USD amount regardless of current default',()=>{
  const h=formHarness({_id:P,...product({currency:'USD',price:'stale'}),priceCents:1234});assert.equal(h.find(h.render(),n=>n.props?.name==='currency').props.value,'USD');assert.equal(h.find(h.render(),n=>n.props?.name==='price').props.value,'12.34');
});
test('disabled saved currency remains visible/read-only and changing currency clears the amount',()=>{
  const h=formHarness({_id:P,...product({currency:'USD'}),priceCents:1250},{enabled:['EUR'],defaultCurrency:'EUR',revision:1});
  let price=h.find(h.render(),n=>n.props?.name==='price');assert.equal(price.props.readOnly,true);assert.equal(price.props.value,'12.50');
  const select=h.find(h.render(),n=>n.props?.name==='currency');assert.equal(h.find(select,n=>n.type==='option'&&n.props.value==='USD').props.disabled,true);
  select.props.onChange({target:{value:'EUR'}});price=h.find(h.render(),n=>n.props?.name==='price');assert.equal(price.props.value,'');assert.equal(price.props.readOnly,false);
});
test('currency-specific input precision follows ISO minor units',()=>{
  const h=formHarness(undefined,{enabled:['JPY','KWD'],defaultCurrency:'JPY',revision:0});let price=h.find(h.render(),n=>n.props?.name==='price');assert.equal(new RegExp('^'+price.props.pattern+'$').test('1.1'),false);
  h.find(h.render(),n=>n.props?.name==='currency').props.onChange({target:{value:'KWD'}});price=h.find(h.render(),n=>n.props?.name==='price');assert.equal(new RegExp('^'+price.props.pattern+'$').test('1.234'),true);assert.equal(new RegExp('^'+price.props.pattern+'$').test('1.2345'),false);
});
