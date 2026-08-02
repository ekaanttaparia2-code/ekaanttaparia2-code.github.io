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

  // 1. Savings Ratio Score (max 40 pts)
  let savingsRatio = totalInc > 0 ? (totalInc - totalExp) / totalInc : 0;
  let savingsPts = Math.min(40, Math.max(0, Math.round(savingsRatio * 80)));

  // 2. Budget Adherence Score (max 30 pts)
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

  // 3. Streak & Activity Score (max 30 pts)
  const streak = (typeof currentStreak !== 'undefined' ? currentStreak : 1);
  let streakPts = Math.min(30, Math.round(streak * 5 + 10));

  const finalScore = Math.min(100, Math.max(0, savingsPts + budgetPts + streakPts));

  let status = 'Good';
  let color = '#4ade80';
  if (finalScore >= 85) { status = 'Excellent 🚀'; color = '#4ade80'; }
  else if (finalScore >= 70) { status = 'Good 👍'; color = '#60a5fa'; }
  else if (finalScore >= 50) { status = 'Fair ⚠️'; color = '#ffb84d'; }
  else { status = 'Needs Attention 🔴'; color = '#f87171'; }

  // Generate Personalized Insights
  const insights = [];

  // Insight 1: Top Category
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
    insights.push(`📊 Your highest spending is on <b>${escapeHTML(topCat)}</b> (₹${topAmt}, ${topPct}% of total expenses).`);
  }

  // Insight 2: Savings Status
  if (savingsRatio >= 0.2) {
    insights.push(`💡 Great job! You are saving <b>${Math.round(savingsRatio * 100)}%</b> of your income (above the 20% benchmark).`);
  } else if (savingsRatio > 0) {
    insights.push(`💡 You save <b>${Math.round(savingsRatio * 100)}%</b> of income. Try boosting it to 20% for stronger financial health.`);
  } else {
    insights.push(`⚠️ Your total expenses currently exceed or equal your total income. Consider cutting non-essential costs.`);
  }

  // Insight 3: Streak
  if (streak >= 3) {
    insights.push(`🔥 Impressive ${streak}-day active logging streak! Consistency helps you catch impulse spending early.`);
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
          🤖 <b>AI Financial Twin:</b> Hello! Your financial score is <b>${health.score}/100</b> (${health.status}). Ask me for savings advice or tap a quick question!
        </div>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="tag-btn" onclick="sendQuickPrompt('How can I save ₹2,000 this month?')">💡 How to save ₹2,000?</button>
        <button class="tag-btn" onclick="sendQuickPrompt('Analyze my top spending categories')">📊 Analyze spending</button>
        <button class="tag-btn" onclick="sendQuickPrompt('Am I spending too much on food?')">🍔 Food spending check</button>
      </div>

      <div style="display:flex; gap:8px;">
        <input type="text" id="ai-user-input" placeholder="Ask your Financial Twin..." style="flex:1" onkeypress="if(event.key==='Enter')askAICoach()"/>
        <button class="btn primary" onclick="askAICoach()"><i class="ti ti-send"></i></button>
      </div>
    </div>
  `;
}

function sendQuickPrompt(text) {
  const input = document.getElementById('ai-user-input');
  if (input) {
    input.value = text;
    askAICoach();
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
      🤖 <i>Financial Twin AI is analyzing your data...</i>
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  let responseText = '';

  try {
    const health = calculateHealthScore();
    const promptText = `Act as an expert financial coach for PocketTrack app.
User Query: "${query}".
Financial Summary: Score ${health.score}/100, Savings Ratio: ${health.savingsRatio}%, Total Entries: ${(entries||[]).length}.
Recent Entries: ${JSON.stringify((entries||[]).slice(0, 10))}.
Provide concise (2-3 sentences max), actionable financial advice tailored to this user without any disclaimers.`;

    // Free public AI gateway proxy (no API key required from user)
    const res = await fetch('https://api.pollinations.ai/p/' + encodeURIComponent(promptText));
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 5) {
        responseText = text.trim();
      }
    }
  } catch (e) {
    console.warn('Real AI endpoint fetch warning, using offline smart engine:', e);
  }

  if (!responseText) {
    responseText = generateRuleBasedAdvice(query);
  }

  const loadEl = document.getElementById(loadingId);
  if (loadEl) {
    loadEl.innerHTML = `🤖 <b>AI Financial Twin:</b> ${escapeHTML(responseText)}`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

function generateRuleBasedAdvice(query) {
  const q = query.toLowerCase();
  const health = calculateHealthScore();

  let totalExp = 0;
  let foodExp = 0;
  let travelExp = 0;

  (entries || []).forEach(e => {
    if (e.type === 'expense') {
      const amt = parseFloat(e.amt) || 0;
      totalExp += amt;
      if (e.cat === 'food') foodExp += amt;
      if (e.cat === 'travel') travelExp += amt;
    }
  });

  if (q.includes('save') || q.includes('₹2,000') || q.includes('2000')) {
    return `To save ₹2,000 this month, cut non-essential food/dining out by 20% and set your weekly budget to ₹${Math.round((totalExp * 0.8) / 4)}. Also check unused subscription leaks!`;
  }
  if (q.includes('food') || q.includes('dinner') || q.includes('restaurant')) {
    const foodPct = totalExp > 0 ? Math.round((foodExp / totalExp) * 100) : 0;
    return `Your food spending is ₹${foodExp} (${foodPct}% of total expenses). Cooking home meals twice a week can save you ~₹1,200/month.`;
  }
  if (q.includes('analyze') || q.includes('category') || q.includes('spending')) {
    return `Your total expenses are ₹${totalExp}. Food: ₹${foodExp}, Travel: ₹${travelExp}. Your overall financial score is ${health.score}/100 (${health.status}).`;
  }

  return `Based on your score of ${health.score}/100 (${health.status}): Maintain your daily logging streak and keep weekly expenses under budget to save an extra 15% this month!`;
}
