const REGION_ART={
"Sumatera":"assets/photos/origins/v54-sumatera.jpg","Jawa Barat":"assets/photos/origins/v54-jawa-barat.jpg","Jawa Tengah":"assets/photos/origins/v52-jawa-tengah.jpg","Jawa Timur":"assets/photos/origins/v54-jawa-timur.jpg","Indonesia Timur":"assets/photos/origins/v54-indonesia-timur.jpg"
};
const REGION_TEXT={
"Sumatera":"Bold, earthy, chocolate-led expressions.","Jawa Barat":"Fruity, grape, berry and winey character.","Jawa Tengah":"Sweet, smooth and comforting cups.","Jawa Timur":"Sweet, chocolate and caramel-driven profile.","Indonesia Timur":"Bold body with pronounced acidity."
};
let cart=JSON.parse(localStorage.getItem("kenangan_cart")||"[]");
let activeRegion="All";

const SEEDED_STORIES=[
 {id:"seed-1",name:"RAKA",city:"JAKARTA",coffee:"Pangalengan",method:"V60",rating:5,text:"The fruit character from West Java completely changed how I think about Indonesian coffee."},
 {id:"seed-2",name:"NADIA",city:"BANDUNG",coffee:"Kerinci Mossto",method:"Pour Over",rating:5,text:"Seasonal coffee gave me a reason to come back to the café and try something new."},
 {id:"seed-3",name:"ARYA",city:"BALI",coffee:"Bajawa",method:"French Press",rating:5,text:"Different beans. Different landscapes. Different memories. Bajawa felt warm, floral and deeply comforting."}
];
let communityStories=JSON.parse(localStorage.getItem("kenangan_stories")||"[]");
let deletedStories=JSON.parse(localStorage.getItem("kenangan_deleted_stories")||"[]");
let editedSeedStories=JSON.parse(localStorage.getItem("kenangan_edited_stories")||"{}");

// V11 Stories data layer: use the real local Node API when available,
// while keeping localStorage as a graceful fallback for the Vercel/static demo.
const STORIES_API="/api/stories";
let apiStories=null;
let storyApiAvailable=false;
let currentUser=JSON.parse(localStorage.getItem("kenangan_user")||"null");
let authToken=localStorage.getItem("kenangan_auth_token")||"";
const AUTH_API="/api/auth";


function normalizeLocalStories(){
 let changed=false;
 communityStories=communityStories.map((s,i)=>{
   if(!s.id){changed=true;return {...s,id:`legacy-${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}`};}
   return s;
 });
 if(changed)localStorage.setItem("kenangan_stories",JSON.stringify(communityStories));
}
normalizeLocalStories();

