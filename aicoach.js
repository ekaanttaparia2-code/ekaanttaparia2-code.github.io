Object.assign(TRANSLATIONS, {
  nav_aicoach: { en: 'AI Coach & Health', hi: 'एआई कोच और हेल्थ' },
  aicoach_title: { en: 'Financial Health & AI Coach', hi: 'फाइनेंशियल हेल्थ और एआई कोच' },
  aicoach_score_title: { en: 'Financial Health Score', hi: 'फाइनेंशियल हेल्थ स्कोर' },
  aicoach_leak_title: { en: 'Subscription Leak Detector', hi: 'सब्सक्रिप्शन लीक डिटैक्टर' },
  aicoach_chat_title: { en: 'Chat with Financial Twin', hi: 'फाइनेंशियल ट्विन से बात करें' },
  btn_ask_ai: { en: 'Ask AI Coach', hi: 'एआई कोच से पूछें' }
});

let userMarkedLeaks = JSON.parse(localStorage.getItem('pockettrack_marked_leaks') || '{}');

function calculateHealthScore() {
  if (!entries || entries.length === 0) {
    return {
      score: 70,
      status: 'Needs Data',
      color: '#ffb84d',
      savingsRatio: 0,
      savingsPts: 20,
      budgetPts: 25,
      streakPts: 25,
      insights: ['Log your daily income and expenses to unlock full financial health insights.']
    };
  }

  let totalInc = 0;
  let totalExp = 0;
  const catTotals = {};

  entries.forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') totalInc += amt;
    else if (e.type === 'expense') {
      totalExp += amt;
      const cat = e.cat || 'other';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    }
  });

  let savingsRatio = totalInc > 0 ? (totalInc - totalExp) / totalInc : 0;
  let savingsPts = Math.min(40, Math.max(0, Math.round(savingsRatio * 80)));

  let budgetPts = 30;
  if (typeof weeklyBudget !== 'undefined' && weeklyBudget > 0) {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0,0,0,0);
    
    let thisWeekExp = 0;
    entries.forEach(e => {
      if (e.type === 'expense' && new Date(e.date) >= startOfWeek) {
        thisWeekExp += (parseFloat(e.amt) || 0);
      }
    });
    if (thisWeekExp > weeklyBudget) {
      const overPct = (thisWeekExp - weeklyBudget) / weeklyBudget;
      budgetPts = Math.max(5, Math.round(30 - (overPct * 30)));
    }
  }

  const streak = (typeof currentStreak !== 'undefined' ? currentStreak : 1);
  let streakPts = Math.min(30, Math.round(streak * 5 + 10));

  const finalScore = Math.min(100, Math.max(0, savingsPts + budgetPts + streakPts));

  let status = 'Good';
  let color = '#4ade80';
  if (finalScore >= 85) { status = 'Excellent 🚀'; color = '#4ade80'; }
  else if (finalScore >= 70) { status = 'Good 👍'; color = '#60a5fa'; }
  else if (finalScore >= 50) { status = 'Fair ⚠️'; color = '#ffb84d'; }
  else { status = 'Needs Attention 🔴'; color = '#f87171'; }

  const insights = [];
  let topCat = 'other';
  let topAmt = 0;
  Object.keys(catTotals).forEach(c => {
    if (catTotals[c] > topAmt) {
      topAmt = catTotals[c];
      topCat = c;
    }
  });

  if (totalExp > 0 && topAmt > 0) {
    const topPct = Math.round((topAmt / totalExp) * 100);
    insights.push(`📊 Highest spending category: <b>${escapeHTML(topCat)}</b> (₹${topAmt}, ${topPct}% of total expenses).`);
  }

  if (savingsRatio >= 0.2) {
    insights.push(`💡 You save <b>${Math.round(savingsRatio * 100)}%</b> of your income (above the 20% benchmark).`);
  } else if (savingsRatio > 0) {
    insights.push(`💡 You save <b>${Math.round(savingsRatio * 100)}%</b> of income. Target 20% for optimal score.`);
  } else {
    insights.push(`⚠️ Total expenses currently exceed or equal income. Consider reviewing non-essential purchases.`);
  }

  if (streak >= 3) {
    insights.push(`🔥 ${streak}-day active logging streak!`);
  }

  return {
    score: finalScore,
    status,
    color,
    savingsRatio: Math.round(savingsRatio * 100),
    savingsPts,
    budgetPts,
    streakPts,
    insights
  };
}

