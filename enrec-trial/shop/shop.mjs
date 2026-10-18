const API='https://jummai-automatic-fixture.jummai-mugen.workers.dev',STORE='enrec-hp-shop-v1';
const COOKIE='__Secure-enrec_hp_shop',PATH='/enrec-trial/shop/';
const clearGrant=()=>{try{sessionStorage.removeItem(STORE);}catch{}document.cookie=`${COOKIE}=; Path=${PATH}; Secure; SameSite=Strict; Max-Age=0`;};
const $=id=>document.getElementById(id);
const products=[{id:'rob6',name:'ロブ6'},{id:'rob6-one',name:'ロブ6＋ワン'},{id:'rob6-p2',name:'ロブ6 PⅡ'}];
let grant='',basket=[],state=null,stage='products',busy=false,saved=false;
const incoming=new URLSearchParams(location.hash.slice(1)).get('grant');
if(incoming){history.replaceState(null,'',location.pathname);try{sessionStorage.setItem(STORE,incoming);}catch{}document.cookie=`${COOKIE}=${encodeURIComponent(incoming)}; Path=${PATH}; Secure; SameSite=Strict`;}
let sessionCookie='';try{sessionCookie=decodeURIComponent(document.cookie.split('; ').find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'');}catch{}
try{grant=incoming||sessionStorage.getItem(STORE)||sessionCookie;}catch{grant=incoming||sessionCookie;}
if(grant){try{sessionStorage.setItem(STORE,grant);}catch{}}
const msg=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
const operation=()=> 'fixture-'+crypto.randomUUID();
async function call(action,data,keepalive=false){
  const r=await fetch(API+'/api/shop/'+action,{method:data?'POST':'GET',credentials:'omit',keepalive,headers:{'X-Shop-Token':grant,...(data?{'Content-Type':'application/json','X-Operation-ID':operation()}: {})},...(data?{body:JSON.stringify(data)}:{})});
  const value=await r.json();if(!r.ok){if(value.error==='invalid_shop_request'){clearGrant();grant='';}throw Error(value.error==='fixture_capacity'?'試用枠がいっぱいです。データを消さず、管理者へお知らせください。':'接続・操作を確認できませんでした。繰り返し開始せず、画面を読み込み直してください。');}return value;
}
function show(next){stage=next;for(const id of ['products','cart','inbox','finished'])$(id).hidden=id!==next;for(const [id,page] of [['show-shop','products'],['show-cart','cart'],['show-inbox','inbox']])$(id).setAttribute('aria-current',String(next===page));}
function render(){
  $('count').textContent=basket.reduce((s,v)=>s+v.quantity,0);$('unread').textContent=state?.notices.length||0;
  $('cart-items').replaceChildren();for(const v of basket)$('cart-items').append(el('p',`${products.find(p=>p.id===v.id).name} × ${v.quantity}本`));
  $('total').textContent=basket.length?`試用の合計 ${(basket.reduce((s,v)=>s+v.quantity,0)*5500).toLocaleString()}円（税込）／請求なし`:'カートは空です。商品を選んでください。';
  const locked=!!state?.cart?.abandonedAt||state?.status==='purchased';
  document.querySelectorAll('[data-add]').forEach(b=>b.disabled=!grant||locked||busy||Number($('count').textContent)>=4);
  $('leave').disabled=!grant||!basket.length||locked||busy;$('purchase').disabled=!grant||!basket.length||state?.status==='purchased'||busy;
  $('consent-label').hidden=locked;
  $('notices').replaceChildren();
  if(!state?.notices.length)$('notices').append(el('p',state?.cart?.abandonedAt?'まだ案内は届いていません。自動で更新します。':'商品を選び、カートから「購入せず、お店へ戻る」を押してください。'));
  for(const n of state?.notices||[]){const box=el('article','');box.className='notice';box.append(el('h3','カートに商品が残っています（試用）'),el('p',basket.map(v=>products.find(p=>p.id===v.id).name+' × '+v.quantity).join('、')),el('p',new Date(n.recorded_at).toLocaleTimeString('ja-JP')+' に自動記録'));
    const b=el('button',state.status==='purchased'?'購入済みの内容を見る':'カートに戻って購入を試す');b.onclick=()=>show('cart');box.append(b);$('notices').append(box);}
  renderJobs();
}
function renderJobs(){
  $('jobs').replaceChildren();
  const stopped={purchase:'停止（購入済み）',expired:'停止（期限を過ぎたため）',interrupted:'停止（処理の中断・確認が必要）',revoke:'停止（案内の同意なし）',verification_unknown:'停止（購入状況を確認できません）'};
  for(const j of state?.jobs||[]){const left=Math.max(0,Math.ceil((j.due_at-Date.now())/1000));$('jobs').append(el('p',`${j.step}回目：${j.state==='stopped'?(stopped[j.reason]||'停止（状態を確認してください）'):j.state==='simulated'?'案内を記録済み':j.state==='pending'?(left?'あと '+left+'秒':'処理結果を確認中'):j.state==='checking'?'処理中':j.state==='unknown'?'結果不明（確認が必要）':j.state}`));}
}
for(const p of products){const box=el('article','');box.className='product';const img=document.createElement('img');img.src='/rob6-assets/bottle-hero-v2.png';img.alt=p.name+'のシリーズイメージ';box.append(img,el('h3',p.name),el('p','1本 5,500円（税込・試用）'));
 const b=el('button','カートに入れる');b.dataset.add=p.id;b.onclick=()=>{const item=basket.find(v=>v.id===p.id);if(item)item.quantity++;else basket.push({id:p.id,quantity:1});saved=false;render();msg(p.name+'をカートに入れました。「カートを見る」へお進みください。');};box.append(b);$('catalog').append(box);}
