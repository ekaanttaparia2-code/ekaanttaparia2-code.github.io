Object.assign(TRANSLATIONS, {
  nav_ledger: { en: 'Ledger Accounts', hi: 'खाता प्रणाली' },
  btn_add_person: { en: '+ Add Contact', hi: '+ संपर्क जोड़ें' },
  ledger_total_owed_to_you: { en: 'Total You Will Receive', hi: 'आपको कुल मिलेगा' },
  ledger_total_you_owe: { en: 'Total You Owe', hi: 'आपको कुल देना है' },
  ledger_give: { en: 'Gave ₹', hi: '₹ दिए' },
  ledger_receive: { en: 'Received ₹', hi: '₹ मिले' },
  ledger_no_people: { en: 'No ledger contacts added yet.', hi: 'अभी तक कोई संपर्क नहीं जोड़ा गया है।' },
  ledger_person_name: { en: 'Contact Name (e.g. Rahul, Priya, Roommate)', hi: 'संपर्क नाम (जैसे राहुल, प्रिया)' },
  btn_delete_person: { en: 'Delete Contact', hi: 'संपर्क हटाएं' }
});

let ledgerUnsubscribe = null;
let ledgerPeople = [];
const LOCAL_LEDGER_KEY = 'pockettrack_local_ledger';

// Load cached ledger people if available
try {
  const cached = localStorage.getItem(LOCAL_LEDGER_KEY);
  if (cached) ledgerPeople = JSON.parse(cached);
} catch(e){}

function saveLocalLedgerCache() {
  try {
    localStorage.setItem(LOCAL_LEDGER_KEY, JSON.stringify(ledgerPeople));
  } catch(e){}
}

