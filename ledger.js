Object.assign(TRANSLATIONS, {
  nav_ledger: { en: 'Ledger', hi: 'खाता (लेजर)' },
  btn_add_person: { en: 'Add Person', hi: 'व्यक्ति जोड़ें' },
  ledger_total_owed_to_you: { en: 'Total Owed to You', hi: 'आपको कुल मिलना है' },
  ledger_total_you_owe: { en: 'You Owe', hi: 'आपको कुल देना है' },
  ledger_give: { en: 'Gave ₹', hi: '₹ दिए' },
  ledger_receive: { en: 'Received ₹', hi: '₹ मिले' },
  ledger_no_people: { en: 'No people added yet.', hi: 'अभी तक कोई व्यक्ति नहीं जोड़ा गया है।' },
  ledger_person_name: { en: 'Person Name', hi: 'व्यक्ति का नाम' },
  btn_delete_person: { en: 'Delete Person', hi: 'व्यक्ति हटाएं' }
});

let ledgerUnsubscribe = null;
let ledgerPeople = [];

function listenToLedger() {
  if (!currentUser) return;
  if (ledgerUnsubscribe) ledgerUnsubscribe();
  
  ledgerUnsubscribe = db.collection('users').doc(currentUser.uid).collection('ledger')
    .onSnapshot(async (snap) => {
      ledgerPeople = [];
      for (const d of snap.docs) {
        const personData = { ...d.data(), _id: d.id, transactions: [] };
        // Fetch transactions for this person
        const txSnap = await db.collection('users').doc(currentUser.uid).collection('ledger').doc(d.id).collection('transactions').get();
        txSnap.forEach(t => {
          personData.transactions.push({ ...t.data(), _id: t.id });
        });
        personData.transactions.sort((a,b) => b.createdAt - a.createdAt);
        ledgerPeople.push(personData);
      }
      renderLedger();
    }, err => {
      console.error(err);
    });
}

function renderLedger() {
  const listEl = document.getElementById('ledger-people-list');
  if (!listEl) return;
  
  if (ledgerPeople.length === 0) {
    listEl.innerHTML = `<p class="empty">${TT('ledger_no_people')}</p>`;
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
    const balText = personBalance > 0 ? `+₹${personBalance}` : (personBalance < 0 ? `-₹${Math.abs(personBalance)}` : '₹0');
    
    html += `
      <div class="card" style="padding:15px; cursor:pointer;" onclick="showPersonDetail('${person._id}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="margin:0; font-size:16px;">${escapeHTML(person.name)}</h4>
          <span style="font-weight:bold; color:${balColor}">${balText}</span>
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
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('ledger').add({
      name, createdAt: Date.now()
    });
    toast(TT('btn_add') + ' ' + name, 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteLedgerPerson(personId) {
  if (!currentUser) return;
  showAppConfirm(TT('btn_delete_person') + '?', async () => {
    try {
      await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).delete();
      closeModal();
      toast('Deleted', 'success');
    } catch(e) {
      toast('Error: ' + e.message, 'error');
    }
  });
}

function showPersonDetail(personId) {
  const person = ledgerPeople.find(p => p._id === personId);
  if (!person) return;
  
  let txHtml = person.transactions.length ? person.transactions.map(tx => `
    <div class="entry-row" style="justify-content:space-between">
      <div>
        <div style="font-weight:bold; color:${tx.type === 'gave' ? 'var(--green)' : 'var(--red)'}">
          ${tx.type === 'gave' ? 'Gave' : 'Received'} ₹${tx.amount}
        </div>
        <div style="font-size:11px; color:var(--text-dim)">${tx.date} • ${escapeHTML(tx.note)}</div>
      </div>
      <button class="icon-btn" onclick="deleteLedgerTx('${personId}', '${tx._id}')"><i class="ti ti-trash"></i></button>
    </div>
  `).join('') : '<p class="empty">No transactions yet.</p>';
  
  const content = `
    <h3 class="sec-title" style="margin-top:0">${escapeHTML(person.name)}</h3>
    <div class="btn-row" style="margin-bottom:15px">
      <button class="btn primary" onclick="addLedgerTx('${personId}', 'gave')"><i class="ti ti-arrow-up-right"></i> Gave ₹</button>
      <button class="btn danger" onclick="addLedgerTx('${personId}', 'received')"><i class="ti ti-arrow-down-left"></i> Received ₹</button>
    </div>
    <div style="max-height:300px; overflow-y:auto; margin-bottom:15px;">
      ${txHtml}
    </div>
    <div style="text-align:right">
      <button class="btn danger" style="background:transparent" onclick="deleteLedgerPerson('${personId}')">${TT('btn_delete_person')}</button>
    </div>
  `;
  showAppAlert(content);
}

async function addLedgerTx(personId, type) {
  const amtStr = prompt('Amount (₹):');
  if (!amtStr) return;
  const amount = parseFloat(amtStr);
  if (isNaN(amount) || amount <= 0) return;
  
  const note = prompt('Note (optional):') || '';
  
  try {
    await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).collection('transactions').add({
      amount, type, note, date: todayStr(), createdAt: Date.now()
    });
    closeModal();
    toast('Added', 'success');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteLedgerTx(personId, txId) {
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('ledger').doc(personId).collection('transactions').doc(txId).delete();
    closeModal();
    toast('Deleted', 'success');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}

// Hook into app login flow
const originalOnAuthStateChangedLedger = firebase.auth().onAuthStateChanged;
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    listenToLedger();
  } else {
    if (ledgerUnsubscribe) { ledgerUnsubscribe(); ledgerUnsubscribe = null; }
    ledgerPeople = [];
  }
});
