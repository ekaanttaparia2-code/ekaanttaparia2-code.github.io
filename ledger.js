Object.assign(TRANSLATIONS, {
  nav_ledger: { en: 'Ledger Accounts', hi: 'खाता प्रणाली' },
  btn_add_person: { en: '+ Add Contact', hi: '+ संपर्क जोड़ें' },
  ledger_total_owed_to_you: { en: 'Total You Will Receive', hi: 'आपको कुल मिलेगा' },
  ledger_total_you_owe: { en: 'Total You Owe', hi: 'आपको कुल देना है' },
  ledger_give: { en: 'Gave ₹', hi: '₹ दिए' },
  ledger_receive: { en: 'Received ₹', hi: '₹ मिले' },
  ledger_no_people: { en: 'No ledger contacts added yet.', hi: 'अभी तक कोई संपर्क नहीं जोड़ा गया है।' },
  ledger_person_name: { en: 'Contact Name (e.g. Rahul, Priya)', hi: 'संपर्क नाम (जैसे राहुल, प्रिया)' },
  btn_delete_person: { en: 'Delete Contact', hi: 'संपर्क हटाएं' }
});

let ledgerUnsubscribe = null;
let ledgerPeople = [];
const LOCAL_LEDGER_KEY = 'pockettrack_local_ledger';

try {
  const cached = localStorage.getItem(LOCAL_LEDGER_KEY);
  if (cached) ledgerPeople = JSON.parse(cached);
} catch(e){}

