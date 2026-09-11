let P = [];
const R = [
  ["Sumatera", "Bold · Earthy · Chocolatey", "Chocolate, herbal/earthy, brown sugar, citrus and spice"],
  ["Jawa Barat", "Fruity · Sweet · Expressive", "Berries, grape, stone fruit, apple, winey and sweet"],
  ["Jawa Tengah", "Sweet · Smooth · Comforting", "Sweetness, chocolate, sugarcane, nuts and vanilla"],
  ["Jawa Timur", "Sweet · Chocolatey · Caramel", "Sweet, chocolate, caramel, nuts and warm finish"],
  ["Indonesia Timur", "Bold · Full-Bodied · Vibrant", "Full body, pronounced character and lively acidity"]
];
let cartItems = JSON.parse(localStorage.getItem("kenangan_cart") || "[]");
let apiReady = false;

const money = n => new Intl.NumberFormat("id-ID", {
  style:"currency", currency:"IDR", maximumFractionDigits:0
}).format(n);

const $ = id => document.getElementById(id);

function bag(p){
  let c = p[1] === "Jawa Barat" || p[1] === "Jawa Timur" ? "red" :
          p[1] === "Indonesia Timur" ? "blue" : "";
  return `<div class="visual"><div class="bag ${c}">
    <b>K</b><small>KENANGAN<br>${p[0].toUpperCase()}<br>${p[1].toUpperCase()}</small>
  </div></div>`;
}

function productCard(p){
  const i = P.indexOf(p);
  const seasonal = p[6] === "Seasonal";
  return `<article class="card">
    ${bag(p)}
    <div class="card-body">
      <span class="badge ${seasonal ? "seasonal-badge" : ""}">${seasonal ? "CAFÉ EXCLUSIVE" : (p[7] ? "BEST SELLER" : "AVAILABLE")}</span>
      <h3>${p[0]}</h3>
      <div class="meta">${p[2]} · ${p[3]}</div>
      <div class="notes">${p[4]}</div>
      <div class="price">${money(p[5])} <span>/ 100g</span></div>
      <div class="card-actions">
        <button onclick="detail(${i})">${seasonal ? "DISCOVER AT CAFÉ →" : "VIEW COFFEE →"}</button>
        ${seasonal ? "" : `<button class="quick-add" onclick="add(${i})">+ CART</button>`}
      </div>
    </div>
  </article>`;
}

function render(){
  $("regions").innerHTML = R.map((r,i) => `
    <article class="region r${i}" onclick="region('${r[0]}')">
      <small>REGION 0${i+1}</small><h3>${r[0]}</h3>
      <p>${r[1]}</p><p>${r[2]}</p>
    </article>`).join("");

  $("products").innerHTML = P.filter(p => p[7]).slice(0,4).map(productCard).join("");
  $("seasonals").innerHTML = P.filter(p => p[6] === "Seasonal").map(productCard).join("");
  $("regionBtns").innerHTML = R.map(r =>
    `<button class="choice" onclick="chooseRegion('${r[0]}',this)">${r[0]}</button>`
  ).join("");

  filterShop();
  updateCartCount();
}

function filterShop(){
  const region = $("filterRegion")?.value || "";
  const process = $("filterProcess")?.value || "";
  const type = $("filterType")?.value || "";

  const filtered = P.filter(p =>
    (!region || p[1] === region) &&
    (!process || p[3] === process) &&
    (!type || p[6] === type)
  );

  $("shopGrid").innerHTML = filtered.map(productCard).join("");
  $("shopCount").textContent = `${filtered.length} coffees`;
}

function clearFilters(){
  $("filterRegion").value = "";
  $("filterProcess").value = "";
  $("filterType").value = "";
  filterShop();
}

function chooseRegion(name,el){
  document.querySelectorAll(".choice").forEach(x => x.classList.remove("active"));
  el.classList.add("active");

  const ps = P.filter(p => p[1] === name);
  $("beanBtns").innerHTML = ps.map(productCard).join("");
  $("result").innerHTML = `<div class="finder-result"><span>${name.toUpperCase()}</span><h3>${ps.length} coffees to discover.</h3><p>Select a bean to see its origin, process and tasting notes.</p></div>`;
}