function detectSubscriptionLeaks() {
  if (!entries || entries.length === 0) return [];

  const subKeywords = /netflix|spotify|prime|hotstar|youtube|apple|icloud|gym|recharge|wifi|broadband|rent|newspaper|tuition|sip|insurance/i;
  const leaksMap = {};

  entries.forEach(e => {
    if (e.type === 'expense') {
      const text = (e.label || '') + ' ' + (e.cat || '') + ' ' + (e.note || '');
      if (subKeywords.test(text)) {
        const key = (e.label || e.cat || 'Recurring').toLowerCase();
        if (!leaksMap[key]) {
          leaksMap[key] = {
            key: key,
            name: e.label || e.cat,
            amount: parseFloat(e.amt) || 0,
            count: 1,
            isUnused: userMarkedLeaks[key] === true
          };
        } else {
          leaksMap[key].count++;
          leaksMap[key].amount = Math.max(leaksMap[key].amount, parseFloat(e.amt) || 0);
        }
      }
    }
  });

  return Object.values(leaksMap);
}

function toggleLeakUnused(key) {
  userMarkedLeaks[key] = !userMarkedLeaks[key];
  localStorage.setItem('pockettrack_marked_leaks', JSON.stringify(userMarkedLeaks));
  renderAICoachTab();
  toast(userMarkedLeaks[key] ? 'Marked as Unused Leak ⚠️' : 'Marked as Active Subscription', 'info');
}

