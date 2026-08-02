/* Income/expense CRUD and entries snapshot listener with 10-entry limit for unverified users. */

const UNVERIFIED_LIMIT = 10;
let entries = [];
let unsubscribeEntries = null;

function checkEntryLimit() {
  const isUnverified = currentUser && !currentUser.emailVerified && currentUser.providerData?.[0]?.providerId === 'password';
  const limitBanner = document.getElementById('limit-banner');
  const limitText = document.getElementById('limit-banner-text');

  if (isUnverified) {
    const used = entries.length;
    if (limitBanner && limitText) {
      limitBanner.style.display = 'block';
      limitText.textContent = (typeof currentLang !== 'undefined' && currentLang === 'hi')
        ? `मुफ्त सीमा: आपने 10 में से ${used} एंट्रीज का उपयोग किया है।`
        : `Free limit: You have used ${used} of 10 free entries. Verify email for unlimited.`;
      
      if (used >= UNVERIFIED_LIMIT) {
        limitBanner.style.borderColor = 'rgba(255, 107, 107, 0.5)';
        limitBanner.style.background = 'rgba(255, 107, 107, 0.12)';
      }
    }
  } else {
    if (limitBanner) limitBanner.style.display = 'none';
  }
}

function isLimitReached() {
  const isUnverified = currentUser && !currentUser.emailVerified && currentUser.providerData?.[0]?.providerId === 'password';
  return isUnverified && entries.length >= UNVERIFIED_LIMIT;
}

function showLimitModal() {
  const msg = (typeof currentLang !== 'undefined' && currentLang === 'hi')
    ? `आपने अनवेरिफाइड ईमेल सीमा (10 एंट्रीज) पूरी कर ली है।\nअनलिमिटेड उपयोग के लिए कृपया अपना ईमेल वेरिफाई करें!`
    : `You have reached the limit of 10 free entries for unverified accounts.\nPlease verify your email to unlock unlimited entries!`;
  
  showAppAlert(msg);
}

function listenToEntries() {
  if (!currentUser) return;
  if (unsubscribeEntries) unsubscribeEntries();

  unsubscribeEntries = db.collection('users').doc(currentUser.uid).collection('entries')
    .orderBy('date', 'desc')
    .onSnapshot(snap => {
      entries = [];
      snap.forEach(doc => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      renderEntries();
      if (typeof renderBalanceStats === 'function') renderBalanceStats();
      if (typeof renderReport === 'function') renderReport();
      if (typeof updateStreak === 'function') updateStreak();
      checkEntryLimit();
    }, err => {
      console.error('Entries listener error:', err);
    });
}

async function addIncome() {
  if (isLimitReached()) {
    showLimitModal();
    return;
  }

  const srcSelect = document.getElementById('inc-src');
  let label = srcSelect.value;
  if (label === '__add_new__') {
    label = document.getElementById('inc-custom').value.trim() || 'Other Income';
  }
  const amt = parseFloat(document.getElementById('inc-amt').value);
  const date = document.getElementById('inc-date').value || todayStr();

  if (isNaN(amt) || amt <= 0) {
    toast((typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'कृपया सही राशि दर्ज करें' : 'Please enter a valid amount', 'error');
    return;
  }

  try {
    await saveEntry({
      type: 'income',
      cat: 'income',
      label: label,
      amt: amt,
      date: date
    });
    toast((typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'आय दर्ज की गई!' : 'Income recorded!', 'success');
    document.getElementById('inc-amt').value = '';
    if (document.getElementById('inc-custom')) document.getElementById('inc-custom').value = '';
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function addExpense() {
  if (isLimitReached()) {
    showLimitModal();
    return;
  }

  const cat = document.getElementById('exp-cat').value;
  const note = document.getElementById('exp-note').value.trim() || cat;
  const amt = parseFloat(document.getElementById('exp-amt').value);
  const date = document.getElementById('exp-date').value || todayStr();

  if (isNaN(amt) || amt <= 0) {
    toast((typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'कृपया सही राशि दर्ज करें' : 'Please enter a valid amount', 'error');
    return;
  }

  try {
    await saveEntry({
      type: 'expense',
      cat: cat,
      label: note,
      note: note,
      amt: amt,
      date: date
    });
    toast((typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'खर्च दर्ज किया गया!' : 'Expense recorded!', 'success');
    document.getElementById('exp-amt').value = '';
    document.getElementById('exp-note').value = '';
    if (typeof checkBudget === 'function') checkBudget();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function saveEntry(entryData) {
  if (!currentUser) return;
  return db.collection('users').doc(currentUser.uid).collection('entries').add({
    ...entryData,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function deleteEntry(id) {
  if (!currentUser) return;
  showAppConfirm((typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'क्या आप इस एंट्री को हटाना चाहते हैं?' : 'Delete entry?', async () => {
    try {
      await db.collection('users').doc(currentUser.uid).collection('entries').doc(id).delete();
      toast((typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'एंट्री हटाई गई' : 'Entry deleted', 'success');
    } catch(e) {
      toast('Error: ' + e.message, 'error');
    }
  });
}

function renderEntries() {
  const container = document.getElementById('entries-list');
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = `<p class="empty">${(typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'कोई एंट्री मौजूद नहीं है।' : 'No entries logged yet.'}</p>`;
    return;
  }

  let html = '';
  entries.forEach(e => {
    const isIncome = e.type === 'income';
    const color = isIncome ? 'var(--green)' : 'var(--red)';
    const sign = isIncome ? '+' : '-';
    const catIcon = isIncome ? '💰' : getCategoryEmoji(e.cat);

    html += `
      <div class="entry-row">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:22px;">${catIcon}</div>
          <div>
            <div style="font-weight:600; font-size:14.5px;">${escapeHTML(e.label || e.cat)}</div>
            <div style="font-size:11.5px; color:var(--text-dim);">${e.date} • ${escapeHTML(e.note || e.cat)}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-weight:700; color:${color}; font-size:15px;">${sign}₹${e.amt}</span>
          <button class="icon-btn" onclick="deleteEntry('${e.id}')" title="Delete"><i class="ti ti-trash" style="color:var(--red)"></i></button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function getCategoryEmoji(cat) {
  const map = {
    food: '🍔', travel: '🚗', shopping: '🛒', bills: '💡',
    health: '💊', entertainment: '🎬', education: '📚', home: '🏠', other: '💸'
  };
  return map[cat] || '💸';
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