function getAllStories(){
 if(Array.isArray(apiStories)) return apiStories.filter(s=>s.status!=="unsent");
 const seeded=SEEDED_STORIES
  .filter(s=>!deletedStories.includes(s.id))
  .map(s=>editedSeedStories[s.id]?{...s,...editedSeedStories[s.id],id:s.id}:s);
 return [...communityStories,...seeded];
}
function storyIsLocal(id){return communityStories.some(s=>String(s.id)===String(id));}
function canManageStory(s){return !!currentUser && !!s.authorId && String(s.authorId)===String(currentUser.id);}
function renderStories(){
 const all=getAllStories();
 const grid=document.getElementById("storyGrid"); if(!grid)return;
 document.getElementById("storyCount").textContent=String(all.length).padStart(2,"0")+" STORIES";
 grid.innerHTML=all.map((s,i)=>`
  <article class="story-card ${i<3?'featured':''}">
   <div class="story-top"><span>${String(i+1).padStart(2,"0")}</span><span class="story-stars" aria-label="${Number(s.rating)} out of 5">${"★".repeat(Number(s.rating))}${"☆".repeat(5-Number(s.rating))}</span></div>
   <p>“${esc(s.text)}”</p>
   <div class="story-meta"><b>— ${esc(s.name).toUpperCase()} · ${esc(s.city).toUpperCase()}</b><small>${esc(s.coffee)} · ${esc(s.method)}</small></div>
   <div class="story-controls"><span>${canManageStory(s)?"YOUR STORY":"COMMUNITY STORY"}</span>${canManageStory(s)?`<div class="story-actions"><button type="button" onclick="editStory('${esc(String(s.id))}')">EDIT</button><button type="button" onclick="unsendStory('${esc(String(s.id))}')">UNSEND ×</button></div>`:""}</div>
  </article>`).join("");
}
function findStory(id){return getAllStories().find(s=>String(s.id)===String(id));}
async function authFetch(url,options={}){
 const headers={"Content-Type":"application/json",...(options.headers||{})};
 if(authToken)headers.Authorization=`Bearer ${authToken}`;
 const res=await fetch(url,{...options,headers});
 if(!res.ok)throw new Error(`Auth API ${res.status}`);
 return res.json();
}
function setSession(data){currentUser=data?.user||null;authToken=data?.token||"";if(currentUser)localStorage.setItem("kenangan_user",JSON.stringify(currentUser));else localStorage.removeItem("kenangan_user");if(authToken)localStorage.setItem("kenangan_auth_token",authToken);else localStorage.removeItem("kenangan_auth_token");updateAccountUI();renderStories();}
async function restoreSession(){
 if(!authToken){updateAccountUI();return;}
 try{
  const data=await authFetch(`${AUTH_API}/me`);
  currentUser=data.user;
  localStorage.setItem('kenangan_user',JSON.stringify(currentUser));
 }catch{
  // Vercel/static mode: keep the browser session instead of wiping it when /api is unavailable.
  currentUser=JSON.parse(localStorage.getItem('kenangan_user')||'null');
 }
 updateAccountUI();renderStories();
}
async function hashText(text){
 if(window.crypto?.subtle){
  const bytes=new TextEncoder().encode(text); const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 return btoa(unescape(encodeURIComponent(text)));
}
function localAccounts(){return JSON.parse(localStorage.getItem('kenangan_accounts')||'[]');}
function saveLocalAccounts(list){localStorage.setItem('kenangan_accounts',JSON.stringify(list));}
function localToken(){return `local-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;}
async function localRegister(payload){
 const accounts=localAccounts(); const email=payload.email.toLowerCase();
 if(accounts.some(a=>a.email===email))throw new Error('LOCAL_409');
 const user={id:`local-${Date.now()}`,name:payload.name,email,createdAt:new Date().toISOString()};
 accounts.push({...user,passwordHash:await hashText(payload.password)}); saveLocalAccounts(accounts);
 return {token:localToken(),user};
}
async function localLogin(payload){
 const accounts=localAccounts(); const email=payload.email.toLowerCase(); const hash=await hashText(payload.password);
 const account=accounts.find(a=>a.email===email && a.passwordHash===hash);
 if(!account)throw new Error('LOCAL_401');
 const {passwordHash,...user}=account; return {token:localToken(),user};
}
function updateAccountUI(){const button=document.querySelector('.actions button[onclick="openAccount()"]');if(button)button.innerHTML=currentUser?'◉':'◯';}
function openAccount(){document.getElementById("accountModal").classList.add("open");renderAccount();}
function closeAccount(){document.getElementById("accountModal").classList.remove("open");}
function renderAccount(){document.querySelector('#accountModal .account-box')?.classList.remove('orders-account-box');const el=document.getElementById("accountContent");if(!el)return;if(currentUser){el.innerHTML=`<span class="eyebrow">YOUR KENANGAN</span><h2>Welcome back, ${esc(currentUser.name)}.</h2><p class="form-intro">Your account connects your stories to your Kenangan identity.</p><div class="account-panel"><div><span>NAME</span><b>${esc(currentUser.name)}</b></div><div><span>EMAIL</span><b>${esc(currentUser.email)}</b></div><div><span>STATUS</span><b>ACCOUNT ACTIVE</b></div></div><div class="account-actions"><button class="btn" onclick="location.hash='stories';closeAccount()">MY STORIES →</button><button class="btn secondary-btn" onclick="showMyOrders()">MY ORDERS →</button><button class="text-link" onclick="logoutAccount()">LOG OUT</button></div>`;}else{el.innerHTML=`<span class="eyebrow">YOUR KENANGAN</span><h2>Join the coffee journey.</h2><p class="form-intro">Create an account to publish, edit, and unsend your own Coffee Stories.</p><div class="auth-switch"><button class="active" id="loginTab" onclick="showAuthForm('login')">LOGIN</button><button id="registerTab" onclick="showAuthForm('register')">CREATE ACCOUNT</button></div><form id="authForm" class="auth-form" onsubmit="submitAuth(event)"></form><div id="authMessage" class="auth-message"></div>`;showAuthForm('login');}}
function showAuthForm(mode){const form=document.getElementById("authForm");if(!form)return;document.getElementById("loginTab")?.classList.toggle("active",mode==='login');document.getElementById("registerTab")?.classList.toggle("active",mode==='register');form.dataset.mode=mode;form.innerHTML=mode==='login'?`<label>EMAIL<input id="authEmail" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>PASSWORD<input id="authPassword" type="password" required minlength="6" autocomplete="current-password" placeholder="••••••••"></label><button class="btn full" type="submit">LOGIN →</button>`:`<label>NAME<input id="authName" required maxlength="40" autocomplete="name" placeholder="Your name"></label><label>EMAIL<input id="authEmail" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>PASSWORD<input id="authPassword" type="password" required minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters"></label><button class="btn full" type="submit">CREATE ACCOUNT →</button>`;}
async function submitAuth(e){
 e.preventDefault();
 const mode=e.currentTarget.dataset.mode;
 const payload={email:document.getElementById('authEmail').value.trim(),password:document.getElementById('authPassword').value};
 if(mode==='register')payload.name=document.getElementById('authName').value.trim();
 const msg=document.getElementById('authMessage'); msg.textContent='';
 try{
  let data;
  try{
   data=await authFetch(`${AUTH_API}/${mode}`,{method:'POST',body:JSON.stringify(payload)});
  }catch(apiErr){
   // Deployed/static mode fallback: accounts live in this browser so the site remains usable on Vercel.
   data=mode==='register'?await localRegister(payload):await localLogin(payload);
   data.local=true;
  }
  setSession(data); closeAccount();
  alert(mode==='register'?'Account created. Welcome to Kenangan!':'Welcome back to Kenangan!');
 }catch(err){
  const m=String(err.message||'');
  msg.textContent=m.includes('LOCAL_409')||m.includes('409')?'Email is already registered.':m.includes('LOCAL_401')||m.includes('401')?'Email or password is incorrect.':'Unable to create the account right now. Please try again.';
 }
}
function showMyOrders(){
 const box=document.querySelector('#accountModal .account-box');
 box?.classList.add('orders-account-box');
 document.getElementById("accountContent").innerHTML=`<div class="orders-head"><div><span class="eyebrow">YOUR KENANGAN</span><h2>My Orders.</h2><p class="form-intro">A complete record of the coffees you have chosen, from order placed to the next cup.</p></div><button class="orders-back" onclick="renderAccount()">← ACCOUNT</button></div><div id="myOrdersContent"></div>`;
 loadMyOrders()
}
async function logoutAccount(){try{if(authToken)await authFetch(`${AUTH_API}/logout`,{method:"POST"});}catch{}setSession(null);renderAccount();}
async function storyFetch(url,options={}){
 const headers={"Content-Type":"application/json",...(options.headers||{})};if(authToken)headers.Authorization=`Bearer ${authToken}`;const res=await fetch(url,{...options,headers});
 if(!res.ok)throw new Error(`Story API ${res.status}`);
 return res.json();
}
async function loadStories(){
 try{
   const remote=await storyFetch(STORIES_API);
   storyApiAvailable=true;
   apiStories=Array.isArray(remote)?remote:[];
   // One-time migration: move older local user stories into the backend.
   const remoteIds=new Set(apiStories.map(s=>String(s.id)));
   for(const localStory of communityStories){
     if(!remoteIds.has(String(localStory.id))){
       try{
         const created=await storyFetch(STORIES_API,{method:"POST",body:JSON.stringify(localStory)});
         apiStories.unshift(created); remoteIds.add(String(created.id));
       }catch{}
     }
   }
   renderStories();
 }catch{
   storyApiAvailable=false; apiStories=null; renderStories();
 }
}
async function unsendStory(id){
 const story=findStory(id);if(!story||!canManageStory(story)){alert("You can only unsend your own story.");return;} if(!story)return;
 const ok=confirm(`Unsend “${story.text.slice(0,55)}${story.text.length>55?'…':''}”? This story will be removed from Coffee Stories.`);
 if(!ok)return;
 try{
   if(storyApiAvailable){
     await storyFetch(`${STORIES_API}/${encodeURIComponent(id)}`,{method:"DELETE"});
     apiStories=apiStories.filter(s=>String(s.id)!==String(id));
   }else if(storyIsLocal(id)){
     communityStories=communityStories.filter(s=>String(s.id)!==String(id));
     localStorage.setItem("kenangan_stories",JSON.stringify(communityStories));
   }else if(String(id).startsWith("seed-")){
     if(!deletedStories.includes(id))deletedStories.push(id);
     localStorage.setItem("kenangan_deleted_stories",JSON.stringify(deletedStories));
   }
   renderStories();
 }catch(e){alert("Story could not be unsent. Please try again.");}
}
function editStory(id){
 const story=findStory(id);if(!story||!canManageStory(story)){alert("You can only edit your own story.");return;} if(!story)return;
 const select=document.getElementById("editStoryCoffee");
 select.innerHTML=PRODUCTS.map(p=>`<option value="${esc(p.name)}">${esc(p.name)} — ${esc(p.region)}</option>`).join("");
 document.getElementById("editStoryId").value=id;
 document.getElementById("editStoryName").value=story.name;
 document.getElementById("editStoryCity").value=story.city;
 document.getElementById("editStoryCoffee").value=story.coffee;
 document.getElementById("editStoryMethod").value=story.method;
 document.getElementById("editStoryRating").value=String(story.rating);
 document.getElementById("editStoryText").value=story.text;
 document.getElementById("editStoryModal").classList.add("open");
}
function closeEditStory(){document.getElementById("editStoryModal").classList.remove("open");}
async function saveEditedStory(e){
 e.preventDefault();
 const id=document.getElementById("editStoryId").value;
 const updated={name:document.getElementById("editStoryName").value.trim(),city:document.getElementById("editStoryCity").value.trim(),coffee:document.getElementById("editStoryCoffee").value,method:document.getElementById("editStoryMethod").value,rating:Number(document.getElementById("editStoryRating").value),text:document.getElementById("editStoryText").value.trim(),authorId:currentUser?.id};
 if(!updated.name||!updated.city||!updated.text)return;
 try{
   if(storyApiAvailable){
     const saved=await storyFetch(`${STORIES_API}/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(updated)});
     apiStories=apiStories.map(s=>String(s.id)===String(id)?saved:s);
   }else{
     const idx=communityStories.findIndex(s=>String(s.id)===String(id));
     if(idx>-1){communityStories[idx]={...communityStories[idx],...updated};localStorage.setItem("kenangan_stories",JSON.stringify(communityStories));}
     else if(String(id).startsWith("seed-")){editedSeedStories[id]=updated;localStorage.setItem("kenangan_edited_stories",JSON.stringify(editedSeedStories));}
   }
   closeEditStory();renderStories();
 }catch(e){alert("Story could not be updated. Please try again.");}
}
function openStoryForm(){
 if(!currentUser){openAccount();return;}
 const select=document.getElementById("storyCoffee");
 select.innerHTML=PRODUCTS.map(p=>`<option value="${esc(p.name)}">${esc(p.name)} — ${esc(p.region)}</option>`).join("");
 document.getElementById("storyName").value=currentUser.name;
 document.getElementById("storyModal").classList.add("open");
}
function closeStoryForm(){document.getElementById("storyModal").classList.remove("open");}
async function submitStory(e){
 e.preventDefault();
 const story={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2)),name:document.getElementById("storyName").value.trim(),city:document.getElementById("storyCity").value.trim(),coffee:document.getElementById("storyCoffee").value,method:document.getElementById("storyMethod").value,rating:Number(document.getElementById("storyRating").value),text:document.getElementById("storyText").value.trim(),authorId:currentUser?.id};
 if(!story.name||!story.city||!story.text)return;
 try{
   if(storyApiAvailable){
     const created=await storyFetch(STORIES_API,{method:"POST",body:JSON.stringify(story)});
     apiStories=[created,...apiStories];
   }else{
     story.authorId=currentUser?.id;
     communityStories.unshift(story);
     localStorage.setItem("kenangan_stories",JSON.stringify(communityStories));
   }
   document.getElementById("storyForm").reset();
   closeStoryForm(); renderStories();
   document.getElementById("stories").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){alert("Story could not be published. Please try again.");}
}

const PRODUCT_DESCRIPTIONS = {
 "Aceh Gayo Bourbon":"A refined Gayo cup with the comforting depth of dark chocolate and brown sugar, lifted by a bright citrus finish. Smooth, balanced and quietly elegant, it is an inviting expression of northern Sumatra.",
 "Aceh Gayo Natural":"Lush berry sweetness meets mellow chocolate and raisin-like depth. The natural process gives this Gayo coffee a fruit-forward character that feels rich, rounded and wonderfully expressive.",
 "Aceh Gayo Wine":"A more adventurous Gayo expression, opening with vivid red-fruit character before moving into a winey sweetness and dark-chocolate finish. Rich, layered and made for curious coffee drinkers.",
 "Mandheling":"Deep and unmistakably Indonesian, Mandheling brings herbal tones, dark chocolate richness and a gentle spice character. Full and comforting in the cup, with the earthy depth that makes this classic so distinctive.",
 "Lintong":"A warm, grounded profile where chocolate and brown sugar sweetness meet a subtle earthy character. Smooth and comforting, Lintong is an easy choice for those who enjoy a deeper, more mellow cup.",
 "Kerinci":"Bright tropical fruit meets soft caramel sweetness in this expressive Kerinci lot. Its natural-process character creates a lively yet approachable cup with a sweet finish that keeps you coming back.",
 "Kerinci Mossto":"A limited seasonal expression built for exploration: juicy red grape and crisp apple character unfold over an earthy backbone. Unusual, vibrant and intriguing, this is a cup for those who want to discover something beyond the familiar.",
 "Pangalengan":"A bright West Java classic with sparkling citrus, silky caramel sweetness and delicate floral notes. Clean, elegant and refreshing, Pangalengan captures the lighter, more aromatic side of Indonesian coffee.",
 "Halu Honey":"Sweet berry character meets creamy chocolate in a honey-processed cup with a soft, lingering sweetness. Lively yet smooth, Halu Honey is an approachable choice with plenty of personality.",
 "Papandayan":"Silky caramel sweetness leads into ripe stone-fruit character, rounded by a gentle nutty finish. Honey processing gives Papandayan a polished, sweet and comforting cup with an elegant texture.",
 "Rancabali Anaerob":"An expressive anaerobic profile bursting with berries and red cherries, followed by a distinctive winey character. Juicy, aromatic and memorable, Rancabali is made for drinkers who love adventurous fruit-forward coffees.",
 "Patuha":"Sweet, candy-like notes meet juicy berry character for a playful and vibrant cup. Patuha is naturally expressive and delightfully approachable, with a sweetness that makes every sip feel effortless.",
 "Manglayang":"Fresh fruitiness, ripe grape and crisp green apple create a bright, lively profile. Clean and energetic, Manglayang offers a refreshing take on West Java natural-process coffee.",
 "Kamojang Wine":"Bold jackfruit character meets a winey sweetness with a pleasantly funky edge. Complex and unconventional, Kamojang Wine is an expressive choice for anyone drawn to distinctive, fermentation-driven cups.",
 "Puntang":"Juicy cherry and grape notes unfold into a naturally sweet finish. Bright yet rounded, Puntang delivers a fruit-forward cup that feels elegant without losing its playful character.",
 "Ciwidey":"Crisp apple and ripe peach meet smooth caramel sweetness in a bright, polished cup. Balanced and refreshing, Ciwidey brings together fruit clarity and comforting sweetness beautifully.",
 "Garut":"Rich raisin sweetness leads into ripe stone-fruit character with a subtle whiskey-like impression. Warm, aromatic and intriguing, Garut offers a deeper side of West Java's natural-process coffees.",
 "Palasari Anaerobic":"A café-exclusive seasonal lot from Palasari, Bandung, shaped by anaerobic processing. Bright citrus and orange meet soft peach for a vibrant, aromatic cup that rewards slow discovery.",
 "Manglayang Strong Wine":"A bold seasonal expression with boozy aromatics, wine-like depth and pronounced sweetness. Rich, playful and unapologetically expressive, it is designed for a memorable café experience rather than an everyday cup.",
 "Temanggung":"A deep and comforting profile where tobacco-like character meets chocolate richness and gentle spice. Warm, distinctive and full of personality, Temanggung is made for those who prefer a darker, more grounded cup.",
 "Dieng":"Bright citrus and delicate florals sit over a soft brown-sugar sweetness. Clean and refreshing with a gentle finish, Dieng offers an elegant highland character that is easy to enjoy.",
 "Kaliangkrik Anaerobic":"A seasonal anaerobic expression balancing rich chocolate and almond tones with a vivid passionfruit lift. Sweet, layered and intriguing, this is a limited cup for drinkers who enjoy contrast and complexity.",
 "Damar Kandang":"Chocolate richness is softened by creamy coconut and a touch of vanilla sweetness. Smooth, comforting and naturally rounded, Damar Kandang feels like a warm, familiar cup with an Indonesian character.",
 "Posong Honey":"Ripe stone fruit meets fresh green-fruit brightness in a honey-processed cup with a naturally sweet feel. Light, lively and refreshing, Posong brings a graceful balance of fruit and sweetness.",
 "Bismo":"Sweet sugarcane character meets cocoa depth and soft vanilla. Gentle, rounded and comforting, Bismo is an easy-drinking profile that stays pleasantly sweet from first sip to finish.",
 "Merapi Selo":"An intriguing natural-process cup with whiskey-barrel-like aromatics, nutty depth and a touch of rum-like sweetness. Warm and distinctive, Merapi Selo offers a richer, more contemplative coffee experience.",
 "Ijen":"A balanced East Java classic combining chocolate depth with bright citrus and a subtle herbal edge. Smooth, comforting and distinctly characterful, Ijen is a dependable choice for a refined everyday cup.",
 "Argupuro":"Sweetness takes the lead, followed by generous chocolate richness and smooth caramel. Rounded and comforting, Argupuro is an inviting East Java profile with a naturally satisfying finish.",
 "Ijen CM":"A refined carbonic maceration profile where rich chocolate and smooth caramel meet the elegant lift of bergamot and bright citrus. Layered, aromatic and beautifully expressive, Ijen CM offers a distinctive East Java cup for those who enjoy nuanced and adventurous coffees.",
 "Lawu":"Roasted hazelnut and chocolate richness are lifted by a subtle rum-like character. Warm, smooth and indulgent, Lawu offers a naturally processed cup with a deep, comforting finish.",
 "Kawi Bhutak":"Brown sugar sweetness blends with cocoa and soft vanilla for a smooth, rounded profile. Gentle and comforting, Kawi Bhutak is a beautifully balanced choice for lovers of sweet, chocolate-led coffees.",
 "Bondowoso":"Nutty almond character meets a lively passionfruit lift, grounded by chocolate sweetness. Bright yet rounded, Bondowoso creates an appealing contrast between tropical freshness and familiar cocoa depth.",
 "Ijen Raung":"Dark chocolate and caramel create a rich foundation, finished with a pleasant nutty character. Deep, sweet and comforting, Ijen Raung is an inviting expression of East Java's fuller-bodied style.",
 "Kintamani":"Bright citrus and delicate florals are balanced by soft brown-sugar sweetness. Refreshing, aromatic and clean, Kintamani is a vibrant introduction to Bali's distinctive coffee character.",
 "Bajawa":"Juicy red fruit meets rich chocolate and delicate floral aromatics. Naturally expressive and beautifully balanced, Bajawa offers a lively cup with enough depth to keep every sip interesting.",
 "Manggarai":"Berry brightness meets caramel sweetness and cocoa depth. Rounded and expressive, Manggarai delivers a rich tropical character with a smooth, satisfying finish.",
 "Bajawa Honey":"Tropical fruit and honey-like sweetness melt into a comforting chocolate base. Smooth, fragrant and naturally sweet, Bajawa Honey is an inviting expression of Flores coffee.",
 "Kalimutu":"Crisp citrus brings brightness to a soft cocoa and brown-sugar foundation. Clean, balanced and refreshing, Kalimutu offers a graceful cup with a gentle sweetness.",
 "Toraja Sapan":"Herbal aromatics meet dark chocolate richness and warm spice. Full and distinctive, Toraja Sapan delivers the deeper, more structured character that makes Sulawesi coffees so compelling.",
 "Toraja Pulu-Pulu":"Juicy berry notes meet cocoa richness and a subtle winey character. Naturally expressive and layered, Pulu-Pulu brings a fruit-driven edge to the bold personality of Sulawesi coffee.",
 "Enrekang":"Smooth caramel sweetness is lifted by citrus brightness and rounded with nutty depth. Balanced and approachable, Enrekang offers a lively yet comforting cup with a clean finish.",
 "Jayawijaya":"Chocolate richness sits alongside a bold, earthy character and gentle sweetness. Full-bodied and grounded, Jayawijaya delivers a strong, comforting cup with unmistakable presence.",
 "Papua Wamena Honey":"Floral aromatics and chocolate depth meet a bright citrus lift. Elegant and refreshing, this Wamena expression balances a gentle sweetness with a lively finish.",
 "Papua Baliem":"Tropical fruit leads into smooth caramel sweetness with delicate floral lift. Fragrant, rounded and expressive, Papua Baliem offers a bright yet substantial cup from the highlands of Papua.",
 "Halmahera":"Cocoa richness meets warm spice and subtle nuttiness. Full, grounded and characterful, Halmahera presents a bold Maluku profile with a satisfying, lingering finish."
};
function productDescription(p){return PRODUCT_DESCRIPTIONS[p.name]||`A distinctive Indonesian coffee shaped by ${p.process.toLowerCase()} processing, with ${p.notes.toLowerCase()} unfolding across the cup. Balanced, expressive and selected to showcase the character of its origin.`;}

const rp=n=>"Rp"+n.toLocaleString("id-ID");
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

function renderRegions(){
 const regions=Object.keys(REGION_ART);
 document.getElementById("regions").innerHTML=regions.map((r,i)=>`
 <article class="region-card" data-action="select-region" data-region="${r}" tabindex="0" role="button">
  <img src="${REGION_ART[r]}" alt="${r} coffee region">
  <div class="region-number">0${i+1}</div>
  <div class="region-copy"><span>ORIGIN 0${i+1}</span><h3>${r}</h3><p>${REGION_TEXT[r]}</p><b>EXPLORE ORIGIN →</b></div>
 </article>`).join("");
 document.getElementById("finderRegions").innerHTML=regions.map(r=>`<button onclick="chooseFinderRegion('${r}',this)">${r.toUpperCase()}</button>`).join("");
}
function selectRegion(region){
 const products=PRODUCTS.filter(p=>p.region===region);
 const sample=products.slice(0,4);
 const detail=document.getElementById("regionDetail");
 detail.innerHTML=`<div class="region-detail-copy"><span class="eyebrow">ORIGIN ${String(Object.keys(REGION_ART).indexOf(region)+1).padStart(2,"0")}</span><h3>${region}</h3><p>${REGION_TEXT[region]}</p><div class="region-count">${products.length} COFFEES IN THE COLLECTION</div><button class="btn" onclick="filterRegion('${region}');location.hash='shop'">SHOP ${region.toUpperCase()} →</button></div><div class="region-picks"><span class="eyebrow">SELECTED ORIGINS</span>${sample.map(p=>`<button type="button" class="origin-pick-btn" data-action="open-product" data-product="${esc(p.name)}"><b>${esc(p.name)}</b><small>${esc(p.notes)}</small></button>`).join("")}</div>`;
 detail.classList.add("show");
 detail.scrollIntoView({behavior:"smooth",block:"center"});
}

function renderSeasonal(){
 const list=PRODUCTS.filter(p=>p.type==="Seasonal");
 const el=document.getElementById("seasonalGrid");
 if(!el)return;
 el.innerHTML=list.map((p,i)=>`<article class="seasonal-item">
   <div class="seasonal-item-art"><img src="${productArt(p)}" alt="${esc(p.name)}"><span>DROP 0${i+1}</span></div>
   <div class="seasonal-item-copy"><span class="eyebrow">${esc(p.region).toUpperCase()} · ${esc(p.process).toUpperCase()}</span><h3>${esc(p.name)}</h3><p>${esc(p.notes)}</p><div class="exclusive-line"><b>CAFÉ EXCLUSIVE</b><small>NOT AVAILABLE ONLINE</small></div><button type="button" class="seasonal-discover-btn" data-action="open-product" data-product="${esc(p.name)}">DISCOVER THIS COFFEE →</button></div>
 </article>`).join("");
}
function productArt(p){
 const palettes={"Sumatera":["#24342b","#b08a4a"],"Jawa Barat":["#4a3325","#c89a58"],"Jawa Tengah":["#171512","#b08a4a"],"Jawa Timur":["#5a3b28","#d0a66a"],"Indonesia Timur":["#24342b","#d1aa70"]};
 const [ink,gold]=palettes[p.region]||["#171512","#b08a4a"];
 const title=p.name.toUpperCase();
 const notes=p.notes.toUpperCase().split(" · ");
 const note1=notes[0]||"INDONESIAN COFFEE";
 const note2=notes.slice(1).join(" · ").slice(0,34);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><radialGradient id="g"><stop stop-color="${gold}" stop-opacity=".25"/><stop offset="1" stop-color="${gold}" stop-opacity="0"/></radialGradient><filter id="s"><feGaussianBlur stdDeviation="16"/></filter></defs><rect width="800" height="1000" fill="#e7dfd1"/><circle cx="650" cy="180" r="260" fill="url(#g)"/><ellipse cx="400" cy="845" rx="250" ry="52" fill="#2d241e" opacity=".2" filter="url(#s)"/><g transform="translate(175 115)"><rect x="20" y="18" width="430" height="700" rx="28" fill="#171512" opacity=".22"/><rect width="430" height="700" rx="28" fill="#f7f0e3"/><rect x="24" y="24" width="382" height="652" rx="20" fill="#fbf6ed" stroke="${gold}" stroke-width="2"/><text x="215" y="92" text-anchor="middle" font-family="Georgia" font-size="25" letter-spacing="6" fill="#171512">KENANGAN</text><text x="215" y="120" text-anchor="middle" font-family="Arial" font-size="9" letter-spacing="4" fill="#5a493c">KOPI NUSANTARA</text><circle cx="215" cy="300" r="105" fill="${ink}"/><path d="M215 200 C160 275 170 345 215 405 C260 345 270 275 215 200Z" fill="${gold}"/><path d="M215 222 C192 275 199 335 215 372 C231 335 238 275 215 222Z" fill="#f5f0e7" opacity=".72"/><text x="215" y="485" text-anchor="middle" font-family="Georgia" font-size="20" fill="#171512">${title}</text><text x="215" y="516" text-anchor="middle" font-family="Arial" font-size="9" letter-spacing="3" fill="#5a493c">${p.process.toUpperCase()}</text><line x1="105" y1="552" x2="325" y2="552" stroke="${gold}"/><text x="215" y="584" text-anchor="middle" font-family="Arial" font-size="9" letter-spacing="1.5" fill="#4a3325">${note1}</text><text x="215" y="606" text-anchor="middle" font-family="Arial" font-size="8" letter-spacing="1.3" fill="#4a3325">${note2}</text><text x="215" y="648" text-anchor="middle" font-family="Arial" font-size="8" letter-spacing="3" fill="#8a7867">100 G · ROASTED IN INDONESIA</text></g></svg>`;
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
function renderProducts(){
 const proc=document.getElementById("processFilter").value;
 const list=PRODUCTS.filter(p=>p.type==="Regular"&&(activeRegion==="All"||p.region===activeRegion)&&(proc==="All"||p.process===proc));
 document.getElementById("shopCount").textContent=`${list.length} coffee${list.length!==1?"s":""}`;
 document.getElementById("products").innerHTML=list.map((p,i)=>`
 <article class="product-card">
  <div class="product-art"><img src="${productArt(p)}" alt="${esc(p.name)}"><span class="product-badge">${p.badge||"REGULAR"}</span></div>
  <div class="product-info"><div class="origin-line">${p.region.toUpperCase()} · ${p.process.toUpperCase()}</div><h3>${esc(p.name)}</h3><div class="notes">${esc(p.notes)}</div><div class="card-actions"><span class="price">${rp(p.price)} / 100g</span><button type="button" data-action="open-product" data-product="${esc(p.name)}">VIEW</button><button type="button" data-action="add-cart" data-product="${esc(p.name)}">ADD TO CART</button></div></div>
 </article>`).join("")||`<p>No coffee found for this filter.</p>`;
}
function filterRegion(r){
 activeRegion=r;
 document.querySelectorAll(".filter").forEach(b=>b.classList.toggle("active",b.dataset.region===r));
 renderProducts();
}
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>filterRegion(b.dataset.region)));
document.getElementById("processFilter").addEventListener("change",renderProducts);

function chooseFinderRegion(r,el){
 document.querySelectorAll(".finder-regions button").forEach(b=>b.classList.remove("active"));
 el.classList.add("active");
 const beans=PRODUCTS.filter(p=>p.region===r&&p.type==="Regular");
 document.getElementById("finderProgress").textContent="STEP 02 · CHOOSE YOUR BEAN";
 document.getElementById("finderBeans").innerHTML=beans.map(p=>`<button class="bean-btn" onclick='showFinder(${JSON.stringify(p.name)},this)'><b>${esc(p.name)}</b><small>${esc(p.process)} · ${esc(p.notes)}</small></button>`).join("");
 document.getElementById("finderCharacter").classList.remove("show");
 document.getElementById("finderExperience").classList.remove("show");
 document.getElementById("finderResult").innerHTML='<div class="result-copy"><strong>Choose a bean to discover its natural character.</strong><small>The tasting notes come from the coffee itself — not from a flavor selector.</small></div>';
 document.getElementById("finderBeans").scrollIntoView({behavior:"smooth",block:"center"});
}
function showFinder(name,el){
 const p=PRODUCTS.find(x=>x.name===name); if(!p)return;
 document.querySelectorAll(".bean-btn").forEach(b=>b.classList.remove("active"));
 if(el)el.classList.add("active");
 document.getElementById("finderProgress").textContent="STEP 03 · DISCOVER ITS CHARACTER";
 document.getElementById("finderCharacter").innerHTML=`<div class="character-grid">
   <div class="character-art"><img src="${productArt(p)}" alt="${esc(p.name)}"></div>
   <div class="character-copy"><span class="eyebrow">YOUR SELECTED BEAN</span><h3>${esc(p.name)}</h3><div class="character-notes">${esc(p.notes)}</div><div class="character-meta"><span>ORIGIN · ${esc(p.region).toUpperCase()}</span><span>VARIETY · ${esc(p.variety).toUpperCase()}</span><span>PROCESS · ${esc(p.process).toUpperCase()}</span></div></div>
 </div>`;
 document.getElementById("finderCharacter").classList.add("show");
 document.getElementById("finderExperience").innerHTML=`<div class="experience-title">OPTIONAL · CHOOSE YOUR CAFÉ EXPERIENCE</div><div class="experience-options">
   <button onclick="chooseExperience('POUR OVER',this)">POUR OVER</button>
   <button onclick="chooseExperience('V60',this)">V60</button>
   <button onclick="chooseExperience('ESPRESSO',this)">ESPRESSO</button>
   <button onclick="chooseExperience('FRENCH PRESS',this)">FRENCH PRESS</button>
 </div>`;
 document.getElementById("finderExperience").classList.add("show");
 window.finderSelection={bean:p.name,experience:""};
 updateFinderResult();
 document.getElementById("finderCharacter").scrollIntoView({behavior:"smooth",block:"center"});
}
function chooseExperience(method,el){
 document.querySelectorAll(".experience-options button").forEach(b=>b.classList.remove("active"));
 el.classList.add("active");
 if(!window.finderSelection)window.finderSelection={bean:"",experience:""};
 window.finderSelection.experience=method;
 updateFinderResult();
}
function updateFinderResult(){
 const p=PRODUCTS.find(x=>x.name===window.finderSelection?.bean); if(!p)return;
 const exp=window.finderSelection.experience;
 document.getElementById("finderProgress").textContent=exp?"STEP 04 · YOUR COFFEE JOURNEY":"STEP 03 · DISCOVER ITS CHARACTER";
 document.getElementById("finderResult").innerHTML=`<div class="result-copy"><span class="eyebrow">YOUR COFFEE JOURNEY</span><strong>${esc(p.name)} · ${esc(p.region)}</strong><small>${esc(p.process)} · ${esc(p.notes)}${exp?` · EXPERIENCE: ${esc(exp)}`:""}</small></div><a class="result-cta" href="#cafe">DISCOVER AT THE CAFÉ →</a>`;
}
function productId(p){return p.id||p.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function addToCart(name, quantity=1){
 const p=PRODUCTS.find(x=>x.name===name);
 if(!p||p.type==="Seasonal")return;
 const qty=Math.max(1,Math.min(99,Math.floor(Number(quantity)||1)));
 const id=productId(p); const item=cart.find(x=>x.id===id||x.name===name);
 if(item)item.qty=Math.min(99,item.qty+qty);else cart.push({id,name:p.name,qty,price:p.price,region:p.region});
 saveCart();openCart();
}
function saveCart(){localStorage.setItem("kenangan_cart",JSON.stringify(cart));renderCart()}
function cartSubtotal(){return cart.reduce((a,x)=>a+Number(x.price||0)*Number(x.qty||0),0)}
function renderCart(){
 cart=cart.filter(x=>{const p=PRODUCTS.find(p=>p.name===x.name||productId(p)===x.id);return p&&p.type!=="Seasonal";});
 localStorage.setItem("kenangan_cart",JSON.stringify(cart));
 const count=document.getElementById("count"); if(count)count.textContent=cart.reduce((a,x)=>a+Number(x.qty||0),0);
 const host=document.getElementById("cartItems"); if(!host)return;
 host.innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-row"><div class="cart-item-copy"><h4>${esc(x.name)}</h4><small>${esc(x.region||"")} · 100g</small><strong>${rp(x.price)}</strong></div><div class="cart-item-controls"><div class="qty"><button type="button" data-cart-action="qty-down" data-cart-index="${i}" aria-label="Decrease ${esc(x.name)}">−</button><span>${x.qty}</span><button type="button" data-cart-action="qty-up" data-cart-index="${i}" aria-label="Increase ${esc(x.name)}">+</button></div><button type="button" class="remove-item" data-cart-action="remove" data-cart-index="${i}" aria-label="Remove ${esc(x.name)}">REMOVE</button></div></div>`).join(""):`<div class="empty-cart"><span class="eyebrow">YOUR CART</span><h3>Your cart is waiting.</h3><p>Add a regular coffee from the collection to begin your order.</p><button type="button" class="text-link" data-cart-action="continue">CONTINUE SHOPPING →</button></div>`;
 const total=document.getElementById("cartTotal"); if(total)total.textContent=rp(cartSubtotal());
 const checkoutBtn=document.querySelector(".cart-bottom .btn.full"); if(checkoutBtn)checkoutBtn.disabled=!cart.length;
}
function changeQty(i,d){if(!cart[i])return;cart[i].qty=Math.max(0,Math.min(99,Number(cart[i].qty||0)+d));if(cart[i].qty===0)cart.splice(i,1);saveCart()}
function removeFromCart(i){if(!cart[i])return;cart.splice(i,1);saveCart()}
function openCart(){const d=document.getElementById("cartDrawer");if(!d)return;d.classList.add("open");document.getElementById("cartBackdrop")?.classList.add("open");renderCart()}
function closeCart(){document.getElementById("cartDrawer")?.classList.remove("open");document.getElementById("cartBackdrop")?.classList.remove("open")}
function checkout(){
 if(!cart.length)return;
 if(!currentUser){closeCart();openAccount();return alert("Please login to continue to checkout.");}
 closeCart();
 document.getElementById("checkoutName").value=currentUser.name||"";
 document.getElementById("checkoutEmail").value=currentUser.email||"";
 document.getElementById("checkoutSummary").innerHTML=cart.map(x=>`<div><span>${esc(x.name)} × ${x.qty}</span><strong>${rp(x.price*x.qty)}</strong></div>`).join("")+`<div><span>Shipping</span><strong>${rp(20000)}</strong></div><div class="checkout-grand"><span>TOTAL</span><strong>${rp(cartSubtotal()+20000)}</strong></div>`;
 document.getElementById("checkoutMessage").textContent="";document.getElementById("checkoutModal").classList.add("open");
}
function searchProducts(q){
 const l=q.toLowerCase();const res=PRODUCTS.filter(p=>`${p.name} ${p.region} ${p.process} ${p.notes}`.toLowerCase().includes(l)).slice(0,8);
 document.getElementById("searchResults").innerHTML=res.map(p=>`<div class="search-item" onclick="closeSearch();location.hash='shop';filterRegion('${p.region}')"><b>${esc(p.name)}</b><small>${esc(p.region)} · ${esc(p.process)} · ${esc(p.notes)}</small></div>`).join("");
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeSearch();closeAccount();closeStoryForm();closeProduct();closeJournal()}});
document.addEventListener("click",e=>{if(e.target.id==="cartBackdrop")closeCart();});
renderRegions();
renderSeasonal();renderProducts();renderCart();renderStories();
restoreSession().then(()=>loadStories()).then(()=>{const m=document.getElementById("storyMode");if(m)m.textContent=storyApiAvailable?"DATABASE CONNECTED":"LOCAL FALLBACK";});

function openProduct(name){
 const p=PRODUCTS.find(x=>x.name===name); if(!p)return;
 const isSeasonal=p.type==="Seasonal";
 document.getElementById("productDetail").innerHTML=`<div class="detail-grid">
 <div class="detail-art"><img src="${productArt(p)}" alt="${esc(p.name)}"></div>
 <div class="detail-content">
  <span class="eyebrow">${esc(p.region).toUpperCase()} · ${esc(p.process).toUpperCase()}</span>
  <h2>${esc(p.name)}</h2>
  <p class="detail-notes">${esc(p.notes)}</p>
  <div class="detail-facts"><div><span>VARIETY</span><strong>${esc(p.variety)}</strong></div><div><span>PROCESS</span><strong>${esc(p.process)}</strong></div><div><span>FORMAT</span><strong>100G</strong></div></div>
  <p class="detail-copy">${esc(productDescription(p))}</p>
  <div class="detail-purchase"><strong class="detail-price">${rp(p.price)} <small>/ 100g</small></strong>
  ${isSeasonal?'<div class="seasonal-detail-note"><b>CAFÉ EXCLUSIVE</b><span>This seasonal coffee is not available for online purchase. Discover it at the Kenangan café.</span></div>':'<div class="detail-buy-row"><div class="detail-qty"><button type="button" class="detail-qty-btn" data-delta="-1">−</button><span id="detailQty">1</span><button type="button" class="detail-qty-btn" data-delta="1">+</button></div><button type="button" class="btn detail-add-btn">ADD TO CART →</button></div>'}</div>
 </div></div>`;
 window.detailSelection={name:p.name,qty:1};
 const modal=document.getElementById("productModal");
 modal.classList.add("open");
 // Bind the detail controls after the modal HTML exists. This avoids inline-handler
 // issues and makes the primary CTA reliably clickable inside the scrollable modal.
 modal.querySelectorAll(".detail-qty-btn").forEach(btn=>{
   btn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();adjustDetailQty(Number(btn.dataset.delta)||0);});
 });
 const addBtn=modal.querySelector(".detail-add-btn");
 if(addBtn){
   addBtn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();addDetailToCart(p.name);});
 }
}
function adjustDetailQty(delta){
 const q=document.getElementById("detailQty"); if(!q)return;
 window.detailSelection=window.detailSelection||{name:"",qty:1};
 window.detailSelection.qty=Math.max(1,Math.min(99,window.detailSelection.qty+delta)); q.textContent=window.detailSelection.qty;
}
function addDetailToCart(name){
 const qty=window.detailSelection?.name===name?window.detailSelection.qty:1;
 addToCart(name,qty); closeProduct();
}
function closeProduct(){document.getElementById("productModal").classList.remove("open")}