$('show-shop').onclick=()=>show('products');$('show-cart').onclick=async()=>{if(!grant||!basket.length){show('cart');return;}busy=true;render();try{await saveCart();show('cart');msg('カートを保存しました。購入せず離れるか、試用購入をお試しください。');}catch(e){msg(e.message,true);}finally{busy=false;render();}};$('show-inbox').onclick=()=>{render();show('inbox');};$('see-result').onclick=()=>{render();show('inbox');};
async function saveCart(){if(!saved){state=await call('cart',{items:basket});saved=true;}}
async function mutate(action){if(busy)return;if(action==='abandon'&&!$('consent').checked){msg('「買い忘れ案内の試験を確認します」にチェックしてください。',true);return;}
 busy=true;render();try{await saveCart();state=await call(action,{});render();if(action==='abandon'){show('products');msg('離脱を保存しました。2分後に「試用の受信箱」へ案内が届きます。画面を閉じても予約は残ります。');}else{show('finished');msg('試用購入を完了しました。残りの案内を停止しました。');}}
 catch(e){msg(e.message,true);}finally{busy=false;render();}}
$('leave').onclick=()=>mutate('abandon');$('purchase').onclick=()=>mutate('purchase');
// The confirmed leave button is the reliable path. Abrupt termination before
// server acceptance is deliberately not described as guaranteed detection.
addEventListener('pagehide',()=>{if(stage==='cart'&&saved&&$('consent').checked&&!state?.cart?.abandonedAt&&state?.status!=='purchased')call('abandon',{},true).catch(()=>{});});
async function refresh(){if(!grant||busy)return;try{state=await call('view');if(state.cart&&saved)basket=state.cart.items;render();}catch(e){msg(e.message,true);}}
if(grant){try{state=await call('view');if(state.cart){basket=state.cart.items;saved=true;}msg(state?.cart?.abandonedAt?'前回の試用を表示しています。「試用の受信箱」で案内を確認できます。':'商品を選び、「カートを見る」へお進みください。');}catch(e){grant='';msg('試用リンクの期限または接続をご確認ください。下の「試用を開始する」から始められます。',true);}}
else msg('最初に「試用を開始する」を押してください。');
$('access').hidden=!!grant;render();setInterval(refresh,4000);setInterval(()=>{if(state)renderJobs();},1000);
