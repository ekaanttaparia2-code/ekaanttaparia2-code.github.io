/* Application state, navigation engine, budget management and i18n logic. */

let currentUser = null;
let currentLang = localStorage.getItem('pockettrack_lang') || 'en';
let weeklyBudget = parseFloat(localStorage.getItem('pockettrack_budget') || '0');
let currentStreak = parseInt(localStorage.getItem('pockettrack_streak') || '1');

const TRANSLATIONS = {
  nav_log: { en: 'Log', hi: 'एंट्री दर्ज करें' },
  nav_entries: { en: 'Entries', hi: 'सभी एंट्रीज' },
  nav_report: { en: 'Report', hi: 'रिपोर्ट्स' },
  nav_events: { en: 'Events', hi: 'ईवेंट्स' },
  nav_ledger: { en: 'Ledger', hi: 'खाता प्रणाली' },
  nav_aicoach: { en: 'AI Coach & Health', hi: 'एआई कोच और हेल्थ' },
  nav_simulator: { en: 'Future Money & Pro', hi: 'भविष्य का धन और प्रो' },
  nav_rewards: { en: 'Rewards', hi: 'इनाम' },
  sec_smart_logger: { en: 'Smart Logger', hi: 'स्मार्ट लॉगर' },
  nav_language: { en: 'Language', hi: 'भाषा' },
  nav_overview: { en: 'App Overview', hi: 'ऐप विवरण' },
  nav_logout: { en: 'Log out', hi: 'लॉग आउट' },
  btn_cancel: { en: 'Cancel', hi: 'रद्द करें' },
  btn_confirm_log: { en: 'Save', hi: 'सहेजें' }
};

function TT(key) {
  if (TRANSLATIONS[key]) {
    return TRANSLATIONS[key][currentLang] || TRANSLATIONS[key]['en'] || key;
  }
  return key;
}

function setTab(t) {
  ['log','entries','report','events','rewards','upi','language','ledger','overview','aicoach','simulator'].forEach((x) => {
    const el = document.getElementById('tab-' + x);
    if (el) {
      if (x === t) {
        el.style.display = 'block';
        el.classList.remove('tab-enter');
        void el.offsetWidth;
        el.classList.add('tab-enter');
      } else {
        el.style.display = 'none';
      }
    }
  });

  document.querySelectorAll('.side-menu-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === t);
  });

  const statPills = document.getElementById('header-stat-pills');
  if (statPills) statPills.style.display = (t === 'log' || t === 'entries') ? 'flex' : 'none';

  if (t === 'entries' && typeof renderEntries === 'function') renderEntries();
  if (t === 'report' && typeof renderReport === 'function') { renderReport(); if (typeof showNextTip === 'function') showNextTip(); }
  if (t === 'events' && typeof renderEventsList === 'function') renderEventsList();
  if (t === 'ledger' && typeof renderLedger === 'function') renderLedger();
  if (t === 'overview' && typeof renderOverviewTab === 'function') renderOverviewTab();
  if (t === 'aicoach' && typeof renderAICoachTab === 'function') renderAICoachTab();
  if (t === 'simulator' && typeof renderSimulatorTab === 'function') renderSimulatorTab();
  if (t === 'rewards' && typeof renderRewards === 'function') renderRewards();

  closeMenu();
}

function openMenu() {
  const menu = document.getElementById('side-menu');
  if (menu) menu.classList.add('open');
}

