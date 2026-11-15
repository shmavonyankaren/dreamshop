/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {fixture,product,A,B,P}=require('./helpers/marketplace-fixture.cjs');
const settings=f=>f.load('@/lib/server/currency-service');
const products=f=>f.load('@/lib/server/merchant-products');
const money=fixture().load('@/lib/money');

test('initial policy enables EUR and USD without assigning currency to legacy products',async()=>{
  const f=fixture();const policy=await settings(f).currencySettings();assert.equal(policy.enabled.join(), 'EUR,USD');assert.equal(policy.defaultCurrency,'EUR');assert.equal(f.state.products.get(P).currency,undefined);
});
for(const status of ['guest','customer','merchant','inactive'])test(status+' cannot read or mutate admin currency configuration',async()=>{
  const f=fixture();if(status==='guest')f.state.clerkId=null;if(status==='merchant')f.merchant();if(status==='inactive'){f.admin();f.state.users.get(A).applicationStatus='suspended';}
  for(const op of [()=>settings(f).adminCurrencySettings(),()=>settings(f).saveCurrencySettings({enabled:['USD'],defaultCurrency:'USD',revision:0})])await assert.rejects(op,e=>e.status===401||e.status===403);
  assert.equal(f.state.control,null);
});
test('Super Admin config persists enabled ISO currencies and default with audit and stale-write protection',async()=>{
  const f=fixture();f.admin();const saved=await settings(f).saveCurrencySettings({enabled:['EUR','USD','JPY','KWD'],defaultCurrency:'USD',revision:0});
  assert.equal(saved.revision,1);assert.equal((await settings(f).currencySettings()).defaultCurrency,'USD');assert.equal(f.state.audits.at(-1).action,'currency.settings.update');
  await assert.rejects(()=>settings(f).saveCurrencySettings({enabled:['EUR'],defaultCurrency:'EUR',revision:0}),e=>e.status===409);
  assert.equal((await settings(f).currencySettings()).defaultCurrency,'USD');
});
for(const extra of [{enabled:[]},{enabled:['EUR','EUR']},{enabled:['ZZZ']},{defaultCurrency:'USD',enabled:['EUR']},{enabled:['eur']},{superAdmin:true},{revision:-1}])test('invalid currency configuration rejected: '+JSON.stringify(extra),async()=>{
  const f=fixture();f.admin();await assert.rejects(()=>settings(f).saveCurrencySettings({enabled:['EUR','USD'],defaultCurrency:'EUR',revision:0,...extra}));assert.equal(f.state.control.currencySettings,undefined);
});
test('currency audit failure rolls back settings',async()=>{
  const f=fixture();f.admin();f.state.auditFail=true;await assert.rejects(()=>settings(f).saveCurrencySettings({enabled:['USD'],defaultCurrency:'USD',revision:0}));assert.equal((await settings(f).currencySettings()).defaultCurrency,'EUR');
});
test('concurrent settings changes cannot silently overwrite one another',async()=>{
  const f=fixture();f.admin();const results=await Promise.allSettled(['EUR','USD'].map(code=>settings(f).saveCurrencySettings({enabled:[code],defaultCurrency:code,revision:0})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
});
test('USD creation roundtrips cents and currency through merchant and public projections',async()=>{
  const f=fixture();f.merchant();const {id}=await products(f).saveMerchantProduct({product:product({price:'12.34',currency:'USD'})});
  const record=f.state.products.get(id);assert.equal(record.currency,'USD');assert.equal(record.priceCents,1234);
  const loaded=await products(f).merchantProduct(id);assert.equal(loaded.currency,'USD');assert.equal(loaded.price,'12.34');assert.equal(money.formatPrice(loaded),'$12.34');
  assert.equal(money.formatPrice((await f.products().getAllProducts()).find(p=>p._id===id)),'$12.34');
});
test('disabled currency keeps existing prices; same-price edits work but new/repriced products are rejected on every write path',async()=>{
  const f=fixture();f.merchant();f.admin();const {id}=await products(f).saveMerchantProduct({product:product({currency:'USD'})});
  await settings(f).saveCurrencySettings({enabled:['EUR'],defaultCurrency:'EUR',revision:0});
  await products(f).saveMerchantProduct({id,product:product({currency:'USD',title:'Edited title'})});
  assert.equal(money.formatPrice(await products(f).merchantProduct(id)),'$12.50');
  for(const input of [{product:product({currency:'USD'})},{id,product:product({currency:'USD',price:'13'})}])await assert.rejects(()=>products(f).saveMerchantProduct(input),e=>e.code==='CURRENCY_DISABLED');
  assert.equal((await f.products().createProduct(product({currency:'USD'}))).error.code,'CURRENCY_DISABLED');
  await assert.rejects(()=>f.load('@/lib/server/product-service').updateOwnedProduct({productId:id,product:{currency:'USD',price:'13'}},true),e=>e.code==='CURRENCY_DISABLED');
  await products(f).saveMerchantProduct({id,product:product({currency:'EUR',price:'14'})});assert.equal(f.state.products.get(id).currency,'EUR');assert.equal(f.state.products.get(id).priceCents,1400);
});
test('disabled currency cannot be bypassed via a forged owner or another merchant product',async()=>{
  const f=fixture();f.merchant(A);f.merchant(B);await assert.rejects(()=>products(f).saveMerchantProduct({id:P,product:product({currency:'USD',owner:B})}));
  await f.as('clerk-b',()=>assert.rejects(()=>products(f).saveMerchantProduct({id:P,product:product({currency:'USD'})}),e=>e.status===404));
});
test('additional ISO currencies respect zero and three decimal minor units without rounding',async()=>{
  const f=fixture();f.admin();f.merchant();await settings(f).saveCurrencySettings({enabled:['JPY','KWD'],defaultCurrency:'JPY',revision:0});
  for(const [currency,price,units] of [['JPY','1234',1234],['KWD','1.234',1234]]){const {id}=await products(f).saveMerchantProduct({product:product({currency,price})});const dto=await products(f).merchantProduct(id);assert.equal(dto.priceCents,units);assert.equal(dto.price,price);}
  for(const [currency,price] of [['JPY','1.1'],['KWD','1.2345']])await assert.rejects(()=>products(f).saveMerchantProduct({product:product({currency,price})}));
});
test('mixed-currency carts have no combined subtotal; disabled-currency amounts still format and total independently',()=>{
  const {cartPriceSummary}=fixture().load('@/lib/customer-pricing');const eur={currency:'EUR',priceCents:100,quantity:2},usd={...eur,currency:'USD'};
  assert.equal(cartPriceSummary([usd]).subtotal,'$2.00');assert.equal(cartPriceSummary([eur,usd]).subtotal,undefined);assert.match(cartPriceSummary([eur,usd]).reason,/Mixed currencies/);
});
function loadModel(mongoose){
  const source=ts.transpileModule(fs.readFileSync('lib/db/models/product.model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const loaded={exports:{}};
  vm.runInThisContext(`(function(require,module,exports){${source}})`)(name=>name==='mongoose'?mongoose:name==='../../money'?money:{},loaded,loaded.exports);return loaded.exports.default;
}
test('real Mongoose cached pre-currency model no longer strips pricing or hides it on hydrated documents',()=>{
  const mongoose=new (require('mongoose').Mongoose)();
  const old=mongoose.model('Product',new mongoose.Schema({title:String,price:String}));
  assert.equal(new old({price:'12.50',currency:'USD',priceCents:1250}).toObject().currency,undefined);
  const Model=loadModel(mongoose);assert.equal(Model,old);
  const created=new Model({title:'Test',price:'12.50',currency:'USD',priceCents:1250});assert.equal(created.validateSync(),undefined);
  const saved=created.toObject();assert.equal(saved.currency,'USD');assert.equal(saved.priceCents,1250);
  const hydrated=Model.hydrate(saved);assert.equal(hydrated.currency,'USD');assert.equal(money.formatPrice(hydrated),'$12.50');
  const {toProductDTO}=fixture().load('@/lib/server/product-dto');assert.equal(toProductDTO(hydrated).currency,'USD');
});
test('fresh Mongoose model persists explicit USD minor units and rejects invalid pricing',()=>{
  const mongoose=new (require('mongoose').Mongoose)();const Model=loadModel(mongoose);
  const record=new Model({...product({currency:'USD'}),priceCents:1250,store:A,owner:A});assert.equal(record.validateSync(),undefined);assert.equal(Model.hydrate(record.toObject()).priceCents,1250);
  for(const extra of [{currency:'ZZZ'},{priceCents:1.5},{priceCents:-1},{currency:undefined}])assert(new Model({...record.toObject(),...extra}).validateSync());
});

function adminFormHarness(){
  const slots=[];let cursor=0;const state={requests:[],result:null,refreshes:0};
  const react={...require('react'),useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,v=>{slots[i].value=v;}];},useRef(initial){return slots[cursor++]??={current:initial};}};
  const mocks={react,'next/navigation':{useRouter:()=>({refresh:()=>state.refreshes++})},'@/lib/actions/currency.actions':{updateCurrencies:async input=>{state.requests.push(input);return state.result??{ok:true,data:{...input,revision:input.revision+1}};}},'@/components/ui/button':{Button:'button'},'@/components/ui/foundation':{Input:'input',Select:'select',FormField:'label'}};
  const source=ts.transpileModule(fs.readFileSync('components/admin/CurrencySettingsForm.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const loaded={exports:{}};
  vm.runInThisContext(`(function(require,module,exports){${source}})`)(name=>mocks[name]??require(name),loaded,loaded.exports);
  function render(){cursor=0;return loaded.exports.CurrencySettingsForm({initial:{enabled:['EUR','USD'],defaultCurrency:'EUR',revision:0},options:[{code:'EUR',name:'Euro',digits:2},{code:'USD',name:'US Dollar',digits:2}]});}
  function find(node,predicate){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(child,predicate);if(result)return result;}}
  return {state,render,find,submit:()=>render().props.onSubmit({preventDefault(){}})};
}
test('admin form changes default then disables former default, persists revision, and refreshes',async()=>{
  const h=adminFormHarness();let eur=h.find(h.render(),n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(eur.props.disabled,true);
  h.find(h.render(),n=>n.props?.id==='default-currency'&&n.type==='select').props.onChange({target:{value:'USD'}});
  eur=h.find(h.render(),n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(eur.props.disabled,false);eur.props.onChange({target:{checked:false}});
  await h.submit();assert.equal(h.state.requests[0].enabled.join(),'USD');assert.equal(h.state.requests[0].defaultCurrency,'USD');assert.equal(h.state.refreshes,1);
  await h.submit();assert.equal(h.state.requests[1].revision,1);
});
test('failed admin currency save retains edits and exposes the server error',async()=>{
  const h=adminFormHarness();h.state.result={ok:false,error:{message:'Currencies changed. Reload this page before saving again.'}};await h.submit();assert.equal(h.state.refreshes,0);assert.match(h.find(h.render(),n=>n.props?.role==='status').props.children,/Reload/);assert.equal(h.find(h.render(),n=>n.type==='fieldset').props.disabled,false);
});
