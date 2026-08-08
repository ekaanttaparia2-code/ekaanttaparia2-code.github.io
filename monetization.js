// =====================================================================
// monetization.js — PocketTrack Pro · unlockable Premium themes
// ---------------------------------------------------------------------
// Slice 1 of the Monetization & Pro Themes feature.
//  • Persistent Pro subscription state (localStorage + Firestore mirror)
//  • Razorpay-style in-app checkout simulation
//  • 4 unlockable themes (Cyberpunk default is free; Emerald Luxury,
//    Sunset Glow, Midnight OLED are premium).
// The Future Money Simulator is the next slice and builds on isPro() here.
// =====================================================================

const PT_STORE = {
  pro: 'pocketTrack_pro',
  theme: 'pocketTrack_theme'
};

// --- 3-tier pricing model (real-revenue setup) ---
const PT_PLANS = [
  { id:'monthly', label:'Monthly', price:99,  period:'/month',  perMonth:99,  tag:'',        highlight:false },
  { id:'annual',  label:'Annual',  price:599, period:'/year',   perMonth:50,  tag:'BEST VALUE', highlight:true },
  { id:'life',    label:'Lifetime',price:1499, period:'one-time', perMonth:0, tag:'Own it forever', highlight:false }
];
// Default / featured plan used as the anchor (annual).
const PT_PRICE = '₹599';
const PT_PERIOD = '/year';
const PT_CURRENCY = 'INR';

// --- PocketPoints → Pro discount (retention loop from streaks) ---
// 500 points = ₹50 off any Pro purchase, stackable up to one free month.
const PT_POINTS_KV = { deduct: 500, rupees: 50, maxMonths: 1, storeKey: 'pocketTrack_points_used' };
function pocketPointsBalance(){
  // Reuse the app's real rewards engine when available.
  if (typeof calculateRewardPoints === 'function') {
    try { return calculateRewardPoints() || 0; } catch(e){}
  }
  return 0;
}
function pocketPointsMaxDiscount(){
  // Cap the discount at one month of the chosen plan (use ₹99 monthly as the cap base).
  const cashable = Math.floor(pocketPointsBalance() / PT_POINTS_KV.deduct) * PT_POINTS_KV.rupees;
  return Math.min(cashable, PT_POINTS_KV.maxMonths * PT_PLANS[0].price);
}
function pocketPointsUsedToday(){ return Number(localStorage.getItem(PT_POINTS_KV.storeKey) || 0); }

// Reset Pro so you can preview the free experience (also removes locked themes).
function resetProForPreview(){
  showAppConfirm(
    'Turn off Pro and go back to the free version? Your data stays intact — only the Pro unlock is removed.',
    ()=>{
      localStorage.removeItem(PT_STORE.pro);
      localStorage.removeItem(PT_STORE.theme);
      localStorage.removeItem(PT_STORE.theme + '_pend');
      if (typeof currentUser !== 'undefined' && currentUser && typeof db !== 'undefined') {
        db.collection('users').doc(currentUser.uid)
          .update({ pro: firebase.firestore.FieldValue.delete() })
          .catch(()=>{});
      }
      delete document.body.dataset.theme;
      if (typeof renderProTab === 'function') renderProTab();
      toast('Pro reset — you’re on the free tier now.', 'success');
    },
    'Reset Pro'
  );
}

// Currently selected plan id in the checkout / plan card.
let selectedPlanId = 'annual';
function ptGetSelectedPlan(){ return PT_PLANS.find(p=>p.id===selectedPlanId) || PT_PLANS[1]; }
function ptFormatINR(n){ return '₹' + Number(n).toLocaleString('en-IN'); }

// Ordered list shown in the theme picker. Free themes apply instantly,
// premium themes require a Pro subscription.
const PT_THEMES = [
  { id:'cyber',   name:'Cyberpunk Neo',   free:true,  tag:'Default', emoji:'🌆', desc:'The classic neon arcade look. Always free.' },
  { id:'emerald', name:'Emerald Luxury',  free:false, tag:'Pro',     emoji:'💚', desc:'Deep green glass — refined & calm.' },
  { id:'sunset',  name:'Sunset Glow',     free:false, tag:'Pro',     emoji:'🌇', desc:'Warm dusk tones — soft & cosy.' },
  { id:'midnight',name:'Midnight OLED',   free:false, tag:'Pro',     emoji:'🖤', desc:'True black background — battery saver.' }
];