function closeMenu() {
  const menu = document.getElementById('side-menu');
  if (menu) menu.classList.remove('open');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function showAppAlert(contentHtml) {
  let modal = document.getElementById('app-custom-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'app-custom-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="card" style="width:100%;max-width:420px;background:var(--card-solid);position:relative;">
      <button class="icon-btn" onclick="closeModal()" style="position:absolute;top:15px;right:15px"><i class="ti ti-x"></i></button>
      <div style="margin-top:10px;">${contentHtml}</div>
    </div>
  `;
  modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('app-custom-modal');
  if (modal) modal.style.display = 'none';
}

function showAppConfirm(msg, onConfirm) {
  const content = `
    <div style="text-align:center; padding:10px 0;">
      <p style="font-size:15px; font-weight:600; margin-bottom:20px;">${escapeHTML(msg)}</p>
      <div class="btn-row" style="justify-content:center">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn danger" id="confirm-modal-ok-btn">Confirm</button>
      </div>
    </div>
  `;
  showAppAlert(content);
  document.getElementById('confirm-modal-ok-btn').onclick = () => {
    closeModal();
    onConfirm();
  };
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (TRANSLATIONS[key]) {
      el.textContent = TRANSLATIONS[key][currentLang] || TRANSLATIONS[key]['en'];
    }
  });
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('pockettrack_lang', lang);
  applyLanguage();
  toast(lang === 'hi' ? 'भाषा बदलकर हिंदी कर दी गई है' : 'Language set to English', 'success');
}

function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const lastLog = localStorage.getItem('pockettrack_last_log_date');
  if (lastLog !== today) {
    if (lastLog) {
      const lastDate = new Date(lastLog);
      const diffDays = Math.round((new Date(today) - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) currentStreak++;
      else if (diffDays > 1) currentStreak = 1;
    }
    localStorage.setItem('pockettrack_last_log_date', today);
    localStorage.setItem('pockettrack_streak', currentStreak);
  }
}

function renderBalanceStats() {
  let inc = 0, exp = 0;
  (entries || []).forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') inc += amt;
    else if (e.type === 'expense') exp += amt;
  });
  
  const bal = inc - exp;
  const balEl = document.getElementById('stat-total-balance');
  const incEl = document.getElementById('stat-total-income');
  const expEl = document.getElementById('stat-total-expense');
  
  if (balEl) balEl.textContent = `₹${bal.toLocaleString()}`;
  if (incEl) incEl.textContent = `₹${inc.toLocaleString()}`;
  if (expEl) expEl.textContent = `₹${exp.toLocaleString()}`;
  
  updateBudgetUI();
}

function updateBudgetUI() {
  const box = document.getElementById('budget-progress-box');
  if (!box) return;
  
  if (!weeklyBudget || weeklyBudget <= 0) {
    box.innerHTML = 'Set a weekly limit to track budget adherence & health score.';
    return;
  }
  
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0,0,0,0);
  
  let thisWeekExp = 0;
  (entries || []).forEach(e => {
    if (e.type === 'expense' && new Date(e.date) >= startOfWeek) {
      thisWeekExp += (parseFloat(e.amt) || 0);
    }
  });
  
  const pct = Math.min(100, Math.round((thisWeekExp / weeklyBudget) * 100));
  const color = pct >= 100 ? 'var(--red)' : (pct >= 85 ? 'var(--amber)' : 'var(--green)');
  
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-weight:600;">
      <span>Spent: ₹${thisWeekExp}</span>
      <span style="color:${color}">${pct}% of ₹${weeklyBudget}</span>
    </div>
    <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
      <div style="width:${pct}%; height:100%; background:${color}; border-radius:3px; transition:width 0.3s;"></div>
    </div>
  `;
}

function setWeeklyBudgetPrompt() {
  const val = prompt('Enter your weekly budget cap (₹):', weeklyBudget || 2500);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      weeklyBudget = num;
      localStorage.setItem('pockettrack_budget', weeklyBudget);
      if (currentUser) {
        db.collection('users').doc(currentUser.uid).collection('budget').doc('data').set({ weeklyBudget: num }).catch(e=>console.warn(e));
      }
      updateBudgetUI();
      toast('Weekly budget updated to ₹' + num, 'success');
    }
  }
}

function loadBudget() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('budget').doc('data').get().then(doc => {
    if (doc.exists) {
      weeklyBudget = doc.data().weeklyBudget || 0;
      localStorage.setItem('pockettrack_budget', weeklyBudget);
      updateBudgetUI();
    }
  }).catch(e => console.warn('Load budget err:', e));
}

function checkBudget() {
  if (!weeklyBudget || weeklyBudget <= 0) return;
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0,0,0,0);

  let thisWeekExp = 0;
  (entries || []).forEach(e => {
    if (e.type === 'expense' && new Date(e.date) >= startOfWeek) {
      thisWeekExp += (parseFloat(e.amt) || 0);
    }
  });

  if (thisWeekExp > weeklyBudget) {
    toast(`⚠️ Budget Warning: Spent ₹${thisWeekExp} of ₹${weeklyBudget} weekly cap!`, 'warning');
  }
}

function checkHamburgerHint() {}

// --- Offline & Service Worker Support ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

// --- Network Sync Status Monitor ---
function updateNetworkSyncStatus() {
  const syncStatusEl = document.getElementById('sync-status');
  if (!syncStatusEl) return;
  const dot = syncStatusEl.previousElementSibling;

  if (navigator.onLine) {
    syncStatusEl.textContent = (currentLang === 'hi') ? 'क्लाउड से सिंक है' : 'Synced to cloud';
    if (dot) dot.style.background = 'var(--green)';
  } else {
    syncStatusEl.textContent = (currentLang === 'hi') ? 'ऑफलाइन मोड (लोकल सेव)' : 'Offline (Saved Locally)';
    if (dot) dot.style.background = 'var(--amber)';
  }
}

window.addEventListener('online', () => {
  updateNetworkSyncStatus();
  toast(currentLang === 'hi' ? 'इंटरनेट चालू — सभी डेटा सिंक हुआ!' : 'Back online — all offline entries synced to cloud!', 'success');
});

window.addEventListener('offline', () => {
  updateNetworkSyncStatus();
  toast(currentLang === 'hi' ? 'ऑफलाइन मोड — एंट्रीज फोन पर सुरक्षित हैं' : 'Offline mode — your entries are saved locally & will sync when online!', 'warning');
});

updateNetworkSyncStatus();