function region(name){
  location.hash = "finder";
  const b = [...document.querySelectorAll(".choice")].find(x => x.textContent === name);
  if(b) chooseRegion(name,b);
}

function detail(i){
  const p = P[i], seasonal = p[6] === "Seasonal";
  $("modalBody").innerHTML = `
    <div class="detail">
      ${bag(p)}
      <div>
        <label>${seasonal ? "SEASONAL · CAFÉ EXCLUSIVE" : "SINGLE ORIGIN"}</label>
        <h2>${p[0]}</h2>
        <div class="meta">${p[1]} · ${p[2]} · ${p[3]}</div>
        <p>Discover the natural character of this Indonesian coffee through its origin and processing.</p>
        <div class="detail-box"><b>TASTING NOTES</b><strong>${p[4]}</strong></div>
        <h3>${money(p[5])} <span class="meta">/ 100g</span></h3>
        ${seasonal
          ? `<a class="btn" href="#cafe" onclick="closeModal()">DISCOVER AT CAFÉ →</a>`
          : `<button class="btn" onclick="add(${i});closeModal()">ADD TO CART →</button>`}
      </div>
    </div>`;
  $("modal").classList.add("show");
}

function add(i){
  const p = P[i];
  if(!p) return;
  if(p[6] === "Seasonal") return;
  if(typeof p[8] === "number" && p[8] <= 0){ showToast("This coffee is currently out of stock."); return; }
  const found = cartItems.find(x => x.i === i);
  if(found) found.q += 1;
  else cartItems.push({i, q:1});
  saveCart();
  showToast(`${p[0]} added to your cart.`);
}

function removeCart(i){
  cartItems = cartItems.filter(x => x.i !== i);
  saveCart();
  cartOpen();
}

function changeQty(i, delta){
  const item = cartItems.find(x => x.i === i);
  if(!item) return;
  item.q += delta;
  if(item.q <= 0) cartItems = cartItems.filter(x => x.i !== i);
  saveCart();
  cartOpen();
}

function saveCart(){
  localStorage.setItem("kenangan_cart", JSON.stringify(cartItems));
  updateCartCount();
}

function updateCartCount(){
  $("count").textContent = cartItems.reduce((a,x) => a + x.q, 0);
}

function cartOpen(){
  let total = 0;
  const rows = cartItems.map(x => {
    const p = P[x.i];
    total += p[5] * x.q;
    return `<div class="cartrow">
      <div><b>${p[0]}</b><small>${p[1]} · ${money(p[5])}</small>
      <div class="qty"><button onclick="changeQty(${x.i},-1)">−</button><span>${x.q}</span><button onclick="changeQty(${x.i},1)">+</button></div></div>
      <div><b>${money(p[5]*x.q)}</b><button class="remove" onclick="removeCart(${x.i})">Remove</button></div>
    </div>`;
  }).join("");

  $("cart").innerHTML = rows || `<div class="empty-cart"><h3>Your cart is empty.</h3><p>Start with a coffee that tells a story.</p><a class="btn" href="#shop-all" onclick="cartClose()">EXPLORE COFFEE →</a></div>`;
  $("total").textContent = money(total);
  $("checkoutBtn").style.display = cartItems.length ? "block" : "none";
  $("drawer").classList.add("open");
}

function cartClose(){ $("drawer").classList.remove("open"); }

function checkout(){
  if(!cartItems.length) return;
  let subtotal = cartItems.reduce((a,x) => a + P[x.i][5]*x.q, 0);
  $("modalBody").innerHTML = `
    <div class="checkout">
      <label>YOUR COFFEE ORDER</label><h2>Checkout</h2>
      <div class="checkout-grid">
        <div>
          <h3>Delivery Details</h3>
          <input id="customerName" placeholder="Full name">
          <input id="customerPhone" placeholder="WhatsApp / phone">
          <textarea id="customerAddress" placeholder="Delivery address"></textarea>
          <select id="shipping"><option>Standard Delivery — Rp15.000</option><option>Express Delivery — Rp30.000</option></select>
        </div>
        <div class="summary">
          <h3>Order Summary</h3>
          ${cartItems.map(x => `<div class="summary-row"><span>${P[x.i][0]} × ${x.q}</span><b>${money(P[x.i][5]*x.q)}</b></div>`).join("")}
          <div class="summary-row"><span>Subtotal</span><b>${money(subtotal)}</b></div>
          <div class="summary-row"><span>Shipping</span><b id="shipCost">Rp15.000</b></div>
          <hr><div class="summary-row total-row"><span>Total</span><b id="checkoutTotal">${money(subtotal+15000)}</b></div>
          <button class="btn" onclick="placeOrder()">PLACE ORDER →</button>
          <p class="small-note">Demo checkout for the V1 website. Real payment gateway can be connected in the backend phase.</p>
        </div>
      </div>
    </div>`;
  $("modal").classList.add("show");
  $("shipping").onchange = function(){
    const ship = this.selectedIndex === 0 ? 15000 : 30000;
    $("shipCost").textContent = money(ship);
    $("checkoutTotal").textContent = money(subtotal+ship);
  };
  cartClose();
}