// ---- Pro state -------------------------------------------------------
function proEnabled(){ return localStorage.getItem(PT_STORE.pro) === '1'; }

function setPro(on){
  if (on) localStorage.setItem(PT_STORE.pro, '1');
  else localStorage.removeItem(PT_STORE.pro);
  // Best-effort mirror to the user's Firestore doc so Pro survives reinstall.
  if (typeof currentUser !== 'undefined' && currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid)
      .update({ pro: on ? true : firebase.firestore.FieldValue.delete() })
      .catch(()=>{});
  }
}

// ---- middle-pane helpers you can reuse anywhere (e.g. Simulator next slice)
function pt(s){
  return (typeof escapeHTML === 'function') ? escapeHTML(String(s)) : String(s);
}
function esc(s){ return pt(s); }

// Theme server
function currentThemeId(){ return localStorage.getItem(PT_STORE.theme) || 'cyber'; }

function applyThemeOf(id){
  id = id || 'cyber';
  localStorage.setItem(PT_STORE.theme, id);
  const body = document.body;
  if (!body) return;
  if (id === 'cyber') { delete body.dataset.theme; }
  else { body.dataset.theme = id; }
}

function themeById(id){ return PT_THEMES.find(t=>t.id===id); }
function isThemeFree(id){ return !!(themeById(id) || { free:true }).free; }

// A single picker action: applies free themes; routes premium themes through Pro.
function ptPickTheme(id){
  const theme = themeById(id) || PT_THEMES[0];
  if (theme.free || proEnabled()){
    applyThemeOf(id);
    toast((theme.free ? theme.tag + ' theme applied' : '💎 ' + theme.name + ' applied'), 'success');
    renderProTab();
    return;
  }
  // Premium but no Pro yet — invite the upgrade, remember which theme they wanted.
  localStorage.setItem(PT_STORE.theme + '_pend', id);
  toast('✨ ' + theme.name + ' is Pro only — unlock to apply.', 'info');
  setTimeout(()=>openProCheckout(theme.name), 250);
}