// V27 — account/checkout resilience for both local Node and Vercel/static deployment.
function closeCheckout(){document.getElementById('checkoutModal')?.classList.remove('open');}
function closeOrderSuccess(){document.getElementById('orderSuccessModal')?.classList.remove('open');}
function localOrders(){return JSON.parse(localStorage.getItem('kenangan_orders')||'[]');}
function saveLocalOrders(list){localStorage.setItem('kenangan_orders',JSON.stringify(list));}
function showOrderSuccess(order){
 const box=document.getElementById('orderSuccessContent'); if(!box)return;
 box.innerHTML=`<span class="eyebrow">ORDER CONFIRMED</span><h2>Thank you, ${esc(currentUser?.name||order.customer?.name||'Coffee Lover')}.</h2><p class="form-intro">Your Kenangan coffee journey has begun. Your order has been recorded successfully.</p><div class="order-confirm"><span>ORDER NUMBER</span><strong>${esc(order.id)}</strong><span>TOTAL</span><strong>${rp(order.total)}</strong><span>STATUS</span><strong>${esc(order.status||'ORDER PLACED')}</strong></div><div class="form-actions"><button type="button" class="btn" onclick="closeOrderSuccess();showMyOrders()">VIEW MY ORDERS →</button><button type="button" class="text-link" onclick="closeOrderSuccess()">CONTINUE SHOPPING</button></div>`;
 document.getElementById('orderSuccessModal')?.classList.add('open');
}
async function submitCheckout(e){
 e.preventDefault();
 if(!currentUser){closeCheckout();openAccount();return;}
 const message=document.getElementById('checkoutMessage'); message.textContent='';
 const customer={name:document.getElementById('checkoutName').value.trim(),email:document.getElementById('checkoutEmail').value.trim(),phone:document.getElementById('checkoutPhone').value.trim(),postalCode:document.getElementById('checkoutPostal').value.trim(),address:document.getElementById('checkoutAddress').value.trim(),city:document.getElementById('checkoutCity').value.trim(),province:document.getElementById('checkoutProvince').value.trim()};
 const payload={customer,items:cart.map(x=>({productId:x.id,qty:Number(x.qty)})),shippingFee:20000};
 try{
  let order;
  try{
   order=await authFetch('/api/orders',{method:'POST',body:JSON.stringify(payload)});
  }catch(apiErr){
   // Vercel/static demo fallback. This keeps checkout functional without pretending it is a server database.
   const subtotal=cartSubtotal();
   order={id:`KN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-LOCAL-${String(localOrders().length+1).padStart(3,'0')}`,userId:currentUser.id,customer,items:cart.map(x=>({...x,lineTotal:Number(x.price)*Number(x.qty)})),subtotal,shipping:20000,total:subtotal+20000,status:'ORDER PLACED',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),local:true};
   const orders=localOrders(); orders.unshift(order); saveLocalOrders(orders);
  }
  cart=[];saveCart();closeCheckout();showOrderSuccess(order);
 }catch(err){message.textContent=err?.message||'Unable to place the order. Please check your details and try again.';}
}
function orderStatusMarkup(status){
 const steps=['ORDER PLACED','PREPARING','SHIPPED','DELIVERED'];
 const current=Math.max(0,steps.indexOf(String(status||'ORDER PLACED').toUpperCase()));
 return `<div class="order-status-track">${steps.map((step,i)=>`<div class="status-step ${i<current?'done':''} ${i===current?'current':''}"><span>${i<current?'✓':String(i+1).padStart(2,'0')}</span><small>${step}</small></div>`).join('')}</div>`;
}
function orderItemData(item){
 // Resolve by coffee name first. Older/local orders may not contain productId,
 // and comparing two missing ids would incorrectly match the first coffee (Aceh Gayo Bourbon).
 const itemName=String(item?.name||item?.product?.name||'').trim();
 const itemId=String(item?.productId||item?.product?.id||'').trim();
 let product=itemName?PRODUCTS.find(p=>String(p.name).trim().toLowerCase()===itemName.toLowerCase()):null;
 if(!product && itemId){
   product=PRODUCTS.find(p=>String(p.id||'').trim()===itemId);
   if(!product){
     const normalized=itemId.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
     product=PRODUCTS.find(p=>productId(p)===normalized);
   }
 }
 const name=itemName||product?.name||'Indonesian Coffee';
 const price=Number(item?.price??product?.price??0);
 const qty=Number(item?.qty||1);
 return {product,name,price,qty,lineTotal:Number(item?.lineTotal??(price*qty))};
}
async function loadMyOrders(){
 const host=document.getElementById('myOrdersContent'); if(!host)return;
 host.innerHTML='<div class="orders-loading"><span class="eyebrow">YOUR COFFEE JOURNEY</span><p>Loading your orders…</p></div>';
 try{
  let orders;
  try{orders=await authFetch('/api/orders');}
  catch{orders=localOrders().filter(o=>o.userId===currentUser?.id);}
  if(!orders.length){host.innerHTML='<div class="orders-empty"><div class="empty-mark">K</div><span class="eyebrow">NO ORDERS YET</span><h3>Your next Kenangan starts here.</h3><p>Explore Indonesian origins, choose a regular coffee, and make your first order. Your coffee journey will be saved here.</p><button class="btn" onclick="closeAccount();location.hash=\'shop\'">EXPLORE COFFEE →</button></div>';return;}
  const totalSpent=orders.reduce((sum,o)=>sum+Number(o.total||0),0);
  const totalCoffees=orders.reduce((sum,o)=>sum+(o.items||[]).reduce((n,i)=>n+Number(i.qty||0),0),0);
  host.innerHTML=`<div class="orders-overview"><div><span>ORDERS</span><strong>${String(orders.length).padStart(2,'0')}</strong></div><div><span>COFFEES</span><strong>${String(totalCoffees).padStart(2,'0')}</strong></div><div><span>TOTAL SPENT</span><strong>${rp(totalSpent)}</strong></div></div><div class="orders-note"><span>KENANGAN DELIVERY</span><p>Every regular coffee order is prepared for delivery. Seasonal coffees remain café-exclusive.</p></div><div class="orders-list">${orders.map((o,index)=>{
    const status=String(o.status||'ORDER PLACED').toUpperCase();
    const items=(o.items||[]).map(orderItemData);
    const city=o.customer?.city||o.customer?.province||'Delivery address';
    return `<article class="order-card order-card-premium">
      <div class="order-card-head"><div><span class="order-kicker">ORDER ${String(index+1).padStart(2,'0')}</span><h3>${esc(o.id)}</h3><small>${new Date(o.createdAt).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} · ${esc(city)}</small></div><div class="order-total-block"><span>${esc(status)}</span><strong>${rp(o.total)}</strong></div></div>
      ${orderStatusMarkup(status)}
      <div class="order-items-section">
        <div class="order-items-heading"><span>ORDER ITEMS (${items.length})</span><button type="button" class="order-receipt-link" onclick="openOrderReceipt('${esc(o.id)}')">VIEW RECEIPT →</button></div>
        <div class="order-items">${items.map(item=>`<div class="order-item">
          <div class="order-item-main">
            <div class="order-item-art"><img src="${productArt(item.product||{name:item.name,region:'Indonesia',process:'Roasted',notes:''})}" alt="${esc(item.name)}"></div>
            <div class="order-item-copy"><b>${esc(item.name)}</b><small>${esc(item.product?.region||'Indonesia')}<br>${esc(item.product?.process||'Roasted')} · 100g</small><span>QTY ${item.qty}</span></div>
          </div>
          <div class="order-item-price"><span>ITEM TOTAL</span><strong>${rp(item.lineTotal)}</strong></div>
        </div>`).join('')}</div>
      </div>
      <div class="order-bottom"><div class="order-price-breakdown"><div><span>SUBTOTAL</span><b>${rp(o.subtotal??(Number(o.total||0)-Number(o.shipping||20000)))}</b></div><div><span>DELIVERY</span><b>${rp(o.shipping??20000)}</b></div><div class="grand"><span>TOTAL</span><b>${rp(o.total)}</b></div></div><div class="order-actions"><button class="btn order-shop-btn" type="button" onclick="closeAccount();location.hash=\'shop\'">SHOP COFFEE →</button></div></div>
    </article>`;
  }).join('')}</div>`;
 }catch(err){host.innerHTML='<div class="orders-error"><span class="eyebrow">ORDER HISTORY</span><h3>We could not load your orders.</h3><p>Please try again in a moment.</p><button class="btn" onclick="loadMyOrders()">TRY AGAIN →</button></div>';}
}
function openOrderReceipt(orderId){
 const orders=localOrders();
 const order=orders.find(o=>String(o.id)===String(orderId));
 if(!order){
   const cards=[...document.querySelectorAll('.order-card-premium h3')];
   const card=cards.find(el=>el.textContent.trim()===String(orderId))?.closest('.order-card-premium');
   if(!card)return;
   const total=card.querySelector('.order-total-block strong')?.textContent||'';
   const modal=document.getElementById('orderReceiptModal');
   if(modal){document.getElementById('orderReceiptContent').innerHTML=`<span class="eyebrow">KENANGAN RECEIPT</span><h2>Order Receipt.</h2><p class="form-intro">${esc(orderId)} · ${esc(total)}</p><button class="btn" type="button" onclick="window.print()">PRINT RECEIPT →</button>`;modal.classList.add('open');}
   return;
 }
 const items=(order.items||[]).map(orderItemData);
 const modal=document.getElementById('orderReceiptModal');
 const box=document.getElementById('orderReceiptContent');
 if(!modal||!box)return;
 box.innerHTML=`<span class="eyebrow">KENANGAN RECEIPT</span><h2>Order Receipt.</h2><p class="form-intro">${esc(order.id)} · ${new Date(order.createdAt).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p><div class="receipt-lines">${items.map(i=>`<div><span>${esc(i.name)} × ${i.qty}</span><b>${rp(i.lineTotal)}</b></div>`).join('')}<div><span>DELIVERY</span><b>${rp(order.shipping??20000)}</b></div><div class="receipt-total"><span>TOTAL</span><b>${rp(order.total)}</b></div></div><div class="form-actions"><button class="btn" type="button" onclick="window.print()">PRINT RECEIPT →</button><button class="text-link" type="button" onclick="closeOrderReceipt()">CLOSE</button></div>`;
 modal.classList.add('open');
}
function closeOrderReceipt(){document.getElementById('orderReceiptModal')?.classList.remove('open');}
function openSearch(){const m=document.getElementById('searchModal');if(!m)return;m.classList.add('open');const input=document.getElementById('searchInput');if(input){input.value='';searchProducts('');setTimeout(()=>input.focus(),50);}}
function closeSearch(){document.getElementById('searchModal')?.classList.remove('open');}
const JOURNAL_CONTENT={
 'natural-washed':{eyebrow:'COFFEE 101',title:'Natural vs Washed: What’s the Difference?',readtime:'8 MIN READ',type:'long'},
 'five-origins':{eyebrow:'ORIGIN STORIES',title:'Five Indonesian Coffee Origins You Should Try',readtime:'4 MIN READ',body:'Indonesia offers a wide range of coffee expressions shaped by region, elevation, climate, variety and processing. Explore Sumatera, Jawa Barat, Jawa Tengah, Jawa Timur and Indonesia Timur to discover how differently one archipelago can taste.'},
 'brew-guide':{eyebrow:'BREWING GUIDE',title:'Finding the Right Brew for Your Bean',readtime:'4 MIN READ',body:'Start with the bean’s natural character, then adjust grind size, water temperature, ratio and pouring technique. Pour over can highlight clarity, French Press can emphasize body, and espresso can concentrate richer chocolate and caramel notes.'}
};