function renderAICoachTab() {
  const container = document.getElementById('tab-aicoach-content');
  if (!container) return;

  const health = calculateHealthScore();
  const leaks = detectSubscriptionLeaks();

  let leaksTotalMo = 0;
  let unusedTotalMo = 0;

  leaks.forEach(l => {
    leaksTotalMo += l.amount;
    if (l.isUnused) unusedTotalMo += l.amount;
  });

  let leaksHtml = '';
  if (leaks.length === 0) {
    leaksHtml = `<p style="color:var(--text-dim); font-size:13px; margin:0;">No recurring subscription leaks detected yet. Log payments like Netflix, Wifi, or Gym to track leaks!</p>`;
  } else {
    leaks.forEach(l => {
      const badgeStyle = l.isUnused 
        ? 'background:rgba(248,113,113,0.15); color:var(--red,#f87171); border:1px solid rgba(248,113,113,0.3);' 
        : 'background:rgba(74,222,128,0.15); color:var(--green,#4ade80); border:1px solid rgba(74,222,128,0.3);';
      const badgeText = l.isUnused ? '⚠️ Unused Leak' : '● Active';

      leaksHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:12px; margin-bottom:8px; border:1px solid var(--border)">
          <div>
            <div style="font-weight:600; font-size:14.5px;">${escapeHTML(l.name)}</div>
            <div style="display:flex; gap:6px; align-items:center; margin-top:4px;">
              <span style="font-size:10.5px; padding:2px 8px; border-radius:10px; font-weight:600; ${badgeStyle}">${badgeText}</span>
              <button class="btn" style="padding:2px 8px; font-size:10.5px;" onclick="toggleLeakUnused('${l.key}')">Toggle Status</button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700; color:var(--red,#f87171)">₹${l.amount}/mo</div>
            <div style="font-size:11px; color:var(--text-dim)">₹${l.amount * 12}/yr</div>
          </div>
        </div>
      `;
    });
  }

  let insightsListHtml = health.insights.map(item => `
    <div style="background:rgba(255,255,255,0.04); padding:10px 12px; border-radius:10px; margin-bottom:8px; border:1px solid var(--border); font-size:13px; line-height:1.4;">
      ${item}
    </div>
  `).join('');

  container.innerHTML = `
    <!-- Health Score Hero Card -->
    <div class="card" style="background:linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.15)); text-align:center; padding:24px 20px; margin-bottom:18px;">
      <h3 style="margin:0 0 16px; font-family:'Space Grotesk',sans-serif; font-size:20px;">Financial Health Score</h3>
      <div style="position:relative; width:130px; height:130px; margin:0 auto 14px; border-radius:50%; border:6px solid ${health.color}; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 0 30px ${health.color}44;">
        <div style="font-size:38px; font-weight:800; color:#fff; line-height:1;">${health.score}</div>
        <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">out of 100</div>
      </div>
      <div style="font-size:14px; font-weight:700; color:${health.color};">${health.status}</div>
    </div>

    <!-- Score Calculation Breakdown -->
    <div class="card" style="margin-bottom:18px;">
      <h4 style="margin:0 0 12px; font-size:16px;" class="sec-title"><i class="ti ti-calculator"></i> How Score is Calculated</h4>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div>
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:4px;">
            <span>💰 Savings Rate Benchmark</span>
            <span style="color:var(--accent,#8b5cf6)">${health.savingsPts} / 40 pts</span>
          </div>
          <div style="background:rgba(255,255,255,0.08); height:6px; border-radius:3px; overflow:hidden;">
            <div style="width:${(health.savingsPts/40)*100}%; height:100%; background:var(--accent,#8b5cf6); border-radius:3px;"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:4px;">
            <span>🎯 Budget Discipline</span>
            <span style="color:var(--green,#4ade80)">${health.budgetPts} / 30 pts</span>
          </div>
          <div style="background:rgba(255,255,255,0.08); height:6px; border-radius:3px; overflow:hidden;">
            <div style="width:${(health.budgetPts/30)*100}%; height:100%; background:var(--green,#4ade80); border-radius:3px;"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:4px;">
            <span>🔥 Daily Logging Consistency</span>
            <span style="color:#ffb84d">${health.streakPts} / 30 pts</span>
          </div>
          <div style="background:rgba(255,255,255,0.08); height:6px; border-radius:3px; overflow:hidden;">
            <div style="width:${(health.streakPts/30)*100}%; height:100%; background:#ffb84d; border-radius:3px;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Personal Financial Insights Card -->
    <div class="card" style="margin-bottom:18px;">
      <h4 style="margin:0 0 12px; font-size:16px;" class="sec-title"><i class="ti ti-bulb"></i> Personal Financial Insights</h4>
      ${insightsListHtml}
    </div>

    <!-- Subscription Leak Detector Card -->
    <div class="card" style="margin-bottom:18px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h4 style="margin:0; font-size:16px;" class="sec-title"><i class="ti ti-alarm"></i> Subscription Leak Detector</h4>
        <div style="text-align:right">
          <div style="font-size:13px; font-weight:700; color:var(--red,#f87171);">Total: ₹${leaksTotalMo}/mo</div>
          ${unusedTotalMo > 0 ? `<div style="font-size:11px; color:#f87171; font-weight:600;">Save ₹${unusedTotalMo * 12}/yr if canceled</div>` : ''}
        </div>
      </div>
      ${leaksHtml}
    </div>

    <!-- AI Coach Chat Card -->
    <div class="card" style="margin-bottom:18px;">
      <h4 style="margin:0 0 12px; font-size:16px;" class="sec-title"><i class="ti ti-robot"></i> Ask Financial Twin AI</h4>

      <div id="ai-chat-box" style="max-height:260px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:12px; padding:14px; margin-bottom:14px; border:1px solid var(--border)">
        <div style="background:rgba(139,92,246,0.15); padding:10px 14px; border-radius:12px; border:1px solid rgba(139,92,246,0.3); font-size:13px; line-height:1.4; margin-bottom:10px;">
          🤖 <b>AI Financial Twin:</b> Hello! Ask me any financial or app guide question in any way you like!
        </div>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="tag-btn" onclick="sendQuickPrompt('How much should I save per month to buy an iPhone?')">📱 Save for iPhone</button>
        <button class="tag-btn" onclick="sendQuickPrompt('How do I set my weekly budget limit in the app?')">⚙️ How to set budget?</button>
        <button class="tag-btn" onclick="sendQuickPrompt('How does the Ledger debt manager work?')">📑 How Ledger works?</button>
      </div>

      <div style="display:flex; gap:8px;">
        <input type="text" id="ai-user-input" placeholder="Ask any question in your own words..." style="flex:1" onkeypress="if(event.key==='Enter')askAICoach()"/>
        <button class="btn primary" onclick="askAICoach()"><i class="ti ti-send"></i></button>
      </div>
    </div>
  `;

  initFloatingAIWidget();
}

function initFloatingAIWidget() {
  if (document.getElementById('ai-widget-icon')) return;

  const widget = document.createElement('div');
  widget.id = 'ai-widget-icon';
  widget.title = 'AI Financial Twin & App Assistant';
  widget.style.cssText = 'position:fixed;bottom:90px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 8px 25px rgba(139,92,246,0.6);z-index:9999;cursor:grab;touch-action:none;user-select:none;transition:transform 0.2s;';
  widget.innerHTML = '🤖';

  const panel = document.createElement('div');
  panel.id = 'ai-widget-panel';
  panel.style.cssText = 'position:fixed;bottom:155px;right:24px;width:340px;max-width:90vw;background:var(--card-solid,#1f1840);border:1px solid rgba(255,255,255,0.18);box-shadow:0 20px 50px rgba(0,0,0,0.7);border-radius:20px;padding:16px;z-index:9999;display:none;flex-direction:column;max-height:75vh;';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px;">
      <div style="font-weight:700;font-size:15px;display:flex;align-items:center;gap:6px;">🤖 <span>AI Twin & App Guide</span></div>
      <button class="icon-btn" onclick="toggleAIPanel()" style="font-size:18px;color:var(--text-dim);"><i class="ti ti-x"></i></button>
    </div>
    
    <div id="ai-panel-chat-box" style="flex:1;max-height:220px;overflow-y:auto;background:rgba(0,0,0,0.25);border-radius:12px;padding:10px;margin-bottom:10px;border:1px solid var(--border);font-size:12.5px;">
      <div style="background:rgba(139,92,246,0.15);padding:8px 10px;border-radius:10px;line-height:1.4;">
        👋 Ask me anything about your money or how to use any feature in PocketTrack!
      </div>
    </div>

    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">
      <button class="tag-btn" style="font-size:10.5px;padding:3px 8px;" onclick="sendPanelPrompt('How to save for iPhone?')">📱 iPhone Goal</button>
      <button class="tag-btn" style="font-size:10.5px;padding:3px 8px;" onclick="sendPanelPrompt('How to set weekly budget?')">⚙️ Budget Guide</button>
      <button class="tag-btn" style="font-size:10.5px;padding:3px 8px;" onclick="sendPanelPrompt('How to track debts in Ledger?')">📑 Ledger Guide</button>
    </div>

    <div style="display:flex;gap:6px;">
      <input type="text" id="ai-panel-input" placeholder="Ask AI or App Guide..." style="flex:1;padding:8px 10px;font-size:12.5px;" onkeypress="if(event.key==='Enter')askAIPanel()"/>
      <button class="btn primary" style="padding:8px 12px;font-size:12px;" onclick="askAIPanel()"><i class="ti ti-send"></i></button>
    </div>
  `;

  document.body.appendChild(widget);
  document.body.appendChild(panel);

  let isDragging = false;
  let hasMoved = false;
  let startX, startY, initialLeft, initialTop;

  widget.addEventListener('pointerdown', e => {
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = widget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    widget.style.cursor = 'grabbing';
    widget.setPointerCapture(e.pointerId);
  });

  widget.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
    
    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;
    
    newLeft = Math.max(10, Math.min(window.innerWidth - 70, newLeft));
    newTop = Math.max(10, Math.min(window.innerHeight - 70, newTop));

    widget.style.left = newLeft + 'px';
    widget.style.top = newTop + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';

    panel.style.left = Math.min(window.innerWidth - 350, Math.max(10, newLeft - 140)) + 'px';
    panel.style.top = Math.max(10, newTop - 360) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  widget.addEventListener('pointerup', e => {
    isDragging = false;
    widget.style.cursor = 'grab';
    if (!hasMoved) {
      toggleAIPanel();
    }
  });
}

function toggleAIPanel() {
  const panel = document.getElementById('ai-widget-panel');
  if (panel) {
    panel.style.display = (panel.style.display === 'flex') ? 'none' : 'flex';
  }
}

function sendQuickPrompt(text) {
  const input = document.getElementById('ai-user-input');
  if (input) {
    input.value = text;
    askAICoach();
  }
}

function sendPanelPrompt(text) {
  const input = document.getElementById('ai-panel-input');
  if (input) {
    input.value = text;
    askAIPanel();
  }
}

async function askAICoach() {
  const inputEl = document.getElementById('ai-user-input');
  const chatBox = document.getElementById('ai-chat-box');
  if (!inputEl || !chatBox) return;

  const query = inputEl.value.trim();
  if (!query) return;

  chatBox.innerHTML += `
    <div style="background:rgba(255,255,255,0.08); text-align:right; padding:8px 12px; border-radius:12px; font-size:13px; margin-bottom:10px; margin-left:20px;">
      <b>You:</b> ${escapeHTML(query)}
    </div>
  `;
  inputEl.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  const loadingId = 'ai-loading-' + Date.now();
  chatBox.innerHTML += `
    <div id="${loadingId}" style="background:rgba(139,92,246,0.15); padding:10px 14px; border-radius:12px; border:1px solid rgba(139,92,246,0.3); font-size:13px; margin-bottom:10px;">
      🤖 <i>AI Financial Twin is analyzing...</i>
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  const responseText = await processSmartAIQuery(query);
  const loadEl = document.getElementById(loadingId);
  if (loadEl) {
    loadEl.innerHTML = `🤖 <b>AI Financial Twin:</b> ${escapeHTML(responseText)}`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function askAIPanel() {
  const inputEl = document.getElementById('ai-panel-input');
  const chatBox = document.getElementById('ai-panel-chat-box');
  if (!inputEl || !chatBox) return;

  const query = inputEl.value.trim();
  if (!query) return;

  chatBox.innerHTML += `
    <div style="background:rgba(255,255,255,0.08); text-align:right; padding:6px 10px; border-radius:10px; font-size:12px; margin-bottom:8px; margin-left:15px;">
      <b>You:</b> ${escapeHTML(query)}
    </div>
  `;
  inputEl.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  const loadingId = 'ai-panel-loading-' + Date.now();
  chatBox.innerHTML += `
    <div id="${loadingId}" style="background:rgba(139,92,246,0.15); padding:8px 10px; border-radius:10px; font-size:12px; margin-bottom:8px;">
      🤖 <i>AI Assistant is analyzing...</i>
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  const responseText = await processSmartAIQuery(query);
  const loadEl = document.getElementById(loadingId);
  if (loadEl) {
    loadEl.innerHTML = `🤖 <b>AI Assistant:</b> ${escapeHTML(responseText)}`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Gemini API key (client-side for now — move behind a backend before real launch/payments)
const GEMINI_API_KEY = 'AQ.Ab8RN6IGb1-EdnxYvSsdbFA6zX2TbiEoYl8Oe4InBPgJ8q3Ftw';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Multi-layered Natural Language Processor (Semantic Matcher + Live Gateway LLM)
async function processSmartAIQuery(query) {
  const q = query.toLowerCase();

  // Try Semantic Concept Matching first for instant responses
  const semanticAnswer = matchSemanticConcepts(q);
  if (semanticAnswer) return semanticAnswer;

  // Fallback to Gemini for arbitrary natural sentence structures
  try {
    const health = calculateHealthScore();
    const promptText = `You are an AI financial twin & app guide for PocketTrack app.
User asked: "${query}".
User Financial Status: Health score ${health.score}/100, Savings Ratio: ${health.savingsRatio}%, Total Entries: ${(entries||[]).length}.
Answer concisely (2-3 sentences max) with practical numbers and clear guidance.`;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 5) {
        return text.trim();
      }
    } else {
      console.warn('Gemini API error:', res.status, await res.text());
    }
  } catch (e) {
    console.warn('Gemini fetch warning:', e);
  }

  // Ultimate fallback
  const health = calculateHealthScore();
  return `🤖 Based on your financial health score of ${health.score}/100 (${health.status}): Keep your daily logging streak active and maintain your weekly budget caps to boost your savings rate!`;
}

// Semantic Synonym & Concept Pattern Matcher
function matchSemanticConcepts(q) {
  // Concept 1: iPhone / Smartphone savings goal (any sentence phrasing)
  if (/iphone|apple|mobile|phone|smartphone|buy a phone|get a phone/i.test(q)) {
    const estCost = 69900;
    return `📱 To buy an iPhone (~₹${estCost.toLocaleString('en-IN')}): If your target timeframe is 6 months, set aside ₹${Math.round(estCost/6).toLocaleString('en-IN')}/month. If 12 months, save ₹${Math.round(estCost/12).toLocaleString('en-IN')}/month!`;
  }

  // Concept 2: Laptop / Computer goal
  if (/laptop|macbook|computer|pc|notebook/i.test(q)) {
    const estCost = 85000;
    return `💻 To save for a Laptop (~₹${estCost.toLocaleString('en-IN')}): Save ₹${Math.round(estCost/6).toLocaleString('en-IN')}/mo for 6 months or ₹${Math.round(estCost/10).toLocaleString('en-IN')}/mo for 10 months!`;
  }

  // Concept 3: Trip / Vacation / Holiday goal
  if (/trip|vacation|goa|tour|flight|holiday|travel goal/i.test(q)) {
    const estCost = 15000;
    return `✈️ For a Trip/Vacation (~₹15,000): Setting aside ₹2,500/month will get you fully funded in 6 months!`;
  }

  // Concept 4: Budget setting / capping
  if (/budget|limit|max spend|cap|restrict|threshold|set spending/i.test(q)) {
    return `⚙️ Budget Setting: Go to the Report tab or main Log screen, tap 'Set weekly budget', enter your target amount (e.g. ₹5,000) and tap Save. PocketTrack automatically tracks your progress and alerts you if you approach the cap!`;
  }

  // Concept 5: Ledger / Debts / Money lent or borrowed / Friends
  if (/ledger|debt|borrow|lend|lent|owe|roommate|friend|gave|received|khata|hisab/i.test(q)) {
    return `📑 Ledger Accounts: Tap ☰ Menu → Ledger. Add contacts (e.g. Rahul, Priya), then tap their name card to record 'Gave ₹' or 'Received ₹' with notes & history cards!`;
  }

  // Concept 6: Voice expense logging
  if (/voice|mic|speak|audio|bolke|talk|say/i.test(q)) {
    return `🎤 Voice Entry: Tap the floating purple Mic button on the bottom-right of your screen and speak naturally, e.g. "Spent 250 on lunch" or "Got 5000 salary"!`;
  }

  // Concept 7: Events / Bill splitting / Trips / Group expenses
  if (/split|group|party|flatmate|shared|bill split|sharing/i.test(q)) {
    return `👥 Events & Bill Splitting: Open ☰ Menu → Events. Create a group (e.g. Goa Trip, Flatmates), add participants, and log shared expenses — PocketTrack calculates 1-tap settlements!`;
  }

  // Concept 8: Smart UPI Logger / Notifications / Copy Paste
  if (/upi|gpay|phonepe|paytm|paste|notification|autodetect|copy/i.test(q)) {
    return `⚡ Smart Logger: Copy any GPay, PhonePe, or Paytm payment notification and paste it into ☰ Menu → Smart Logger. Amount, merchant, and type are auto-detected!`;
  }

  // Concept 9: Themes & Visuals
  if (/theme|dark|color|style|cyberpunk|emerald|sunset|oled/i.test(q)) {
    return `🎨 Themes: Tap ☰ Menu → Language/Settings to switch between Cyberpunk Neon, Emerald Luxury, Sunset Glow, or Midnight OLED themes!`;
  }

  // Concept 10: Offline / Cloud Sync
  if (/offline|sync|wifi|network|no internet|airplane|cloud/i.test(q)) {
    return `☁️ Cloud Sync & Offline Mode: PocketTrack works 100% offline! Entries saved without internet are stored locally and auto-sync with Firebase Cloud as soon as you reconnect.`;
  }

  // Concept 11: PDF / Report Export
  if (/export|pdf|statement|report|sheet|excel|download|print/i.test(q)) {
    return `📊 Reports & Export: Tap ☰ Menu → Report. You can view breakdown charts, tap 'Export as PDF' to save your statement, or 'Copy Report' to paste your breakdown anywhere!`;
  }

  return null;
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initFloatingAIWidget, 500);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(initFloatingAIWidget, 500));
}
