/* Transaction syncing, entry management, and transaction-list UI. */

function updateHeaderStats(){
  const list = mainEntries();
  const income=list.filter(e=>e.type==='income').reduce((s,e)=>s+e.amt,0);
  const spent=list.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amt,0);
  document.getElementById('hdr-income').textContent='₹'+income;
  document.getElementById('hdr-spent').textContent='₹'+spent;
  document.getElementById('hdr-balance').textContent='₹'+(income-spent);
  document.getElementById('hdr-count').textContent=list.length;
}

function listenToEntries(){
  if(!currentUser) return;
  unsubscribeEntries = db.collection('users').doc(currentUser.uid).collection('entries')
    .onSnapshot(snap=>{
      entries = snap.docs.map(d=>({...d.data(), _id:d.id}));
      document.getElementById('sync-status').textContent='Synced to cloud';
      renderEntries();
      renderReport();
      updateHeaderStats();
      checkBudget();
      refreshEventsViewsIfOpen();
      renderStreak();
      renderQuickAdd();
      if(typeof checkEntryLimit !== 'undefined') checkEntryLimit();
    }, err=>{
      console.error(err);
      document.getElementById('sync-status').textContent='Sync error — check connection';
    });
}

// --- Quick-add: surfaces your 4 most-repeated exact entries as one-tap chips ---
function renderQuickAdd(){
  const card=document.getElementById('quick-add-card');
  const wrap=document.getElementById('quick-add-chips');
  if(!card||!wrap)return;
  const list=mainEntries().filter(e=>e.type==='expense');
  if(list.length<3){ card.style.display='none'; return; }
  const counts={};
  list.forEach(e=>{
    const key=e.cat+'|'+e.label.toLowerCase()+'|'+e.amt;
    if(!counts[key]) counts[key]={count:0,cat:e.cat,label:e.label,amt:e.amt};
    counts[key].count++;
  });
  const top = Object.values(counts).filter(c=>c.count>=2).sort((a,b)=>b.count-a.count).slice(0,4);
  if(!top.length){ card.style.display='none'; return; }
  card.style.display='block';
  wrap.innerHTML = top.map(t=>`
    <button class="quick-chip" onclick='quickAddExpense(${JSON.stringify(t.cat)}, ${JSON.stringify(t.label)}, ${t.amt})'>
      <span>${escapeHTML(t.label)}</span><span class="chip-amt">₹${t.amt}</span>
    </button>`).join('');
}

async function quickAddExpense(cat, label, amt){
  try{
    await saveEntry({type:'expense',cat,label,amt,date:todayStr()});
    toast(TT('expense_added'),'success');
    checkBudget();
    showSpendMoodToast(amt);
  }catch(e){toast('Could not save: '+e.message,'error');}
}

// --- Spending mood: light, non-judgmental feedback comparing an expense to your own average ---
function showSpendMoodToast(amt){
  const expenses=mainEntries().filter(e=>e.type==='expense');
  if(expenses.length<4)return; // not enough history for a meaningful average yet
  const avg = expenses.reduce((s,e)=>s+e.amt,0)/expenses.length;
  if(amt > avg*1.5){
    toast(currentLang==='hi' ? '😬 यह आपके औसत से काफी ज्यादा है' : "😬 That's well above your usual spend", 'info');
  } else if(amt < avg*0.5){
    toast(currentLang==='hi' ? '👍 बढ़िया, यह आपके औसत से कम है' : '👍 Nice, that\'s below your usual spend', 'info');
  }
}

function refreshEventsViewsIfOpen(){
  const eventsTab=document.getElementById('tab-events');
  if(!eventsTab || eventsTab.style.display==='none')return;
  if(currentEventId){ renderEventDetail(); }
  else if(document.getElementById('events-list-view').style.display!=='none'){ renderEventsList(); }
}



async function saveEntry(entry){
  if(!currentUser){toast(TT('not_logged_in'),'error');return;}
  await db.collection('users').doc(currentUser.uid).collection('entries').add(entry);
}

