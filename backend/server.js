const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;

function readDB(){
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return {stories:[],users:[]}; }
}
function writeDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function send(res, status, data, type='application/json'){
  res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*'});
  res.end(type==='application/json' ? JSON.stringify(data) : data);
  return true;
}
function body(req){
  return new Promise((resolve,reject)=>{
    let raw=''; req.on('data', c=>{ raw+=c; if(raw.length>1e6) req.destroy(); });
    req.on('end',()=>{ try{ resolve(raw?JSON.parse(raw):{}); }catch(e){reject(e);} });
    req.on('error',reject);
  });
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
  if(!out.name || !out.city || !out.coffee || !out.method || !out.text) throw new Error('Missing required story fields');
  return out;
}
const sessions=new Map();
function cleanUser(input, existing={}){
  const out={...existing};
  out.name=String(input.name ?? out.name ?? '').trim().slice(0,40);
  out.email=String(input.email ?? out.email ?? '').trim().toLowerCase().slice(0,120);
  if(input.password!==undefined) out.password=String(input.password).slice(0,200);
  if(!out.name || !out.email || !out.password) throw new Error('Missing required account fields');
  return out;
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
function authUser(req,db){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const uid=sessions.get(token); if(!uid)return null;
  return db.users?.find(u=>u.id===uid)||null;
}
function cleanStory(input, existing={}){
  const allowed=['name','city','coffee','method','rating','text','authorId'];
  const out={...existing};
  for(const k of allowed) if(input[k]!==undefined) out[k]=input[k];
  out.name=String(out.name||'').trim().slice(0,40); out.city=String(out.city||'').trim().slice(0,40);
  out.coffee=String(out.coffee||'').trim().slice(0,80); out.method=String(out.method||'').trim().slice(0,40);
  out.rating=Math.min(5,Math.max(1,Number(out.rating)||5)); out.text=String(out.text||'').trim().slice(0,420);
  if(!out.name||!out.city||!out.coffee||!out.method||!out.text)throw new Error('Missing required story fields');
  return out;
}
async function api(req,res,url){
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});return res.end();}
  if(!url.pathname.startsWith('/api/'))return false;
  const db=readDB(); db.stories ||= []; db.users ||= [];
  try{
    // AUTH
    if(url.pathname==='/api/auth/register' && req.method==='POST'){
      const input=await body(req); const name=String(input.name||'').trim(); const email=String(input.email||'').trim().toLowerCase(); const password=String(input.password||'');
      if(name.length<2||!email.includes('@')||password.length<6) return send(res,400,{error:'Name, valid email and password (min 6 characters) are required'});
      if(db.users.some(u=>u.email===email))return send(res,409,{error:'Email is already registered'});
      const hp=hashPassword(password); const user={id:crypto.randomUUID(),name,email,passwordHash:hp.hash,passwordSalt:hp.salt,createdAt:new Date().toISOString()}; db.users.push(user); writeDB(db);
      const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,user.id); return send(res,201,{token,user:publicUser(user)});
    }
    if(url.pathname==='/api/auth/login' && req.method==='POST'){
      const input=await body(req); const email=String(input.email||'').trim().toLowerCase(); const password=String(input.password||''); const user=db.users.find(u=>u.email===email);
      if(!user||!verifyPassword(password,user))return send(res,401,{error:'Email or password is incorrect'});
      const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,user.id); return send(res,200,{token,user:publicUser(user)});
    }
    if(url.pathname==='/api/auth/me' && req.method==='GET'){
      const user=authUser(req,db); return user?send(res,200,{user:publicUser(user)}):send(res,401,{error:'Not authenticated'});
    }
    if(url.pathname==='/api/auth/logout' && req.method==='POST'){
      const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,''); sessions.delete(token); return send(res,200,{ok:true});
    }
    // STORIES
    if(url.pathname.startsWith('/api/stories')){
      const parts=url.pathname.split('/').filter(Boolean); const id=parts[2];
      if(req.method==='GET'&&!id)return send(res,200,db.stories.filter(s=>s.status!=='unsent'));
      if(req.method==='GET'&&id){const s=db.stories.find(x=>x.id===id&&x.status!=='unsent');return s?send(res,200,s):send(res,404,{error:'Story not found'});}
      if(req.method==='POST'&&!id){
        const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required to publish a story'});
        const input=await body(req); const story=cleanStory(input); const now=new Date().toISOString(); story.id=crypto.randomUUID(); story.authorId=user.id; story.status='published'; story.createdAt=now; story.updatedAt=now; story.name=user.name;
        db.stories.unshift(story); writeDB(db); return send(res,201,story);
      }
      if(req.method==='PUT'&&id){
        const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required'});
        const idx=db.stories.findIndex(x=>x.id===id&&x.status!=='unsent'); if(idx<0)return send(res,404,{error:'Story not found'});
        if(db.stories[idx].authorId!==user.id)return send(res,403,{error:'You can only edit your own story'});
        const input=await body(req); const updated=cleanStory(input,db.stories[idx]); updated.id=id; updated.authorId=user.id; updated.status='published'; updated.updatedAt=new Date().toISOString(); updated.name=user.name; db.stories[idx]=updated; writeDB(db); return send(res,200,updated);
      }
      if(req.method==='DELETE'&&id){
        const user=authUser(req,db); if(!user)return send(res,401,{error:'Login required'});
        const idx=db.stories.findIndex(x=>x.id===id&&x.status!=='unsent'); if(idx<0)return send(res,404,{error:'Story not found'});
        if(db.stories[idx].authorId!==user.id)return send(res,403,{error:'You can only unsend your own story'});
        db.stories[idx].status='unsent'; db.stories[idx].unsentAt=new Date().toISOString(); writeDB(db); return send(res,200,{ok:true,id,status:'unsent'});
      }
      return send(res,405,{error:'Method not allowed'});
    }
    if(url.pathname==='/api/health')return send(res,200,{ok:true,service:'kenangan-v12',time:new Date().toISOString()});
    return false;
  }catch(e){return send(res,400,{error:e.message||'Bad request'});}
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(await api(req,res,url)) return;
  if(url.pathname==='/api/health') return send(res,200,{ok:true,service:'kenangan-stories',time:new Date().toISOString()});
  let filePath=path.normalize(path.join(ROOT, decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)));
  if(!filePath.startsWith(ROOT)) return send(res,403,{error:'Forbidden'});
  fs.stat(filePath,(err,stat)=>{
    if(err || !stat.isFile()) return send(res,404,{error:'Not found'});
    const ext=path.extname(filePath).toLowerCase(); res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'}); fs.createReadStream(filePath).pipe(res);
  });
});
server.listen(PORT,()=>console.log(`KENANGAN backend running at http://localhost:${PORT}`));
