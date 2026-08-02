Object.assign(TRANSLATIONS, {
  voice_entry_title: { en: 'Voice Entry', hi: 'वॉयस एंट्री' },
  voice_listening: { en: 'Listening...', hi: 'सुन रहा है...' },
  voice_not_supported: { en: 'Voice recognition not supported in this browser.', hi: 'इस ब्राउज़र में वॉयस रिकग्निशन सपोर्ट नहीं करता है।' },
  voice_parse_error: { en: 'Could not understand amount or details.', hi: 'राशि या विवरण समझ नहीं आया।' }
});

let recognition;
let isListening = false;
let parsedVoiceData = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  
  recognition.onstart = function() {
    isListening = true;
    const fab = document.getElementById('voice-fab');
    if (fab) fab.classList.add('listening');
    toast(TT('voice_listening'), 'info');
  };
  
  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    parseVoiceInput(transcript);
  };
  
  recognition.onerror = function(event) {
    console.error('Speech recognition error', event.error);
    toast('Voice error: ' + event.error, 'error');
    stopVoiceRecognition();
  };
  
  recognition.onend = function() {
    stopVoiceRecognition();
  };
}

function startVoiceRecognition() {
  if (!recognition) {
    toast(TT('voice_not_supported'), 'error');
    return;
  }
  
  recognition.lang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
  
  if (isListening) {
    recognition.stop();
  } else {
    recognition.start();
  }
}

function stopVoiceRecognition() {
  isListening = false;
  const fab = document.getElementById('voice-fab');
  if (fab) fab.classList.remove('listening');
}

function parseVoiceInput(text) {
  text = text.toLowerCase();
  
  // Extract amount (find first number)
  const amountMatch = text.match(/\d+(\.\d+)?/);
  if (!amountMatch) {
    toast(TT('voice_parse_error') + ` ("${text}")`, 'error');
    return;
  }
  const amount = parseFloat(amountMatch[0]);
  
  // Determine type
  let type = 'expense';
  const incomeKeywords = ['received', 'got', 'earned', 'income', 'आय', 'मिला', 'मिले'];
  if (incomeKeywords.some(kw => text.includes(kw))) {
    type = 'income';
  }
  
  // Determine category (expense only mostly)
  let category = 'other';
  if (type === 'expense') {
    if (/food|खाना|grocer|meal|snack|restaurant/.test(text)) category = 'food';
    else if (/auto|petrol|fuel|transport|bus|train|cab|taxi|uber|ola/.test(text)) category = 'travel';
    else if (/shopping|clothes|shirt|shoes|buy|bought/.test(text)) category = 'shopping';
    else if (/bill|recharge|electricity|water|wifi|internet/.test(text)) category = 'bills';
    else if (/medicine|doctor|health|hospital|clinic/.test(text)) category = 'health';
    else if (/movie|game|entertainment|show|ticket/.test(text)) category = 'entertainment';
    else if (/education|book|tuition|school|fee|college/.test(text)) category = 'education';
    else if (/rent|home|house/.test(text)) category = 'home';
  }
  
  // Clean up description (remove amount and some stop words)
  let description = text.replace(amountMatch[0], '').trim();
  const stopWords = ['spent', 'paid', 'for', 'rupees', 'bucks', 'खर्च', 'किया', 'रुपये', 'का', 'के', 'लिए'];
  stopWords.forEach(sw => {
    description = description.replace(new RegExp(`\\b${sw}\\b`, 'g'), '').trim();
  });
  description = description.replace(/\s+/g, ' '); // remove extra spaces
  if (!description) description = 'Voice entry';
  
  // Capitalize first letter
  description = description.charAt(0).toUpperCase() + description.slice(1);
  
  parsedVoiceData = {
    amount,
    type,
    category: type === 'income' ? 'income' : category, // map to existing cats if possible, or use 'other'
    note: description,
    date: todayStr()
  };
  
  showVoiceModal();
}

function showVoiceModal() {
  const backdrop = document.getElementById('voice-modal-backdrop');
  const content = document.getElementById('voice-parsed-content');
  if (!backdrop || !content || !parsedVoiceData) return;
  
  const isIncome = parsedVoiceData.type === 'income';
  const color = isIncome ? 'var(--green)' : 'var(--red)';
  const sign = isIncome ? '+' : '-';
  
  content.innerHTML = `
    <div style="font-size:24px; font-weight:bold; color:${color}; text-align:center; margin-bottom:10px;">
      ${sign}₹${parsedVoiceData.amount}
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
      <span style="color:var(--text-dim)">Type:</span>
      <span style="font-weight:600;text-transform:capitalize">${parsedVoiceData.type}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
      <span style="color:var(--text-dim)">Category:</span>
      <span style="font-weight:600;text-transform:capitalize">${parsedVoiceData.category}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
      <span style="color:var(--text-dim)">Note:</span>
      <span style="font-weight:600">${escapeHTML(parsedVoiceData.note)}</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
      <span style="color:var(--text-dim)">Date:</span>
      <span style="font-weight:600">${parsedVoiceData.date}</span>
    </div>
  `;
  
  backdrop.style.display = 'flex';
}

function closeVoiceModal() {
  document.getElementById('voice-modal-backdrop').style.display = 'none';
  parsedVoiceData = null;
}

async function confirmVoiceEntry() {
  if (!parsedVoiceData) return;
  
  try {
    await saveEntry({
      type: parsedVoiceData.type,
      cat: parsedVoiceData.category,
      label: parsedVoiceData.type === 'income' ? parsedVoiceData.note : parsedVoiceData.note,
      note: parsedVoiceData.type === 'income' ? parsedVoiceData.note : '', // for expense, label is description. For income, label is source. We'll put it in both appropriately, or just as label
      amt: parsedVoiceData.amount,
      date: parsedVoiceData.date
    });
    
    toast(parsedVoiceData.type === 'income' ? TT('income_added') : TT('expense_added'), 'success');
    closeVoiceModal();
    if(parsedVoiceData.type === 'expense' && typeof checkBudget === 'function') checkBudget();
  } catch (e) {
    toast('Could not save voice entry: ' + e.message, 'error');
  }
}

// Show voice FAB when logged in
const originalOnAuthStateChangedVoice = firebase.auth().onAuthStateChanged;
firebase.auth().onAuthStateChanged((user) => {
  const fab = document.getElementById('voice-fab');
  if (fab) {
    fab.style.display = user ? 'flex' : 'none';
  }
});
