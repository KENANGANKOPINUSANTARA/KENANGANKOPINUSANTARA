const REGION_ART={
"Sumatera":"assets/sumatera.svg","Jawa Barat":"assets/jabar.svg","Jawa Tengah":"assets/jateng.svg","Jawa Timur":"assets/jatim.svg","Indonesia Timur":"assets/timur.svg"
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
async function restoreSession(){if(!authToken){updateAccountUI();return;}try{const data=await authFetch(`${AUTH_API}/me`);currentUser=data.user;localStorage.setItem("kenangan_user",JSON.stringify(currentUser));}catch{setSession(null);}updateAccountUI();renderStories();}
function updateAccountUI(){const button=document.querySelector('.actions button[onclick="openAccount()"]');if(button)button.innerHTML=currentUser?'◉':'◯';}
function openAccount(){document.getElementById("accountModal").classList.add("open");renderAccount();}
function closeAccount(){document.getElementById("accountModal").classList.remove("open");}
function renderAccount(){const el=document.getElementById("accountContent");if(!el)return;if(currentUser){el.innerHTML=`<span class="eyebrow">YOUR KENANGAN</span><h2>Welcome back, ${esc(currentUser.name)}.</h2><p class="form-intro">Your account connects your stories to your Kenangan identity.</p><div class="account-panel"><div><span>NAME</span><b>${esc(currentUser.name)}</b></div><div><span>EMAIL</span><b>${esc(currentUser.email)}</b></div><div><span>STATUS</span><b>ACCOUNT ACTIVE</b></div></div><div class="account-actions"><button class="btn" onclick="location.hash='stories';closeAccount()">MY STORIES →</button><button class="btn secondary-btn" onclick="showMyOrders()">MY ORDERS →</button><button class="text-link" onclick="logoutAccount()">LOG OUT</button></div>`;}else{el.innerHTML=`<span class="eyebrow">YOUR KENANGAN</span><h2>Join the coffee journey.</h2><p class="form-intro">Create an account to publish, edit, and unsend your own Coffee Stories.</p><div class="auth-switch"><button class="active" id="loginTab" onclick="showAuthForm('login')">LOGIN</button><button id="registerTab" onclick="showAuthForm('register')">CREATE ACCOUNT</button></div><form id="authForm" class="auth-form" onsubmit="submitAuth(event)"></form><div id="authMessage" class="auth-message"></div>`;showAuthForm('login');}}
function showAuthForm(mode){const form=document.getElementById("authForm");if(!form)return;document.getElementById("loginTab")?.classList.toggle("active",mode==='login');document.getElementById("registerTab")?.classList.toggle("active",mode==='register');form.dataset.mode=mode;form.innerHTML=mode==='login'?`<label>EMAIL<input id="authEmail" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>PASSWORD<input id="authPassword" type="password" required minlength="6" autocomplete="current-password" placeholder="••••••••"></label><button class="btn full" type="submit">LOGIN →</button>`:`<label>NAME<input id="authName" required maxlength="40" autocomplete="name" placeholder="Your name"></label><label>EMAIL<input id="authEmail" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>PASSWORD<input id="authPassword" type="password" required minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters"></label><button class="btn full" type="submit">CREATE ACCOUNT →</button>`;}
async function submitAuth(e){e.preventDefault();const mode=e.currentTarget.dataset.mode;const payload={email:document.getElementById("authEmail").value.trim(),password:document.getElementById("authPassword").value};if(mode==='register')payload.name=document.getElementById("authName").value.trim();const msg=document.getElementById("authMessage");try{const data=await authFetch(`${AUTH_API}/${mode}`,{method:"POST",body:JSON.stringify(payload)});setSession(data);closeAccount();alert(mode==='register'?"Account created. Welcome to Kenangan!":"Welcome back to Kenangan!");}catch(err){msg.textContent=err.message.includes('409')?'Email is already registered.':err.message.includes('401')?'Email or password is incorrect.':'For the local account system, start the V12 backend and try again.';}}
function showMyOrders(){document.getElementById("accountContent").innerHTML=`<span class="eyebrow">YOUR KENANGAN</span><h2>My Orders.</h2><p class="form-intro">Track the coffee journeys connected to your account.</p><div id="myOrdersContent"></div><div class="form-actions"><button class="text-link" onclick="renderAccount()">← BACK</button></div>`;loadMyOrders()}
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
 const p=PRODUCTS.find(x=>x.name===name); if(!p||p.type==="Seasonal")return;
 const qty=Math.max(1,Math.floor(Number(quantity)||1));
 const id=productId(p); const item=cart.find(x=>x.id===id||x.name===name);
 item?item.qty+=qty:cart.push({id,name:p.name,qty,price:p.price,region:p.region});
 saveCart();openCart();
}
function saveCart(){localStorage.setItem("kenangan_cart",JSON.stringify(cart));renderCart()}
function cartSubtotal(){return cart.reduce((a,x)=>a+Number(x.price||0)*Number(x.qty||0),0)}
function renderCart(){
 // Keep seasonal/café-exclusive products out of the online cart even if an old localStorage entry exists.
 cart=cart.filter(x=>{const p=PRODUCTS.find(p=>p.name===x.name||productId(p)===x.id); return p&&p.type!=="Seasonal";});
 localStorage.setItem("kenangan_cart",JSON.stringify(cart));
 document.getElementById("count").textContent=cart.reduce((a,x)=>a+Number(x.qty||0),0);
 document.getElementById("cartItems").innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-row"><div class="cart-item-copy"><h4>${esc(x.name)}</h4><small>${esc(x.region||"")} · 100g</small><strong>${rp(x.price)}</strong></div><div class="cart-item-controls"><div class="qty"><button onclick="changeQty(${i},-1)" aria-label="Decrease ${esc(x.name)}">−</button><span>${x.qty}</span><button onclick="changeQty(${i},1)" aria-label="Increase ${esc(x.name)}">+</button></div><button class="remove-item" onclick="removeFromCart(${i})" aria-label="Remove ${esc(x.name)}">REMOVE</button></div></div>`).join(""):`<div class="empty-cart"><span class="eyebrow">YOUR CART</span><h3>Your cart is waiting.</h3><p>Add a regular coffee from the collection to begin your order.</p><button class="text-link" onclick="closeCart();location.hash='shop'">CONTINUE SHOPPING →</button></div>`;
 document.getElementById("cartTotal").textContent=rp(cartSubtotal());
 const checkoutBtn=document.querySelector(".cart-bottom .btn.full"); if(checkoutBtn)checkoutBtn.disabled=!cart.length;
}
function changeQty(i,d){if(!cart[i])return;cart[i].qty+=d;if(cart[i].qty<=0)cart.splice(i,1);saveCart()}
function removeFromCart(i){if(!cart[i])return;cart.splice(i,1);saveCart()}
function openCart(){document.getElementById("cartDrawer").classList.add("open");renderCart()}
function closeCart(){document.getElementById("cartDrawer").classList.remove("open")}
function checkout(){
 if(!cart.length)return alert("Your cart is empty.");
 if(!currentUser){closeCart();openAccount();return alert("Please login to continue to checkout.");}
 closeCart();
 document.getElementById("checkoutName").value=currentUser.name||"";
 document.getElementById("checkoutEmail").value=currentUser.email||"";
 document.getElementById("checkoutSummary").innerHTML=cart.map(x=>`<div><span>${esc(x.name)} × ${x.qty}</span><strong>${rp(x.price*x.qty)}</strong></div>`).join("")+`<div><span>Shipping</span><strong>${rp(20000)}</strong></div><div class="checkout-grand"><span>TOTAL</span><strong>${rp(cartSubtotal()+20000)}</strong></div>`;
 document.getElementById("checkoutMessage").textContent=""; document.getElementById("checkoutModal").classList.add("open");
}
function closeCheckout(){document.getElementById("checkoutModal")?.classList.remove("open")}
async function submitCheckout(e){
 e.preventDefault(); if(!currentUser)return;
 const msg=document.getElementById("checkoutMessage"); msg.textContent="Placing your order…";
 const payload={customer:{name:document.getElementById("checkoutName").value.trim(),email:document.getElementById("checkoutEmail").value.trim(),phone:document.getElementById("checkoutPhone").value.trim(),address:document.getElementById("checkoutAddress").value.trim(),city:document.getElementById("checkoutCity").value.trim(),province:document.getElementById("checkoutProvince").value.trim(),postalCode:document.getElementById("checkoutPostal").value.trim()},items:cart.map(x=>({productId:x.id||productId(PRODUCTS.find(p=>p.name===x)||x),qty:x.qty})),shippingFee:20000};
 try{const order=await orderFetch("/api/orders",{method:"POST",body:JSON.stringify(payload)});cart=[];saveCart();closeCheckout();showOrderSuccess(order)}catch(err){msg.textContent=err.message||"Unable to place order."}
}
async function orderFetch(url,options={}){const headers={"Content-Type":"application/json",...(options.headers||{})};if(authToken)headers.Authorization=`Bearer ${authToken}`;const res=await fetch(url,{...options,headers});let data={};try{data=await res.json()}catch{}if(!res.ok)throw new Error(data.error||`Order API ${res.status}`);return data}
function showOrderSuccess(order){document.getElementById("orderSuccessContent").innerHTML=`<span class="eyebrow">ORDER CONFIRMED</span><h2>Your coffee is on its way.</h2><p class="form-intro">Thank you, ${esc(order.customer.name)}. Your order has been recorded.</p><div class="order-number"><span>ORDER NUMBER</span><strong>${esc(order.id)}</strong></div><div class="order-summary-line"><span>TOTAL</span><strong>${rp(order.total)}</strong></div><button class="btn full" onclick="closeOrderSuccess();openAccount();">VIEW MY ORDERS →</button>`;document.getElementById("orderSuccessModal").classList.add("open")}
function closeOrderSuccess(){document.getElementById("orderSuccessModal")?.classList.remove("open")}
async function loadMyOrders(){const host=document.getElementById("myOrdersContent");if(!host)return;host.innerHTML='<p class="muted-copy">Loading orders…</p>';try{const orders=await orderFetch("/api/orders");host.innerHTML=orders.length?orders.map(o=>`<div class="order-card"><div><span>${esc(o.id)}</span><b>${esc(o.status)}</b></div><small>${new Date(o.createdAt).toLocaleString("en-ID")}</small><p>${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join(" · ")}</p><strong>${rp(o.total)}</strong></div>`).join(""):"<p class=\"muted-copy\">No orders yet. Your first coffee journey starts in the Shop.</p>"}catch{host.innerHTML='<p class="muted-copy">Orders are available when the V13 backend is running.</p>'}}
function openSearch(){document.getElementById("searchModal").classList.add("open");document.getElementById("searchInput").focus()}
function closeSearch(){document.getElementById("searchModal").classList.remove("open")}
function searchProducts(q){
 const l=q.toLowerCase();const res=PRODUCTS.filter(p=>`${p.name} ${p.region} ${p.process} ${p.notes}`.toLowerCase().includes(l)).slice(0,8);
 document.getElementById("searchResults").innerHTML=res.map(p=>`<div class="search-item" onclick="closeSearch();location.hash='shop';filterRegion('${p.region}')"><b>${esc(p.name)}</b><small>${esc(p.region)} · ${esc(p.process)} · ${esc(p.notes)}</small></div>`).join("");
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeSearch();closeAccount();closeStoryForm();closeProduct()}});
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
});
document.addEventListener("keydown",function(e){
 if((e.key==="Enter"||e.key===" ") && e.target.matches("[data-action=select-region]")){e.preventDefault();selectRegion(e.target.dataset.region);}
});