async function placeOrder(){
  const name = $("customerName").value.trim();
  const phone = $("customerPhone").value.trim();
  const address = $("customerAddress").value.trim();
  const shipping = $("shipping").selectedIndex === 0 ? 15000 : 30000;
  if(!name || !phone || !address){
    showToast("Please complete your delivery details.");
    return;
  }
  if(!apiReady){ showToast("Backend belum aktif. Jalankan START-WEBSITE.bat terlebih dahulu."); return; }
  try{
    const order = await fetch("/api/orders", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        customer:{name, phone, address},
        shipping,
        items:cartItems.map(x=>({productId:P[x.i][9], quantity:x.q}))
      })
    }).then(async r=>{ const data=await r.json(); if(!r.ok) throw new Error(data.error||"Order failed"); return data; });
    cartItems = [];
    saveCart();
    await loadProducts();
    $("modalBody").innerHTML = `<div class="success">
      <div class="success-icon">✓</div><label>ORDER RECEIVED</label>
      <h2>Thank you, ${name.split(" ")[0]}.</h2>
      <p>Your coffee journey has begun.</p>
      <strong>${order.orderNumber}</strong>
      <p class="small-note">Order tersimpan di backend KENANGAN KOPI NUSANTARA.</p>
      <button class="btn" onclick="closeModal()">CONTINUE EXPLORING →</button>
    </div>`;
  }catch(e){ showToast(e.message); }
}

async function loadProducts(){
  try{
    const data = await fetch("/api/products").then(r=>{if(!r.ok) throw new Error("API unavailable"); return r.json();});
    P = data.map(x=>[
      x.name, x.region, x.origin, x.process, x.tastingNotes.join(" · "), x.price,
      x.type, x.bestSeller ? 1 : 0, x.stock, x.id
    ]);
    apiReady = true;
    render();
  }catch(e){
    apiReady = false;
    showToast("Backend belum aktif. Menampilkan data demo lokal.");
    render();
  }
}

function search(){
  $("modalBody").innerHTML = `<h2>Find Your Coffee</h2>
    <input id="q" autofocus class="search-input" placeholder="Search coffee, region, process or tasting note...">
    <div id="sr"></div>`;
  $("modal").classList.add("show");
  $("q").oninput = e => {
    const q = e.target.value.toLowerCase().trim();
    const matches = q ? P.filter(p => p.slice(0,6).join(" ").toLowerCase().includes(q)).slice(0,12) : [];
    $("sr").innerHTML = matches.map(p => `<button class="search-result" onclick="detail(${P.indexOf(p)})"><b>${p[0]}</b><span>${p[1]} · ${p[3]} · ${p[4]}</span></button>`).join("");
  };
}

function account(){
  $("modalBody").innerHTML = `<div class="account">
    <label>KENANGAN MEMBER</label><h2>My Account</h2>
    <p>Your account will hold orders, addresses, wishlist and Coffee Journey preferences.</p>
    <input placeholder="Email address">
    <input placeholder="Password" type="password">
    <button class="btn" onclick="showToast('Account system will connect in the backend phase.');closeModal()">SIGN IN →</button>
  </div>`;
  $("modal").classList.add("show");
}

function closeModal(){ $("modal").classList.remove("show"); }
function showToast(text){
  let t = document.querySelector(".toast");
  if(!t){ t=document.createElement("div"); t.className="toast"; document.body.appendChild(t); }
  t.textContent=text; t.classList.add("show");
  clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>t.classList.remove("show"),2500);
}

loadProducts();