async function updateEntry(id, entry){
  if(!currentUser){toast(TT('not_logged_in'),'error');return;}
  await db.collection('users').doc(currentUser.uid).collection('entries').doc(id).update(entry);
}

async function removeEntry(id){
  if(!currentUser) return;
  await db.collection('users').doc(currentUser.uid).collection('entries').doc(id).delete();
}

document.getElementById('inc-date').value=todayStr();
document.getElementById('exp-date').value=todayStr();

let editingId=null; // set when editing an existing entry instead of adding new

async function addIncome(){
  await withButtonLoading('add-income-btn', async ()=>{
    if(!editingId && currentUser && !currentUser.emailVerified && (!currentUser.providerData || currentUser.providerData[0].providerId !== 'google.com') && entries.length >= 10){
      showAppAlert(currentLang==='hi'?'सीमा पूरी हुई':'Limit Reached', currentLang==='hi'?'अपनी एंट्रीज़ जोड़ना जारी रखने के लिए अपना ईमेल सत्यापित करें। आपने अपनी सभी 10 मुफ़्त एंट्रीज़ का उपयोग कर लिया है।':"Verify your email to continue adding entries. You've used all 10 free entries.");
      return;
    }
    let src=document.getElementById('inc-src').value;
    let isNewCustom=false;
    if(src==='__add_new__'){
      const custom=document.getElementById('inc-custom').value.trim().slice(0,40);
      if(!custom){toast(TT('give_source_name'),'error');return;}
      src=custom;
      isNewCustom=true;
    }
    const amt=parseFloat(document.getElementById('inc-amt').value);
    const note=document.getElementById('inc-note').value.trim().slice(0,60);
    const date=document.getElementById('inc-date').value||todayStr();
    if(!isValidAmount(amt)){toast(TT('enter_valid_amount'),'error');return;}
    if(!note){toast(TT('add_description'),'error');return;}
    if(!isValidDate(date)){toast(TT('enter_valid_date'),'error');return;}
    const payload={type:'income',cat:'income',label:src,note,amt:Math.round(amt*100)/100,date};
    try{
      if(editingId){
        await updateEntry(editingId, payload);
        toast(TT('income_updated'),'success');
        cancelEdit();
      } else {
        await saveEntry(payload);
        toast(TT('income_added'),'success');
        if(isNewCustom) saveCustomIncomeSource(src);
      }
      document.getElementById('inc-amt').value='';
      document.getElementById('inc-note').value='';
      document.getElementById('inc-custom').value='';
      document.getElementById('inc-custom-wrap').style.display='none';
    }catch(e){toast('Could not save: '+e.message,'error');}
  });
}

async function addExpense(){
  await withButtonLoading('add-expense-btn', async ()=>{
    if(!editingId && currentUser && !currentUser.emailVerified && (!currentUser.providerData || currentUser.providerData[0].providerId !== 'google.com') && entries.length >= 10){
      showAppAlert(currentLang==='hi'?'सीमा पूरी हुई':'Limit Reached', currentLang==='hi'?'अपनी एंट्रीज़ जोड़ना जारी रखने के लिए अपना ईमेल सत्यापित करें। आपने अपनी सभी 10 मुफ़्त एंट्रीज़ का उपयोग कर लिया है।':"Verify your email to continue adding entries. You've used all 10 free entries.");
      return;
    }
    let cat=document.getElementById('exp-cat').value;
    let customCat='';
    let isNewCustom=false;
    if(cat==='__add_new__'){
      customCat=document.getElementById('exp-custom').value.trim().slice(0,40);
      if(!customCat){toast(TT('give_category_name'),'error');return;}
      cat='custom';
      isNewCustom=true;
    } else if(cat.startsWith('custom:')){
      customCat=cat.slice(7);
      cat='custom';
    }
    const amt=parseFloat(document.getElementById('exp-amt').value);
    const desc=document.getElementById('exp-desc').value.trim().slice(0,60);
    const date=document.getElementById('exp-date').value||todayStr();
    if(!isValidAmount(amt)){toast(TT('enter_valid_amount'),'error');return;}
    if(!desc){toast(TT('add_description'),'error');return;}
    if(!isValidDate(date)){toast(TT('enter_valid_date'),'error');return;}
    const payload={type:'expense',cat,customCat,label:desc,amt:Math.round(amt*100)/100,date};
    try{
      if(editingId){
        await updateEntry(editingId, payload);
        toast(TT('expense_updated'),'success');
        cancelEdit();
      } else {
        await saveEntry(payload);
        toast(TT('expense_added'),'success');
        checkBudget();
        showSpendMoodToast(payload.amt);
        if(isNewCustom) saveCustomExpenseCategory(customCat);
      }
      document.getElementById('exp-amt').value='';
      document.getElementById('exp-desc').value='';
      document.getElementById('exp-custom').value='';
      document.getElementById('exp-custom-wrap').style.display='none';
    }catch(e){toast('Could not save: '+e.message,'error');}
  });
}