function naturalWashedArticleMarkup(){
 return `
  <article class="journal-article">
   <figure class="journal-cover">
    <img src="assets/photos/journal/article-natural-washed/coffee-cherries-hero.webp" alt="Ripe red coffee cherries growing among glossy green leaves in an Indonesian highland coffee farm" fetchpriority="high">
    <figcaption>Every cup begins long before roasting — with a ripe coffee cherry and the choices made after harvest.</figcaption>
   </figure>
   <h2 class="journal-article-headline">Natural vs Washed: What’s the Difference?</h2>
   <div class="journal-byline"><span class="journal-author-mark">K</span><strong>Kenangan Coffee Editorial</strong><span class="journal-byline-divider">·</span><time datetime="2026-11-18">18 November 2026</time><span class="journal-byline-divider">·</span><span>8 min read</span></div>
   <p class="journal-standfirst">Two popular processing methods can take the same coffee cherry in different directions. Discover how Natural and Washed processing shape the character in your cup — and why neither method is automatically better.</p>

   <div class="journal-article-copy">
    <p>When we enjoy a cup of coffee, it is easy to focus on the origin printed on the bag, the roast level, or the tasting notes that promise berries, citrus, chocolate, or florals. Yet another important part of the story happens between harvest and roasting: <strong>post-harvest processing</strong>. This is where the freshly picked coffee fruit is prepared so that its seeds can become the green coffee beans that roasters work with.</p>
    <p>Inside every coffee cherry are usually two seeds, protected by layers of fruit. The skin and pulp surround a sticky layer called <em>mucilage</em>; beneath it sits a protective parchment layer around the seed. How much of this fruit is removed, when it is removed, and how the remaining coffee is dried are central differences between Natural and Washed processing.</p>
    <p>These methods do more than describe a farm technique. They influence how a coffee develops during drying and fermentation, and they can contribute to the sweetness, acidity, body, aroma, and clarity we notice when tasting. Let’s follow each method from the harvest to the final cup.</p>

    <section class="journal-article-section">
     <div class="journal-section-heading"><span>01</span><div><span class="eyebrow">THE DRY PROCESS</span><h3>What Is Natural Processing?</h3></div></div>
     <p>Natural processing, also known as the <strong>dry process</strong>, is one of the oldest ways of preparing coffee. Instead of removing the fruit immediately, producers dry the coffee cherry while the skin, pulp, and mucilage are still wrapped around the seeds. The fruit remains attached during most of the drying stage, and the dried outer layers are removed later during hulling.</p>
     <figure class="journal-inline-figure journal-inline-wide">
      <img src="assets/photos/sections/seasonal.jpg" alt="Coffee cherries laid out across raised drying beds at a highland coffee farm" loading="lazy">
      <figcaption>In Natural processing, whole coffee cherries are spread out to dry and are turned regularly to encourage even drying.</figcaption>
     </figure>
     <h4>How the Natural process works</h4>
     <ol class="journal-number-list">
      <li><strong>Harvest and sort.</strong> Ripe cherries are selected and sorted to remove leaves, stones, damaged fruit, and cherries that are not suitable for the lot.</li>
      <li><strong>Dry the whole cherry.</strong> The cherries are spread on patios, raised beds, or other suitable drying surfaces. Producers turn or move them regularly so that air can circulate and moisture can leave more evenly.</li>
      <li><strong>Monitor the drying stage.</strong> Temperature, humidity, airflow, the depth of the coffee layer, and weather all affect the pace of drying. Careful monitoring helps reduce the risk of uneven drying or unwanted fermentation.</li>
      <li><strong>Hull and prepare the green coffee.</strong> Once the cherries have reached a stable drying condition, the dried skin and fruit are removed. The beans are then cleaned, sorted, and prepared for storage or export.</li>
     </ol>
     <div class="journal-taste-card">
      <div class="journal-taste-icon">✳</div><div><strong>What might you taste?</strong><p>Natural coffees are often associated with ripe-fruit or dried-fruit impressions, noticeable sweetness, and a fuller mouthfeel. Berry, tropical-fruit, or wine-like notes may appear in some lots, but these are tendencies — not a promise that every Natural coffee will taste the same.</p></div>
     </div>
     <p>Because the fruit dries together with the seeds, Natural processing can encourage a layered and expressive profile. It can also use less process water than a traditional Washed method. However, it asks for close attention: cherries must be dried evenly, protected from excess moisture, and moved with care. If drying is inconsistent, quality can become uneven from one part of the lot to another.</p>
    </section>

    <section class="journal-article-section">
     <div class="journal-section-heading"><span>02</span><div><span class="eyebrow">THE WET PROCESS</span><h3>What Is Washed Processing?</h3></div></div>
     <p>Washed processing, also known as the <strong>wet process</strong>, takes a different route. The outer skin and pulp are removed soon after the cherries arrive at the processing station. The seeds are still covered by mucilage, so that sticky layer must also be broken down or removed before the coffee is dried.</p>
     <p>In a common traditional method, the pulped coffee is allowed to ferment for a carefully managed period. During fermentation, naturally occurring microorganisms and enzymes help loosen the mucilage. The coffee is then washed with water, leaving the seeds inside their parchment layer. Finally, the parchment coffee is dried until it is stable for storage and later milling.</p>
     <div class="journal-process-flow" aria-label="Typical washed coffee processing sequence">
      <div><span>01</span><b>Sort cherries</b><small>Select ripe, sound fruit</small></div><i>→</i>
      <div><span>02</span><b>Pulp</b><small>Remove skin and pulp</small></div><i>→</i>
      <div><span>03</span><b>Ferment & wash</b><small>Loosen and remove mucilage</small></div><i>→</i>
      <div><span>04</span><b>Dry parchment</b><small>Stabilise the green coffee</small></div>
     </div>
     <figure class="journal-inline-figure journal-inline-wide">
      <img src="assets/photos/sections/best-sellers.jpg" alt="Freshly brewed coffee poured into a cup, ready for tasting" loading="lazy">
      <figcaption>The purpose of careful processing is not to impose one flavour, but to prepare the coffee so its qualities can be appreciated in the cup.</figcaption>
     </figure>
     <h4>How the Washed process works</h4>
     <ol class="journal-number-list">
      <li><strong>Sort the harvested cherries.</strong> Producers remove foreign material and separate fruit that does not meet the lot’s quality requirements.</li>
      <li><strong>Remove the skin and pulp.</strong> A pulping machine separates the outer fruit from the seeds. A layer of mucilage remains attached to the parchment coffee.</li>
      <li><strong>Ferment and wash.</strong> Fermentation, or an appropriate mechanical or enzymatic method, loosens the mucilage. Washing then removes the loosened material from the parchment.</li>
      <li><strong>Dry the parchment coffee.</strong> The cleaned parchment coffee is dried under controlled conditions. It is later hulled to remove the parchment, then cleaned and sorted as green coffee.</li>
     </ol>
     <div class="journal-taste-card journal-taste-card-washed">
      <div class="journal-taste-icon">◌</div><div><strong>What might you taste?</strong><p>Washed coffees are often described as clean, clear, and well-defined. Depending on the coffee, you may notice a more distinct acidity, delicate florals, citrus, or a transparent expression of the origin. Body can feel lighter than in some Natural coffees, although this is not a fixed rule.</p></div>
     </div>
     <p>Washed processing can make the coffee’s flavour profile feel more clearly separated and easier to read. It also requires reliable water access, careful fermentation management, and responsible handling of the water and organic by-products created during processing. The skill of the producer remains essential at every stage.</p>
    </section>

    <section class="journal-article-section">
     <div class="journal-section-heading"><span>03</span><div><span class="eyebrow">SIDE BY SIDE</span><h3>Natural vs Washed: What Is the Difference?</h3></div></div>
     <p>The clearest difference is <strong>when the coffee fruit is removed</strong>. Natural coffee is dried as a whole cherry; Washed coffee has its skin and pulp removed before drying, and the mucilage is removed through fermentation and washing or another suitable method. That one decision changes the way the coffee moves through the post-harvest process.</p>
     <div class="journal-table-wrap" role="region" aria-label="Natural and Washed coffee processing comparison" tabindex="0">
      <table class="journal-comparison-table">
       <thead><tr><th>Aspect</th><th>Natural (Dry Process)</th><th>Washed (Wet Process)</th></tr></thead>
       <tbody>
        <tr><th>Fruit removal</th><td>Whole cherry stays around the seed during drying.</td><td>Skin and pulp are removed before drying; mucilage is removed before the parchment dries.</td></tr>
        <tr><th>Main drying form</th><td>Whole coffee cherries.</td><td>Cleaned parchment coffee.</td></tr>
        <tr><th>Water use</th><td>Usually lower process-water demand.</td><td>Usually higher, especially when fermentation and washing use water.</td></tr>
        <tr><th>Common cup tendency</th><td>Fruit-forward, sweet, layered.</td><td>Clean, clear, defined.</td></tr>
        <tr><th>Body & acidity</th><td>Can feel fuller, with softer or rounder acidity.</td><td>Can feel lighter, with more noticeable or defined acidity.</td></tr>
        <tr><th>Key management focus</th><td>Even drying, airflow, turning, and protection from excess moisture.</td><td>Sorting, fermentation control, washing, water quality, and effluent handling.</td></tr>
       </tbody>
      </table>
     </div>
     <p class="journal-table-note">These are broad tendencies, not strict rules. The final cup also depends on cultivar, growing environment, cherry ripeness, processing decisions, drying, storage, roasting, and brewing.</p>
    </section>

    <section class="journal-article-section">
     <div class="journal-section-heading"><span>04</span><div><span class="eyebrow">FIND YOUR PREFERENCE</span><h3>Which One Should You Choose?</h3></div></div>
     <p>There is no universal winner. Think about the kind of experience you want from your next cup. If you enjoy coffees that feel generous, fruit-led, and expressive, a well-made Natural lot may be a great place to start. If you prefer definition, clarity, and a more distinct sense of acidity or origin, try a Washed lot.</p>
     <div class="journal-choice-grid">
      <div class="journal-choice-card"><span class="eyebrow">TRY NATURAL IF YOU LIKE</span><h4>Fruit & sweetness</h4><ul><li>Ripe or dried-fruit impressions</li><li>A rounder, fuller mouthfeel</li><li>Layered, expressive flavour</li><li>A cup that feels bold and generous</li></ul></div>
      <div class="journal-choice-card"><span class="eyebrow">TRY WASHED IF YOU LIKE</span><h4>Clarity & definition</h4><ul><li>Clean, well-separated flavours</li><li>Bright or clearly defined acidity</li><li>Delicate floral or citrus notes</li><li>A cup that highlights origin character</li></ul></div>
     </div>
     <h4>A simple way to compare them at home</h4>
     <p>Brew a Natural coffee and a Washed coffee side by side using the same brewer, water, coffee-to-water ratio, and brew time as closely as possible. Smell the dry grounds first, then notice the aroma after brewing. Taste each cup while it is hot, warm, and cooler: sweetness, acidity, body, and aftertaste can become easier to distinguish as the temperature changes. Write down what you notice before reading the bag’s tasting notes. The goal is not to find a correct answer; it is to discover the profile you enjoy.</p>
    </section>

    <section class="journal-article-section journal-indonesia-note">
     <div class="journal-section-heading"><span>05</span><div><span class="eyebrow">A NOTE FROM NUSANTARA</span><h3>Where Does Indonesian Wet-Hulled Coffee Fit?</h3></div></div>
     <p>When exploring Indonesian coffee, you may also encounter the term <strong>wet-hulled</strong>, commonly known locally as <em>giling basah</em>. It is a distinct processing method and should not be treated as another name for Washed coffee. In wet-hulling, the parchment is removed while the coffee is still relatively moist, before the green beans complete their drying. This differs from the usual Washed route, where parchment coffee is dried first and hulled later.</p>
     <p>You may also see <strong>Honey</strong> or <strong>pulped natural</strong> processing. These methods sit between the two broad approaches: the outer skin is removed, but some mucilage is left on the coffee as it dries. They are useful reminders that coffee processing is not limited to only two choices — producers have many ways to shape a lot according to their environment, equipment, and desired result.</p>
    </section>

    <section class="journal-conclusion">
     <span class="eyebrow">THE TAKEAWAY</span>
     <h3>One cherry. Two journeys. Countless ways to enjoy coffee.</h3>
     <p>Natural and Washed processing are two different ways of preparing coffee after harvest. Natural keeps the whole cherry around the seed while it dries; Washed removes the fruit earlier and cleans away the mucilage before drying. Each method asks for knowledge, consistency, and care from the producer — and each can produce a beautiful cup.</p>
     <p>The next time you choose a coffee, look beyond the origin and roast. Notice the processing method, brew it with curiosity, and let your own palate decide. That is part of the joy of discovering Indonesian coffee: every bean has a journey, and every cup can become a new Kenangan.</p>
    </section>

    <div class="journal-sources"><span class="eyebrow">FURTHER READING</span><a href="https://www.intracen.org/sites/default/files/uploadedFiles/intracenorg/Content/Publications/ITC_Coffee_4th_Report_20210930_web_pages.pdf" target="_blank" rel="noopener">The Coffee Guide, 4th Edition · International Trade Centre ↗</a><a href="https://www.aeki-aice.org/en/coffee-processing-process/" target="_blank" rel="noopener">Coffee Processing: 10 Steps from Harvest to Brewing · AEKI-AICE ↗</a></div>
   </div>

   <div class="journal-related">
    <div class="journal-related-heading"><span class="eyebrow">KEEP EXPLORING</span><h3>More from the Journal.</h3></div>
    <button type="button" class="journal-related-card" onclick="openJournal('five-origins')"><img src="assets/photos/journal/v54-origin-stories.jpg" alt="Indonesian highland coffee landscape" loading="lazy"><span><small>ORIGIN STORIES</small><b>Five Indonesian Coffee Origins You Should Try</b><em>READ STORY →</em></span></button>
    <button type="button" class="journal-related-card" onclick="openJournal('brew-guide')"><img src="assets/photos/journal/v54-brew-guide.jpg" alt="Coffee brewing in a glass dripper" loading="lazy"><span><small>BREWING GUIDE</small><b>Finding the Right Brew for Your Bean</b><em>READ STORY →</em></span></button>
   </div>
  </article>`;
}

