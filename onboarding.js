const ONBOARDING_FLAG = 'pockettrack_onboarded';

const onboardingData = [
  {
    title: { en: 'Welcome to PocketTrack', hi: 'पॉकेटट्रैक में आपका स्वागत है' },
    desc: { en: 'Your smart money companion', hi: 'आपका स्मार्ट मनी साथी' },
    emoji: '💸',
    btn: { en: 'Next', hi: 'अगला' }
  },
  {
    title: { en: 'Track Everything', hi: 'सब कुछ ट्रैक करें' },
    desc: { en: 'Income, expenses, budgets & more', hi: 'आय, व्यय, बजट और बहुत कुछ' },
    emoji: '📊',
    btn: { en: 'Next', hi: 'अगला' }
  },
  {
    title: { en: 'Split Bills', hi: 'बिल बांटे' },
    desc: { en: 'Split expenses with friends, settle debts', hi: 'दोस्तों के साथ खर्च बांटे, कर्ज चुकाएं' },
    emoji: '👥',
    btn: { en: 'Next', hi: 'अगला' }
  },
  {
    title: { en: 'Smart Insights', hi: 'स्मार्ट अंतर्दृष्टि' },
    desc: { en: 'Reports, charts, PDF exports & rewards', hi: 'रिपोर्ट, चार्ट, PDF एक्सपोर्ट और इनाम' },
    emoji: '📈',
    btn: { en: 'Get Started', hi: 'शुरू करें' }
  }
];

let currentSlide = 0;

function initOnboarding() {
  if (localStorage.getItem(ONBOARDING_FLAG) === 'true') {
    document.getElementById('onboarding-screen').style.display = 'none';
    return;
  }
  document.getElementById('onboarding-screen').style.display = 'flex';
  renderSlide();
}

function renderSlide() {
  const lang = (window.currentLang || 'en');
  const slide = onboardingData[currentSlide];
  
  document.getElementById('ob-emoji').textContent = slide.emoji;
  document.getElementById('ob-title').textContent = slide.title[lang];
  document.getElementById('ob-desc').textContent = slide.desc[lang];
  document.getElementById('ob-btn').textContent = slide.btn[lang];
  
  const dots = document.getElementById('ob-dots-container').children;
  for(let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('active', i === currentSlide);
  }
}

function nextSlide() {
  if (currentSlide < onboardingData.length - 1) {
    currentSlide++;
    
    // Add smooth animation class
    const content = document.getElementById('ob-content');
    content.style.transform = 'translateX(20px)';
    content.style.opacity = '0';
    
    setTimeout(() => {
      renderSlide();
      content.style.transform = 'translateX(0)';
      content.style.opacity = '1';
    }, 200);
  } else {
    finishOnboarding();
  }
}

function finishOnboarding() {
  localStorage.setItem(ONBOARDING_FLAG, 'true');
  const screen = document.getElementById('onboarding-screen');
  screen.style.opacity = '0';
  setTimeout(() => {
    screen.style.display = 'none';
  }, 300);
}

document.addEventListener('DOMContentLoaded', initOnboarding);