function startEdit(id){
  const entry=entries.find(e=>e._id===id);
  if(!entry)return;
  editingId=id;
  setTab('log');

  if(entry.type==='income'){
    const srcSelect=document.getElementById('inc-src');
    const knownValues=[...srcSelect.options].map(o=>o.value).filter(v=>v!=='__add_new__');
    if(knownValues.includes(entry.label)){
      srcSelect.value=entry.label;
      document.getElementById('inc-custom-wrap').style.display='none';
    } else {
      srcSelect.value='__add_new__';
      document.getElementById('inc-custom-wrap').style.display='block';
      document.getElementById('inc-custom').value=entry.label;
    }
    document.getElementById('inc-amt').value=entry.amt;
    document.getElementById('inc-date').value=entry.date;
    document.getElementById('inc-note').value=entry.note||'';
    document.getElementById('inc-btn-label').textContent=TT('btn_update_income');
  } else {
    if(entry.cat==='custom' && entry.customCat){
      document.getElementById('exp-cat').value='__add_new__';
      document.getElementById('exp-custom-wrap').style.display='block';
      document.getElementById('exp-custom').value=entry.customCat;
    } else {
      document.getElementById('exp-cat').value=entry.cat;
      document.getElementById('exp-custom-wrap').style.display='none';
    }
    document.getElementById('exp-amt').value=entry.amt;
    document.getElementById('exp-date').value=entry.date;
    document.getElementById('exp-desc').value=entry.label;
    document.getElementById('exp-btn-label').textContent=TT('btn_update_expense');
    document.getElementById('cancel-edit-btn').style.display='inline-flex';
  }
  toast(TT('editing_entry'),'info');
}

function cancelEdit(){
  editingId=null;
  document.getElementById('inc-btn-label').textContent=TT('btn_add_income');
  document.getElementById('exp-btn-label').textContent=TT('btn_add_expense');
  document.getElementById('cancel-edit-btn').style.display='none';
  document.getElementById('inc-amt').value='';
  document.getElementById('inc-note').value='';
  document.getElementById('exp-amt').value='';
  document.getElementById('exp-desc').value='';
}

function deleteEntry(id){
  showAppConfirm('Delete this entry?', ()=>{
    removeEntry(id).then(()=>toast(TT('entry_deleted'),'success')).catch(e=>toast('Could not delete: '+e.message,'error'));
  });
}


function resetFilter(){
  document.getElementById('filter-from').value='';
  document.getElementById('filter-to').value='';
  renderEntries();
}

