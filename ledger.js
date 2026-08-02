Object.assign(TRANSLATIONS, {
  nav_ledger: { en: 'Ledger Accounts', hi: 'खाता प्रणाली' },
  btn_add_person: { en: '+ Add Contact', hi: '+ संपर्क जोड़ें' },
  ledger_total_owed_to_you: { en: 'Total You Will Receive', hi: 'आपको कुल मिलेगा' },
  ledger_total_you_owe: { en: 'Total You Owe', hi: 'आपको कुल देना है' },
  ledger_give: { en: 'Gave ₹', hi: '₹ दिए' },
  ledger_receive: { en: 'Received ₹', hi: '₹ मिले' },
  ledger_no_people: { en: 'No ledger contacts added yet.', hi: 'अभी तक कोई संपर्क नहीं जोड़ा गया है।' },
  ledger_person_name: { en: 'Contact Name (e.g. Rahul, Priya, Roommate)', hi: 'संपर्क नाम (जैसे राहुल, प्रिया)' },
});

let ledgerUnsubscribe = null;
function closeModal() {
  if (typeof closeAppModal === 'function') closeAppModal();
  const backdrop = document.getElementById('app-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
}
let ledgerPeople = [];

function listenToLedger() {
  if (!currentUser) return;
  if (ledgerUnsubscribe) ledgerUnsubscribe();
  
  try {
    ledgerUnsubscribe = db.collection('users').doc(currentUser.uid).collection('ledger')
      .onSnapshot(async (snap) => {
        ledgerPeople = [];
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
          ledgerPeople.push(personData);
        }
        renderLedger();
      }, err => {
        console.error('Ledger listener error:', err);
      });
  } catch (e) {
    console.error('Failed to attach ledger listener:', e);
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
    person.transactions.forEach(tx => {
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
              <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">${person.transactions.length} transactions</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:15px; color:${balColor}">${balStatus}</div>
            <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">Tap for history →</div>
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
  const name = prompt(TT('ledger_person_name'));
  if (!name || !name.trim()) return;
  addLedgerPerson(name.trim());
}

async function addLedgerPerson(name) {
  if (!currentUser) {
    toast('Please sign in to manage ledger', 'error');
    return;
  }
  try {
    await db.collection('users').doc(currentUser.uid).collection('ledger').add({
      name, createdAt: Date.now()
    });
    toast('Added ' + name, 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteLedgerPerson(personId) {
  if (!currentUser) return;
  showAppConfirm('Delete contact and all transaction history?', async () => {
    try {
      await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).delete();
      closeAppModal();
      toast('Contact deleted', 'success');
    } catch(e) {
      toast('Error: ' + e.message, 'error');
    }
  });
}

function showLedgerHtmlModal(contentHtml) {
  const titleEl = document.getElementById('app-modal-title');
  const msgEl = document.getElementById('app-modal-message');
  const btnEl = document.getElementById('app-modal-buttons');
  const backdrop = document.getElementById('app-modal-backdrop');

  if (titleEl && msgEl && backdrop) {
    titleEl.textContent = 'Ledger Details';
    msgEl.innerHTML = contentHtml;
    if (btnEl) btnEl.innerHTML = `<button class="btn" style="flex:1" onclick="closeAppModal()">Close</button>`;
    backdrop.style.display = 'flex';
  }
}

function showPersonDetail(personId) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;
  
  let personBalance = 0;
  person.transactions.forEach(tx => {
    if (tx.type === 'gave') personBalance += tx.amount;
    else if (tx.type === 'received') personBalance -= tx.amount;
  });
  
  const balColor = personBalance > 0 ? 'var(--green)' : (personBalance < 0 ? 'var(--red)' : 'var(--text-dim)');
  const balStatus = personBalance > 0 ? `Owes you ₹${personBalance}` : (personBalance < 0 ? `You owe ₹${Math.abs(personBalance)}` : 'Settled up');

  let txHtml = person.transactions.length ? person.transactions.map(tx => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:10px; margin-bottom:8px; border:1px solid var(--border)">
      <div>
        <div style="font-weight:700; color:${tx.type === 'gave' ? 'var(--green)' : 'var(--red)'}">
          ${tx.type === 'gave' ? 'Gave' : 'Received'} ₹${tx.amount}
        </div>
        <div style="font-size:11.5px; color:var(--text-dim); margin-top:2px;">${tx.date || ''} ${tx.note ? '• ' + escapeHTML(tx.note) : ''}</div>
      </div>
      <button class="icon-btn" onclick="deleteLedgerTx('${personId}', '${tx._id}')" title="Delete transaction"><i class="ti ti-trash" style="color:var(--red)"></i></button>
    </div>
  `).join('') : '<p style="text-align:center; color:var(--text-dim); padding:20px 0;">No entries yet with ' + escapeHTML(person.name) + '</p>';
  
  const content = `
    <div style="text-align:center; margin-bottom:16px;">
      <h3 style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:20px;">${escapeHTML(person.name)}</h3>
      <div style="font-size:14px; font-weight:700; color:${balColor}; margin-top:4px;">${balStatus}</div>
    </div>
    <div class="btn-row" style="margin-bottom:18px">
      <button class="btn primary" style="flex:1" onclick="addLedgerTx('${personId}', 'gave')"><i class="ti ti-arrow-up-right"></i> Gave ₹</button>
      <button class="btn danger" style="flex:1" onclick="addLedgerTx('${personId}', 'received')"><i class="ti ti-arrow-down-left"></i> Received ₹</button>
    </div>
    <div style="max-height:280px; overflow-y:auto; margin-bottom:16px;">
      ${txHtml}
    </div>
    <div style="text-align:center">
      <button class="btn" style="background:rgba(255,107,107,0.15); color:var(--red); border-color:rgba(255,107,107,0.3);" onclick="deleteLedgerPerson('${personId}')"><i class="ti ti-trash"></i> ${TT('btn_delete_person')}</button>
    </div>
  `;
  showLedgerHtmlModal(content);
}

async function addLedgerTx(personId, type) {
  const amtStr = prompt('Amount (₹):');
  if (!amtStr) return;
  const amount = parseFloat(amtStr);
  if (isNaN(amount) || amount <= 0) {
    toast('Invalid amount', 'error');
    return;
  }
  
  const note = prompt('Note (e.g. Lunch, Rent share, Uber):') || '';
  
  try {
    await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).collection('transactions').add({
      amount, type, note, date: (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().split('T')[0]), createdAt: Date.now()
    });
    closeAppModal();
    toast('Entry saved!', 'success');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteLedgerTx(personId, txId) {
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).collection('transactions').doc(txId).delete();
    closeAppModal();
    toast('Entry deleted', 'success');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
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
