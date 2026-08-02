const ONBOARDING_FLAG = 'pockettrack_onboarded_v2';

const onboardingSlides = [
  {
    step: 1,
    title: { en: 'Welcome to PocketTrack', hi: 'पॉकेटट्रैक में आपका स्वागत है' },
    subtitle: { en: 'Your AI-powered smart money companion', hi: 'आपका एआई-संचालित स्मार्ट मनी साथी' },
    previewHtml: `
      <div class="ob-preview-card">
        <div class="ob-wallet-box">
          <div class="ob-wallet-icon">💼</div>
          <div class="ob-balance-label">TOTAL BALANCE</div>
          <div class="ob-balance-val">₹45,250<span class="ob-balance-decimal">.00</span></div>
          <div class="ob-pill-row">
            <span class="ob-pill green">● Synced to Cloud</span>
            <span class="ob-pill purple">PWA Offline Ready</span>
          </div>
        </div>
        <div class="ob-features-grid">
          <div class="ob-feat-item"><i class="ti ti-bolt"></i> Instant Entry</div>
          <div class="ob-feat-item"><i class="ti ti-language"></i> English & Hindi</div>
          <div class="ob-feat-item"><i class="ti ti-shield-check"></i> 100% Private</div>
        </div>
      </div>
    `,
    btnText: { en: 'Explore Features →', hi: 'आगे बढ़ें →' }
  },
  {
    step: 2,
    title: { en: 'Voice & Instant Logging', hi: 'वॉयस और त्वरित एंट्री' },
    subtitle: { en: 'Speak or tap to record expenses in seconds', hi: 'बोलें या टैप करके सेकंडों में खर्च दर्ज करें' },
    previewHtml: `
      <div class="ob-preview-card">
        <div class="ob-voice-box">
          <div class="ob-mic-pulse"><i class="ti ti-microphone"></i></div>
          <div class="ob-voice-text">"Spent ₹450 on groceries"</div>
          <div class="ob-voice-tag">🎙️ Auto-Parsed via Voice AI</div>
        </div>
        <div class="ob-tx-preview-list">
          <div class="ob-tx-item">
            <div class="ob-tx-icon green">💰</div>
            <div class="ob-tx-info"><div class="ob-tx-title">Monthly Salary</div><div class="ob-tx-sub">Income • Bank</div></div>
            <div class="ob-tx-amt green">+₹25,000</div>
          </div>
          <div class="ob-tx-item">
            <div class="ob-tx-icon red">🛒</div>
            <div class="ob-tx-info"><div class="ob-tx-title">Groceries & Food</div><div class="ob-tx-sub">Expense • Voice Entry</div></div>
            <div class="ob-tx-amt red">-₹450</div>
          </div>
        </div>
      </div>
    `,
    btnText: { en: 'See Bill Splitting →', hi: 'आगे बढ़ें →' }
  },
  {
    step: 3,
    title: { en: 'Person Ledgers & Split Bills', hi: 'व्यक्तिगत खाता और बिल बंटवारा' },
    subtitle: { en: 'Track who owes what without any awkward math', hi: 'बिना किसी उलझन के हिसाब-किताब रखें' },
    previewHtml: `
      <div class="ob-preview-card">
        <div class="ob-ledger-box">
          <div class="ob-people-row">
            <div class="ob-avatar-card green">
              <div class="ob-avatar">R</div>
              <div class="ob-person-name">Rahul</div>
              <div class="ob-person-bal green">Owes you ₹500</div>
            </div>
            <div class="ob-avatar-card red">
              <div class="ob-avatar">P</div>
              <div class="ob-person-name">Priya</div>
              <div class="ob-person-bal red">You owe ₹250</div>
            </div>
          </div>
          <div class="ob-settle-badge"><i class="ti ti-check"></i> Smart 1-Tap Settlement Enabled</div>
        </div>
      </div>
    `,
    btnText: { en: 'Check Insights & Rewards →', hi: 'आगे बढ़ें →' }
  },
  {
    step: 4,
    title: { en: 'Reports, PDF & Rewards', hi: 'रिपोर्ट्स, PDF और रिवॉर्ड्स' },
    subtitle: { en: 'Export reports, track streaks, and earn badges', hi: 'रिपोर्ट एक्सपोर्ट करें और इनाम जीतें' },
    previewHtml: `
      <div class="ob-preview-card">
        <div class="ob-rewards-preview">
          <div class="ob-streak-badge">🔥 7 Day Streak Master</div>
          <div class="ob-score-ring">
            <div class="ob-score-num">92<span style="font-size:12px">/100</span></div>
            <div class="ob-score-label">Financial Score</div>
          </div>
          <div class="ob-badge-row">
            <span class="ob-badge-item">🏆 Top Saver</span>
            <span class="ob-badge-item">📄 PDF Export</span>
            <span class="ob-badge-item">⚡ Smart Logger</span>
          </div>
        </div>
      </div>
    `,
    btnText: { en: 'Get Started Now 🚀', hi: 'अभी शुरू करें 🚀' }
  }
];

let currentObIndex = 0;

function initOnboarding() {
  const isDone = localStorage.getItem(ONBOARDING_FLAG) === 'true';
  const container = document.getElementById('onboarding-screen');
  if (!container) return;
  
  if (isDone) {
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
    renderObSlide();
  }
}

function renderObSlide() {
  const lang = (window.currentLang || 'en');
  const slide = onboardingSlides[currentObIndex];
  const total = onboardingSlides.length;
  
  const stepText = lang === 'hi' ? `चरण ${slide.step} का ${total}` : `Step ${slide.step} of ${total}`;
  const stepEl = document.getElementById('ob-step-indicator');
  if (stepEl) stepEl.textContent = stepText;
  
  const progressPct = ((currentObIndex + 1) / total) * 100;
  const barEl = document.getElementById('ob-progress-bar-fill');
  if (barEl) barEl.style.width = progressPct + '%';
  
  const previewBox = document.getElementById('ob-preview-container');
  if (previewBox) previewBox.innerHTML = slide.previewHtml;
  
  const titleEl = document.getElementById('ob-title');
  if (titleEl) titleEl.textContent = slide.title[lang] || slide.title.en;
  
  const descEl = document.getElementById('ob-desc');
  if (descEl) descEl.textContent = slide.subtitle[lang] || slide.subtitle.en;
  
  const btnEl = document.getElementById('ob-btn');
  if (btnEl) btnEl.textContent = slide.btnText[lang] || slide.btnText.en;
  
  const prevBtn = document.getElementById('ob-prev-btn');
  if (prevBtn) prevBtn.style.visibility = currentObIndex > 0 ? 'visible' : 'hidden';
}

function nextObSlide() {
  if (currentObIndex < onboardingSlides.length - 1) {
    currentObIndex++;
    const card = document.getElementById('ob-content');
    if (card) {
      card.classList.add('ob-slide-anim');
      setTimeout(() => {
        renderObSlide();
        card.classList.remove('ob-slide-anim');
      }, 150);
    } else {
      renderObSlide();
    }
  } else {
    finishOnboarding();
  }
}

function prevObSlide() {
  if (currentObIndex > 0) {
    currentObIndex--;
    renderObSlide();
  }
}

function finishOnboarding() {
  localStorage.setItem(ONBOARDING_FLAG, 'true');
  const screen = document.getElementById('onboarding-screen');
  if (screen) {
    screen.style.opacity = '0';
    screen.style.transform = 'scale(0.95)';
    setTimeout(() => {
      screen.style.display = 'none';
    }, 250);
  }
}

document.addEventListener('DOMContentLoaded', initOnboarding);