function renderEntries(){
  const from=document.getElementById('filter-from').value;
  const to=document.getElementById('filter-to').value;
  const sortMode=document.getElementById('entry-sort')?document.getElementById('entry-sort').value:'date-desc';
  let list=mainEntries().map(e=>({...e}));
  if(from)list=list.filter(e=>e.date>=from);
  if(to)list=list.filter(e=>e.date<=to);
  const el=document.getElementById('entries-list');
  if(!list.length){el.innerHTML=`<p class="empty">${TT('no_entries_range')}</p>`;return;}

  // Group entries by date to compute per-day balance
  const byDate={};
  list.forEach(e=>{
    if(!byDate[e.date])byDate[e.date]={income:0,expense:0,items:[]};
    if(e.type==='income')byDate[e.date].income+=e.amt;else byDate[e.date].expense+=e.amt;
    byDate[e.date].items.push(e);
  });

  let dateKeys=Object.keys(byDate);
  if(sortMode==='date-desc')dateKeys.sort((a,b)=>b.localeCompare(a));
  else if(sortMode==='date-asc')dateKeys.sort((a,b)=>a.localeCompare(b));
  else if(sortMode==='amt-desc')dateKeys.sort((a,b)=>(byDate[b].income-byDate[b].expense)-(byDate[a].income-byDate[a].expense));
  else if(sortMode==='amt-asc')dateKeys.sort((a,b)=>(byDate[a].income-byDate[a].expense)-(byDate[b].income-byDate[b].expense));

  el.innerHTML=dateKeys.map(d=>{
    const grp=byDate[d];
    const bal=grp.income-grp.expense;
    const balColor=bal>0?'var(--green)':(bal<0?'var(--red)':'var(--text-dim)');
    const items=[...grp.items].sort((a,b)=>sortMode.startsWith('amt')?b.amt-a.amt:0);
    const rows=items.map(e=>`
      <div class="entry-row">
        <span class="date-chip">${fmtDate(e.date)}</span>
        <span class="badge ${e.cat}">${escapeHTML(displayCatLabel(e))}</span>
        <span style="flex:1;color:var(--text)">${escapeHTML(e.label)}${e.note?' — '+escapeHTML(e.note):''}${e.event?' <span class=\"event-tag\">🎉 '+escapeHTML(e.event)+'</span>':''}</span>
        <span style="font-weight:600;color:${e.type==='income'?'var(--green)':'var(--red)'}">${e.type==='income'?'+':'-'}₹${e.amt}</span>
        <div class="row-actions">
          <button class="icon-btn" onclick="startEdit('${e._id}')" aria-label="edit">✏️</button>
          <button class="icon-btn" onclick="deleteEntry('${e._id}')" aria-label="delete">🗑️</button>
        </div>
      </div>`).join('');
    return `
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0 4px;border-bottom:1px solid var(--border)">
          <span style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;color:var(--text-dim)">${fmtDate(d)}</span>
          <span style="font-family:'Space Grotesk',sans-serif;font-size:13.5px;font-weight:600;color:${balColor}">Day balance: ${bal>=0?'+':'-'}₹${Math.abs(bal)}</span>
        </div>
        ${rows}
      </div>`;
  }).join('');
}

function checkEntryLimit(){
  const banner = document.getElementById('limit-banner');
  if(!banner) return;
  if(!currentUser) { banner.style.display='none'; return; }
  const isGoogle = currentUser.providerData && currentUser.providerData[0].providerId === 'google.com';
  if(!isGoogle && !currentUser.emailVerified){
    banner.style.display = 'block';
    const count = entries.length;
    if(count >= 10) {
      banner.style.background = 'rgba(255,107,107,0.15)';
      banner.style.borderColor = 'rgba(255,107,107,0.3)';
      document.getElementById('limit-banner-text').textContent = currentLang === 'hi' 
        ? 'आपने सभी 10 मुफ्त एंट्रीज़ का उपयोग कर लिया है। असीमित एंट्रीज़ के लिए अपना ईमेल सत्यापित करें।'
        : "You've used all 10 free entries. Verify email for unlimited.";
    } else {
      banner.style.background = 'rgba(255,184,77,0.1)';
      banner.style.borderColor = 'rgba(255,184,77,0.3)';
      document.getElementById('limit-banner-text').textContent = currentLang === 'hi'
        ? `${count}/10 मुफ्त एंट्रीज़ का उपयोग किया गया। असीमित के लिए ईमेल सत्यापित करें।`
        : `${count}/10 free entries used. Verify email for unlimited.`;
    }
  } else {
    banner.style.display = 'none';
  }
}
