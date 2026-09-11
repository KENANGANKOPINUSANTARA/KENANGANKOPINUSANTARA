const REGION_ART={
"Sumatera":"assets/sumatera.svg","Jawa Barat":"assets/jabar.svg","Jawa Tengah":"assets/jateng.svg","Jawa Timur":"assets/jatim.svg","Indonesia Timur":"assets/timur.svg"
};
const REGION_TEXT={
"Sumatera":"Bold, earthy, chocolate-led expressions.","Jawa Barat":"Fruity, grape, berry and winey character.","Jawa Tengah":"Sweet, smooth and comforting cups.","Jawa Timur":"Sweet, chocolate and caramel-driven profile.","Indonesia Timur":"Bold body with pronounced acidity."
};
let cart=JSON.parse(localStorage.getItem("kenangan_cart")||"[]");
let activeRegion="All";

const rp=n=>"Rp"+n.toLocaleString("id-ID");
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

function renderRegions(){
 document.getElementById("regions").innerHTML=Object.keys(REGION_ART).map(r=>`
 <article class="region-card" onclick="filterRegion('${r}');location.hash='shop'">
 <img src="${REGION_ART[r]}" alt="${r} coffee region">
 <div class="region-copy"><span>ORIGIN 0${Object.keys(REGION_ART).indexOf(r)+1}</span><h3>${r}</h3><p>${REGION_TEXT[r]}</p></div></article>`).join("");
 document.getElementById("finderRegions").innerHTML=Object.keys(REGION_ART).map(r=>`<button onclick="chooseFinderRegion('${r}',this)">${r.toUpperCase()}</button>`).join("");
}
function productArt(p){
 const n=PRODUCTS.findIndex(x=>x.name===p.name);
 return `assets/still${(n%4)+1}.svg`;
}
function renderProducts(){
 const proc=document.getElementById("processFilter").value;
 const list=PRODUCTS.filter(p=>p.type==="Regular"&&(activeRegion==="All"||p.region===activeRegion)&&(proc==="All"||p.process===proc));
 document.getElementById("shopCount").textContent=`${list.length} coffee${list.length!==1?"s":""}`;
 document.getElementById("products").innerHTML=list.map((p,i)=>`
 <article class="product-card">
  <div class="product-art"><img src="${productArt(p)}" alt="${esc(p.name)}"><span class="product-badge">${p.badge||"REGULAR"}</span></div>
  <div class="product-info"><div class="origin-line">${p.region.toUpperCase()} · ${p.process.toUpperCase()}</div><h3>${esc(p.name)}</h3><div class="notes">${esc(p.notes)}</div><div class="card-actions"><span class="price">${rp(p.price)} / 100g</span><button onclick='addToCart(${JSON.stringify(p.name)})'>ADD TO CART</button></div></div>
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
 document.querySelectorAll(".finder-regions button").forEach(b=>b.classList.remove("active"));el.classList.add("active");
 const beans=PRODUCTS.filter(p=>p.region===r&&p.type==="Regular");
 document.getElementById("finderBeans").innerHTML=beans.map(p=>`<button class="bean-btn" onclick='showFinder(${JSON.stringify(p.name)})'><b>${esc(p.name)}</b><small>${esc(p.process)} · ${esc(p.notes)}</small></button>`).join("");
 document.getElementById("finderResult").textContent="Choose a bean to discover its natural character.";
}
function showFinder(name){
 const p=PRODUCTS.find(x=>x.name===name);
 document.getElementById("finderResult").innerHTML=`<b>${esc(p.name)}</b> · ${esc(p.region)}<br><span style="color:#b08a4a">${esc(p.notes)}</span><br><small>${esc(p.process)} process · ${rp(p.price)} / 100g</small>`;
}
function addToCart(name){
 const p=PRODUCTS.find(x=>x.name===name); if(!p||p.type==="Seasonal")return;
 const item=cart.find(x=>x.name===name); item?item.qty++:cart.push({name,qty:1,price:p.price});
 saveCart();openCart();
}
function saveCart(){localStorage.setItem("kenangan_cart",JSON.stringify(cart));renderCart()}
function renderCart(){
 document.getElementById("count").textContent=cart.reduce((a,x)=>a+x.qty,0);
 document.getElementById("cartItems").innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-row"><div><h4>${esc(x.name)}</h4><small>${rp(x.price)} / 100g</small></div><div class="qty"><button onclick="changeQty(${i},-1)">−</button> ${x.qty} <button onclick="changeQty(${i},1)">+</button></div></div>`).join(""):"<p>Your cart is empty.</p>";
 document.getElementById("cartTotal").textContent=rp(cart.reduce((a,x)=>a+x.price*x.qty,0));
}
function changeQty(i,d){cart[i].qty+=d;if(cart[i].qty<=0)cart.splice(i,1);saveCart()}
function openCart(){document.getElementById("cartDrawer").classList.add("open");renderCart()}
function closeCart(){document.getElementById("cartDrawer").classList.remove("open")}
function checkout(){if(!cart.length)return alert("Your cart is empty.");alert("Demo checkout siap. Tahap payment gateway akan kita sambungkan saat production.")}
function openSearch(){document.getElementById("searchModal").classList.add("open");document.getElementById("searchInput").focus()}
function closeSearch(){document.getElementById("searchModal").classList.remove("open")}
function searchProducts(q){
 const l=q.toLowerCase();const res=PRODUCTS.filter(p=>`${p.name} ${p.region} ${p.process} ${p.notes}`.toLowerCase().includes(l)).slice(0,8);
 document.getElementById("searchResults").innerHTML=res.map(p=>`<div class="search-item" onclick="closeSearch();location.hash='shop';filterRegion('${p.region}')"><b>${esc(p.name)}</b><small>${esc(p.region)} · ${esc(p.process)} · ${esc(p.notes)}</small></div>`).join("");
}
function openAccount(){document.getElementById("accountModal").classList.add("open")}
function closeAccount(){document.getElementById("accountModal").classList.remove("open")}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeSearch();closeAccount()}});
renderRegions();renderProducts();renderCart();

function openProduct(name){
 const p=PRODUCTS.find(x=>x.name===name); if(!p)return;
 document.getElementById("productDetail").innerHTML=`<div class="detail-grid">
 <div class="detail-art"><img src="${productArt(p)}" alt="${esc(p.name)}"></div>
 <div><span class="eyebrow">${esc(p.region).toUpperCase()} · ${esc(p.process).toUpperCase()}</span>
 <h2>${esc(p.name)}</h2><p class="detail-notes">${esc(p.notes)}</p>
 <p class="detail-copy">A curated Indonesian origin selected for the Kenangan collection. The cup expresses the character of its origin and processing method.</p>
 <strong class="detail-price">${rp(p.price)} / 100g</strong><br><br>
 ${p.type==="Seasonal"?'<p><b>CAFÉ EXCLUSIVE.</b> Available to discover in person at the Kenangan café.</p>':'<button class="btn" onclick="addToCart('+JSON.stringify(p.name)+');closeProduct()">ADD TO CART →</button>'}</div></div>`;
 document.getElementById("productModal").classList.add("open");
}
function closeProduct(){document.getElementById("productModal").classList.remove("open")}