let journalReturnFocus=null;
function openJournal(key){
 const j=JOURNAL_CONTENT[key]||JOURNAL_CONTENT['natural-washed'];
 const modal=document.getElementById('journalModal');
 if(!modal)return;
 if(!modal.classList.contains('open'))journalReturnFocus=document.activeElement;
 document.getElementById('journalModalEyebrow').textContent=j.eyebrow;
 document.getElementById('journalModalTitle').textContent=j.title;
 const readtime=document.getElementById('journalModalReadtime');
 if(readtime)readtime.textContent=j.readtime||'4 MIN READ';
 const content=document.getElementById('journalModalContent');
 if(j.type==='long')content.innerHTML=naturalWashedArticleMarkup();
 else content.innerHTML=`<div class="journal-short-article"><p>${esc(j.body)}</p><p>Great coffee is shaped by origin, harvest, processing, roasting, and the way we brew it. Keep exploring, stay curious, and discover the character that feels right for your cup.</p></div>`;
 modal.classList.add('open');
 modal.setAttribute('aria-hidden','false');
 const box=modal.querySelector('.journal-modal-box');
 if(box)box.scrollTop=0;
 const closeButton=modal.querySelector('.journal-modal-close');
 if(closeButton)closeButton.focus({preventScroll:true});
}
function closeJournal(){
 const modal=document.getElementById('journalModal');
 if(!modal)return;
 modal.classList.remove('open');
 modal.setAttribute('aria-hidden','true');
 if(journalReturnFocus&&typeof journalReturnFocus.focus==='function')journalReturnFocus.focus({preventScroll:true});
 journalReturnFocus=null;
}
const journalModalElement=document.getElementById('journalModal');
journalModalElement?.addEventListener('click',event=>{if(event.target===journalModalElement)closeJournal();});

