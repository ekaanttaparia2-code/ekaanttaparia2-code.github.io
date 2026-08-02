Object.assign(TRANSLATIONS, {
  voice_entry_title: { en: 'Voice Expense Log', hi: 'वॉयस खर्च रिकॉर्डर' },
  voice_listening: { en: 'Listening... Speak now!', hi: 'सुन रहा है... अब बोलें!' },
  voice_not_supported: { en: 'Voice recognition is not supported in this browser. Type below instead:', hi: 'वॉयस सपोर्ट नहीं है। नीचे टाइप करें:' },
  voice_parse_error: { en: 'Could not detect amount. Try: "Spent 450 on dinner"', hi: 'राशि समझ नहीं आई। उदाहरण: "Spent 450 on food"' }
});

let recognition = null;
let isListening = false;
let parsedVoiceData = null;

function initVoiceEngine() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
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
      stopVoiceRecognition();
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast('Microphone access denied. Enable mic permissions in browser settings.', 'error');
      } else if (event.error !== 'no-speech') {
        promptManualVoiceInput();
      }
    };
    
    recognition.onend = function() {
      stopVoiceRecognition();
    };
  }
}

function updateVoiceFabVisibility() {
  const fab = document.getElementById('voice-fab');
  if (!fab) return;
  const user = currentUser || (firebase.auth() && firebase.auth().currentUser);
  fab.style.display = user ? 'flex' : 'none';
}

function startVoiceRecognition() {
  updateVoiceFabVisibility();
  if (!recognition) {
    promptManualVoiceInput();
    return;
  }
  
  recognition.lang = (window.currentLang === 'hi') ? 'hi-IN' : 'en-US';
  
  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition start exception:', e);
      promptManualVoiceInput();
    }
  }
}

function stopVoiceRecognition() {
  isListening = false;
  const fab = document.getElementById('voice-fab');
  if (fab) fab.classList.remove('listening');
}

function promptManualVoiceInput() {
  const input = prompt(TT('voice_entry_title') + '\ne.g. "Spent 350 on petrol" or "Got 15000 salary"');
  if (input && input.trim()) {
    parseVoiceInput(input.trim());
  }
}

function parseVoiceInput(text) {
  const rawText = text;
  text = text.toLowerCase();
  
  const amountMatch = text.match(/\d+(\.\d+)?/);
  if (!amountMatch) {
    toast(TT('voice_parse_error') + ` ("${rawText}")`, 'error');
    return;
  }
  const amount = parseFloat(amountMatch[0]);
  
  let type = 'expense';
  const incomeKeywords = ['received', 'got', 'earned', 'income', 'salary', 'allowance', 'आय', 'मिला', 'मिले', 'आया', 'वेतन'];
  if (incomeKeywords.some(kw => text.includes(kw))) {
    type = 'income';
  }
  
  let category = 'other';
  if (type === 'expense') {
    if (/food|grocer|meal|snack|restaurant|lunch|dinner|tea|coffee|खाना|चाय|नाश्ता|होटल/.test(text)) category = 'food';
    else if (/auto|petrol|fuel|transport|bus|train|cab|taxi|uber|ola|पेट्रोल|किराया|बस/.test(text)) category = 'travel';
    else if (/shopping|clothes|shirt|shoes|buy|bought|कपड़े|खरीद/.test(text)) category = 'shopping';
    else if (/bill|recharge|electricity|water|wifi|internet|बिल|रिचार्ज/.test(text)) category = 'bills';
    else if (/medicine|doctor|health|hospital|clinic|दवा|डॉक्टर/.test(text)) category = 'health';
    else if (/movie|game|entertainment|show|ticket|मूवी|फिल्म/.test(text)) category = 'entertainment';
    else if (/education|book|tuition|school|fee|college|किताब|फीस/.test(text)) category = 'education';
    else if (/rent|home|house|कमरा/.test(text)) category = 'home';
  }
  
  let description = rawText.replace(amountMatch[0], '').trim();
  const stopWords = ['spent', 'paid', 'for', 'rupees', 'rs', 'inr', 'bucks', 'खर्च', 'किया', 'रुपये', 'का', 'के', 'लिए', 'पर'];
  stopWords.forEach(sw => {
    description = description.replace(new RegExp(`\\b${sw}\\b`, 'gi'), '').trim();
  });
  description = description.replace(/\s+/g, ' ');
  if (!description) description = type === 'income' ? 'Voice Income' : 'Voice Expense';
  
  description = description.charAt(0).toUpperCase() + description.slice(1);
  
  parsedVoiceData = {
    amount,
    type,
    category: type === 'income' ? 'Salary' : category,
    note: description,
    date: (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().split('T')[0])
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
    <div style="font-size:28px; font-weight:800; color:${color}; text-align:center; margin:10px 0 16px;">
      ${sign}₹${parsedVoiceData.amount}
    </div>
    <div style="background:rgba(255,255,255,0.05); padding:12px 16px; border-radius:12px; border:1px solid var(--border)">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:var(--text-dim)">Type:</span>
        <span style="font-weight:600;text-transform:capitalize;color:${color}">${parsedVoiceData.type}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:var(--text-dim)">Category:</span>
        <span style="font-weight:600;text-transform:capitalize">${parsedVoiceData.category}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:var(--text-dim)">Note:</span>
        <span style="font-weight:600">${escapeHTML(parsedVoiceData.note)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--text-dim)">Date:</span>
        <span style="font-weight:600">${parsedVoiceData.date}</span>
      </div>
    </div>
  `;
  
  backdrop.style.display = 'flex';
}

function closeVoiceModal() {
  const backdrop = document.getElementById('voice-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';
  parsedVoiceData = null;
}

async function confirmVoiceEntry() {
  if (!parsedVoiceData) return;
  
  try {
    if (typeof saveEntry === 'function') {
      await saveEntry({
        type: parsedVoiceData.type,
        cat: parsedVoiceData.category,
        label: parsedVoiceData.note,
        note: parsedVoiceData.note,
        amt: parsedVoiceData.amount,
        date: parsedVoiceData.date
      });
    }
    
    toast((parsedVoiceData.type === 'income' ? 'Income' : 'Expense') + ' recorded!', 'success');
    closeVoiceModal();
    if (parsedVoiceData.type === 'expense' && typeof checkBudget === 'function') checkBudget();
  } catch (e) {
    toast('Could not save: ' + e.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initVoiceEngine();
  updateVoiceFabVisibility();
});

if (window.firebase && firebase.auth()) {
  firebase.auth().onAuthStateChanged(() => {
    updateVoiceFabVisibility();
  });
}
