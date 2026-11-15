/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function hooks(){
  const slots=[],effects=[];let cursor=0;const changed=(a,b)=>!a||b.some((v,i)=>v!==a[i]);
  const react={...require('react'),useId:()=> 'quantity-error',useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value;}];},useRef(initial){return slots[cursor++]??={current:initial};},useCallback(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps))slots[i]={deps,fn};return slots[i].fn;},useEffect(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
  return {react,render(fn){cursor=0;const result=fn();while(effects.length)effects.shift()();return result;}};
}
function load(file,mocks){const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const loaded={exports:{}};vm.runInThisContext(`(function(require,module,exports){${source}})`)(name=>mocks[name]??require(name),loaded,loaded.exports);return loaded.exports;}
function find(node,predicate){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}}
function quantityHarness(extra={}){
 const h=hooks(),commits=[],steps=[];const props={quantity:2,title:'Product',onStep:delta=>steps.push(delta),onCommit:(...args)=>commits.push(args),...extra};
 const Control=load('components/cart/QuantityControl.tsx',{react:h.react,'@/components/ui/button':{Button:'button'},'@/lib/cart-contract':{MAX_QUANTITY:99}}).QuantityControl;
 const render=()=>h.render(()=>Control(props)),input=()=>find(render(),n=>n.type==='input');
 return {props,commits,steps,render,input,type(value){input().props.onFocus();input().props.onChange({target:{value}});}};
}
test('quantity commits only on blur/Enter, and Enter followed by blur commits once',()=>{
 const h=quantityHarness();h.type('12');assert.equal(h.commits.length,0);h.input().props.onKeyDown({key:'Enter',preventDefault(){}});h.input().props.onBlur();assert.deepEqual(h.commits,[[12,2]]);
});
for(const value of ['', '0','100','-1','2.5','1e1','abc',' 2'])test('invalid quantity safely restores the saved value: '+JSON.stringify(value),()=>{
 const h=quantityHarness();h.type(value);h.input().props.onBlur();assert.equal(h.commits.length,0);assert.equal(h.input().props.value,'2');assert.equal(h.input().props['aria-invalid'],true);assert(find(h.render(),n=>n.props?.role==='alert'));
});
test('external changes retain typed-edit baseline instead of silently overwriting another view',()=>{
 const h=quantityHarness();h.type('7');h.props.quantity=4;h.input().props.onBlur();assert.deepEqual(h.commits,[[7,2]]);
});
test('unchanged/escaped edits do not submit, and quantity boundaries retain keyboard-accessible controls',()=>{
 const h=quantityHarness({quantity:1});h.type('1');h.input().props.onBlur();assert.equal(h.commits.length,0);h.type('5');h.input().props.onKeyDown({key:'Escape'});h.input().props.onBlur();assert.equal(h.commits.length,0);
 const minus=find(h.render(),n=>n.props?.['aria-label']==='Decrease quantity of Product');assert.equal(minus.props.disabled,true);assert(!minus.props.className.includes('cursor-not-allowed'));assert(minus.props.className.includes('disabled:pointer-events-auto'));assert(minus.props.className.includes('select-none'));assert(h.input().props.className.includes('select-text'));
 h.props.quantity=99;assert.equal(find(h.render(),n=>n.props?.['aria-label']==='Increase quantity of Product').props.disabled,true);
});
test('pending and unavailable items cannot accept unsafe quantity edits',()=>{
 const h=quantityHarness({disabled:true});assert.equal(h.input().props.disabled,true);h.type('7');h.input().props.onBlur();assert.equal(h.commits.length,0);
 h.props.disabled=false;h.props.unavailable=true;h.type('5');h.input().props.onBlur();assert.equal(h.commits.length,0);h.type('1');h.input().props.onBlur();assert.deepEqual(h.commits,[[1,2]]);
});
test('storefront purchase switches from Add to shared quantity controls using provider state',()=>{
 const state={cartProducts:[],cartReady:true,cartError:'',cartPending:[],mutateCart:async(...args)=>calls.push(args),reloadCart:async()=>{}};const calls=[];
 const Purchase=load('components/products/StorefrontPurchase.tsx',{'@/components/CartContext':{useCart:()=>state},'@/components/ui/button':{Button:'button'},'@/components/cart/QuantityControl':{QuantityControl:'quantity-control'}}).StorefrontPurchase;
 const render=()=>Purchase({productId:'p',title:'Product'});let button=find(render(),n=>n.type==='button');assert.equal(button.props['aria-label'],'Add Product to cart');button.props.onClick();assert.equal(calls[0][1].type,'add');
 state.cartProducts=[{_id:'p',quantity:4}];const control=find(render(),n=>n.type==='quantity-control');assert.equal(control.props.quantity,4);assert(!find(render(),n=>n.props?.['aria-label']==='Add Product to cart'));control.props.onStep(1);assert.equal(calls[1][1].delta,1);
 state.cartPending=['p'];assert.equal(find(render(),n=>n.type==='quantity-control').props.disabled,false);assert.equal(find(render(),n=>n.type==='quantity-control').props.pending,true);
});
function stateHarness(){
 const h=hooks(),state={session:'a',version:0,products:[{_id:'p',quantity:1}],load:null,mutate:null,calls:0};
 const use=load('components/cart/useCartState.ts',{react:h.react,'@/lib/utils/cartClient':{setCartSession(){}},'@/lib/utils/cart-quantity':{loadCartProducts:async()=>state.load?state.load():structuredClone(state.products),changeStorefrontQuantity:async(_session,_id,action)=>{state.calls++;if(state.mutate)await state.mutate(action);else state.products[0].quantity=action.type==='set'?action.quantity:state.products[0].quantity+(action.delta??1);}}}).useCartState;
 const render=()=>h.render(()=>use(state.session,state.version));const settle=async()=>{for(let i=0;i<5;i++){await new Promise(r=>setImmediate(r));render();}};return {state,render,settle};
}
test('rapid edits update the display immediately and all accepted changes execute in order',async()=>{
 const h=stateHarness();h.render();await h.settle();let release;const gate=new Promise(r=>release=r);h.state.mutate=async action=>{await gate;h.state.products[0].quantity=action.type==='set'?action.quantity:h.state.products[0].quantity+action.delta;};
 const first=h.render().mutateCart('p',{type:'step',delta:1});const second=h.render().mutateCart('p',{type:'step',delta:1});const third=h.render().mutateCart('p',{type:'set',quantity:8,expectedQuantity:3});const fourth=h.render().mutateCart('p',{type:'step',delta:-1});
 assert.equal(h.render().cartProducts[0].quantity,7);assert.equal(h.render().cartPending[0],'p');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.state.calls,1);release();await Promise.all([first,second,third,fourth]);assert.equal(h.state.calls,4);assert.equal(h.render().cartProducts[0].quantity,7);assert.equal(h.render().cartPending.length,0);
});
test('failed writes cancel queued successors and restore the confirmed quantity',async()=>{
 const h=stateHarness();h.render();await h.settle();h.state.mutate=async()=>{throw Error('Network failure');};const first=h.render().mutateCart('p',{type:'step',delta:1}),second=h.render().mutateCart('p',{type:'step',delta:1});const results=await Promise.allSettled([first,second]);assert(results.every(r=>r.status==='rejected'));assert.equal(h.state.calls,1);assert.equal(h.render().cartProducts[0].quantity,1);assert.equal(h.render().cartPending.length,0);
});
test('repeated Add submissions remain deduplicated',async()=>{
 const h=stateHarness();h.render();await h.settle();const first=h.render().mutateCart('p',{type:'add'}),second=h.render().mutateCart('p',{type:'add'});assert.equal(first,second);await first;assert.equal(h.state.calls,1);
});