// =====================================================================
//  PRO TAB
// =====================================================================
function renderProTab(){
  const host = document.getElementById('pro-content');
  if (!host) return;

  const isPro = proEnabled();
  const cur = currentThemeId();

  const planCards = PT_PLANS.map(p=>{
    const priceLine = p.id==='life' ? `${ptFormatINR(p.price)} ${p.period}` : `${ptFormatINR(p.price)}${p.period}`;
    const perLine = p.id==='life' ? 'One-time · yours forever' : (p.perMonth ? `≈ ${ptFormatINR(p.perMonth)}/mo` : '');
    return `
      <div class="pt-plan ${p.highlight?'featured':''}" onclick="ptPickPlan('${p.id}')" role="button" tabindex="0"
        onkeydown="if(event.key==='Enter')ptPickPlan('${p.id}')">
        <div class="pt-plan-top">
          <span class="pt-plan-name">${p.label}</span>
          ${p.tag ? `<span class="pt-plan-tag">${p.tag}</span>` : ''}
        </div>
        <div class="pt-plan-price">${priceLine}</div>
        <div class="pt-plan-per">${perLine}</div>
      </div>`;
  }).join('');

  const planCard = `
    <div class="card" style="padding:18px;background:linear-gradient(135deg, rgba(155,107,255,0.12), rgba(255,126,179,0.08));border-color:rgba(155,107,255,0.25)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:30px">${isPro?'👑':'⭐'}</span>
          <div>
            <p style="font-weight:700;font-size:16px;margin:0;font-family:'Space Grotesk',sans-serif">
              ${isPro ? 'PocketTrack Pro' : 'Unlock PocketTrack Pro'}
            </p>
            <p style="font-size:11.5px;color:var(--text-dim);margin:2px 0 0">
              ${isPro
                ? 'You have full access. Enjoy every theme and all premium perks.'
                : 'Premium themes, money projection, AI coach & more.'}
            </p>
          </div>
        </div>
        <div style="text-align:right">
          ${isPro
            ? '<span class="pro-badge" style="background:linear-gradient(135deg,#f59e0b,#ec4899)">PRO ACTIVE</span>'
            : `<span class="pro-badge" style="background:linear-gradient(135deg,#8b5cf6,#ec4899)">${PT_PRICE}${PT_PERIOD}</span>`}
          ${isPro ? '' : `<br><button class="btn primary" style="margin-top:8px;padding:7px 14px;font-size:12.5px" onclick="openProCheckout()"><i class="ti ti-crown"></i> Get Pro</button>`}
        </div>
      </div>
      ${isPro
        ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);text-align:center">
             <button class="btn" style="font-size:12px" onclick="resetProForPreview()"><i class="ti ti-rotate"></i> Reset Pro (view free experience)</button>
           </div>`
        : `<div class="pt-plan-grid" style="margin-top:14px">${planCards}</div>`}
    </div>
  `;

  const themeCards = PT_THEMES.map(t=>{
    const locked = !t.free && !isPro;
    const isCur = cur === t.id;
    return `
      <div class="theme-card ${locked ? 'locked' : ''} ${isCur?'current':''}" onclick="ptPickTheme('${t.id}')" role="button" tabindex="0"
        onkeydown="if(event.key==='Enter')ptPickTheme('${t.id}')">
        <div class="theme-preview" data-theme-prev="${t.id}">
          <span class="theme-preview-emoji">${t.emoji}</span>
          ${isCur ? '<span class="theme-current-tag">CURRENT</span>' : ''}
        </div>
        <div style="flex:1;padding:10px 12px 12px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight:600;font-size:13px">${pt(t.name)}</span>
            ${locked ? '<span style="font-size:11px">🔒</span>' : ''}
          </div>
          <p style="font-size:11px;color:var(--text-dim);margin:3px 0 8px;line-height:1.35">${pt(t.desc)}</p>
          ${locked
            ? `<span class="chip chip-gold" style="font-size:10.5px">${t.tag} · tap to unlock</span>`
            : `<span class="chip" style="font-size:10.5px">${isCur ? 'Active' : 'Tap to apply'}</span>`}
        </div>
      </div>`;
  }).join('');

  const themesCard = `
    <div class="card">
      <p class="sec-title"><i class="ti ti-palette"></i><span>App Themes</span></p>
      <p style="font-size:12px;color:var(--text-dim);margin:2px 0 14px">
        Re-skin the whole app. The default theme is free; premium themes unlock with Pro.
      </p>
      <div class="theme-grid">${themeCards}</div>
    </div>
  `;

  const perks = isPro ? '' : `
    <div class="card">
      <p class="sec-title"><i class="ti ti-sparkles"></i><span>Everything Pro</span></p>
      <ul class="pro-benefits">
        <li>💎 All premium themes (Emerald Luxury, Sunset Glow, Midnight OLED)</li>
        <li>🔮 Future Money Simulator — project your savings over 3, 6 & 12 months</li>
        <li>🗑️ Faster, ad-free experience and early access to new features</li>
        <li>☁️ Up to 10,000 entries & priority cloud sync</li>
      </ul>
      <button class="btn primary" style="width:100%;margin-top:6px" onclick="openProCheckout()">
        <i class="ti ti-crown"></i> Unlock Pro — from ${ptFormatINR(50)}/mo
      </button>
      <p style="font-size:10.5px;color:var(--text-faint);margin:10px 0 0;text-align:center">
        Razorpay-powered. Cancel anytime.
      </p>
    </div>
  `;

  host.innerHTML = planCard + themesCard + perks;
}

// =========================================================================
// PRO CHECKOUT (Razorpay-style in-app paywall)
// ========================================================================
function openProCheckout(themeName){
  // reuse a shared glassy overlay we add once
  let overlay = document.getElementById('pro-checkout-backdrop');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'pro-checkout-backdrop';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:960;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)';
    overlay.onclick = (e)=>{ if(e.target===overlay) closeProCheckout(); };
    document.body.appendChild(overlay);
  }
  const header = themeName
      ? `<p style="margin:0 0 4px;font-size:12px;color:var(--amber);font-weight:600">💎 ${pt(themeName)} theme</p>`
      : '';
  overlay.innerHTML = `
    <div style="width:100%;max-width:380px;background:linear-gradient(160deg,var(--card-solid),#1f1840);border:1px solid rgba(255,255,255,0.14);border-radius:22px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,0.6);position:relative;color:var(--text)">
      <button class="icon-btn" onclick="closeProCheckout()" style="position:absolute;top:14px;right:14px"><i class="ti ti-x"></i></button>
      ${header}
      <div style="display:flex;justify-content:center;margin:4px 0 10px">
        <span style="font-size:44px">👑</span>
      </div>
      <h3 style="text-align:center;font-family:'Space Grotesk',sans-serif;margin:0 0 2px">PocketTrack Pro</h3>
      <p style="text-align:center;color:var(--text-dim);font-size:12px;margin:0 0 14px">Unlock every theme · money projection · more</p>

      <div id="pt-selected-summary" style="text-align:center;margin-bottom:14px">
        <span id="pt-plan-price" style="font-size:30px;font-weight:700;font-family:'Space Grotesk',sans-serif">₹599</span>
        <span id="pt-plan-period" style="color:var(--text-dim);font-size:13px">/year</span>
        <p style="font-size:10.5px;color:var(--green);margin:2px 0 0">✔ Billed via Razorpay</p>
      </div>

      <div id="pt-plan-tabs" style="display:flex;gap:6px;margin-bottom:8px">
        ${PT_PLANS.map(p=>`
          <button class="pt-plan-tab ${p.id===selectedPlanId?'active':''}" data-id="${p.id}" onclick="ptSelectPlan('${p.id}')">
            ${p.label}${p.tag?`<small> ${p.tag}</small>`:''}
          </button>`).join('')}
      </div>
      <div id="pt-points-line" style="font-size:11px;color:var(--text-dim);text-align:center;margin:0 0 12px"></div>

      <div class="pay-tabs" style="display:flex;gap:6px;margin-bottom:12px">
        <button class="pay-tab active" onclick="ptPayTab(this,'upi',event)">UPI</button>
        <button class="pay-tab" onclick="ptPayTab(this,'card',event)">Card</button>
        <button class="pay-tab" onclick="ptPayTab(this,'bank',event)">Netbanking</button>
      </div>

      <div id="pt-pay-body">
        <label style="font-size:11px;color:var(--text-dim)">UPI ID</label>
        <input id="pt-upi-input" type="text" value="you@upi" style="width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:13px;margin:4px 0 10px;box-sizing:border-box"/>
        <p style="font-size:10.5px;color:var(--text-faint)">Demo checkout — enter any UPI ID. No real money moves in this preview.</p>
      </div>

      <button class="btn primary" id="pt-pay-now" style="width:100%;margin-top:12px" onclick="payForPro()">
        <span id="pt-pay-label">Pay now</span>
      </button>
      <button class="btn" style="width:100%;margin-top:8px" onclick="closeProCheckout()">Maybe later</button>
      <p style="text-align:center;font-size:10px;color:var(--text-faint);margin:12px 0 0;display:flex;justify-content:center;gap:4px;align-items:center">
        <i class="ti ti-shield-check"></i> Secured by Razorpay <i class="ti ti-lock"></i>
      </p>
    </div>
  `;
  overlay.style.display = 'flex';
  reflectPlanUI();
}

// Highlight the chosen plan on the pricing cards in the Pro tab.
function ptPickPlan(id){
  document.querySelectorAll('.pt-plan').forEach(el=> el.classList.remove('selected'));
  document.querySelectorAll('.pt-plan').forEach(el=>{
    if(el.querySelector('.pt-plan-name') && el.querySelector('.pt-plan-name').textContent.trim()===(PT_PLANS.find(p=>p.id===id)||{}).label){
      el.classList.add('selected');
    }
  });
  // Remember the choice, then open checkout with that plan.
  ptSelectPlan(id);
  openProCheckout();
}

function reflectPlanUI(){
  const p = ptGetSelectedPlan();
  document.getElementById('pt-plan-price').textContent = ptFormatINR(p.price);
  document.getElementById('pt-plan-period').textContent = ' ' + p.period;
  document.querySelectorAll('.pt-plan-tab').forEach(b=> b.classList.toggle('active', b.dataset.id===p.id));
  document.getElementById('pt-pay-label').textContent = 'Pay ' + ptFormatINR(p.price) + ' now';

  // PocketPoints discount affordance (visual only; real money is server-side later).
  const bal = pocketPointsBalance();
  const ptsEl = document.getElementById('pt-points-line');
  if(ptsEl){
    ptsEl.style.display = bal >= PT_POINTS_KV.deduct ? 'block' : 'none';
    if(bal >= PT_POINTS_KV.deduct){
      ptsEl.textContent = `🎟️ ${bal} points — apply ${ptFormatINR(pocketPointsMaxDiscount())} off at checkout`;
    }
  }
}

function ptSelectPlan(id){
  selectedPlanId = id;
  document.querySelectorAll('.pt-plan-tab').forEach(b=> b.classList.toggle('active', b.dataset.id===id));
  reflectPlanUI();
}

function closeProCheckout(){
  const el = document.getElementById('pro-checkout-backdrop');
  if(el) el.style.display = 'none';
}

function ptPayTab(btn, method, ev){
  if(ev) ev.stopPropagation();
  document.querySelectorAll('.pay-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const body = document.getElementById('pt-pay-body');
  if(method === 'upi'){
    body.innerHTML = `
      <label style="font-size:11px;color:var(--text-dim)">UPI ID</label>
      <input id="pt-upi-input" type="text" value="you@upi" style="width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:14px;margin:4px 0 10px;box-sizing:border-box"/>
      <p style="font-size:10.5px;color:var(--text-faint)">Demo checkout — no real money moves in this preview.</p>`;
  } else if(method === 'card'){
    body.innerHTML = `
      <label style="font-size:11px;color:var(--text-dim)">Card number</label>
      <input type="text" value="4242 4242 4242 4242" style="width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:14px;margin:4px 0 10px;box-sizing:border-box"/>
      <div style="display:flex;gap:8px">
        <input type="text" placeholder="MM/YY" style="flex:1;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:14px;box-sizing:border-box"/>
        <input type="password" placeholder="CVV" style="flex:1;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:14px;box-sizing:border-box"/>
      </div>
      <p style="font-size:10.5px;color:var(--text-faint)">Demo checkout — no real money is charged in this preview.</p>`;
  } else {
    body.innerHTML = `
      <label style="font-size:11px;color:var(--text-dim)">Select your bank</label>
      <select style="width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:14px;margin:4px 0 10px;box-sizing:border-box">
        <option>HDFC Bank</option><option>State Bank of India</option><option>ICICI Bank</option><option>Axis Bank</option>
      </select>
      <p style="font-size:10.5px;color:var(--text-faint)">Demo checkout, no real money is moved in this preview.</p>`;
  }
  // Reset the pay button label back to normal (selected plan).
  const p = ptGetSelectedPlan();
  document.getElementById('pt-pay-label').textContent = 'Pay ' + ptFormatINR(p.price) + ' now';
}

async function payForPro(){
  const btn = document.getElementById('pt-pay-now');
  const label = document.getElementById('pt-pay-label');
  if(!btn) return;
  const plan = ptGetSelectedPlan();
  btn.disabled = true;
  label.textContent = 'Verifying payment…';
  document.querySelectorAll('.pay-tab').forEach(b=>b.style.pointerEvents='none');

  // Simulate the Razorpay payment flow (order → then success).
  await new Promise(r=>setTimeout(r, 1400));

  setPro(true);
  closeProCheckout();
  const planMsg = plan.id==='life' ? ' lifetime access' : (' ' + plan.label.toLowerCase() + ' plan');
  toast('👑 PocketTrack Pro unlocked' + planMsg + '! Thanks for subscribing.', 'success');

  // Apply any theme they were aiming for (they are Pro now).
  const pend = localStorage.getItem(PT_STORE.theme + '_pend');
  localStorage.removeItem(PT_STORE.theme + '_pend');
  if(pend && themeById(pend)) applyThemeOf(pend);

  if(typeof renderProTab === 'function') renderProTab();
}

function isThemePremium(id){
  const t = themeById(id);
  return t ? !t.free : false;
}

// Boot: apply saved theme as early as possible + expose globals.
(function(){
  const id = localStorage.getItem(PT_STORE.theme) || 'cyber';
  if(id !== 'cyber'){
    document.addEventListener('readystatechange', function onRS(){
      if(document.readyState === 'interactive' || document.readyState === 'complete'){
        document.removeEventListener('readystatechange', onRS);
        const b = document.body;
        if(b){ b.dataset.theme = id; }
      }
    });
  }
})();x
x