function saveLocalLedgerCache() {
  try {
    localStorage.setItem(LOCAL_LEDGER_KEY, JSON.stringify(ledgerPeople));
  } catch(e){}
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
          } catch(e){}
          remotePeople.push(personData);
        }
        if (remotePeople.length > 0) {
          ledgerPeople = remotePeople;
          saveLocalLedgerCache();
        }
        renderLedger();
      }, err => {
        console.warn('Firestore ledger listener warning, using local mode:', err.message);
        renderLedger();
      });
  } catch (e) {
    console.warn('Ledger listener warning:', e);
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
    document.getElementById('ledger-total-owed').textContent = '₹0';
    document.getElementById('ledger-total-owe').textContent = '₹0';
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
    
    const balColor = personBalance > 0 ? 'var(--green)' : (personBalance < 0 ? 'var(--red)' : 'var(--text-dim)');
    const balStatus = personBalance > 0 ? `Owes you ₹${personBalance}` : (personBalance < 0 ? `You owe ₹${Math.abs(personBalance)}` : 'Settled (₹0)');
    const avatarLetter = (person.name || 'P').charAt(0).toUpperCase();
    
    html += `
      <div class="card" style="padding:16px; margin-bottom:12px; cursor:pointer; transition:transform 0.2s;" onclick="showPersonDetail('${person._id}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg, var(--accent), var(--bg3)); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:18px; color:#fff;">
              ${avatarLetter}
            </div>
            <div>
              <h4 style="margin:0; font-size:16px;">${escapeHTML(person.name)}</h4>
              <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">${(person.transactions || []).length} transactions</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:15px; color:${balColor}">${balStatus}</div>
            <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">Tap for details →</div>
          </div>
        </div>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
  document.getElementById('ledger-total-owed').textContent = `₹${totalOwed}`;
  document.getElementById('ledger-total-owe').textContent = `₹${totalOwe}`;
}

function showAddPersonModal() {
  const content = `
    <div style="text-align:center; margin-bottom:16px;">
      <h3 style="margin:0 0 6px; font-family:'Space Grotesk',sans-serif; font-size:18px;">Add New Contact</h3>
      <p style="color:var(--text-dim); font-size:12.5px; margin:0;">Enter the name of a friend or contact</p>
    </div>
    <div style="margin-bottom:18px;">
      <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:6px;">Contact Name</label>
      <input type="text" id="custom-person-name-input" placeholder="e.g. Rahul, Priya, Roommate" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,0.06); color:#fff; font-size:14px;" autofocus/>
    </div>
    <div class="btn-row" style="justify-content:flex-end; gap:10px;">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="submitAddPersonModal()">Save Contact</button>
    </div>
  `;
  showAppAlert(content);
}

function submitAddPersonModal() {
  const inputEl = document.getElementById('custom-person-name-input');
  if (!inputEl) return;
  const name = inputEl.value.trim();
  if (!name) {
    toast('Please enter a contact name', 'error');
    return;
  }
  closeModal();
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
        name: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      newPerson._id = docRef.id;
      saveLocalLedgerCache();
    } catch(e) {
      console.warn('Firestore write warning:', e.message);
    }
  }

  toast('Added ' + name, 'success');
}

function showAddLedgerTxModal(personId, type) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;

  const typeLabel = type === 'gave' ? 'Gave ₹' : 'Received ₹';
  const typeColor = type === 'gave' ? 'var(--green)' : 'var(--red)';

  const content = `
    <div style="text-align:center; margin-bottom:16px;">
      <h3 style="margin:0 0 4px; font-family:'Space Grotesk',sans-serif; font-size:18px;">${escapeHTML(person.name)}</h3>
      <div style="font-weight:700; color:${typeColor}; font-size:15px;">Record ${typeLabel}</div>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Amount (₹)</label>
      <input type="number" id="custom-ledger-tx-amt" placeholder="e.g. 500" min="1" step="1" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,0.06); color:#fff; font-size:16px; font-weight:700;" autofocus/>
    </div>
    <div style="margin-bottom:18px;">
      <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Note (optional)</label>
      <input type="text" id="custom-ledger-tx-note" placeholder="e.g. Dinner share, Rent, Petrol" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,0.06); color:#fff; font-size:14px;"/>
    </div>
    <div class="btn-row" style="justify-content:flex-end; gap:10px;">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="submitAddLedgerTx('${personId}', '${type}')">Save Entry</button>
    </div>
  `;
  showAppAlert(content);
}

function submitAddLedgerTx(personId, type) {
  const amtEl = document.getElementById('custom-ledger-tx-amt');
  const noteEl = document.getElementById('custom-ledger-tx-note');
  if (!amtEl) return;

  const amount = parseFloat(amtEl.value);
  if (isNaN(amount) || amount <= 0) {
    toast('Please enter a valid amount', 'error');
    return;
  }

  const note = noteEl ? noteEl.value.trim() : '';
  closeModal();
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

async function deleteLedgerPerson(personId) {
  showAppConfirm('Delete contact and all history?', async () => {
    ledgerPeople = ledgerPeople.filter(p => p._id !== personId);
    saveLocalLedgerCache();
    closeModal();
    renderLedger();

    if (currentUser && !personId.startsWith('local_')) {
      try {
        await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).delete();
      } catch(e) {
        console.warn('Firestore delete warning:', e.message);
      }
    }
    toast('Contact deleted', 'success');
  });
}

function showPersonDetail(personId) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;
  
  let personBalance = 0;
  (person.transactions || []).forEach(tx => {
    if (tx.type === 'gave') personBalance += tx.amount;
    else if (tx.type === 'received') personBalance -= tx.amount;
  });
  
  const balColor = personBalance > 0 ? 'var(--green)' : (personBalance < 0 ? 'var(--red)' : 'var(--text-dim)');
  const balStatus = personBalance > 0 ? `Owes you ₹${personBalance}` : (personBalance < 0 ? `You owe ₹${Math.abs(personBalance)}` : 'Settled up');

  let txHtml = (person.transactions && person.transactions.length) ? person.transactions.map(tx => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; margin-bottom:8px; border:1px solid var(--border)">
      <div>
        <div style="font-weight:700; color:${tx.type === 'gave' ? 'var(--green)' : 'var(--red)'}">
          ${tx.type === 'gave' ? 'Gave' : 'Received'} ₹${tx.amount}
        </div>
        <div style="font-size:11.5px; color:var(--text-dim); margin-top:2px;">${tx.date || ''} ${tx.note ? '• ' + escapeHTML(tx.note) : ''}</div>
      </div>
      <button class="icon-btn" onclick="deleteLedgerTx('${personId}', '${tx._id}')" title="Delete entry"><i class="ti ti-trash" style="color:var(--red)"></i></button>
    </div>
  `).join('') : '<p style="text-align:center; color:var(--text-dim); padding:20px 0;">No entries yet with ' + escapeHTML(person.name) + '</p>';
  
  const content = `
    <div style="text-align:center; margin-bottom:16px;">
      <h3 style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:20px;">${escapeHTML(person.name)}</h3>
      <div style="font-size:14px; font-weight:700; color:${balColor}; margin-top:4px;">${balStatus}</div>
    </div>
    <div class="btn-row" style="margin-bottom:18px; gap:10px;">
      <button class="btn primary" style="flex:1" onclick="showAddLedgerTxModal('${personId}', 'gave')"><i class="ti ti-arrow-up-right"></i> Gave ₹</button>
      <button class="btn danger" style="flex:1" onclick="showAddLedgerTxModal('${personId}', 'received')"><i class="ti ti-arrow-down-left"></i> Received ₹</button>
    </div>
    <div style="max-height:260px; overflow-y:auto; margin-bottom:16px;">
      ${txHtml}
    </div>
    <div style="text-align:center">
      <button class="btn" style="background:rgba(255,107,107,0.15); color:var(--red); border-color:rgba(255,107,107,0.3);" onclick="deleteLedgerPerson('${personId}')"><i class="ti ti-trash"></i> ${TT('btn_delete_person')}</button>
    </div>
  `;
  showAppAlert(content);
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