// Dedicated Custom Glassmorphism Modal System for Ledger (Zero browser prompts)
function openLedgerModal(htmlContent) {
  let backdrop = document.getElementById('ledger-custom-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'ledger-custom-modal-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(10,8,26,0.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(backdrop);
  }
  backdrop.innerHTML = `
    <div class="card" style="width:100%;max-width:420px;background:var(--card-solid,#1f1840);border:1px solid rgba(255,255,255,0.15);box-shadow:0 20px 50px rgba(0,0,0,0.6);position:relative;padding:24px 20px;border-radius:20px;max-height:88vh;display:flex;flex-direction:column;">
      <button class="icon-btn" onclick="closeLedgerModal()" style="position:absolute;top:16px;right:16px;font-size:20px;color:var(--text-dim,#9ca3af);"><i class="ti ti-x"></i></button>
      ${htmlContent}
    </div>
  `;
  backdrop.style.display = 'flex';
}

function closeLedgerModal() {
  const backdrop = document.getElementById('ledger-custom-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function closeModal() {
  closeLedgerModal();
  if (typeof closeAppModal === 'function') closeAppModal();
}

function listenToLedger() {
  if (!currentUser) return;
  if (ledgerUnsubscribe) ledgerUnsubscribe();
  
  try {
    ledgerUnsubscribe = db.collection('users').doc(currentUser.uid).collection('ledger')
      .onSnapshot(async (snap) => {
        const remotePeople = [];
        for (const d of snap.docs) {
          const personData = { ...d.data(), _id: d.id, transactions: [] };
          try {
            const txSnap = await db.collection('users').doc(currentUser.uid).collection('ledger').doc(d.id).collection('transactions').get();
            txSnap.forEach(t => {
              personData.transactions.push({ ...t.data(), _id: t.id });
            });
            personData.transactions.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
          } catch(e) {
            console.error('Err fetching ledger txs:', e);
          }
          remotePeople.push(personData);
        }
        if (remotePeople.length > 0) {
          ledgerPeople = remotePeople;
          saveLocalLedgerCache();
        }
        renderLedger();
      }, err => {
        console.warn('Ledger listener warning, using local mode:', err.message);
        renderLedger();
      });
  } catch (e) {
    console.warn('Failed to attach ledger listener:', e);
    renderLedger();
  }
}

function renderLedger() {
  const listEl = document.getElementById('ledger-people-list');
  if (!listEl) return;
  
  if (!ledgerPeople || ledgerPeople.length === 0) {
    listEl.innerHTML = `
      <div class="card" style="text-align:center; padding:35px 20px;">
        <div style="font-size:48px; margin-bottom:12px;">📑</div>
        <h3 style="margin:0 0 8px; font-family:'Space Grotesk',sans-serif;">No Ledger Contacts Yet</h3>
        <p style="color:var(--text-dim); font-size:13.5px; max-width:320px; margin:0 auto 20px; line-height:1.4;">
          Keep track of money lent to or borrowed from friends, roommates, or vendors in one single place.
        </p>
        <button class="btn primary" onclick="showAddPersonModal()"><i class="ti ti-user-plus"></i> ${TT('btn_add_person')}</button>
      </div>
    `;
    const owedEl = document.getElementById('ledger-total-owed');
    const oweEl = document.getElementById('ledger-total-owe');
    if (owedEl) owedEl.textContent = '₹0';
    if (oweEl) oweEl.textContent = '₹0';
    return;
  }
  
  let totalOwed = 0;
  let totalOwe = 0;
  
  let html = '';
  ledgerPeople.forEach(person => {
    let personBalance = 0;
    (person.transactions || []).forEach(tx => {
      if (tx.type === 'gave') personBalance += tx.amount;
      else if (tx.type === 'received') personBalance -= tx.amount;
    });
    
    if (personBalance > 0) totalOwed += personBalance;
    else if (personBalance < 0) totalOwe += Math.abs(personBalance);
    
    const balColor = personBalance > 0 ? 'var(--green,#4ade80)' : (personBalance < 0 ? 'var(--red,#f87171)' : 'var(--text-dim,#9ca3af)');
    const balStatus = personBalance > 0 ? `Owes you ₹${personBalance}` : (personBalance < 0 ? `You owe ₹${Math.abs(personBalance)}` : 'Settled (₹0)');
    const avatarLetter = (person.name || 'P').charAt(0).toUpperCase();
    
    html += `
      <div class="card" style="padding:16px; margin-bottom:12px; cursor:pointer; transition:transform 0.2s;" onclick="showPersonDetail('${person._id}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg, var(--accent,#8b5cf6), var(--accent2,#ec4899)); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:18px; color:#fff;">
              ${avatarLetter}
            </div>
            <div>
              <h4 style="margin:0; font-size:16px;">${escapeHTML(person.name)}</h4>
              <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">${(person.transactions || []).length} transactions</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:15px; color:${balColor}">${balStatus}</div>
            <div style="font-size:11px; color:var(--text-faint,#6b7280); margin-top:2px;">Tap for history →</div>
          </div>
        </div>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
  const owedEl = document.getElementById('ledger-total-owed');
  const oweEl = document.getElementById('ledger-total-owe');
  if (owedEl) owedEl.textContent = `₹${totalOwed}`;
  if (oweEl) oweEl.textContent = `₹${totalOwe}`;
}

// In-App Modal for Adding a Contact (No browser prompt)
function showAddPersonModal() {
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  const title = isHi ? 'नया संपर्क जोड़ें' : 'Add New Contact';
  const desc = isHi ? 'मित्र, रूममेट या संपर्क का नाम दर्ज करें' : 'Enter the name of a friend, roommate, or vendor';
  const btnSave = isHi ? '+ संपर्क जोड़ें' : '+ Save Contact';
  
  const html = `
    <div style="text-align:center; margin-bottom:18px;">
      <div style="font-size:38px; margin-bottom:6px;">📑</div>
      <h3 style="margin:0 0 4px; font-family:'Space Grotesk',sans-serif; font-size:20px;">${title}</h3>
      <p style="color:var(--text-dim); font-size:13px; margin:0;">${desc}</p>
    </div>
    <div style="margin-bottom:20px;">
      <label style="font-size:12px; font-weight:600; color:var(--text-dim); display:block; margin-bottom:6px;">${isHi ? 'संपर्क का नाम' : 'Contact Name'}</label>
      <input type="text" id="new-person-name-input" placeholder="e.g. Rahul, Priya, Roommate" style="width:100%; padding:12px 14px; border-radius:12px; border:1px solid var(--border); background:rgba(0,0,0,0.3); color:#fff; font-size:15px;" autofocus onkeydown="if(event.key==='Enter')submitAddPersonModal()"/>
    </div>
    <div class="btn-row" style="gap:10px;">
      <button class="btn" style="flex:1" onclick="closeLedgerModal()">${isHi ? 'रद्द करें' : 'Cancel'}</button>
      <button class="btn primary" style="flex:1; padding:12px; font-weight:700;" onclick="submitAddPersonModal()">${btnSave}</button>
    </div>
  `;
  openLedgerModal(html);
  setTimeout(() => document.getElementById('new-person-name-input')?.focus(), 100);
}

function submitAddPersonModal() {
  const inputEl = document.getElementById('new-person-name-input');
  if (!inputEl) return;
  const name = inputEl.value.trim();
  if (!name) {
    toast('Please enter a contact name', 'error');
    return;
  }
  closeLedgerModal();
  addLedgerPerson(name);
}

async function addLedgerPerson(name) {
  const newPerson = {
    _id: 'local_' + Date.now(),
    name: name,
    createdAt: Date.now(),
    transactions: []
  };

  ledgerPeople.unshift(newPerson);
  saveLocalLedgerCache();
  renderLedger();

  if (currentUser) {
    try {
      const docRef = await db.collection('users').doc(currentUser.uid).collection('ledger').add({
        name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      newPerson._id = docRef.id;
      saveLocalLedgerCache();
    } catch (e) {
      console.warn('Firestore write warning:', e.message);
    }
  }

  toast('Added ' + name, 'success');
}

// In-App Modal for Adding a Transaction (Gave ₹ / Received ₹)
function showAddTxModal(personId, type) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;
  
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  const isGave = type === 'gave';
  const badgeColor = isGave ? 'var(--green,#4ade80)' : 'var(--red,#f87171)';
  const btnClass = isGave ? 'primary' : 'danger';
  
  const html = `
    <div style="text-align:center; margin-bottom:18px;">
      <h3 style="margin:0 0 4px; font-family:'Space Grotesk',sans-serif; font-size:20px;">${escapeHTML(person.name)}</h3>
      <span style="display:inline-block; padding:3px 12px; border-radius:12px; font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); color:${badgeColor}; border:1px solid ${badgeColor}44;">
        ${isGave ? '↗ Gave ₹' : '↘ Received ₹'}
      </span>
    </div>
    
    <div style="margin-bottom:14px;">
      <label style="font-size:12px; font-weight:600; color:var(--text-dim); display:block; margin-bottom:6px;">${isHi ? 'राशि (₹)' : 'Amount (₹)'}</label>
      <input type="number" id="ledger-tx-amt-input" placeholder="0" min="1" step="1" style="width:100%; padding:12px 14px; border-radius:12px; border:1px solid var(--border); background:rgba(0,0,0,0.3); color:#fff; font-size:18px; font-weight:800;" autofocus onkeydown="if(event.key==='Enter')document.getElementById('ledger-tx-note-input')?.focus()"/>
    </div>

    <div style="margin-bottom:20px;">
      <label style="font-size:12px; font-weight:600; color:var(--text-dim); display:block; margin-bottom:6px;">${isHi ? 'विवरण / कारण (ऐच्छिक)' : 'Note / Reason (optional)'}</label>
      <input type="text" id="ledger-tx-note-input" placeholder="e.g. Lunch share, Rent, Petrol" style="width:100%; padding:11px 14px; border-radius:12px; border:1px solid var(--border); background:rgba(0,0,0,0.3); color:#fff; font-size:14px;" onkeydown="if(event.key==='Enter')submitAddTxModal('${personId}', '${type}')"/>
    </div>

    <div class="btn-row" style="gap:10px;">
      <button class="btn" style="flex:1" onclick="showPersonDetail('${personId}')">${isHi ? 'रद्द करें' : 'Cancel'}</button>
      <button class="btn ${btnClass}" style="flex:1; padding:12px; font-weight:700;" onclick="submitAddTxModal('${personId}', '${type}')">${isHi ? 'सहेजें' : 'Save Entry'}</button>
    </div>
  `;
  openLedgerModal(html);
  setTimeout(() => document.getElementById('ledger-tx-amt-input')?.focus(), 100);
}

function submitAddTxModal(personId, type) {
  const amtEl = document.getElementById('ledger-tx-amt-input');
  const noteEl = document.getElementById('ledger-tx-note-input');
  if (!amtEl) return;

  const amount = parseFloat(amtEl.value);
  if (isNaN(amount) || amount <= 0) {
    toast('Please enter a valid amount', 'error');
    return;
  }

  const note = noteEl ? noteEl.value.trim() : '';
  closeLedgerModal();
  saveLedgerTx(personId, type, amount, note);
}

async function saveLedgerTx(personId, type, amount, note) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;

  const dateStr = (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().split('T')[0]);
  const newTx = {
    _id: 'local_tx_' + Date.now(),
    type: type,
    amount: amount,
    note: note,
    date: dateStr,
    createdAt: Date.now()
  };

  if (!person.transactions) person.transactions = [];
  person.transactions.unshift(newTx);
  saveLocalLedgerCache();
  renderLedger();
  showPersonDetail(personId);

  if (currentUser && !personId.startsWith('local_')) {
    try {
      await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).collection('transactions').add({
        amount: amount,
        type: type,
        note: note,
        date: dateStr,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {
      console.warn('Firestore tx write warning:', e.message);
    }
  }

  toast('Recorded ' + (type === 'gave' ? 'Gave' : 'Received') + ' ₹' + amount, 'success');
}

// Sleek In-App Person Detail Card Modal
function showPersonDetail(personId) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;
  
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  let personBalance = 0;
  (person.transactions || []).forEach(tx => {
    if (tx.type === 'gave') personBalance += tx.amount;
    else if (tx.type === 'received') personBalance -= tx.amount;
  });

  const avatarLetter = (person.name || 'P').charAt(0).toUpperCase();
  let balStatusText = '';
  let balBadgeStyle = '';

  if (personBalance > 0) {
    balStatusText = isHi ? `आपको ₹${personBalance} मिलेगा` : `Owes you ₹${personBalance}`;
    balBadgeStyle = 'background:rgba(74,222,128,0.15); color:var(--green,#4ade80); border:1px solid rgba(74,222,128,0.3);';
  } else if (personBalance < 0) {
    balStatusText = isHi ? `आपको ₹${Math.abs(personBalance)} देना है` : `You owe ₹${Math.abs(personBalance)}`;
    balBadgeStyle = 'background:rgba(248,113,113,0.15); color:var(--red,#f87171); border:1px solid rgba(248,113,113,0.3);';
  } else {
    balStatusText = isHi ? 'सब चुकता (₹0)' : 'Settled up (₹0)';
    balBadgeStyle = 'background:rgba(255,255,255,0.08); color:var(--text-dim,#9ca3af); border:1px solid var(--border);';
  }

  let txHtml = (person.transactions && person.transactions.length) ? person.transactions.map(tx => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:12px 14px; border-radius:12px; margin-bottom:8px; border:1px solid var(--border)">
      <div>
        <div style="font-weight:700; font-size:14px; color:${tx.type === 'gave' ? 'var(--green,#4ade80)' : 'var(--red,#f87171)'}">
          ${tx.type === 'gave' ? '↗ Gave' : '↘ Received'} ₹${tx.amount}
        </div>
        <div style="font-size:11.5px; color:var(--text-dim); margin-top:2px;">${tx.date || ''} ${tx.note ? '• ' + escapeHTML(tx.note) : ''}</div>
      </div>
      <button class="icon-btn" onclick="deleteLedgerTx('${personId}', '${tx._id}')" title="Delete entry" style="color:var(--red,#f87171); padding:4px;"><i class="ti ti-trash"></i></button>
    </div>
  `).join('') : `<p style="text-align:center; color:var(--text-dim); padding:24px 0; font-size:13px;">No transaction entries yet with ${escapeHTML(person.name)}</p>`;

  const deleteBtnText = isHi ? '🗑️ संपर्क हटाएं' : '🗑️ Delete Contact';

  const html = `
    <div style="text-align:center; margin-bottom:18px;">
      <div style="width:52px; height:52px; border-radius:50%; background:linear-gradient(135deg, var(--accent,#8b5cf6), var(--accent2,#ec4899)); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:22px; color:#fff; margin:0 auto 10px; box-shadow:0 4px 16px rgba(139,92,246,0.4);">
        ${avatarLetter}
      </div>
      <h3 style="margin:0 0 6px; font-family:'Space Grotesk',sans-serif; font-size:22px;">${escapeHTML(person.name)}</h3>
      <span style="display:inline-block; padding:4px 14px; border-radius:14px; font-size:12.5px; font-weight:700; ${balBadgeStyle}">
        ${balStatusText}
      </span>
    </div>

    <div class="btn-row" style="margin-bottom:18px; gap:10px;">
      <button class="btn primary" style="flex:1; padding:12px; font-weight:700;" onclick="showAddTxModal('${personId}', 'gave')"><i class="ti ti-arrow-up-right"></i> Gave ₹</button>
      <button class="btn danger" style="flex:1; padding:12px; font-weight:700;" onclick="showAddTxModal('${personId}', 'received')"><i class="ti ti-arrow-down-left"></i> Received ₹</button>
    </div>

    <div style="font-size:12px; font-weight:700; color:var(--text-dim); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">History</div>
    
    <div style="max-height:220px; overflow-y:auto; margin-bottom:18px; padding-right:2px;">
      ${txHtml}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:14px;">
      <button class="btn" style="background:rgba(248,113,113,0.12); color:var(--red,#f87171); border-color:rgba(248,113,113,0.3); font-size:12px;" onclick="deleteLedgerPerson('${personId}')">${deleteBtnText}</button>
      <button class="btn" onclick="closeLedgerModal()">${isHi ? 'बंद करें' : 'Close'}</button>
    </div>
  `;
  openLedgerModal(html);
}

async function deleteLedgerPerson(personId) {
  const isHi = (typeof currentLang !== 'undefined' && currentLang === 'hi');
  const msg = isHi ? 'संपर्क और सभी लेनदेन इतिहास हटाएं?' : 'Delete contact and all transaction history?';
  
  if (typeof showAppConfirm === 'function') {
    showAppConfirm(msg, async () => {
      ledgerPeople = ledgerPeople.filter(p => p._id !== personId);
      saveLocalLedgerCache();
      closeLedgerModal();
      renderLedger();

      if (currentUser && !personId.startsWith('local_')) {
        try {
          await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).delete();
        } catch(e) {
          console.warn('Firestore delete warning:', e.message);
        }
      }
      toast(isHi ? 'संपर्क हटाया गया' : 'Contact deleted', 'success');
    });
  } else if (confirm(msg)) {
    ledgerPeople = ledgerPeople.filter(p => p._id !== personId);
    saveLocalLedgerCache();
    closeLedgerModal();
    renderLedger();
    toast(isHi ? 'संपर्क हटाया गया' : 'Contact deleted', 'success');
  }
}

async function deleteLedgerTx(personId, txId) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;

  person.transactions = (person.transactions || []).filter(t => t._id !== txId);
  saveLocalLedgerCache();
  renderLedger();
  showPersonDetail(personId);

  if (currentUser && !txId.startsWith('local_')) {
    try {
      await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).collection('transactions').doc(txId).delete();
    } catch(e) {
      console.warn('Firestore tx delete warning:', e.message);
    }
  }
  toast('Entry deleted', 'success');
}

// Attach listener on auth change
if (window.firebase && firebase.auth()) {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      listenToLedger();
    } else {
      if (ledgerUnsubscribe) { ledgerUnsubscribe(); ledgerUnsubscribe = null; }
      ledgerPeople = [];
    }
  });
}
