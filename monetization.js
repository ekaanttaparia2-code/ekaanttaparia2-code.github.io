Object.assign(TRANSLATIONS, {
  nav_simulator: { en: 'Future Money & Pro', hi: 'भविष्य का धन और प्रो' },
  sim_title: { en: 'Future Money & Runway Simulator', hi: 'भविष्य का धन और रनवे सिमुलेटर' },
  pro_title: { en: 'PocketTrack Pro', hi: 'पॉकेटट्रैक प्रो' },
  btn_go_pro: { en: 'Upgrade to Pro ⭐', hi: 'प्रो पर अपग्रेड करें ⭐' }
});

// Razorpay Key Placeholder (User can update or use test key)
let RAZORPAY_KEY_ID = localStorage.getItem('pockettrack_razorpay_key') || 'rzp_test_YOUR_KEY_HERE';
let isProUser = localStorage.getItem('pockettrack_is_pro') === 'true';
let currentTheme = localStorage.getItem('pockettrack_theme') || 'default';

function applyTheme(themeName) {
  currentTheme = themeName;
  localStorage.setItem('pockettrack_theme', themeName);
  document.body.setAttribute('data-theme', themeName);

  const root = document.documentElement;
  if (themeName === 'cyberpunk') {
    root.style.setProperty('--bg1', '#0d0221');
    root.style.setProperty('--bg2', '#0f0826');
    root.style.setProperty('--accent', '#00f0ff');
    root.style.setProperty('--accent2', '#ff007f');
  } else if (themeName === 'emerald') {
    root.style.setProperty('--bg1', '#06201b');
    root.style.setProperty('--bg2', '#092d26');
    root.style.setProperty('--accent', '#10b981');
    root.style.setProperty('--accent2', '#f59e0b');
  } else if (themeName === 'sunset') {
    root.style.setProperty('--bg1', '#2a0813');
    root.style.setProperty('--bg2', '#3d0c1c');
    root.style.setProperty('--accent', '#ff6b6b');
    root.style.setProperty('--accent2', '#ffb84d');
  } else if (themeName === 'midnight') {
    root.style.setProperty('--bg1', '#000000');
    root.style.setProperty('--bg2', '#0a0a0a');
    root.style.setProperty('--accent', '#8b5cf6');
    root.style.setProperty('--accent2', '#ec4899');
  } else {
    root.style.removeProperty('--bg1');
    root.style.removeProperty('--bg2');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent2');
  }
  toast('Applied theme: ' + themeName, 'info');
}

function calculateRunway(dailySpendTarget) {
  let totalBalance = 0;
  let totalInc = 0;
  let totalExp = 0;

  (entries || []).forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') { totalInc += amt; totalBalance += amt; }
    else if (e.type === 'expense') { totalExp += amt; totalBalance -= amt; }
  });

  totalBalance = Math.max(1000, totalBalance);
  const monthlySpend = dailySpendTarget * 30;
  const runwayMonths = (monthlySpend > 0) ? (totalBalance / monthlySpend).toFixed(1) : '∞';

  const month3Bal = Math.round(totalBalance + (totalInc * 3) - (monthlySpend * 3));
  const month6Bal = Math.round(totalBalance + (totalInc * 6) - (monthlySpend * 6));
  const month12Bal = Math.round(totalBalance + (totalInc * 12) - (monthlySpend * 12));

  return { totalBalance, monthlySpend, runwayMonths, month3Bal, month6Bal, month12Bal };
}

