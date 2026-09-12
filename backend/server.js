const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;
const SHIPPING_FEE = 20000;

function readDB(){
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return {stories:[],users:[],products:[],orders:[]}; }
}
function writeDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function send(res, status, data, type='application/json'){
  res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*'});
  res.end(type==='application/json' ? JSON.stringify(data) : data);
  return true;
}
function body(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data', c=>{ raw+=c; if(raw.length>1e6) req.destroy(); });
    req.on('end',()=>{ try{ resolve(raw?JSON.parse(raw):{}); }catch(e){reject(e);} });
    req.on('error',reject);
  });
}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){
  return {salt,hash:crypto.scryptSync(password,salt,64).toString('hex')};
}
function verifyPassword(password,user){
  if(!user.passwordHash||!user.passwordSalt)return false;
  const hash=crypto.scryptSync(password,user.passwordSalt,64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(user.passwordHash,'hex'));
}
function publicUser(u){ return {id:u.id,name:u.name,email:u.email,createdAt:u.createdAt}; }
const sessions=new Map();
function authUser(req,db){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const uid=sessions.get(token);
  return uid ? db.users.find(u=>u.id===uid)||null : null;
}
function cleanStory(input, existing={}){
  const allowed=['name','city','coffee','method','rating','text'];
  const out={...existing};
  for(const k of allowed) if(input[k]!==undefined) out[k]=input[k];
  out.name=String(out.name||'').trim().slice(0,40);
  out.city=String(out.city||'').trim().slice(0,40);
  out.coffee=String(out.coffee||'').trim().slice(0,80);
  out.method=String(out.method||'').trim().slice(0,40);
  out.rating=Math.min(5,Math.max(1,Number(out.rating)||5));
  out.text=String(out.text||'').trim().slice(0,420);
  if(!out.name||!out.city||!out.coffee||!out.method||!out.text) throw new Error('Missing required story fields');
  return out;
}
function cleanCustomer(input){
  const c={
    name:String(input.name||'').trim().slice(0,60),
    email:String(input.email||'').trim().toLowerCase().slice(0,120),
    phone:String(input.phone||'').trim().slice(0,30),
    address:String(input.address||'').trim().slice(0,240),
    city:String(input.city||'').trim().slice(0,60),
    province:String(input.province||'').trim().slice(0,60),
    postalCode:String(input.postalCode||'').trim().slice(0,12)
  };
  if(!c.name||!c.email||!c.phone||!c.address||!c.city||!c.province||!c.postalCode) throw new Error('Complete all customer and shipping fields');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new Error('Enter a valid email address');
  return c;
}
function normalizeItems(input,db){
  if(!Array.isArray(input)||!input.length) throw new Error('Cart is empty');
  const merged=new Map();
  for(const raw of input){
    const productId=String(raw.productId||'').trim();
    const qty=Math.floor(Number(raw.qty));
    if(!productId||!Number.isInteger(qty)||qty<1||qty>99) throw new Error('Invalid cart item');
    merged.set(productId,(merged.get(productId)||0)+qty);
  }
  const items=[];
  for(const [productId,qty] of merged){
    const p=db.products.find(x=>String(x.id)===productId);
    if(!p) throw new Error('A product in your cart is no longer available');
    if(p.type==='Seasonal') throw new Error(`${p.name} is café exclusive and cannot be ordered online`);
    if(Number(p.stock)<qty) throw new Error(`${p.name} only has ${p.stock} item(s) left`);
    items.push({productId:p.id,name:p.name,region:p.region,price:Number(p.price),qty,lineTotal:Number(p.price)*qty});
  }
  return items;
}
async function api(req,res,url){
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
    return res.end();
  }
  if(!url.pathname.startsWith('/api/')) return false;
  const db=readDB(); db.stories ||= []; db.users ||= []; db.products ||= []; db.orders ||= [];
  try{
    // AUTH
    if(url.pathname==='/api/auth/register' && req.method==='POST'){
      const input=await body(req); const name=String(input.name||'').trim(); const email=String(input.email||'').trim().toLowerCase(); const password=String(input.password||'');
      if(name.length<2||!email.includes('@')||password.length<6) return send(res,400,{error:'Name, valid email and password (min 6 characters) are required'});
      if(db.users.some(u=>u.email===email)) return send(res,409,{error:'Email is already registered'});
      const hp=hashPassword(password); const user={id:crypto.randomUUID(),name,email,passwordHash:hp.hash,passwordSalt:hp.salt,createdAt:new Date().toISOString()};
      db.users.push(user); writeDB(db); const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,user.id);
      return send(res,201,{token,user:publicUser(user)});
    }
    if(url.pathname==='/api/auth/login' && req.method==='POST'){
      const input=await body(req); const email=String(input.email||'').trim().toLowerCase(); const password=String(input.password||''); const user=db.users.find(u=>u.email===email);
      if(!user||!verifyPassword(password,user)) return send(res,401,{error:'Email or password is incorrect'});
      const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,user.id); return send(res,200,{token,user:publicUser(user)});
    }
    if(url.pathname==='/api/auth/me' && req.method==='GET'){
      const user=authUser(req,db); return user?send(res,200,{user:publicUser(user)}):send(res,401,{error:'Not authenticated'});
    }
    if(url.pathname==='/api/auth/logout' && req.method==='POST'){
      const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,''); sessions.delete(token); return send(res,200,{ok:true});
    }

    // PRODUCTS
    if(url.pathname==='/api/products' && req.method==='GET'){
      let products=db.products.filter(Boolean);
      const region=url.searchParams.get('region'); const process=url.searchParams.get('process'); const type=url.searchParams.get('type'); const q=url.searchParams.get('q');
      if(region) products=products.filter(p=>p.region===region);
      if(process) products=products.filter(p=>p.process===process);
      if(type) products=products.filter(p=>p.type===type);
      if(q){const l=q.toLowerCase();products=products.filter(p=>`${p.name} ${p.region} ${p.process} ${p.notes}`.toLowerCase().includes(l));}
      return send(res,200,products);
    }
    if(url.pathname.startsWith('/api/products/') && req.method==='GET'){
      const id=url.pathname.split('/').filter(Boolean)[2]; const p=db.products.find(x=>String(x.id)===id);
      return p?send(res,200,p):send(res,404,{error:'Product not found'});
    }

    // STORIES
    if(url.pathname.startsWith('/api/stories')){
      const parts=url.pathname.split('/').filter(Boolean); const id=parts[2];
      if(req.method==='GET'&&!id) return send(res,200,db.stories.filter(s=>s.status!=='unsent'));
      if(req.method==='GET'&&id){const s=db.stories.find(x=>x.id===id&&x.status!=='unsent');return s?send(res,200,s):send(res,404,{error:'Story not found'});}
      if(req.method==='POST'&&!id){
        const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required to publish a story'});
        const story=cleanStory(await body(req)); const now=new Date().toISOString();
        story.id=crypto.randomUUID(); story.authorId=user.id; story.status='published'; story.createdAt=now; story.updatedAt=now; story.name=user.name;
        db.stories.unshift(story); writeDB(db); return send(res,201,story);
      }
      if(req.method==='PUT'&&id){
        const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required'});
        const idx=db.stories.findIndex(x=>x.id===id&&x.status!=='unsent'); if(idx<0)return send(res,404,{error:'Story not found'});
        if(db.stories[idx].authorId!==user.id)return send(res,403,{error:'You can only edit your own story'});
        const updated=cleanStory(await body(req),db.stories[idx]); updated.id=id; updated.authorId=user.id; updated.status='published'; updated.updatedAt=new Date().toISOString(); updated.name=user.name;
        db.stories[idx]=updated; writeDB(db); return send(res,200,updated);
      }
      if(req.method==='DELETE'&&id){
        const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required'});
        const idx=db.stories.findIndex(x=>x.id===id&&x.status!=='unsent'); if(idx<0)return send(res,404,{error:'Story not found'});
        if(db.stories[idx].authorId!==user.id)return send(res,403,{error:'You can only unsend your own story'});
        db.stories[idx].status='unsent'; db.stories[idx].unsentAt=new Date().toISOString(); writeDB(db); return send(res,200,{ok:true,id,status:'unsent'});
      }
      return send(res,405,{error:'Method not allowed'});
    }

    // ORDERS
    if(url.pathname==='/api/orders' && req.method==='POST'){
      const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required to place an order'});
      const input=await body(req); const customer=cleanCustomer(input.customer||{}); const items=normalizeItems(input.items,db);
      const subtotal=items.reduce((sum,x)=>sum+x.lineTotal,0); const shipping=Number.isFinite(Number(input.shippingFee))&&Number(input.shippingFee)>=0?Number(input.shippingFee):SHIPPING_FEE;
      if(shipping!==SHIPPING_FEE) return send(res,400,{error:'Unsupported shipping option'});
      const total=subtotal+shipping; const now=new Date().toISOString();
      // Re-check and decrement stock in the same write cycle.
      for(const item of items){const p=db.products.find(x=>x.id===item.productId);if(!p||p.stock<item.qty)return send(res,409,{error:`Stock changed for ${item.name}. Please review your cart.`});}
      for(const item of items){const p=db.products.find(x=>x.id===item.productId);p.stock-=item.qty;}
      const order={id:`KN-${now.slice(0,10).replace(/-/g,'')}-${String(db.orders.length+1).padStart(4,'0')}`,userId:user.id,customer,items,subtotal,shipping,total,status:'ORDER PLACED',createdAt:now,updatedAt:now};
      db.orders.unshift(order); writeDB(db); return send(res,201,order);
    }
    if(url.pathname==='/api/orders' && req.method==='GET'){
      const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required'});
      return send(res,200,db.orders.filter(o=>o.userId===user.id));
    }
    if(url.pathname.startsWith('/api/orders/') && req.method==='GET'){
      const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required'});
      const id=url.pathname.split('/').filter(Boolean)[2]; const order=db.orders.find(o=>o.id===id&&o.userId===user.id);
      return order?send(res,200,order):send(res,404,{error:'Order not found'});
    }

    if(url.pathname==='/api/health') return send(res,200,{ok:true,service:'kenangan-v13',time:new Date().toISOString()});
    return false;
  }catch(e){ return send(res,400,{error:e.message||'Bad request'}); }
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'); if(await api(req,res,url)) return;
  let filePath=path.normalize(path.join(ROOT,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)));
  if(!filePath.startsWith(ROOT)) return send(res,403,{error:'Forbidden'});
  fs.stat(filePath,(err,stat)=>{if(err||!stat.isFile())return send(res,404,{error:'Not found'});const ext=path.extname(filePath).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});fs.createReadStream(filePath).pipe(res);});
});
server.listen(PORT,()=>console.log(`KENANGAN V13 backend running at http://localhost:${PORT}`));
