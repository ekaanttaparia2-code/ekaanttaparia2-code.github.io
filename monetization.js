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

const PT_PRICE = '₹199';
const PT_PERIOD = '/3 months';
const PT_CURRENCY = 'INR';

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
                : 'Premium themes, future money projection & more — for a tiny cost.'}
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
        <i class="ti ti-crown"></i> Unlock Pro — ${PT_PRICE}${PT_PERIOD}
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

      <div style="text-align:center;margin-bottom:16px">
        <span style="font-size:30px;font-weight:700;font-family:'Space Grotesk',sans-serif">${PT_PRICE}</span>
        <span style="color:var(--text-dim);font-size:13px">${PT_PERIOD}</span>
        <p style="font-size:10.5px;color:var(--green);margin:2px 0 0">✔ Billed via Razorpay</p>
      </div>

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
        <span id="pt-pay-label">Pay ${PT_PRICE} now</span>
      </button>
      <button class="btn" style="width:100%;margin-top:8px" onclick="closeProCheckout()">Maybe later</button>
      <p style="text-align:center;font-size:10px;color:var(--text-faint);margin:12px 0 0;display:flex;justify-content:center;gap:4px;align-items:center">
        <i class="ti ti-shield-check"></i> Secured by Razorpay <i class="ti ti-lock"></i>
      </p>
    </div>
  `;
  overlay.style.display = 'flex';
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
  // Reset the pay button label back to normal.
  document.getElementById('pt-pay-label').textContent = 'Pay ' + PT_PRICE + ' now';
}

async function payForPro(){
  const btn = document.getElementById('pt-pay-now');
  const label = document.getElementById('pt-pay-label');
  if(!btn) return;
  btn.disabled = true;
  label.textContent = 'Verifying payment…';
  document.querySelectorAll('.pay-tab').forEach(b=>b.style.pointerEvents='none');

  // Simulate the Razorpay payment flow (order → then success).
  await new Promise(r=>setTimeout(r, 1400));

  setPro(true);
  closeProCheckout();
  toast('👑 PocketTrack Pro unlocked! Thanks for subscribing.', 'success');

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