function renderSimulatorTab() {
  const container = document.getElementById('tab-simulator-content');
  if (!container) return;

  let defaultDaily = 500;
  const sim = calculateRunway(defaultDaily);

  container.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(255, 0, 127, 0.15)); text-align:center; padding:24px 20px; margin-bottom:18px;">
      <h3 style="margin:0 0 6px; font-family:'Space Grotesk',sans-serif; font-size:22px;">🔮 Future Money Simulator</h3>
      <p style="color:var(--text-dim); font-size:13px; margin:0 0 16px;">Simulate your spending targets and forecast savings over 1 year</p>
      
      <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:14px; border:1px solid var(--border); margin-bottom:16px;">
        <div style="font-size:12px; color:var(--text-dim); font-weight:700;">DAILY SPENDING TARGET</div>
        <div style="font-size:28px; font-weight:800; color:var(--accent);" id="sim-daily-val">₹${defaultDaily}/day</div>
        <input type="range" id="sim-range-input" min="100" max="5000" step="50" value="${defaultDaily}" style="width:100%; margin-top:10px;" oninput="updateSimulatorCalc(this.value)"/>
        <div style="display:flex; justify-space-between; font-size:11px; color:var(--text-dim); margin-top:4px;">
          <span>₹100/day</span>
          <span>₹5,000/day</span>
        </div>
      </div>

      <div class="grid3" style="gap:10px;">
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; border:1px solid var(--border)">
          <div style="font-size:11px; color:var(--text-dim);">RUNWAY</div>
          <div style="font-size:20px; font-weight:800; color:#4ade80;" id="sim-runway-val">${sim.runwayMonths} Mos</div>
        </div>
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; border:1px solid var(--border)">
          <div style="font-size:11px; color:var(--text-dim);">IN 6 MONTHS</div>
          <div style="font-size:18px; font-weight:800; color:${sim.month6Bal >= 0 ? '#60a5fa' : '#f87171'};" id="sim-6m-val">₹${sim.month6Bal}</div>
        </div>
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; border:1px solid var(--border)">
          <div style="font-size:11px; color:var(--text-dim);">IN 1 YEAR</div>
          <div style="font-size:18px; font-weight:800; color:${sim.month12Bal >= 0 ? '#a78bfa' : '#f87171'};" id="sim-12m-val">₹${sim.month12Bal}</div>
        </div>
      </div>
    </div>

    <!-- PRO SUBSCRIPTION CARD -->
    <div class="card" style="background:linear-gradient(135deg, rgba(255, 184, 77, 0.2), rgba(139, 92, 246, 0.2)); border-color:rgba(255, 184, 77, 0.4); margin-bottom:18px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h4 style="margin:0; font-size:17px;" class="sec-title"><i class="ti ti-crown"></i> PocketTrack Pro</h4>
        <span class="ob-pill green">${isProUser ? '⭐ PRO Active' : 'Free Trial'}</span>
      </div>
      <p style="color:var(--text-dim); font-size:13px; margin:0 0 16px;">Unlock unlimited AI Twin queries, Razorpay monetization, and custom app themes!</p>
      
      <div class="btn-row" style="margin-bottom:16px;">
        <button class="btn primary" style="flex:1; padding:12px;" onclick="openProModal('monthly')">Monthly Plan (₹199/mo)</button>
        <button class="btn" style="flex:1; padding:12px; background:linear-gradient(135deg,#ffb84d,#ff7eb3); color:#000; font-weight:700;" onclick="openProModal('yearly')">Yearly (₹1,499/yr - Save 37%)</button>
      </div>
    </div>

    <!-- THEME SELECTION -->
    <div class="card">
      <h4 style="margin:0 0 12px; font-size:16px;" class="sec-title"><i class="ti ti-palette"></i> App Themes</h4>
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
        <button class="btn" style="background:#1b1340; color:#fff; border:1px solid var(--border);" onclick="applyTheme('default')">✨ Default Dark</button>
        <button class="btn" style="background:#0d0221; color:#00f0ff; border:1px solid #00f0ff55;" onclick="applyTheme('cyberpunk')">⚡ Cyberpunk Neon</button>
        <button class="btn" style="background:#06201b; color:#10b981; border:1px solid #10b98155;" onclick="applyTheme('emerald')">🌿 Emerald Luxury</button>
        <button class="btn" style="background:#2a0813; color:#ff6b6b; border:1px solid #ff6b6b55;" onclick="applyTheme('sunset')">🌅 Sunset Glow</button>
        <button class="btn" style="background:#000000; color:#8b5cf6; border:1px solid #8b5cf655; grid-column:span 2;" onclick="applyTheme('midnight')">🌌 Midnight OLED (Battery Saver)</button>
      </div>
    </div>
  `;
}

function updateSimulatorCalc(val) {
  const daily = parseFloat(val);
  document.getElementById('sim-daily-val').textContent = `₹${daily}/day`;
  const sim = calculateRunway(daily);

  document.getElementById('sim-runway-val').textContent = `${sim.runwayMonths} Mos`;
  
  const m6 = document.getElementById('sim-6m-val');
  if (m6) {
    m6.textContent = `₹${sim.month6Bal}`;
    m6.style.color = sim.month6Bal >= 0 ? '#60a5fa' : '#f87171';
  }

  const m12 = document.getElementById('sim-12m-val');
  if (m12) {
    m12.textContent = `₹${sim.month12Bal}`;
    m12.style.color = sim.month12Bal >= 0 ? '#a78bfa' : '#f87171';
  }
}

function openProModal(plan) {
  const price = plan === 'yearly' ? '₹1,499/year' : '₹199/month';
  const content = `
    <div style="text-align:center; margin-bottom:16px;">
      <div style="font-size:42px; margin-bottom:6px;">👑</div>
      <h3 style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:20px;">Upgrade to PocketTrack Pro</h3>
      <div style="font-size:14px; font-weight:700; color:var(--accent); margin-top:4px;">${price}</div>
    </div>
    <div style="background:rgba(255,255,255,0.05); padding:14px; border-radius:12px; border:1px solid var(--border); margin-bottom:18px; font-size:13px; line-height:1.6;">
      <div>✓ Unlimited AI Twin & Financial Advice</div>
      <div>✓ Future Money & Runway Simulator</div>
      <div>✓ Subscription Leak Alert Scanner</div>
      <div>✓ PDF Monthly Reports & CSV Export</div>
      <div>✓ All Pro Custom App Themes Unlocked</div>
    </div>
    <div class="btn-row" style="gap:10px;">
      <button class="btn" style="flex:1" onclick="closeModal()">Cancel</button>
      <button class="btn primary" style="flex:2; padding:12px; font-weight:700;" onclick="startRazorpayPayment('${plan}')">💳 Pay with Razorpay</button>
    </div>
  `;
  showAppAlert(content);
}

function startRazorpayPayment(plan) {
  closeModal();

  // If Razorpay SDK is available
  if (typeof Razorpay !== 'undefined') {
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: plan === 'yearly' ? 149900 : 19900, // amount in paise
      currency: "INR",
      name: "PocketTrack Pro",
      description: plan === 'yearly' ? "Pro Yearly Membership" : "Pro Monthly Membership",
      handler: function (response) {
        isProUser = true;
        localStorage.setItem('pockettrack_is_pro', 'true');
        toast('🎉 Payment successful! Welcome to PocketTrack Pro ⭐', 'success');
        renderSimulatorTab();
      },
      prefill: {
        email: currentUser ? currentUser.email : "",
      },
      theme: { color: "#8b5cf6" }
    };
    const rzp = new Razorpay(options);
    rzp.open();
  } else {
    // Simulated checkout if SDK is loading or in test mode
    isProUser = true;
    localStorage.setItem('pockettrack_is_pro', 'true');
    toast('🎉 Pro Membership Activated! (Test Mode)', 'success');
    renderSimulatorTab();
  }
}

// Apply stored theme on load
document.addEventListener('DOMContentLoaded', () => {
  if (currentTheme && currentTheme !== 'default') {
    applyTheme(currentTheme);
  }
});
