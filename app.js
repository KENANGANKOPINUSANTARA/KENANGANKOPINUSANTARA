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
 'five-origins':{eyebrow:'ORIGIN STORIES',title:'Five Indonesian Coffee Origins You Should Try',readtime:'11 MIN READ',type:'origins'},
 'brew-guide':{eyebrow:'BREWING GUIDE',title:'Finding the Right Brew for Your Bean',readtime:'6 MIN READ',type:'brew'},
 'coffee-roasting':{eyebrow:'COFFEE KNOWLEDGE',title:'The Art of Roasting: How Roast Level Shapes Your Coffee’s Flavor',readtime:'10 MIN READ',type:'roast'},
 'coffee-tasting':{eyebrow:'COFFEE EDUCATION',title:'Understanding Coffee Tasting Notes: How to Taste and Describe Coffee',readtime:'12 MIN READ',type:'tasting'}
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
    <button type="button" class="journal-related-card" onclick="openJournal('five-origins')"><img src="assets/photos/journal/indonesian-coffee-origins-hero.webp" alt="Indonesian highland coffee landscape" loading="lazy"><span><small>ORIGIN STORIES</small><b>Five Indonesian Coffee Origins You Should Try</b><em>READ STORY →</em></span></button>
    <button type="button" class="journal-related-card" onclick="openJournal('brew-guide')"><img src="assets/photos/journal/brew-guide-hero.webp" alt="Coffee brewing in a glass dripper" loading="lazy"><span><small>BREWING GUIDE</small><b>Finding the Right Brew for Your Bean</b><em>READ STORY →</em></span></button>
   </div>
  </article>`;
}

function fiveOriginsArticleMarkup(){
 return `
  <article class="journal-article journal-origins-article">
   <figure class="journal-cover">
    <img src="assets/photos/journal/indonesian-coffee-origins-hero.webp" alt="Lanskap perkebunan kopi Indonesia di dataran tinggi saat matahari terbit" fetchpriority="high" onerror="this.onerror=null;this.src='assets/photos/journal/indonesian-coffee-origins-hero.webp'">
    <figcaption>Dari pegunungan Sumatera hingga perkebunan di kepulauan timur, setiap daerah menyimpan cerita kopi yang berbeda.</figcaption>
   </figure>
   <h2 class="journal-article-headline">Five Indonesian Coffee Origins You Should Try</h2>
   <div class="journal-byline"><span class="journal-author-mark">K</span><strong>Kenangan Coffee Editorial</strong><span class="journal-byline-divider">·</span><time datetime="2026-11-20">20 November 2026</time><span class="journal-byline-divider">·</span><span>11 min read</span></div>
   <p class="journal-standfirst">Satu kepulauan, begitu banyak karakter dalam cangkir. Kenali lima kawasan kopi Indonesia melalui lanskap, tradisi budidaya, proses pascapanen, dan cita rasa yang membuat setiap origin layak dijelajahi.</p>

   <div class="journal-article-copy">
    <p>Indonesia bukan sekadar negara penghasil kopi; Indonesia adalah rangkaian lanskap yang membentuk pengalaman minum kopi dengan cara berbeda. Pegunungan vulkanik, ketinggian kebun, curah hujan, varietas tanaman, kebiasaan petani, hingga metode pascapanen ikut menentukan karakter biji yang akhirnya diseduh. Karena itu, dua kopi yang sama-sama berasal dari Indonesia belum tentu menghadirkan rasa yang serupa.</p>
    <p>Di balik nama daerah pada kemasan, ada komunitas petani, pengetahuan lokal, dan keputusan kecil yang berlangsung sejak buah dipetik sampai biji siap dipanggang. Artikel ini mengajak kamu mengenal lima kawasan besar yang sudah akrab dalam perjalanan kopi Nusantara: Sumatera, Jawa Barat, Jawa Tengah, Jawa Timur, dan Indonesia Timur. Di dalamnya, kita juga akan berjumpa dengan nama-nama origin yang dikenal luas, seperti Gayo, Mandheling, Java Preanger, Ijen-Raung, Toraja, Flores Bajawa, dan Kintamani.</p>
    <p>Perlu diingat, istilah rasa seperti cokelat, rempah, citrus, floral, atau buah-buahan adalah catatan sensori yang membantu kita membayangkan karakter kopi. Catatan tersebut bukan bahan tambahan di dalam biji, dan bukan jaminan bahwa setiap lot dari satu daerah akan terasa sama. Varietas, tingkat kematangan buah, proses, penyimpanan, roasting, serta cara seduh dapat menghasilkan pengalaman yang berbeda.</p>

    <section class="journal-origin-overview" aria-labelledby="origin-overview-title">
     <span class="eyebrow">A JOURNEY THROUGH THE ARCHIPELAGO</span>
     <h3 id="origin-overview-title">Five Regions, Many Ways to Enjoy Coffee.</h3>
     <div class="journal-origin-overview-grid">
      <a href="#origin-sumatera"><span>01</span><b>Sumatera</b><small>Bold · earthy · full-bodied</small></a>
      <a href="#origin-jabar"><span>02</span><b>Jawa Barat</b><small>Fruity · bright · expressive</small></a>
      <a href="#origin-jateng"><span>03</span><b>Jawa Tengah</b><small>Sweet · warm · balanced</small></a>
      <a href="#origin-jatim"><span>04</span><b>Jawa Timur</b><small>Spiced · clean · structured</small></a>
      <a href="#origin-east"><span>05</span><b>Indonesia Timur</b><small>Complex · diverse · memorable</small></a>
     </div>
    </section>

    <section class="journal-article-section journal-origin-section" id="origin-sumatera">
     <div class="journal-section-heading"><span>01</span><div><span class="eyebrow">THE ISLAND OF MANY EXPRESSIONS</span><h3>Sumatera: Bold, Earthy, and Full of Character</h3></div></div>
     <figure class="journal-inline-figure journal-origin-image"><img src="assets/photos/origins/v54-sumatera.jpg" alt="Lanskap dataran tinggi Sumatera dengan pegunungan dan kebun kopi" loading="lazy"><figcaption>Perbukitan dan dataran tinggi Sumatera menjadi rumah bagi beragam komunitas dan kebun kopi.</figcaption></figure>
     <p>Ketika membicarakan kopi Sumatera, dua nama yang sering muncul adalah <strong>Gayo</strong> dari dataran tinggi Aceh dan <strong>Mandheling</strong> dari Sumatera Utara. Keduanya memiliki identitas geografis dan tradisi produksi masing-masing, sehingga sebaiknya tidak dianggap sebagai satu nama untuk origin yang sama. Di sekitar kawasan Danau Toba, Lintong juga dikenal sebagai salah satu nama kopi Arabika yang dicari para penikmat kopi.</p>
     <p>Kopi Gayo tumbuh di kawasan pegunungan Aceh Tengah, Bener Meriah, dan Gayo Lues. Lingkungan dataran tinggi, pemilihan buah matang, serta keterampilan petani menjadi bagian penting dari identitasnya. Dokumen indikasi geografis ASEAN mencatat kopi Arabika Gayo memiliki aroma kuat, cita rasa kompleks, keasaman relatif ringan, dan body yang tebal. Gayo juga tercatat sebagai produk indikasi geografis Indonesia sejak 2010.</p>
     <p>Mandheling dan beberapa kopi Sumatera Utara kerap diasosiasikan dengan tekstur yang mantap serta kesan rasa yang dalam. Pada banyak lot, penikmat dapat menemukan nuansa kakao, rempah, herbal, atau karakter earthy. Sebagian kopi Sumatera diproses dengan metode <em>giling basah</em> atau <em>wet-hulling</em>, sebuah tahapan pascapanen yang berbeda dari washed process biasa. Metode ini ikut membentuk identitas tekstur dan profil rasa, tetapi bukan satu-satunya faktor penentu kualitas.</p>
     <div class="journal-taste-card"><div class="journal-taste-icon">✳</div><div><strong>What to look for in the cup</strong><p>Mulailah dengan mencari kesan body yang terasa penuh, cokelat, rempah, herbal, atau earthy. Perhatikan juga apakah keasamannya lembut dan bagaimana rasa tertinggal setelah kopi ditelan. Karakter setiap lot dapat berbeda, jadi gunakan catatan ini sebagai petunjuk awal, bukan aturan mutlak.</p></div></div>
     <p><strong>Cocok untuk siapa?</strong> Sumatera menarik bagi penikmat yang menyukai kopi dengan tekstur terasa, rasa yang dalam, dan karakter yang nyaman diminum perlahan. Cobalah menyeduhnya dengan French Press atau sebagai espresso blend, lalu bandingkan hasilnya dengan metode pour-over untuk melihat sisi lain dari biji yang sama.</p>
    </section>

    <section class="journal-article-section journal-origin-section" id="origin-jabar">
     <div class="journal-section-heading"><span>02</span><div><span class="eyebrow">JAVA PREANGER COUNTRY</span><h3>Jawa Barat: Fruity, Bright, and Expressive</h3></div></div>
     <figure class="journal-inline-figure journal-origin-image"><img src="assets/photos/origins/v54-jawa-barat.jpg" alt="Perkebunan kopi dan pegunungan di Jawa Barat" loading="lazy"><figcaption>Dataran tinggi Priangan dan kawasan sekitarnya membentuk salah satu cerita panjang kopi Jawa Barat.</figcaption></figure>
     <p>Jawa Barat memiliki sejarah panjang dalam perjalanan kopi Indonesia. Salah satu nama yang paling dikenal adalah <strong>Java Preanger</strong>, atau kopi Arabika Priangan. Nama Preanger merujuk pada kawasan Priangan di Jawa Barat, yang memiliki kebun-kebun dataran tinggi dengan kondisi alam yang beragam. Wilayah seperti Pangalengan, Ciwidey, Garut, dan beberapa kawasan pegunungan lain juga dikenal melalui lot kopi dengan karakter masing-masing.</p>
     <p>Java Preanger tercatat sebagai salah satu kopi Indonesia yang memperoleh pengakuan indikasi geografis. Namun, nama daerah bukan berarti seluruh biji akan mempunyai profil rasa yang seragam. Perbedaan ketinggian, varietas, tingkat kematangan buah, proses washed, natural, atau honey, serta keputusan roasting dapat membuat satu lot terasa berbeda dari lot lainnya.</p>
     <p>Dalam cangkir, kopi dari Jawa Barat dapat menghadirkan pengalaman yang cerah dan ekspresif. Beberapa lot memperlihatkan kesan citrus, buah, floral, atau rasa manis yang bersih; lot lainnya mungkin terasa lebih bulat dengan sentuhan karamel atau cokelat. Jika kamu menemukan catatan grape, berry, atau wine-like pada kemasan, anggap itu sebagai petunjuk aroma dan rasa yang mungkin muncul pada lot tersebut, bukan identitas wajib semua kopi Jawa Barat.</p>
     <div class="journal-taste-card journal-taste-card-washed"><div class="journal-taste-icon">◌</div><div><strong>What to look for in the cup</strong><p>Perhatikan keseimbangan antara keasaman, rasa manis, dan kejernihan rasa. Cobalah mengenali apakah sensasi citrus atau buah muncul lebih dulu, kemudian lihat bagaimana rasa manisnya bertahan ketika kopi mulai mendingin.</p></div></div>
     <p><strong>Cocok untuk siapa?</strong> Jawa Barat layak dicoba oleh penikmat yang senang mengeksplorasi kopi filter dengan aroma yang terbuka dan karakter yang dinamis. V60 atau Kalita dapat membantu menonjolkan detail rasa, terutama ketika rasio seduh dan ukuran gilingan dijaga konsisten.</p>
    </section>

    <section class="journal-article-section journal-origin-section" id="origin-jateng">
     <div class="journal-section-heading"><span>03</span><div><span class="eyebrow">THE CENTRAL HIGHLANDS</span><h3>Jawa Tengah: Sweet, Warm, and Balanced</h3></div></div>
     <figure class="journal-inline-figure journal-origin-image"><img src="assets/photos/origins/v52-jawa-tengah.jpg" alt="Lanskap pegunungan dan perkebunan di Jawa Tengah" loading="lazy"><figcaption>Kawasan Sindoro-Sumbing, Temanggung, dan dataran tinggi sekitarnya memiliki tradisi kopi yang beragam.</figcaption></figure>
     <p>Jawa Tengah menawarkan pemandangan kopi yang tidak kalah menarik. Nama seperti <strong>Java Sindoro-Sumbing</strong>, Temanggung, dan Dieng sering hadir dalam percakapan mengenai kopi dari dataran tinggi bagian tengah Pulau Jawa. Di kawasan ini, ketinggian, kondisi tanah, iklim mikro, serta jenis tanaman membuat produk kopi bisa sangat bervariasi. Sebagian kebun menghasilkan Arabika, sementara daerah lain juga dikenal dengan Robusta.</p>
     <p>Karena itu, penting untuk membaca informasi pada kemasan dengan teliti. Nama Temanggung, misalnya, tidak otomatis menunjukkan satu jenis kopi atau satu metode proses. Periksa apakah bijinya Arabika atau Robusta, bagaimana proses pascapanennya, dan siapa produsen atau kelompok tani yang mengerjakannya. Asosiasi eksportir kopi Indonesia mencatat Temanggung Robusta dan Java Sindoro-Sumbing Arabika sebagai dua nama indikasi geografis yang berbeda.</p>
     <p>Secara sensori, sejumlah lot dari kawasan ini dapat terasa hangat dan nyaman dengan kesan manis, kacang, rempah, atau cokelat. Pada proses tertentu, rasa buah dan floral juga dapat muncul. Jangan terpaku pada satu deskripsi: biji yang sama-sama berasal dari Jawa Tengah dapat menunjukkan karakter berbeda ketika varietas dan prosesnya tidak sama.</p>
     <div class="journal-taste-card"><div class="journal-taste-icon">✳</div><div><strong>What to look for in the cup</strong><p>Amati rasa manis alami, tekstur, dan keseimbangan setelah kopi mulai dingin. Jika kamu mencoba Arabika dan Robusta dari kawasan ini, bandingkan keduanya secara terpisah agar perbedaan varietas tidak tertukar dengan pengaruh proses.</p></div></div>
     <p><strong>Cocok untuk siapa?</strong> Pilihan dari Jawa Tengah menarik bagi penikmat yang ingin mengeksplorasi rasa yang terasa akrab sekaligus menemukan detail baru. Kopi dengan body menengah dapat dinikmati sebagai pour-over, sedangkan lot yang lebih pekat juga dapat menjadi pilihan untuk seduhan susu atau kopi harian.</p>
    </section>

    <section class="journal-article-section journal-origin-section" id="origin-jatim">
     <div class="journal-section-heading"><span>04</span><div><span class="eyebrow">VOLCANIC EAST JAVA</span><h3>Jawa Timur: Spiced, Clean, and Distinctive</h3></div></div>
     <figure class="journal-inline-figure journal-origin-image"><img src="assets/photos/origins/v54-jawa-timur.jpg" alt="Bentang pegunungan vulkanik dan perkebunan di Jawa Timur" loading="lazy"><figcaption>Kawasan Ijen-Raung memperlihatkan hubungan erat antara lanskap vulkanik dan budidaya kopi di Jawa Timur.</figcaption></figure>
     <p>Di Jawa Timur, salah satu nama penting adalah <strong>Java Ijen-Raung</strong>. Kawasan dataran tinggi di sekitar Pegunungan Ijen dan Raung menjadi rumah bagi perkebunan kopi serta komunitas produsen yang telah lama mengolah hasil panen setempat. Dalam catatan mengenai kopi Indonesia, Java Coffee dari dataran tinggi Ijen pernah digambarkan memiliki aroma dan rasa yang baik, nada rempah, keasaman yang bersih, serta body menengah.</p>
     <p>Nama Ijen-Raung juga tercatat dalam daftar indikasi geografis kopi Arabika Indonesia. Di luar itu, Jawa Timur memiliki banyak kawasan dan produsen lain, sehingga pengalaman dalam cangkir tetap bergantung pada asal kebun yang lebih spesifik, varietas, serta proses pascapanen yang digunakan. Satu label provinsi saja belum cukup untuk menjelaskan seluruh karakter sebuah kopi.</p>
     <p>Beberapa lot dapat terasa rapi dan seimbang, dengan sentuhan cokelat, citrus, herbal, atau rempah. Kopi natural dari kawasan yang sama mungkin terasa lebih manis atau menonjolkan buah, sedangkan washed dapat memberi kesan lebih bersih. Perbedaan ini memperlihatkan bahwa proses bukan sekadar keterangan teknis; ia merupakan bagian dari cerita rasa yang dibangun bersama oleh petani dan pengolah.</p>
     <div class="journal-taste-card journal-taste-card-washed"><div class="journal-taste-icon">◌</div><div><strong>What to look for in the cup</strong><p>Cari keseimbangan antara aroma rempah, rasa manis, dan keasaman yang terasa bersih. Coba seduh dengan air dan rasio yang sama seperti kopi Jawa Barat agar perbedaan origin lebih mudah dikenali.</p></div></div>
     <p><strong>Cocok untuk siapa?</strong> Jawa Timur patut dicoba oleh penikmat yang menginginkan kopi dengan karakter jelas namun tetap seimbang. Untuk eksplorasi, gunakan metode pour-over; untuk sajian yang lebih pekat, uji juga sebagai espresso dan perhatikan bagaimana karakter rempah serta cokelatnya berubah.</p>
    </section>

    <section class="journal-article-section journal-origin-section" id="origin-east">
     <div class="journal-section-heading"><span>05</span><div><span class="eyebrow">ACROSS THE EASTERN ISLANDS</span><h3>Indonesia Timur: Diverse, Complex, and Memorable</h3></div></div>
     <figure class="journal-inline-figure journal-origin-image"><img src="assets/photos/origins/v54-indonesia-timur.jpg" alt="Lanskap kepulauan dan dataran tinggi Indonesia bagian timur" loading="lazy"><figcaption>Di luar Jawa dan Sumatera, banyak komunitas di Sulawesi, Nusa Tenggara, dan Papua ikut menjaga keragaman kopi Nusantara.</figcaption></figure>
     <p>Istilah Indonesia Timur dalam artikel ini digunakan sebagai pengelompokan editorial untuk memperkenalkan beberapa wilayah kopi di bagian timur kepulauan, bukan sebagai satu origin tunggal. Di dalamnya ada nama yang sangat dikenal, seperti <strong>Toraja</strong> dan <strong>Kalosi</strong> dari Sulawesi, <strong>Flores Bajawa</strong> dari Nusa Tenggara Timur, serta kopi dari kawasan <strong>Baliem Wamena</strong> di Papua. Setiap wilayah memiliki kondisi alam, komunitas, dan tradisi produksi yang tidak sama.</p>
     <p>Kopi Toraja tumbuh di kawasan pegunungan Sulawesi Selatan dan dikenal melalui aroma yang kuat serta rasa yang kompleks. Catatan dari Kementerian Luar Negeri Indonesia menggambarkan Toraja/Kalosi sebagai kopi dengan aroma baik, rasa kompleks, body menengah, dan kepahitan yang seimbang. Toraja Arabica juga tercantum sebagai kopi indikasi geografis Indonesia pada 2013. Di Flores, Arabika Bajawa memperoleh pengakuan indikasi geografis pada 2012.</p>
     <p>Di Bali, <strong>Kintamani</strong> juga layak masuk daftar eksplorasi. Kopi Arabika Kintamani Bali memiliki pengakuan indikasi geografis sejak 2008. Wilayah pegunungan di sekitar Kintamani dikenal dengan sistem pertanian komunitas dan budidaya kopi yang hidup berdampingan dengan tanaman lain. Profil rasa pada lot tertentu dapat menampilkan citrus, floral, atau rasa manis yang segar, tetapi pengalaman sebenarnya tetap dipengaruhi oleh proses, panen, dan roasting. Secara geografis, Bali berada di kawasan Indonesia bagian tengah; karena itu, Kintamani kami hadirkan sebagai catatan lintas-kepulauan, bukan sebagai bagian dari kategori Indonesia Timur dalam pembagian lima kawasan artikel ini.</p>
     <p>Sementara itu, kopi Flores Bajawa dapat memberikan pengalaman yang berbeda lagi. Beberapa lot dikenal melalui kesan kacang, karamel, cokelat, atau buah tropis. Kopi dari Papua, termasuk wilayah Baliem, menambah luasnya cerita kopi dataran tinggi Nusantara. Keragaman ini mengingatkan kita bahwa sebutan Indonesia Timur tidak bisa disederhanakan menjadi satu profil rasa atau satu cara pengolahan.</p>
     <div class="journal-taste-card"><div class="journal-taste-icon">✳</div><div><strong>What to look for in the cup</strong><p>Jangan hanya mencari satu rasa khas. Pada Toraja, perhatikan kompleksitas dan keseimbangan; pada Kintamani, cermati kesegaran dan kesan citrus jika muncul; pada Bajawa, eksplorasi nuansa manis, kacang, atau cokelat. Bandingkan setiap lot secara terpisah dan catat pengalamanmu sendiri.</p></div></div>
     <p><strong>Cocok untuk siapa?</strong> Kawasan ini menarik bagi penikmat yang senang mencoba kopi dengan identitas daerah yang kuat dan profil yang beragam. Pilih satu origin terlebih dahulu, cari informasi proses dan varietasnya, lalu nikmati tanpa terburu-buru membandingkannya dengan kopi dari pulau lain.</p>
    </section>

    <section class="journal-article-section">
     <div class="journal-section-heading"><span>06</span><div><span class="eyebrow">A SIMPLE TASTING GUIDE</span><h3>How to Explore the Differences at Home</h3></div></div>
     <p>Mencoba lima kawasan kopi sekaligus bisa terasa seperti perjalanan kecil tanpa harus meninggalkan rumah. Agar perbandingan terasa adil, siapkan kopi dengan tingkat roasting yang relatif sebanding, gunakan metode seduh yang sama, dan jaga rasio kopi terhadap air tetap konsisten. Dengan begitu, kamu dapat lebih mudah melihat perbedaan dari origin dan lot, bukan semata-mata dari teknik seduh.</p>
     <ol class="journal-number-list">
      <li><strong>Mulai dari aroma kering.</strong> Cium bubuk kopi sebelum diseduh. Catat kesan awal seperti cokelat, kacang, herbal, bunga, rempah, atau buah.</li>
      <li><strong>Gunakan metode yang sama.</strong> Seduh setiap kopi dengan brewer, rasio air, suhu, dan waktu yang sedekat mungkin. Jika menggunakan V60, pertahankan resep dasar lalu lakukan penyesuaian kecil hanya jika diperlukan.</li>
      <li><strong>Cicipi pada beberapa suhu.</strong> Saat kopi panas, aroma mungkin terasa dominan. Ketika mulai hangat, rasa manis, keasaman, dan body sering lebih mudah dikenali.</li>
      <li><strong>Tulis kesanmu sendiri.</strong> Tidak perlu langsung memakai istilah profesional. Catatan seperti “terasa seperti jeruk”, “lebih tebal”, atau “ada kesan rempah” sudah cukup untuk membangun preferensi pribadi.</li>
      <li><strong>Ulangi dengan proses berbeda.</strong> Jika tersedia, bandingkan washed dan natural dari daerah yang sama. Ini membantu memisahkan pengaruh origin dari pengaruh proses.</li>
     </ol>
     <figure class="journal-inline-figure journal-inline-wide"><img src="assets/photos/journal/brew-guide-hero.webp" alt="Proses menyeduh kopi menggunakan dripper pour-over" loading="lazy"><figcaption>Gunakan resep seduh yang konsisten agar perbedaan antar-origin lebih mudah diamati.</figcaption></figure>
    </section>

    <section class="journal-article-section">
     <div class="journal-section-heading"><span>07</span><div><span class="eyebrow">CHOOSING YOUR NEXT CUP</span><h3>Which Indonesian Origin Should You Try First?</h3></div></div>
     <div class="journal-table-wrap" role="region" aria-label="Ringkasan lima kawasan kopi Indonesia" tabindex="0">
      <table class="journal-comparison-table">
       <thead><tr><th>Region</th><th>Names to explore</th><th>Starting flavour cues</th><th>Try it if you enjoy</th></tr></thead>
       <tbody>
        <tr><th>Sumatera</th><td>Gayo, Mandheling, Lintong</td><td>Earthy, cocoa, herbal, spice</td><td>Body penuh dan rasa mendalam</td></tr>
        <tr><th>Jawa Barat</th><td>Java Preanger, Pangalengan</td><td>Fruit, citrus, floral, sweet</td><td>Kejernihan dan eksplorasi rasa</td></tr>
        <tr><th>Jawa Tengah</th><td>Sindoro-Sumbing, Temanggung, Dieng</td><td>Sweet, nutty, warm spice</td><td>Kopi harian yang seimbang</td></tr>
        <tr><th>Jawa Timur</th><td>Ijen-Raung, Argopuro</td><td>Spice, chocolate, clean acidity</td><td>Karakter tegas namun rapi</td></tr>
        <tr><th>Indonesia Timur</th><td>Toraja, Flores Bajawa, Baliem Wamena</td><td>Complex, cocoa, spice, tropical fruit</td><td>Keragaman origin dan karakter</td></tr>
       </tbody>
      </table>
     </div>
     <p class="journal-table-note">Tabel ini adalah panduan awal, bukan standar rasa resmi. Kintamani di Bali juga patut dicoba sebagai origin lintas-kepulauan. Tasting notes dapat berbeda antar-kebun, varietas, musim panen, proses pascapanen, tingkat roasting, dan resep seduh.</p>
    </section>

    <section class="journal-conclusion">
     <span class="eyebrow">THE TAKEAWAY</span>
     <h3>Five regions. Countless stories in every cup.</h3>
     <p>Sumatera, Jawa Barat, Jawa Tengah, Jawa Timur, dan Indonesia Timur memperlihatkan betapa luasnya karakter kopi Indonesia. Dari body yang terasa penuh hingga cangkir yang cerah dan ekspresif, setiap kawasan menawarkan pintu masuk yang berbeda untuk mengenal petani, lanskap, dan proses di balik biji kopi.</p>
     <p>Tidak ada satu origin yang harus menjadi favorit semua orang. Mulailah dari rasa yang kamu sukai, cobalah daerah yang belum pernah kamu kenal, lalu biarkan pengalamanmu berkembang dari satu cangkir ke cangkir berikutnya. Sebab menjelajahi kopi Nusantara bukan sekadar mencari rasa terbaik, melainkan menemukan cerita yang ingin kamu bawa pulang.</p>
    </section>

    <div class="journal-sources"><span class="eyebrow">SOURCES & FURTHER READING</span><a href="https://gaeki.or.id/en/areal-dan-produksi/" target="_blank" rel="noopener">Indonesia Coffee Exporters Association (GAEKI/ICEA) · Coffee Production & Geographical Indications ↗</a><a href="https://ajcep.asean.org/wp-content/uploads/2021/01/GEOGRAPHICAL-INDICATIONS-IN-THE-ASEAN-REGION.pdf" target="_blank" rel="noopener">ASEAN / EUIPO · Geographical Indications in the ASEAN Region — Gayo Arabica Coffee ↗</a><a href="https://gaeki.or.id/wp-content/uploads/2013/09/Brosur-Kopi-Specialti-A4-tanpa-background.pdf" target="_blank" rel="noopener">GAEKI · The Characteristic of Indonesian Arabica Specialty Coffee ↗</a><a href="https://kemlu.go.id/files/repositori/56577/Indoinvites%20I.pdf" target="_blank" rel="noopener">Ministry of Foreign Affairs of Indonesia · Indonesia Invites: Exotic & Unique Indonesian Coffee ↗</a></div>
   </div>

   <div class="journal-related">
    <div class="journal-related-heading"><span class="eyebrow">KEEP EXPLORING</span><h3>More from the Journal.</h3></div>
    <button type="button" class="journal-related-card" onclick="openJournal('natural-washed')"><img src="assets/photos/journal/article-natural-washed/coffee-cherries-hero.webp" alt="Buah kopi merah di antara daun hijau" loading="lazy"><span><small>COFFEE 101</small><b>Natural vs Washed: What’s the Difference?</b><em>READ STORY →</em></span></button>
    <button type="button" class="journal-related-card" onclick="openJournal('brew-guide')"><img src="assets/photos/journal/brew-guide-hero.webp" alt="Kopi diseduh dengan dripper" loading="lazy"><span><small>BREWING GUIDE</small><b>Finding the Right Brew for Your Bean</b><em>READ STORY →</em></span></button>
   </div>
  </article>`;
}

function brewGuideArticleMarkup(){
 return `
  <article class="journal-article journal-brew-article">
   <figure class="journal-cover journal-brew-cover">
    <img src="assets/photos/journal/brew-guide-hero.webp" alt="Seduhan pour-over V60 dengan ketel leher angsa, carafe kaca, dan biji kopi di meja kayu" fetchpriority="high" onerror="this.onerror=null;this.src='assets/photos/journal/v52-brew-guide.jpg'">
    <figcaption>Metode seduh yang tepat bukan untuk mengubah asal biji, melainkan membantu karakter alaminya tampil lebih jelas.</figcaption>
   </figure>
   <h2 class="journal-article-headline">Finding the Right Brew for Your Bean</h2>
   <div class="journal-byline"><span class="journal-author-mark">K</span><strong>Kenangan Coffee Editorial</strong><span class="journal-byline-divider">·</span><time datetime="2026-11-20">20 November 2026</time><span class="journal-byline-divider">·</span><span>6 min read</span></div>
   <p class="journal-standfirst">Setiap biji kopi menyimpan karakter yang unik. Dengan metode seduh yang tepat, kamu bisa menonjolkan kejernihan rasa, aroma buah, body yang penuh, atau manis yang lembut. Temukan cara menyeduh yang paling sesuai dengan kopi pilihanmu.</p>

   <div class="journal-article-copy">
    <p>Kopi yang sama bisa terasa sangat berbeda ketika diseduh dengan metode yang berbeda. Satu biji Arabika yang diseduh menggunakan V60 mungkin menampilkan aroma floral dan keasaman yang segar, sementara ketika dibuat dengan French Press, cangkirnya dapat terasa lebih tebal dan teksturnya lebih nyata. Bukan berarti salah satu hasil lebih baik. Keduanya hanya menonjolkan sisi yang berbeda dari kopi yang sama.</p>
    <p>Itulah alasan memilih alat seduh sebaiknya dimulai dari pertanyaan sederhana: <strong>rasa seperti apa yang ingin kamu nikmati?</strong> Apakah kamu ingin mengenali detail rasa dari suatu origin, mencari cangkir yang nyaman dan berisi, atau membuat espresso pekat sebagai dasar minuman susu? Setelah tujuan itu jelas, pilihan metode akan terasa jauh lebih mudah.</p>

    <div class="journal-brew-quote"><span aria-hidden="true">“</span><p>Tidak ada satu metode seduh yang paling benar untuk semua kopi. Metode terbaik adalah metode yang membantu kamu menikmati karakter biji yang sedang ada di tanganmu.</p></div>

    <section class="journal-article-section" id="brew-bean-character">
     <div class="journal-section-heading"><span>01</span><div><span class="eyebrow">COFFEE FUNDAMENTALS</span><h3>Kenali Karakter Biji Kopimu</h3></div></div>
     <p>Sebelum memilih alat seduh, luangkan waktu untuk mengenali biji kopi yang akan digunakan. Informasi pada kemasan dapat memberi petunjuk awal, tetapi pengalaman mencicipi tetap menjadi panduan utama. Perhatikan empat hal berikut.</p>
     <div class="journal-brew-profile-grid">
      <div class="journal-brew-profile"><span class="journal-brew-profile-icon">◈</span><b>Origin & varietas</b><p>Asal kebun, varietas, ketinggian, dan lingkungan tumbuh dapat memengaruhi karakter rasa. Catatan fruity, floral, earthy, atau spicy adalah petunjuk sensori, bukan jaminan untuk setiap lot.</p></div>
      <div class="journal-brew-profile"><span class="journal-brew-profile-icon">◐</span><b>Proses pascapanen</b><p>Natural, washed, honey, dan wet-hulled dapat menghasilkan pengalaman yang berbeda. Pelajari prosesnya agar kamu punya gambaran tentang karakter yang mungkin muncul.</p></div>
      <div class="journal-brew-profile"><span class="journal-brew-profile-icon">◒</span><b>Tingkat sangrai</b><p>Light roast sering dipilih ketika ingin mengeksplorasi karakter origin dan detail rasa. Medium memberi ruang untuk keseimbangan, sedangkan dark roast cenderung menonjolkan rasa sangrai, cokelat, dan body.</p></div>
      <div class="journal-brew-profile"><span class="journal-brew-profile-icon">◉</span><b>Kesegaran & penyimpanan</b><p>Simpan biji dalam wadah tertutup, jauh dari panas, cahaya, udara berlebih, dan kelembapan. Giling sesaat sebelum menyeduh untuk membantu menjaga aroma.</p></div>
     </div>
     <figure class="journal-inline-figure journal-inline-wide">
      <img src="assets/photos/journal/v52-brew-guide.jpg" alt="Perangkat pour-over, biji kopi, dan carafe untuk menyeduh kopi secara manual" loading="lazy">
      <figcaption>Mulailah dengan mengenali biji dan menyiapkan alat yang bersih. Konsistensi kecil membuat proses eksplorasi lebih menyenangkan.</figcaption>
     </figure>
    </section>

    <section class="journal-article-section" id="brew-methods">
     <div class="journal-section-heading"><span>02</span><div><span class="eyebrow">BREWING METHODS</span><h3>Lima Metode Seduh dan Karakter Rasanya</h3></div></div>
     <p>Setiap alat bekerja dengan cara yang berbeda. Ada yang membiarkan air mengalir melewati bubuk kopi, ada yang merendam kopi di dalam air, dan ada pula yang menggunakan tekanan. Perbedaan cara ekstraksi ini memengaruhi kejernihan, tekstur, intensitas, serta rasa akhir.</p>
     <div class="journal-brew-method-grid">
      <article class="journal-brew-method-card"><div class="journal-brew-method-icon">◒</div><span class="eyebrow">FILTER · POUR OVER</span><h4>V60 / Kalita</h4><p>Air mengalir melewati bubuk kopi dan filter kertas. Hasilnya sering terasa bersih, dengan detail aroma dan rasa yang lebih mudah dikenali.</p><small>Cocok untuk: fruity, floral, dan kopi yang ingin dieksplorasi asalnya.</small></article>
      <article class="journal-brew-method-card"><div class="journal-brew-method-icon">▤</div><span class="eyebrow">IMMERSION</span><h4>French Press</h4><p>Bubuk kopi direndam bersama air sebelum dipisahkan dengan saringan logam. Minyak kopi dan partikel halus lebih banyak tertinggal dalam cangkir, sehingga body terasa penuh.</p><small>Cocok untuk: cokelat, kacang, rempah, dan penikmat tekstur tebal.</small></article>
      <article class="journal-brew-method-card"><div class="journal-brew-method-icon">◍</div><span class="eyebrow">IMMERSION + PRESSURE</span><h4>AeroPress</h4><p>Air dan kopi direndam singkat, lalu didorong melewati filter menggunakan tekanan manual. Metode ini fleksibel dan mudah disesuaikan dengan resep pribadi.</p><small>Cocok untuk: eksperimen resep, cangkir seimbang, dan seduhan praktis.</small></article>
      <article class="journal-brew-method-card"><div class="journal-brew-method-icon">◉</div><span class="eyebrow">PRESSURE BREW</span><h4>Espresso</h4><p>Air panas dialirkan melalui kopi yang digiling halus dengan tekanan mesin. Hasilnya pekat dan terkonsentrasi, sering menjadi dasar espresso-based drinks.</p><small>Cocok untuk: rasa intens, cokelat, karamel, dan minuman berbasis susu.</small></article>
      <article class="journal-brew-method-card"><div class="journal-brew-method-icon">❄</div><span class="eyebrow">COLD EXTRACTION</span><h4>Cold Brew</h4><p>Kopi direndam dalam air bersuhu dingin atau ruang selama beberapa jam, lalu disaring. Seduhan ini dinikmati dingin dan dapat dibuat sebagai konsentrat atau siap minum.</p><small>Cocok untuk: minuman dingin yang lembut dan mudah dipadukan.</small></article>
     </div>
     <p class="journal-table-note">Catatan: deskripsi rasa di atas merupakan kecenderungan umum, bukan hasil yang pasti. Jenis biji, rasio, gilingan, suhu, durasi, filter, dan teknik seduh dapat mengubah hasil akhir.</p>
    </section>

    <section class="journal-article-section" id="brew-variables">
     <div class="journal-section-heading"><span>03</span><div><span class="eyebrow">THE BREWING VARIABLES</span><h3>Empat Kunci untuk Mengatur Hasil Seduhan</h3></div></div>
     <p>Alat seduh hanya satu bagian dari proses. Untuk mendapatkan hasil yang konsisten, perhatikan empat variabel yang paling mudah kamu kendalikan: ukuran gilingan, rasio kopi dan air, suhu air, serta waktu kontak. Ubah satu variabel pada satu waktu agar kamu tahu perubahan mana yang membuat rasa menjadi lebih baik.</p>
     <div class="journal-brew-variable-grid">
      <div><b>01 · Ukuran gilingan</b><p>Gilingan lebih halus memperbesar luas permukaan kopi dan umumnya mempercepat ekstraksi. Gilingan lebih kasar memperlambatnya. Sesuaikan dengan alat dan waktu seduh.</p></div>
      <div><b>02 · Rasio kopi dan air</b><p>Rasio menentukan seberapa pekat minuman. Sebagai titik awal untuk filter coffee, coba sekitar 1:15–1:17, lalu sesuaikan dengan selera dan jenis biji.</p></div>
      <div><b>03 · Suhu air</b><p>Air yang lebih panas dapat membantu ekstraksi, tetapi suhu yang tepat juga dipengaruhi sangrai dan karakter kopi. Untuk filter, 92–96°C merupakan rentang awal yang banyak digunakan.</p></div>
      <div><b>04 · Waktu kontak</b><p>Waktu terlalu singkat dapat menghasilkan cangkir tipis atau asam tajam; terlalu lama bisa meningkatkan rasa pahit atau kering. Perhatikan aliran air dan ukuran gilingan.</p></div>
     </div>
     <div class="journal-brew-highlight"><strong>Mulai dari resep sederhana</strong><p>Untuk V60, panduan Hario menggunakan 15 gram kopi dan 250 ml air, gilingan medium hingga medium-fine, suhu sekitar 92–96°C, serta waktu seduh kurang lebih 2,5 menit. Anggap angka ini sebagai titik awal, bukan formula yang wajib diikuti semua kopi.</p></div>
    </section>

    <section class="journal-article-section" id="brew-recommendations">
     <div class="journal-section-heading"><span>04</span><div><span class="eyebrow">MATCH BEAN & BREWER</span><h3>Memilih Metode Berdasarkan Karakter Kopi</h3></div></div>
     <p>Setelah memahami metode dan variabelnya, kamu bisa mulai mencocokkan kopi dengan alat seduh. Rekomendasi ini bukan batasan. Justru menarik untuk mencoba satu biji menggunakan dua metode berbeda dan mencatat apa yang berubah.</p>
     <div class="journal-table-wrap"><table class="journal-comparison-table journal-brew-table"><thead><tr><th>Karakter yang ingin ditonjolkan</th><th>Metode yang bisa dicoba</th><th>Hal yang perlu diperhatikan</th></tr></thead><tbody>
      <tr><th>Fruity & floral</th><td>V60, Kalita, AeroPress</td><td>Mulai dengan filter paper dan rasio konsisten untuk melihat kejernihan aroma.</td></tr>
      <tr><th>Chocolate & nutty</th><td>French Press, V60, Moka Pot</td><td>Bandingkan body dan rasa manis pada beberapa tingkat gilingan.</td></tr>
      <tr><th>Earthy & full-bodied</th><td>French Press, AeroPress, Espresso</td><td>Perhatikan tekstur, intensitas, dan rasa akhir agar tidak terasa terlalu berat.</td></tr>
      <tr><th>Bright & clean</th><td>V60, Kalita, AeroPress paper filter</td><td>Jaga aliran air dan hindari perubahan resep yang terlalu banyak sekaligus.</td></tr>
      <tr><th>Dark roast & bold</th><td>Espresso, Moka Pot, French Press</td><td>Coba suhu sedikit lebih rendah atau waktu lebih singkat bila rasa terlalu pahit.</td></tr>
     </tbody></table></div>
     <figure class="journal-inline-figure journal-inline-wide">
      <img src="assets/photos/sections/create-coffee.jpg" alt="Kopi hitam dituangkan ke dalam cangkir di samping biji kopi" loading="lazy">
      <figcaption>Rasa terbaik bukan hanya soal alat, tetapi juga tentang resep yang sesuai dengan biji dan preferensimu.</figcaption>
     </figure>
    </section>

    <section class="journal-article-section" id="brew-recipes">
     <div class="journal-section-heading"><span>05</span><div><span class="eyebrow">STARTER RECIPES</span><h3>Resep Awal yang Bisa Kamu Uji di Rumah</h3></div></div>
     <p>Gunakan resep berikut sebagai titik awal. Timbang kopi dan air bila memungkinkan, gunakan air yang bersih, dan catat hasilnya. Jika alat atau ukuran sajianmu berbeda, sesuaikan jumlah bahan sambil mempertahankan rasio.</p>
     <div class="journal-brew-recipe-grid">
      <div class="journal-brew-recipe"><span class="eyebrow">V60 · POUR OVER</span><b>15 g kopi · 250 g air</b><p>Gilingan medium-fine · 92–96°C · sekitar 2,5–3 menit. Basahi seluruh bubuk pada awal seduh dan beri waktu bloom sekitar 30 detik.</p></div>
      <div class="journal-brew-recipe"><span class="eyebrow">FRENCH PRESS</span><b>30 g kopi · 450 g air</b><p>Gilingan kasar · 92–96°C · sekitar 4 menit. Aduk perlahan, tekan plunger dengan lembut, lalu tuangkan kopi agar tidak terus terekstraksi di dalam bejana.</p></div>
      <div class="journal-brew-recipe"><span class="eyebrow">AEROPRESS</span><b>16–18 g kopi per sajian</b><p>Gunakan gilingan medium atau medium-fine. AeroPress memberi ruang untuk bereksperimen; suhu sekitar 85°C dan waktu rendam sekitar 60 detik dapat menjadi awal mengikuti panduan resmi produsennya.</p></div>
      <div class="journal-brew-recipe"><span class="eyebrow">ESPRESSO</span><b>18–20 g in · sekitar 36–40 g out</b><p>Rasio sekitar 1:2 dan waktu ekstraksi 25–30 detik sering dipakai sebagai titik awal. Hasilnya tetap perlu disesuaikan dengan mesin, basket, kopi, dan rasa yang kamu cari.</p></div>
     </div>
     <p class="journal-table-note">Resep espresso di atas merangkum praktik rata-rata yang dilaporkan dalam artikel Specialty Coffee Association; bukan standar tunggal untuk setiap mesin atau biji.</p>
    </section>

    <section class="journal-article-section" id="brew-troubleshooting">
     <div class="journal-section-heading"><span>06</span><div><span class="eyebrow">TROUBLESHOOT YOUR CUP</span><h3>Jika Rasanya Belum Pas, Apa yang Harus Diubah?</h3></div></div>
     <p>Jangan buru-buru mengganti biji kopi ketika hasil seduhan belum sesuai harapan. Coba kenali rasa yang muncul, kemudian ubah satu variabel pada satu waktu.</p>
     <div class="journal-brew-fix-grid">
      <div><b>Asam tajam, tipis, atau terasa belum matang</b><p>Periksa apakah air mengalir terlalu cepat. Coba giling sedikit lebih halus, naikkan suhu secara bertahap, atau tambah waktu kontak.</p></div>
      <div><b>Pahit berlebihan atau terasa kering</b><p>Coba gilingan sedikit lebih kasar, waktu seduh lebih singkat, atau suhu sedikit lebih rendah. Pastikan juga kopi tidak tertinggal terlalu lama dalam French Press.</p></div>
      <div><b>Terlalu encer atau kurang intens</b><p>Periksa rasio. Kamu dapat menambah dosis kopi atau mengurangi air sedikit demi sedikit sambil menjaga cara seduh tetap konsisten.</p></div>
      <div><b>Terlalu pekat atau berat</b><p>Tambahkan air atau kurangi dosis kopi. Untuk espresso, evaluasi rasio hasil seduhan dan sesuaikan dengan gaya minuman yang ingin dibuat.</p></div>
     </div>
    </section>

    <section class="journal-article-section" id="brew-home-routine">
     <div class="journal-section-heading"><span>07</span><div><span class="eyebrow">A SIMPLE HOME ROUTINE</span><h3>Bangun Ritual Seduh yang Konsisten</h3></div></div>
     <ol class="journal-number-list">
      <li><strong>Siapkan alat dan air bersih.</strong> Pastikan brewer, server, dan cangkir tidak menyimpan aroma sisa seduhan sebelumnya.</li>
      <li><strong>Timbang biji kopi.</strong> Mulailah dengan dosis yang sama setiap kali agar perubahan rasa lebih mudah diamati.</li>
      <li><strong>Giling sesaat sebelum menyeduh.</strong> Gunakan ukuran yang sesuai dengan alat, lalu ratakan bubuk kopi sebelum air dituangkan.</li>
      <li><strong>Catat waktu dan jumlah air.</strong> Gunakan timer dan timbangan. Untuk pour-over, basahi bubuk secara merata dan tuangkan dengan aliran stabil.</li>
      <li><strong>Cicipi saat suhu berubah.</strong> Aroma dan rasa dapat terasa berbeda ketika kopi mulai mendingin. Catat manis, asam, body, aroma, dan aftertaste yang kamu temukan.</li>
      <li><strong>Ubah satu hal pada percobaan berikutnya.</strong> Misalnya, giling sedikit lebih halus tanpa mengubah dosis, suhu, dan teknik tuang pada saat yang sama.</li>
     </ol>
    </section>

    <div class="journal-conclusion"><span class="eyebrow">THE KENANGAN NOTE</span><h3>Metode Terbaik adalah yang Membuatmu Menikmati Kopi.</h3><p>V60 dapat membantu kamu mengenali detail, French Press menawarkan body yang lebih penuh, AeroPress membuka ruang eksperimen, sedangkan espresso menghadirkan intensitas dalam sajian kecil. Tidak ada metode yang harus dipilih hanya karena sedang populer.</p><p>Mulailah dari karakter biji, tentukan rasa yang kamu cari, lalu bereksperimen secara bertahap. Setiap seduhan adalah kesempatan untuk memahami kopi sedikit lebih dekat — dari kebun tempat ia tumbuh sampai cangkir yang kamu nikmati.</p></div>

    <div class="journal-sources"><span class="eyebrow">FURTHER READING & BREWING REFERENCES</span>
     <a href="https://www.hario.co.uk/pages/brew-guides-v60-expert" target="_blank" rel="noopener">Hario UK · Expert V60 Brew Guide ↗</a>
     <a href="https://bodumuk.com/brew-guide/" target="_blank" rel="noopener">Bodum · French Press Brew Guide ↗</a>
     <a href="https://aeropress.com/pages/how-to-use" target="_blank" rel="noopener">AeroPress · Official How to Use Guide ↗</a>
     <a href="https://sca.coffee/sca-news/25-magazine/issue-3/defining-ever-changing-espresso-25-magazine-issue-3-zyx36" target="_blank" rel="noopener">Specialty Coffee Association · Defining the Ever-Changing Espresso ↗</a>
    </div>
    <div class="journal-related">
     <div class="journal-related-heading"><span class="eyebrow">KEEP EXPLORING</span><h3>More from the Journal.</h3></div>
     <button type="button" class="journal-related-card" onclick="openJournal('natural-washed')"><img src="assets/photos/journal/article-natural-washed/coffee-cherries-hero.webp" alt="Buah kopi merah dan proses pengolahan kopi" loading="lazy"><span><small>COFFEE 101</small><b>Natural vs Washed: What’s the Difference?</b><em>READ STORY →</em></span></button>
     <button type="button" class="journal-related-card" onclick="openJournal('five-origins')"><img src="assets/photos/journal/indonesian-coffee-origins-hero.webp" alt="Lanskap dataran tinggi kopi Indonesia" loading="lazy"><span><small>ORIGIN STORIES</small><b>Five Indonesian Coffee Origins You Should Try</b><em>READ STORY →</em></span></button>
    </div>
   </div>
  </article>`;
}

function roastArticleMarkup(){
 return `
  <article class="journal-article journal-roast-article">
   <figure class="journal-cover journal-roast-cover">
    <img src="assets/photos/journal/roasting-hero.webp" alt="Biji kopi sangrai keluar dari mesin drum roaster menuju cooling tray" fetchpriority="high" onerror="this.onerror=null;this.src='assets/photos/journal/v52-brew-guide.jpg'">
    <figcaption>Roasting mengubah green coffee menjadi biji yang siap digiling dan diseduh — sekaligus membentuk aroma serta karakter rasa.</figcaption>
   </figure>
   <h2 class="journal-article-headline">The Art of Roasting: How Roast Level Shapes Your Coffee’s Flavor</h2>
   <div class="journal-byline"><span class="journal-author-mark">K</span><strong>Kenangan Coffee Editorial</strong><span class="journal-byline-divider">·</span><time datetime="2026-11-26">26 November 2026</time><span class="journal-byline-divider">·</span><span>10 min read</span></div>
   <p class="journal-standfirst">Dari biji hijau hingga menjadi secangkir kopi yang penuh karakter. Kenali seni sangrai dan bagaimana setiap tingkat roasting membentuk pengalaman rasa yang berbeda.</p>

   <div class="journal-article-copy">
    <div class="journal-roast-intro">
     <h3>More Than Just Roasting Beans</h3>
     <p>Pernahkah kamu bertanya-tanya mengapa dua cangkir kopi dapat menghadirkan aroma, rasa, dan karakter yang begitu berbeda? Salah satu jawabannya terletak pada proses penting yang sering kali tidak terlihat oleh penikmat kopi: <em>coffee roasting</em>. Di balik perubahan warna biji, ada rangkaian perubahan fisik dan kimia yang membantu membentuk identitas setiap cangkir.</p>
    </div>
    <figure class="journal-inline-figure journal-roast-cherry-banner">
     <img src="assets/photos/journal/roast-cherries.webp" alt="Buah kopi matang berwarna merah di antara daun hijau pada perkebunan dataran tinggi" loading="lazy" onerror="this.onerror=null;this.src='assets/photos/journal/article-natural-washed/coffee-cherries-hero.webp'">
     <figcaption>Perjalanan roasting dimulai jauh sebelum biji masuk mesin — dari buah kopi yang dipanen dan diproses dengan cermat.</figcaption>
    </figure>

    <section class="journal-article-section" id="roast-green-beans">
     <div class="journal-section-heading"><span>01</span><div><span class="eyebrow">BEFORE THE ROAST</span><h3>The Journey of Green Coffee Beans</h3></div></div>
     <div class="journal-roast-media-row">
      <div>
       <p>Sebelum disangrai, kopi hadir sebagai <strong>green coffee beans</strong> — biji kopi mentah yang telah dipisahkan dari buah dan dikeringkan melalui proses pascapanen. Biji ini belum memiliki aroma khas seperti kopi seduh yang biasa kita kenal. Potensi rasanya masih dipengaruhi oleh asal kebun, varietas, tingkat kematangan saat panen, dan metode pengolahan.</p>
       <p>Setelah buah kopi dipanen, produsen dapat menggunakan proses Natural, Washed, Honey, atau metode lain yang sesuai dengan karakter lot dan kondisi setempat. Biji kemudian dikeringkan, disortir, dan disimpan sebelum memasuki tahap roasting. Setiap keputusan di tahap awal ini memberi konteks bagi roaster saat menyusun profil sangrai.</p>
      </div>
      <figure class="journal-inline-figure"><img src="assets/photos/journal/green-coffee-beans.webp" alt="Biji kopi hijau atau green coffee beans di dalam karung goni" loading="lazy" onerror="this.onerror=null;this.src='assets/photos/journal/roast-cherries.webp'"><figcaption>Green coffee beans menjadi bahan awal yang akan dikembangkan melalui panas.</figcaption></figure>
     </div>
     <div class="journal-roast-note"><strong>What the roaster looks at</strong><p>Origin, varietas, proses pascapanen, ukuran, kepadatan, dan kadar air membantu roaster memahami bahan baku. Tidak ada satu profil sangrai yang otomatis cocok untuk semua biji.</p></div>
    </section>

    <section class="journal-article-section" id="roast-process">
     <div class="journal-section-heading"><span>02</span><div><span class="eyebrow">INSIDE THE ROASTING MACHINE</span><h3>Understanding the Roasting Process</h3></div></div>
     <p>Roasting adalah proses pemanasan terkontrol. Selama biji menerima panas, kandungan air berkurang, warna berubah, struktur mengembang, dan reaksi kimia membentuk senyawa aroma serta rasa. Detail suhu dan durasi bergantung pada mesin, ukuran batch, karakter green coffee, dan profil yang dituju; karena itu, tahapan berikut adalah gambaran umum, bukan resep angka yang berlaku untuk semua roaster.</p>
     <figure class="journal-inline-figure journal-roast-process-image"><img src="assets/photos/journal/roasting-drum-detail.webp" alt="Biji kopi bergerak di dalam drum mesin roasting" loading="lazy" onerror="this.onerror=null;this.src='assets/photos/journal/roasting-hero.webp'"><figcaption>Drum yang berputar membantu menggerakkan biji agar menerima panas secara lebih merata.</figcaption></figure>
     <div class="journal-roast-stage-grid" aria-label="Tahapan umum roasting kopi">
      <div><span>01</span><b>Drying Phase</b><small>Mengurangi kadar air dan mengubah warna biji dari hijau menuju kuning.</small></div>
      <div><span>02</span><b>Browning Phase</b><small>Reaksi pencokelatan, termasuk Maillard reaction, membantu membangun warna dan aroma.</small></div>
      <div><span>03</span><b>First Crack</b><small>Letupan yang terdengar saat struktur biji mengembang dan tekanan di dalamnya meningkat.</small></div>
      <div><span>04</span><b>Development</b><small>Roaster mengatur perkembangan rasa setelah first crack hingga titik akhir sangrai.</small></div>
      <div><span>05</span><b>Cooling</b><small>Biji segera didinginkan untuk menghentikan perkembangan panas lebih lanjut.</small></div>
     </div>
     <p><strong>First crack</strong> sering menjadi momen penting yang dikenali melalui suara letupan kecil. Namun, proses tidak selalu berhenti saat suara pertama terdengar. Roaster mengevaluasi warna, aroma, data waktu dan suhu, serta tujuan rasa sebelum menentukan kapan biji dikeluarkan dari mesin. Setelah itu, pendinginan yang cepat membantu menjaga titik sangrai yang sudah dipilih.</p>
     <div class="journal-roast-note"><strong>A small detail that matters</strong><p>Waktu setelah first crack sering disebut <em>development time</em>. Perubahan singkat pada tahap ini dapat memengaruhi karakter akhir, sehingga roaster mengamati keseluruhan profil — bukan hanya satu angka atau satu suara.</p></div>
    </section>

    <section class="journal-article-section" id="roast-levels">
     <div class="journal-section-heading"><span>03</span><div><span class="eyebrow">THREE ROAST EXPRESSIONS</span><h3>Light, Medium, and Dark Roast</h3></div></div>
     <p>Istilah Light, Medium, dan Dark Roast membantu kita membayangkan tingkat perkembangan sangrai. Kategori ini bukan ukuran kualitas. Masing-masing dapat menghasilkan kopi yang menarik ketika profilnya sesuai dengan karakter biji dan tujuan roaster.</p>
     <div class="journal-roast-level-grid">
      <article class="journal-roast-level-card journal-roast-light"><span class="journal-roast-bean" aria-hidden="true"></span><span class="eyebrow">LIGHT ROAST</span><h4>Bringing Out the Origin</h4><p>Biasanya menampilkan warna lebih terang, karakter asal yang lebih mudah dikenali, serta kesan floral, fruity, atau citrus pada lot tertentu.</p><ul><li>Acidity dapat terasa lebih menonjol.</li><li>Body sering terasa lebih ringan.</li><li>Cocok untuk eksplorasi detail rasa.</li></ul></article>
      <article class="journal-roast-level-card journal-roast-medium"><span class="journal-roast-bean" aria-hidden="true"></span><span class="eyebrow">MEDIUM ROAST</span><h4>Finding the Balance</h4><p>Menawarkan titik tengah antara karakter origin dan rasa hasil sangrai, dengan kemungkinan munculnya kesan manis, cokelat, karamel, atau kacang.</p><ul><li>Rasa dapat terasa lebih seimbang.</li><li>Body sering berada di tingkat sedang.</li><li>Fleksibel untuk berbagai metode seduh.</li></ul></article>
      <article class="journal-roast-level-card journal-roast-dark"><span class="journal-roast-bean" aria-hidden="true"></span><span class="eyebrow">DARK ROAST</span><h4>Bold, Deep and Intense</h4><p>Karakter sangrai lebih dominan, dengan kesan roasted, dark chocolate, karamel gelap, atau bittersweet pada beberapa profil.</p><ul><li>Acidity sering terasa lebih rendah.</li><li>Body dapat terasa lebih penuh.</li><li>Perlu dijaga agar tidak menjadi pahit berlebihan.</li></ul></article>
     </div>
     <div class="journal-table-wrap" role="region" aria-label="Perbandingan tingkat sangrai kopi" tabindex="0">
      <table class="journal-comparison-table journal-roast-comparison">
       <thead><tr><th>Aspek</th><th>Light Roast</th><th>Medium Roast</th><th>Dark Roast</th></tr></thead>
       <tbody>
        <tr><th>Warna biji</th><td>Cokelat lebih terang</td><td>Cokelat sedang</td><td>Cokelat gelap</td></tr>
        <tr><th>Karakter aroma</th><td>Sering floral atau fruity</td><td>Manis, cokelat, nutty</td><td>Roasted, karamel gelap</td></tr>
        <tr><th>Acidity</th><td>Dapat terasa lebih jelas</td><td>Cenderung seimbang</td><td>Sering terasa lebih rendah</td></tr>
        <tr><th>Body</th><td>Sering lebih ringan</td><td>Sedang hingga penuh</td><td>Dapat terasa lebih penuh</td></tr>
        <tr><th>Karakter umum</th><td>Origin-forward</td><td>Balanced</td><td>Roast-forward</td></tr>
       </tbody>
      </table>
     </div>
     <p class="journal-table-note">Perbandingan ini bersifat umum. Hasil dapat berubah menurut biji, profil sangrai, ukuran gilingan, dan metode ekstraksi.</p>
    </section>

    <section class="journal-article-section" id="roast-flavour">
     <div class="journal-section-heading"><span>04</span><div><span class="eyebrow">WHAT CHANGES IN THE CUP?</span><h3>How Roasting Shapes Coffee Flavor</h3></div></div>
     <p>Roasting memengaruhi lebih dari sekadar warna. Panas mengubah komposisi kimia dan struktur biji sehingga dapat memengaruhi aroma, rasa, tekstur, dan bagaimana kopi diekstraksi ketika diseduh. Lima aspek berikut dapat menjadi panduan saat kamu mencicipi kopi.</p>
     <div class="journal-roast-flavour-grid">
      <div><span>01</span><b>Acidity</b><p>Kesan cerah atau segar yang dapat mengingatkan pada citrus, apel, atau buah beri. Profil sangrai yang lebih berkembang sering mengubah bagaimana keasaman dirasakan.</p></div>
      <div><span>02</span><b>Sweetness</b><p>Persepsi manis dapat muncul sebagai kesan madu, gula merah, karamel, atau buah. Manis bukan berarti ada gula tambahan di dalam kopi.</p></div>
      <div><span>03</span><b>Body</b><p>Sensasi tekstur ketika kopi berada di mulut. Tingkat sangrai, jenis biji, dan metode seduh sama-sama dapat memengaruhinya.</p></div>
      <div><span>04</span><b>Aroma</b><p>Senyawa volatil yang terbentuk selama pemanasan menghasilkan aroma yang beragam, dari floral dan buah hingga cokelat dan roasted.</p></div>
      <div><span>05</span><b>Aftertaste</b><p>Rasa yang tertinggal setelah kopi ditelan. Perhatikan apakah kesannya bersih, manis, cokelat, kering, atau terlalu pahit.</p></div>
     </div>
     <p>Hal penting yang perlu diingat: tingkat sangrai tidak bekerja sendirian. Bahan baku dan profil waktu–suhu berinteraksi satu sama lain. Dua kopi yang sama-sama disebut Medium Roast belum tentu memiliki rasa yang sama, dan dua batch dari biji yang sama pun dapat berbeda jika profil sangrainya berubah.</p>
    </section>

    <section class="journal-article-section" id="roast-your-preference">
     <div class="journal-section-heading"><span>05</span><div><span class="eyebrow">FIND YOUR PREFERENCE</span><h3>Finding Your Perfect Roast</h3></div></div>
     <p>Tidak ada satu roast level yang paling baik untuk semua orang. Pilihan terbaik adalah kopi yang sesuai dengan rasa yang kamu sukai, cara kamu menyeduhnya, dan pengalaman yang ingin kamu dapatkan.</p>
     <div class="journal-roast-preference-grid">
      <div><b>Mulai dari Light Roast jika…</b><ul><li>Kamu menyukai kesan fruity, floral, atau citrus.</li><li>Kamu ingin mengeksplorasi karakter origin.</li><li>Kamu menikmati kopi filter dengan rasa yang detail.</li></ul></div>
      <div><b>Coba Medium Roast jika…</b><ul><li>Kamu mencari rasa yang relatif seimbang.</li><li>Kamu menyukai perpaduan manis, cokelat, dan nutty.</li><li>Kamu ingin mencoba beberapa metode seduh.</li></ul></div>
      <div><b>Jelajahi Dark Roast jika…</b><ul><li>Kamu menyukai rasa roasted yang kuat.</li><li>Kamu mencari kesan dark chocolate dan bittersweet.</li><li>Kamu menikmati kopi yang intens atau dipadukan dengan susu.</li></ul></div>
     </div>
     <figure class="journal-inline-figure journal-roast-brew-image"><img src="assets/photos/journal/roast-brewing-cup.webp" alt="Secangkir kopi hasil seduhan dengan biji kopi sangrai di meja kayu" loading="lazy" onerror="this.onerror=null;this.src='assets/photos/journal/v52-brew-guide.jpg'"><figcaption>Bandingkan kopi dengan metode seduh yang sama untuk mengenali perbedaan profil secara lebih adil.</figcaption></figure>
     <h4>Try a simple side-by-side tasting</h4>
     <ol class="journal-number-list">
      <li>Pilih kopi dari origin dan varietas yang sama, jika tersedia, dengan tiga tingkat sangrai berbeda.</li>
      <li>Gunakan dosis, rasio air, suhu, gilingan, dan alat seduh yang dibuat sedekat mungkin.</li>
      <li>Cicipi ketika kopi masih hangat, lalu ulangi saat suhunya turun. Catat aroma, acidity, sweetness, body, dan aftertaste.</li>
      <li>Pilih profil yang paling kamu nikmati. Tidak perlu mencari jawaban yang paling benar — tujuannya mengenali seleramu sendiri.</li>
     </ol>
    </section>

    <section class="journal-article-section" id="roast-freshness">
     <div class="journal-section-heading"><span>06</span><div><span class="eyebrow">AFTER THE ROAST</span><h3>Preserving Coffee Freshness</h3></div></div>
     <p>Setelah keluar dari mesin, biji kopi masih melepaskan gas, terutama karbon dioksida. Proses ini dikenal sebagai <em>degassing</em>. Karena itu, kopi yang baru disangrai terkadang membutuhkan waktu istirahat sebelum menghasilkan seduhan yang terasa lebih stabil. Durasi yang sesuai dapat berbeda menurut roast level, jenis biji, kemasan, dan metode penyeduhan.</p>
     <div class="journal-roast-storage-list">
      <div><span>01</span><p><strong>Simpan rapat.</strong> Gunakan kemasan kedap udara atau wadah khusus kopi yang bersih dan tertutup baik.</p></div>
      <div><span>02</span><p><strong>Jauhkan dari panas dan cahaya.</strong> Letakkan kopi di tempat sejuk, kering, dan tidak terkena sinar matahari langsung.</p></div>
      <div><span>03</span><p><strong>Pilih whole beans.</strong> Biji utuh umumnya lebih lambat kehilangan aroma dibandingkan kopi yang sudah digiling. Giling mendekati waktu seduh.</p></div>
      <div><span>04</span><p><strong>Perhatikan tanggal roasting.</strong> Gunakan tanggal sangrai untuk memahami usia kopi dan merencanakan waktu terbaik untuk menikmatinya.</p></div>
      <div><span>05</span><p><strong>Beli sesuai kebutuhan.</strong> Pilih ukuran kemasan yang realistis untuk kebiasaan minummu agar kopi tidak tersimpan terlalu lama setelah dibuka.</p></div>
     </div>
    </section>

    <section class="journal-conclusion journal-roast-conclusion">
     <span class="eyebrow">THE KENANGAN NOTE</span>
     <h3>Every Roast Has Its Own Character.</h3>
     <p>Light, Medium, dan Dark Roast bukanlah perlombaan untuk menentukan mana yang paling unggul. Ketiganya adalah pendekatan berbeda untuk mengembangkan potensi biji kopi. Dengan mengenali karakter masing-masing, kamu dapat memilih kopi yang terasa paling dekat dengan seleramu.</p>
     <p>Di KENANGAN KOPI NUSANTARA, kami percaya setiap biji memiliki cerita — dari kebun tempat ia tumbuh, proses yang dilalui, hingga keputusan sang roaster. Temukan profil yang kamu sukai, seduh dengan cara yang tepat, dan nikmati perjalanan rasa di setiap cangkir.</p>
     <a class="journal-roast-cta" href="#shop" onclick="closeJournal()">EXPLORE OUR ROASTED BEANS →</a>
    </section>

    <div class="journal-sources"><span class="eyebrow">RESEARCH & FURTHER READING</span>
     <a href="https://www.eeca.govt.nz/assets/EECA-Resources/Co-funding/Sector-Decarb-Files/Technology-Scan-Coffee.pdf" target="_blank" rel="noopener">New Zealand Specialty Coffee Association & EECA · Technology Scan: Coffee Roasting Process (2024) ↗</a>
     <a href="https://pure-oai.bham.ac.uk/ws/portalfiles/portal/134813977/Paper_Coffee_Bean_PEPT_May_21.pdf" target="_blank" rel="noopener">University of Birmingham · Coffee Bean Particle Motion in a Spouted Bed (2021) ↗</a>
     <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11002029/" target="_blank" rel="noopener">The Effect of Roast Profiles on the Dynamics of Titratable Acidity During Coffee Roasting (2024) ↗</a>
    </div>

    <div class="journal-related">
     <div class="journal-related-heading"><span class="eyebrow">KEEP EXPLORING</span><h3>More from the Journal.</h3></div>
     <button type="button" class="journal-related-card" onclick="openJournal('natural-washed')"><img src="assets/photos/journal/article-natural-washed/coffee-cherries-hero.webp" alt="Buah kopi merah di antara daun hijau" loading="lazy"><span><small>COFFEE 101</small><b>Natural vs Washed: What’s the Difference?</b><em>READ STORY →</em></span></button>
     <button type="button" class="journal-related-card" onclick="openJournal('five-origins')"><img src="assets/photos/journal/indonesian-coffee-origins-hero.webp" alt="Lanskap perkebunan kopi Indonesia" loading="lazy"><span><small>ORIGIN STORIES</small><b>Five Indonesian Coffee Origins You Should Try</b><em>READ STORY →</em></span></button>
     <button type="button" class="journal-related-card" onclick="openJournal('brew-guide')"><img src="assets/photos/journal/brew-guide-hero.webp" alt="Kopi diseduh dengan dripper" loading="lazy"><span><small>BREWING GUIDE</small><b>Finding the Right Brew for Your Bean</b><em>READ STORY →</em></span></button>
    </div>
   </div>
  </article>`;
}

function coffeeTastingArticleMarkup(){
 return `
  <article class="journal-article journal-tasting-article">
   <figure class="journal-cover journal-tasting-cover">
    <img src="assets/photos/journal/coffee-tasting-hero.webp" alt="Coffee cupping bowls, roasted beans, tasting notebook, chocolate, nuts, citrus, and flowers arranged on a warm wooden table" fetchpriority="high">
    <figcaption>Every tasting begins with curiosity: pause, smell, sip, and notice the character that unfolds in the cup.</figcaption>
   </figure>
   <h2 class="journal-article-headline">Understanding Coffee Tasting Notes: How to Taste and Describe Coffee</h2>
   <div class="journal-byline"><span class="journal-author-mark">K</span><strong>Kenangan Coffee Editorial</strong><span class="journal-byline-divider">·</span><time datetime="2026-11-26">26 November 2026</time><span class="journal-byline-divider">·</span><span>12 min read</span></div>
   <p class="journal-standfirst">Setiap cangkir memiliki cerita sensorik yang berbeda. Kenali aroma, acidity, sweetness, body, flavor, dan aftertaste untuk memahami karakter kopi dengan lebih percaya diri.</p>

   <div class="journal-article-copy">
    <div class="journal-tasting-opening">
     <div>
      <span class="eyebrow">EVERY CUP HAS ITS OWN STORY</span>
      <p>Pernahkah kamu menikmati secangkir kopi dan menemukan kesan cokelat, buah beri, bunga, kacang, atau citrus di dalamnya? Deskripsi seperti itu disebut <em>tasting notes</em> — bahasa yang digunakan untuk menggambarkan kemiripan aroma dan rasa yang dikenali ketika kopi dicium dan dicicipi.</p>
      <p>Catatan rasa bukan daftar bahan tambahan. Kopi yang dideskripsikan memiliki karakter cokelat tidak harus mengandung cokelat; istilah itu menjelaskan kesan sensorik yang mengingatkan kita pada aroma atau rasa cokelat.</p>
     </div>
     <blockquote class="journal-tasting-quote"><span>“</span><p>Tasting notes adalah bahasa untuk menceritakan pengalaman menikmati kopi — bukan rumus yang harus dirasakan semua orang dengan cara yang sama.</p></blockquote>
    </div>

    <section class="journal-article-section" id="tasting-notes-basics">
     <div class="journal-section-heading"><span>01</span><div><span class="eyebrow">START WITH THE BASICS</span><h3>What Are Coffee Tasting Notes?</h3></div></div>
     <p><strong>Coffee tasting notes</strong> adalah deskripsi tentang aroma, rasa, dan sensasi yang muncul ketika seseorang mengevaluasi kopi. Istilah seperti berry, jasmine, almond, caramel, atau dark chocolate membantu kita menyampaikan pengalaman dengan kata-kata yang lebih mudah dipahami.</p>
     <p>Dua orang dapat mencicipi kopi yang sama dan memilih deskripsi yang berbeda. Seseorang mungkin menangkap kesan jeruk, sementara orang lain lebih mengenali teh hitam atau gula merah. Pengalaman, ingatan aroma, kondisi pencicipan, dan kepekaan indra ikut membentuk persepsi tersebut.</p>
     <div class="journal-tasting-note-grid">
      <div><b>Descriptive, not literal</b><p>“Chocolate notes” menggambarkan kemiripan karakter sensorik, bukan bukti bahwa cokelat ditambahkan ke dalam biji kopi.</p></div>
      <div><b>A guide, not a guarantee</b><p>Tasting notes pada kemasan merupakan panduan. Hasil di cangkir dapat berubah karena roasting, gilingan, air, dan metode seduh.</p></div>
     </div>
     <p>Karena itu, gunakan tasting notes sebagai titik awal untuk mengeksplorasi kopi. Kamu tidak perlu menemukan semua karakter yang tertulis pada kemasan. Mulailah dari hal yang benar-benar kamu rasakan.</p>
    </section>

    <section class="journal-article-section" id="coffee-aroma">
     <div class="journal-section-heading"><span>02</span><div><span class="eyebrow">THE FIRST IMPRESSION</span><h3>Understanding Coffee Aroma</h3></div></div>
     <p>Aroma adalah bagian besar dari pengalaman menikmati kopi. Sebelum menyesap, kita dapat mencium bubuk kering, aroma yang muncul setelah air panas dituangkan, lalu wangi yang terasa ketika kopi berada di dalam mulut. Dalam evaluasi sensorik, dua istilah yang sering digunakan adalah <em>fragrance</em> dan <em>aroma</em>.</p>
     <div class="journal-tasting-aroma-grid">
      <div class="journal-tasting-aroma-card"><span class="journal-tasting-symbol">◉</span><div><b>Fragrance</b><p>Aroma bubuk kopi ketika masih kering, sebelum diseduh. Cium perlahan setelah biji digiling.</p></div></div>
      <div class="journal-tasting-aroma-card"><span class="journal-tasting-symbol">♨</span><div><b>Aroma</b><p>Aroma kopi setelah air panas dituangkan. Perhatikan perubahan wangi saat seduhan mulai terbuka.</p></div></div>
     </div>
     <figure class="journal-inline-figure journal-tasting-photo"><img src="assets/photos/journal/coffee-cupping-process.webp" alt="Tangan mengaduk dan mengevaluasi beberapa mangkuk sampel kopi dalam sesi cupping" loading="lazy"><figcaption>Dalam cupping, aroma diamati pada beberapa tahap, termasuk ketika kopi masih kering dan setelah diseduh.</figcaption></figure>
     <p>Untuk mulai melatih penciuman, bandingkan aroma kopi dengan referensi yang akrab: kulit jeruk, kacang panggang, cokelat, bunga, atau rempah. Tidak perlu langsung menebak nama buah yang sangat spesifik. Mengenali kelompok aroma terlebih dahulu akan membuat proses belajar lebih mudah.</p>
    </section>

    <section class="journal-article-section" id="five-elements">
     <div class="journal-section-heading"><span>03</span><div><span class="eyebrow">READ THE CUP</span><h3>The Five Elements of Coffee Flavor</h3></div></div>
     <p>Untuk mendeskripsikan kopi secara lebih terstruktur, perhatikan lima aspek berikut. Ini adalah panduan praktis untuk pemula; evaluasi profesional dapat menggunakan atribut dan skala yang lebih rinci.</p>
     <div class="journal-tasting-elements-grid">
      <div><span class="journal-tasting-element-icon">◒</span><b>Acidity</b><p>Kesan cerah atau segar yang dapat mengingatkan pada citrus, apel, atau buah beri. Bukan sekadar rasa asam yang tajam.</p></div>
      <div><span class="journal-tasting-element-icon">◇</span><b>Sweetness</b><p>Persepsi manis yang dapat menyerupai madu, karamel, gula merah, atau buah matang tanpa harus ada gula tambahan.</p></div>
      <div><span class="journal-tasting-element-icon">◍</span><b>Body</b><p>Sensasi tekstur dan berat kopi di mulut: ringan, sedang, atau penuh. Filter dan metode seduh juga memengaruhinya.</p></div>
      <div><span class="journal-tasting-element-icon">✧</span><b>Flavor</b><p>Gabungan rasa dan aroma yang membentuk kesan keseluruhan, misalnya cokelat, buah, bunga, atau rempah.</p></div>
      <div><span class="journal-tasting-element-icon">〰</span><b>Aftertaste</b><p>Rasa dan aroma yang tertinggal setelah kopi ditelan. Perhatikan apakah kesannya bersih, manis, kering, atau pahit.</p></div>
     </div>
     <p>Cobalah menilai setiap aspek secara terpisah sebelum menyimpulkan karakter keseluruhan. Dengan begitu, catatanmu akan lebih jelas daripada hanya menulis “kopinya enak” atau “kopinya pahit”.</p>
    </section>

    <section class="journal-article-section" id="flavor-families">
     <div class="journal-section-heading"><span>04</span><div><span class="eyebrow">BUILD YOUR VOCABULARY</span><h3>Fruity, Floral, Nutty, and Chocolate Notes</h3></div></div>
     <div class="journal-tasting-flavor-layout">
      <div>
       <p>Kelompok aroma membantu kita menemukan kata yang paling mendekati pengalaman mencicipi. Mulailah dari keluarga rasa yang luas, lalu pilih deskripsi yang lebih spesifik jika memang terasa jelas.</p>
       <ul class="journal-tasting-flavor-list">
        <li><b>Fruity:</b> berry, apple, cherry, peach, citrus.</li>
        <li><b>Floral:</b> jasmine, rose, chamomile, lavender.</li>
        <li><b>Nutty:</b> almond, hazelnut, peanut, walnut.</li>
        <li><b>Chocolate & cocoa:</b> cocoa, milk chocolate, dark chocolate.</li>
        <li><b>Sweet:</b> honey, caramel, brown sugar, molasses.</li>
        <li><b>Spices & roasted:</b> cinnamon, clove, toasted grain, cocoa roast.</li>
       </ul>
      </div>
      <figure class="journal-inline-figure journal-tasting-flavor-image"><img src="assets/photos/journal/coffee-flavor-notes.webp" alt="Dark chocolate, citrus, berries, nuts, white flowers, and roasted coffee beans as aroma references" loading="lazy"><figcaption>Flavor references membantu menghubungkan aroma kopi dengan pengalaman yang sudah dikenal.</figcaption></figure>
     </div>
     <p>Gunakan istilah yang terasa paling dekat, bukan yang terdengar paling mewah. Jika kamu hanya mengenali “buah segar”, itu sudah menjadi catatan awal yang berguna. Seiring latihan, deskripsimu dapat berkembang menjadi lebih spesifik.</p>
    </section>

    <section class="journal-article-section" id="professional-cupping">
     <div class="journal-section-heading"><span>05</span><div><span class="eyebrow">A SIMPLE TASTING ROUTINE</span><h3>How to Taste Coffee Like a Professional</h3></div></div>
     <p>Coffee cupping adalah metode mencicipi yang digunakan untuk membandingkan karakter beberapa sampel kopi secara sistematis. Prosedurnya membantu menjaga variabel tetap konsisten agar perbedaan antar-sampel lebih mudah diamati. Kamu dapat mencoba pendekatan sederhana berikut di rumah.</p>
     <figure class="journal-inline-figure journal-tasting-session-image"><img src="assets/photos/journal/coffee-cupping-session.webp" alt="Dua pencicip kopi mengevaluasi deretan mangkuk sampel dalam sesi coffee cupping" loading="lazy"><figcaption>Sesi cupping memungkinkan beberapa sampel dibandingkan dalam kondisi yang relatif seragam.</figcaption></figure>
     <ol class="journal-tasting-steps">
      <li><b>Observe — Perhatikan sampel.</b><p>Catat identitas kopi, origin, proses, dan roast level. Siapkan alat yang bersih serta sampel dengan takaran yang konsisten.</p></li>
      <li><b>Smell dry — Cium bubuk kering.</b><p>Kenali fragrance sebelum air dituangkan. Catat kesan pertama tanpa buru-buru mencari deskripsi spesifik.</p></li>
      <li><b>Smell brewed — Kenali aroma seduhan.</b><p>Setelah air dituangkan, cium aroma pada permukaan kopi dan crust. Dalam prosedur cupping SCA, crust dibiarkan sekitar 3–5 menit, lalu dipecah dengan mengaduk kira-kira tiga kali sambil mencium uap yang terlepas; setelah itu permukaannya dibersihkan.</p></li>
      <li><b>Taste — Cicipi dengan perhatian.</b><p>Setelah suhu turun, seruput sedikit agar kopi menyebar di mulut. Dalam cupping terstruktur, penilaian rasa dilakukan berulang saat kopi mendingin; amati flavor, acidity, sweetness, mouthfeel/body, dan aftertaste.</p></li>
      <li><b>Let it cool — Cicipi kembali saat mendingin.</b><p>Perubahan suhu dapat membuat beberapa karakter lebih mudah dikenali. Bandingkan catatanmu dari kondisi panas hingga hangat.</p></li>
      <li><b>Write — Tuliskan pengamatan.</b><p>Gunakan kata yang sederhana dan jujur. Catat hal yang paling menonjol, bukan semua deskriptor yang kamu ketahui.</p></li>
     </ol>
     <figure class="journal-inline-figure journal-tasting-process-image"><img src="assets/photos/journal/coffee-tasting-journal.webp" alt="Buku catatan tasting dan sendok cupping di samping deretan mangkuk kopi" loading="lazy"><figcaption>Catatan sederhana membantu membandingkan pengalaman antar-sesi tasting.</figcaption></figure>
    </section>

    <section class="journal-article-section" id="coffee-flavor-wheel">
     <div class="journal-section-heading"><span>06</span><div><span class="eyebrow">A MAP FOR YOUR SENSES</span><h3>Understanding the Coffee Flavor Wheel</h3></div></div>
     <p><em>Coffee Taster’s Flavor Wheel</em> adalah alat bantu visual untuk mengelompokkan dan menelusuri deskripsi aroma serta rasa kopi. Cara yang mudah adalah bergerak dari kategori umum menuju istilah yang lebih spesifik, bukan langsung menebak satu rasa tertentu.</p>
     <div class="journal-flavor-wheel-guide">
      <div><b>01 · Start broad</b><p>Mulai dari kelompok besar seperti fruity, floral, sweet, nutty, roasted, spices, atau sour/fermented.</p></div>
      <div><b>02 · Narrow it down</b><p>Jika menemukan kesan fruity, tanyakan apakah lebih dekat ke berry, dried fruit, atau citrus.</p></div>
      <div><b>03 · Choose a descriptor</b><p>Pilih kata paling spesifik yang benar-benar mendekati pengalamanmu. Tidak semua kategori harus digunakan.</p></div>
     </div>
     <figure class="journal-flavor-wheel-figure">
      <img src="assets/photos/journal/coffee-flavor-wheel.png" alt="SCA Coffee Taster's Flavor Wheel diagram with nested categories of aroma and flavor descriptors" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
      <div class="journal-flavor-family-map" hidden aria-label="Original coffee flavor families guide">
       <div><b>FRUITY</b><span>Berry · Citrus · Dried fruit</span></div>
       <div><b>FLORAL</b><span>Jasmine · Rose · Chamomile</span></div>
       <div><b>SWEET</b><span>Honey · Caramel · Brown sugar</span></div>
       <div><b>NUTTY / COCOA</b><span>Almond · Hazelnut · Chocolate</span></div>
       <div><b>SPICES</b><span>Cinnamon · Clove · Pepper</span></div>
       <div><b>ROASTED</b><span>Toasted grain · Cocoa roast · Smoky</span></div>
       <div><b>GREEN / VEGETATIVE</b><span>Herbal · Fresh · Peapod</span></div>
       <div><b>SOUR / FERMENTED</b><span>Citrus acid · Winey · Fermented</span></div>
       <div><b>OTHER</b><span>Earthy · Papery · Chemical</span></div>
      </div>
      <figcaption>Flavor-family guide for practice. The official SCA Coffee Taster’s Flavor Wheel is an optional asset; if installed, it must remain unchanged, be credited to Specialty Coffee Association, World Coffee Research, and UC Davis Coffee Center, and receive SCA approval before public publication.</figcaption>
     </figure>
     <p>Contohnya, ketika kopi terasa seperti buah, mulai dari kategori <strong>fruity</strong>. Lalu perhatikan apakah kesannya menyerupai berry atau citrus. Jika tidak yakin apakah itu blueberry atau raspberry, tidak masalah untuk berhenti pada deskripsi “berry-like”. Tujuannya adalah komunikasi yang jelas, bukan menebak sebanyak mungkin istilah.</p>
    </section>

    <section class="journal-article-section" id="why-coffee-tastes-different">
     <div class="journal-section-heading"><span>07</span><div><span class="eyebrow">THE VARIABLES IN YOUR CUP</span><h3>Why Does the Same Coffee Taste Different?</h3></div></div>
     <p>Kopi yang sama dapat terasa berbeda ketika diseduh oleh orang atau alat yang berbeda. Beberapa variabel berikut dapat mengubah proses ekstraksi dan persepsi rasa.</p>
     <div class="journal-table-wrap" role="region" aria-label="Faktor yang memengaruhi rasa kopi" tabindex="0">
      <table class="journal-comparison-table journal-tasting-table">
       <thead><tr><th>Faktor</th><th>Peran dalam seduhan</th><th>Hal yang dapat diamati</th></tr></thead>
       <tbody>
        <tr><th>Brewing ratio</th><td>Perbandingan dosis kopi dan air memengaruhi kekuatan seduhan.</td><td>Body, konsentrasi, dan keseimbangan rasa.</td></tr>
        <tr><th>Grind size</th><td>Ukuran gilingan memengaruhi luas permukaan dan laju ekstraksi.</td><td>Seduhan dapat terasa tipis, seimbang, atau terlalu intens.</td></tr>
        <tr><th>Water temperature</th><td>Suhu memengaruhi seberapa cepat komponen larut terekstraksi.</td><td>Kejelasan aroma dan keseimbangan rasa.</td></tr>
        <tr><th>Contact time</th><td>Waktu kontak air dan kopi memengaruhi tingkat ekstraksi.</td><td>Intensitas, bitterness, dan kesan keseluruhan.</td></tr>
        <tr><th>Water quality</th><td>Mineral dan karakter air dapat memengaruhi ekstraksi serta persepsi rasa.</td><td>Kejelasan dan keseimbangan cangkir.</td></tr>
        <tr><th>Personal perception</th><td>Ingatan aroma dan kepekaan sensorik berbeda pada setiap orang.</td><td>Deskriptor yang dipilih oleh pencicip.</td></tr>
       </tbody>
      </table>
     </div>
     <p class="journal-table-note">Ubah satu variabel dalam satu waktu saat bereksperimen. Dengan begitu, kamu lebih mudah memahami faktor apa yang menyebabkan perbedaan rasa.</p>
    </section>

    <section class="journal-article-section" id="develop-coffee-palate">
     <div class="journal-section-heading"><span>08</span><div><span class="eyebrow">KEEP EXPLORING</span><h3>Developing Your Own Coffee Palate</h3></div></div>
     <p>Kemampuan mengenali tasting notes dapat berkembang melalui latihan. Kamu tidak perlu memulai dengan peralatan mahal atau kosakata yang rumit. Konsistensi dalam mencoba, membandingkan, dan mencatat justru lebih penting.</p>
     <div class="journal-tasting-practice-grid">
      <div><span>01</span><b>Explore origins</b><p>Bandingkan kopi dari daerah berbeda, lalu catat karakter yang paling terasa.</p></div>
      <div><span>02</span><b>Compare processing</b><p>Coba Natural, Washed, atau Honey dari lot yang informasinya jelas.</p></div>
      <div><span>03</span><b>Try roast levels</b><p>Perhatikan bagaimana profil sangrai mengubah aroma, acidity, body, dan aftertaste.</p></div>
      <div><span>04</span><b>Taste with friends</b><p>Bandingkan deskripsi tanpa memaksakan semua orang merasakan hal yang sama.</p></div>
     </div>
     <div class="journal-tasting-note-template">
      <span class="eyebrow">YOUR PERSONAL TASTING JOURNAL</span>
      <h4>Record what you discover.</h4>
      <div class="journal-tasting-note-fields"><span>Origin / Coffee</span><span>Processing & roast</span><span>Brewing method</span><span>Fragrance & aroma</span><span>Acidity / sweetness / body</span><span>Flavor & aftertaste</span></div>
      <p>Catat kesanmu dengan kata-kata sendiri. Setelah beberapa sesi, kamu akan mulai melihat pola yang menunjukkan karakter kopi yang paling kamu sukai. Untuk cupping formal, ikuti prosedur persiapan dan keselamatan yang ditetapkan penyelenggara atau standar yang berlaku.</p>
     </div>
    </section>

    <section class="journal-conclusion journal-tasting-conclusion">
     <span class="eyebrow">THE KENANGAN NOTE</span>
     <h3>Every Cup Has a Character Worth Discovering.</h3>
     <p>Tasting notes membantu kita bercerita tentang aroma, rasa, dan tekstur kopi dengan lebih jelas. Flavor Wheel memberi kosakata, sedangkan cupping melatih kita untuk mengamati secara terstruktur. Namun, pengalaman paling berharga tetap datang dari rasa ingin tahu dan kesediaan untuk mencoba.</p>
     <p>Di KENANGAN KOPI NUSANTARA, kami percaya setiap origin menyimpan karakter dan cerita yang layak dijelajahi. Cicipi dengan rasa ingin tahu, catat apa yang kamu temukan, dan nikmati perjalanan rasa di setiap tegukan.</p>
     <p class="journal-tasting-signoff">Taste with curiosity. Explore with intention. Discover the character behind every cup.</p>
    </section>

    <div class="journal-sources"><span class="eyebrow">RESEARCH & FURTHER READING</span>
     <a href="https://worldcoffeeresearch.org/resources/sensory-lexicon" target="_blank" rel="noopener">World Coffee Research · Sensory Lexicon ↗</a>
     <a href="https://sca.coffee/research/protocols-best-practices" target="_blank" rel="noopener">Specialty Coffee Association · Research, protocols, and best practices ↗</a>
     <a href="https://sca.coffee/research/coffee-value-assessment" target="_blank" rel="noopener">Specialty Coffee Association · Coffee Value Assessment ↗</a>
     <a href="https://specialtycoffee.my.site.com/s/article/Flavor-Wheel-Guidelines" target="_blank" rel="noopener">Specialty Coffee Association · Flavor Wheel usage guidelines and publication approval ↗</a>
    </div>

    <div class="journal-related">
     <div class="journal-related-heading"><span class="eyebrow">KEEP EXPLORING</span><h3>More from the Journal.</h3></div>
     <button type="button" class="journal-related-card" onclick="openJournal('coffee-roasting')"><img src="assets/photos/journal/roasting-hero.webp" alt="Biji kopi sedang diproses dalam mesin roasting" loading="lazy"><span><small>COFFEE KNOWLEDGE</small><b>The Art of Roasting: How Roast Level Shapes Your Coffee’s Flavor</b><em>READ STORY →</em></span></button>
     <button type="button" class="journal-related-card" onclick="openJournal('brew-guide')"><img src="assets/photos/journal/brew-guide-hero.webp" alt="Metode pour over untuk menyeduh kopi" loading="lazy"><span><small>BREWING GUIDE</small><b>Finding the Right Brew for Your Bean</b><em>READ STORY →</em></span></button>
     <button type="button" class="journal-related-card" onclick="openJournal('five-origins')"><img src="assets/photos/journal/indonesian-coffee-origins-hero.webp" alt="Lanskap perkebunan kopi Indonesia" loading="lazy"><span><small>ORIGIN STORIES</small><b>Five Indonesian Coffee Origins You Should Try</b><em>READ STORY →</em></span></button>
    </div>
   </div>
  </article>`;
}

function readJournalStore(name,fallback){
 try{const value=JSON.parse(localStorage.getItem(name)||'null');return value===null?fallback:value;}catch{return fallback;}
}
function writeJournalStore(name,value){try{localStorage.setItem(name,JSON.stringify(value));}catch(error){console.warn('Journal interaction could not be saved locally.',error);}}
function getJournalLikes(){return readJournalStore('kn_journal_likes',[]);}
function getJournalSaves(){return readJournalStore('kn_journal_saves',[]);}
function getJournalComments(){return readJournalStore('kn_journal_comments',{});}
function journalEngagementMarkup(key){
 const likes=getJournalLikes();const saves=getJournalSaves();const comments=getJournalComments();
 const liked=likes.includes(key),saved=saves.includes(key),count=Array.isArray(comments[key])?comments[key].length:0;
 return `<section class="journal-engagement" data-journal-social="${key}" aria-label="Article actions">
  <div class="journal-engagement-actions">
   <button type="button" class="journal-social-btn ${liked?'is-active':''}" data-journal-action="like" data-journal-key="${key}" aria-pressed="${liked}"><span aria-hidden="true">${liked?'♥':'♡'}</span> Like <b data-journal-like-count="${key}">${liked?1:0}</b></button>
   <button type="button" class="journal-social-btn" data-journal-action="comment" data-journal-key="${key}"><span aria-hidden="true">◯</span> Comment <b data-journal-comment-count="${key}">${count}</b></button>
   <button type="button" class="journal-social-btn ${saved?'is-active':''}" data-journal-action="save" data-journal-key="${key}" aria-pressed="${saved}"><span aria-hidden="true">${saved?'▣':'▱'}</span> ${saved?'Saved':'Save'}</button>
  </div>
  <p class="journal-social-feedback" data-journal-feedback="${key}" aria-live="polite"></p>
 </section>`;
}
function journalCommentsMarkup(key){
 return `<section class="journal-comments" id="journal-comments-${key}" data-journal-comments="${key}">
  <div class="journal-comments-heading"><span class="eyebrow">JOIN THE CONVERSATION</span><h3>Share Your Coffee Thoughts.</h3><p>Bagikan pengalaman, pertanyaan, atau origin favoritmu. Jaga percakapan tetap ramah dan relevan dengan kopi.</p></div>
  <form class="journal-comment-form" data-journal-comment-form="${key}">
   <label><span>YOUR NAME</span><input name="author" type="text" maxlength="40" placeholder="Nama kamu (opsional)"></label>
   <label class="journal-comment-message"><span>YOUR COMMENT</span><textarea name="comment" rows="3" maxlength="500" required placeholder="Tulis komentar hingga 500 karakter..."></textarea></label>
   <div class="journal-comment-form-footer"><small>Maksimal 500 karakter. Komentar disimpan pada browser ini.</small><button class="btn" type="submit">POST COMMENT →</button></div>
  </form>
  <div class="journal-comments-list" data-journal-comments-list="${key}" aria-live="polite"></div>
  <p class="journal-storage-note">Catatan: Like, Save, dan komentar saat ini tersimpan secara lokal di browser/perangkat ini. Interaksi belum dibagikan ke pengunjung lain karena belum terhubung ke database komunitas.</p>
 </section>`;
}
function renderJournalSocial(key){
 const likes=getJournalLikes(),saves=getJournalSaves(),comments=getJournalComments();
 const liked=likes.includes(key),saved=saves.includes(key),items=Array.isArray(comments[key])?comments[key]:[];
 document.querySelectorAll(`[data-journal-social="${key}"] [data-journal-action="like"]`).forEach(btn=>{btn.classList.toggle('is-active',liked);btn.setAttribute('aria-pressed',String(liked));const icon=btn.querySelector('span');if(icon)icon.textContent=liked?'♥':'♡';});
 document.querySelectorAll(`[data-journal-social="${key}"] [data-journal-action="save"]`).forEach(btn=>{btn.classList.toggle('is-active',saved);btn.setAttribute('aria-pressed',String(saved));const icon=btn.querySelector('span');if(icon)icon.textContent=saved?'▣':'▱';const label=Array.from(btn.childNodes).find(n=>n.nodeType===Node.TEXT_NODE);if(label)label.textContent=saved?' Saved':' Save';});
 document.querySelectorAll(`[data-journal-like-count="${key}"]`).forEach(el=>el.textContent=liked?'1':'0');
 document.querySelectorAll(`[data-journal-comment-count="${key}"]`).forEach(el=>el.textContent=String(items.length));
 const list=document.querySelector(`[data-journal-comments-list="${key}"]`);
 if(list){list.innerHTML=items.length?items.slice().reverse().map(item=>`<article class="journal-comment"><div class="journal-comment-avatar">${esc((item.author||'P').trim().charAt(0).toUpperCase()||'P')}</div><div class="journal-comment-body"><div class="journal-comment-meta"><strong>${esc(item.author||'Pembaca')}</strong><time>${esc(item.dateLabel||'Baru saja')}</time></div><p>${esc(item.text||'')}</p></div></article>`).join(''):'<p class="journal-no-comments">Belum ada komentar. Jadilah pembaca pertama yang memulai percakapan.</p>';}
}
function attachJournalEngagement(key){
 const host=document.getElementById('journalModalContent');if(!host)return;
 const article=host.querySelector('.journal-article')||host.querySelector('.journal-short-article');if(!article)return;
 if(!article.querySelector('.journal-engagement')){
  const anchor=article.querySelector('.journal-standfirst')||article.querySelector('.journal-byline')||article.firstElementChild;
  if(anchor)anchor.insertAdjacentHTML('afterend',journalEngagementMarkup(key));
 }
 if(!article.querySelector('.journal-comments')){
  const related=article.querySelector('.journal-related');
  if(related)related.insertAdjacentHTML('beforebegin',journalCommentsMarkup(key));
  else article.insertAdjacentHTML('beforeend',journalCommentsMarkup(key));
 }
 renderJournalSocial(key);
}
function toggleJournalLike(key){
 const likes=getJournalLikes();const index=likes.indexOf(key);if(index>=0)likes.splice(index,1);else likes.push(key);writeJournalStore('kn_journal_likes',likes);renderJournalSocial(key);
 const feedback=document.querySelector(`[data-journal-feedback="${key}"]`);if(feedback)feedback.textContent=likes.includes(key)?'Terima kasih sudah menyukai artikel ini.':'Like dibatalkan.';
}
function toggleJournalSave(key){
 const saves=getJournalSaves();const index=saves.indexOf(key);if(index>=0)saves.splice(index,1);else saves.push(key);writeJournalStore('kn_journal_saves',saves);renderJournalSocial(key);
 const feedback=document.querySelector(`[data-journal-feedback="${key}"]`);if(feedback)feedback.textContent=saves.includes(key)?'Artikel disimpan di browser ini.':'Artikel dihapus dari simpanan.';
}
function postJournalComment(form){
 const key=form.dataset.journalCommentForm;const data=new FormData(form);const text=String(data.get('comment')||'').trim();const author=String(data.get('author')||'').trim().slice(0,40)||'Pembaca';
 if(!text)return;
 const comments=getJournalComments();if(!Array.isArray(comments[key]))comments[key]=[];
 comments[key].push({author,text,createdAt:new Date().toISOString(),dateLabel:new Date().toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})});
 writeJournalStore('kn_journal_comments',comments);form.reset();renderJournalSocial(key);
 const feedback=document.querySelector(`[data-journal-feedback="${key}"]`);if(feedback)feedback.textContent='Komentar tersimpan di browser ini.';
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
 else if(j.type==='origins')content.innerHTML=fiveOriginsArticleMarkup();
 else if(j.type==='brew')content.innerHTML=brewGuideArticleMarkup();
 else if(j.type==='roast')content.innerHTML=roastArticleMarkup();
 else if(j.type==='tasting')content.innerHTML=coffeeTastingArticleMarkup();
 else content.innerHTML=`<div class="journal-short-article"><h2 class="journal-article-headline">${esc(j.title)}</h2><p>${esc(j.body||'')}</p><p>Setiap biji kopi membawa cerita dari kebun, proses pascapanen, roasting, hingga cara kita menyeduhnya. Teruslah bereksplorasi, catat rasa yang kamu temukan, dan pilih metode yang paling sesuai dengan karakter kopi pilihanmu.</p></div>`;
 document.body.classList.toggle('journal-long-open',j.type==='long'||j.type==='origins'||j.type==='brew'||j.type==='roast'||j.type==='tasting');
 attachJournalEngagement(key);
 modal.classList.add('open');
 modal.setAttribute('aria-hidden','false');
 const box=modal.querySelector('.journal-modal-box');
 if(box)box.scrollTop=0;
 const closeButton=modal.querySelector('.journal-modal-close');
 if(closeButton)closeButton.focus({preventScroll:true});
}
function closeJournal(){
 document.body.classList.remove('journal-long-open');
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


// Journal social interactions — local-browser prototype until a shared API/database is connected.
document.addEventListener('click',function(e){
 const btn=e.target.closest('[data-journal-action]');if(!btn)return;
 e.preventDefault();e.stopPropagation();
 const key=btn.dataset.journalKey;if(!key)return;
 const action=btn.dataset.journalAction;
 if(action==='like'){toggleJournalLike(key);return;}
 if(action==='save'){toggleJournalSave(key);return;}
 if(action==='comment'){
  const section=document.getElementById(`journal-comments-${key}`);
  if(section){section.scrollIntoView({behavior:'smooth',block:'start'});section.querySelector('textarea')?.focus({preventScroll:true});}
 }
});
document.addEventListener('submit',function(e){
 const form=e.target.closest('[data-journal-comment-form]');if(!form)return;
 e.preventDefault();e.stopPropagation();postJournalComment(form);
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