test('shared state recovers committed quantity after a lost response and keeps an error visible',async()=>{
 const h=stateHarness();h.render();await h.settle();h.state.mutate=async()=>{h.state.products[0].quantity=2;throw Error('Response lost');};await assert.rejects(h.render().mutateCart('p',{type:'step',delta:1}),/Response lost/);assert.equal(h.render().cartProducts[0].quantity,2);assert.equal(h.render().cartError,'Response lost');assert.equal(h.state.calls,1);
});
test('late snapshots cannot overwrite fresher cross-tab refreshes',async()=>{
 const h=stateHarness();h.render();await h.settle();let old;h.state.load=()=>new Promise(r=>old=r);const slow=h.render().reloadCart();h.state.load=async()=>[{_id:'p',quantity:8}];h.state.version++;h.render();await h.settle();old([{_id:'p',quantity:2}]);await slow;assert.equal(h.render().cartProducts[0].quantity,8);
});
test('switching accounts hides old cart and ignores the previous account response',async()=>{
 const h=stateHarness();h.render();await h.settle();let old;h.state.load=()=>new Promise(r=>old=r);const slow=h.render().reloadCart();h.state.session='b';h.state.load=async()=>[];assert.equal(h.render().cartProducts.length,0);await h.settle();old([{_id:'p',quantity:7}]);await slow;assert.equal(h.render().cartProducts.length,0);
});

test('background synchronization cannot erase a failed mutation message before customer review',async()=>{
 const h=stateHarness();h.render();await h.settle();h.state.mutate=async()=>{throw Error('Quantity changed elsewhere');};await assert.rejects(h.render().mutateCart('p',{type:'set',quantity:7,expectedQuantity:1}));h.state.version++;h.render();await h.settle();assert.equal(h.render().cartError,'Quantity changed elsewhere');await h.render().reloadCart();assert.equal(h.render().cartError,'');
});

test('cart controls stay safely unloaded while Clerk session is unresolved',()=>{
 const h=stateHarness();h.state.session=undefined;const state=h.render();assert.equal(state.cartReady,false);assert.equal(state.cartProducts.length,0);assert.equal(state.cartError,'');
});