// V26 — direct cart interaction layer. Buttons are generated dynamically, so bind at document level.
document.addEventListener("click",function(e){
 const btn=e.target.closest("[data-cart-action]");
 if(!btn)return;
 e.preventDefault();e.stopPropagation();
 const action=btn.dataset.cartAction;
 const i=Number(btn.dataset.cartIndex);
 if(action==="qty-down")changeQty(i,-1);
 else if(action==="qty-up")changeQty(i,1);
 else if(action==="remove")removeFromCart(i);
 else if(action==="continue"){closeCart();location.hash="shop";}
});

// Robust interaction layer for dynamically rendered controls.
document.addEventListener("click",function(e){
 const el=e.target.closest("[data-action]");
 if(!el)return;
 e.preventDefault();
 e.stopPropagation();
 const action=el.dataset.action;
 if(action==="select-region"){selectRegion(el.dataset.region);return;}
 if(action==="open-product"){openProduct(el.dataset.product);return;}
 if(action==="add-cart"){addToCart(el.dataset.product);return;}
 if(action==="close-product"){closeProduct();return;}
 if(action==="open-journal"){openJournal(el.dataset.journal);return;}
});
document.addEventListener("keydown",function(e){
 if((e.key==="Enter"||e.key===" ") && e.target.matches("[data-action=select-region]")){e.preventDefault();selectRegion(e.target.dataset.region);}
});
