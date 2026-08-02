/* Authentication flows and signed-in state handling. */

function setAuthButtonsLoading(isLoading){
  const loginBtn=document.getElementById('auth-login-btn');
  const signupBtn=document.getElementById('auth-signup-btn');
  [loginBtn, signupBtn].forEach(btn=>{
    btn.disabled = isLoading;
    btn.style.opacity = isLoading ? '0.6' : '1';
    btn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
  });
}

function authAction(mode){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  const errEl=document.getElementById('auth-error');
  errEl.style.display='none';
  if(!email||!pass||pass.length<6){
    errEl.textContent = currentLang==='hi' ? 'सही ईमेल और कम से कम 6 अक्षरों का पासवर्ड डालें।' : 'Enter a valid email and a password with 6+ characters.';
    errEl.style.display='block';
    return;
  }
  setAuthButtonsLoading(true);
  const action = mode==='login'
    ? auth.signInWithEmailAndPassword(email,pass)
    : auth.createUserWithEmailAndPassword(email,pass);
  action.then(cred=>{
    if(mode==='signup' && cred.user && !cred.user.emailVerified){
      cred.user.sendEmailVerification().catch(e=>console.log('Verification email failed:',e));
    }
  }).catch(err=>{
    errEl.textContent=err.message;
    errEl.style.display='block';
  }).finally(()=>{
    setAuthButtonsLoading(false);
  });
}

function handleForgotPassword(){
  const email=document.getElementById('auth-email').value.trim();
  const errEl=document.getElementById('auth-error');
  errEl.style.display='none';
  if(!email){
    errEl.textContent = currentLang==='hi' ? 'पासवर्ड रीसेट लिंक पाने के लिए पहले अपना ईमेल डालें।' : 'Enter your email above first to get a reset link.';
    errEl.style.display='block';
    return;
  }
  auth.sendPasswordResetEmail(email).then(()=>{
    toast(currentLang==='hi' ? 'पासवर्ड रीसेट लिंक आपके ईमेल पर भेज दिया गया है' : 'Password reset link sent to your email', 'success');
  }).catch(err=>{
    errEl.textContent=err.message;
    errEl.style.display='block';
  });
}

function signInWithGoogle(){
  const errEl=document.getElementById('auth-error');
  if (errEl) errEl.style.display='none';
  const btn=document.getElementById('auth-google-btn');
  const originalHTML=btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled=true;
    btn.style.opacity='0.6';
    btn.innerHTML='<span>Logging in...</span>';
  }
  
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');

  auth.signInWithPopup(provider).then(result => {
    if (result && result.user) {
      document.getElementById('auth-screen').style.display = 'none';
      toast((typeof currentLang !== 'undefined' && currentLang === 'hi') ? 'गूगल से लॉगिन सफल!' : 'Signed in as ' + (result.user.displayName || 'Google User'), 'success');
    }
  }).catch(err => {
    console.error('Google Auth Error:', err);
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      auth.signInWithRedirect(provider);
      return;
    }
    if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/operation-not-supported-in-this-environment') {
      if (errEl) {
        errEl.textContent = (typeof currentLang !== 'undefined' && currentLang === 'hi') 
          ? 'गूगल साइन-इन इस डोमेन पर चालू नहीं है। कृपया ईमेल-पासवर्ड से लॉगिन करें!'
          : 'Google Sign-In needs an authorized domain or web server. Please use Email & Password sign in above!';
        errEl.style.display = 'block';
      }
    } else if (err.code !== 'auth/popup-closed-by-user') {
      if (errEl) {
        errEl.textContent = err.message || 'Could not sign in with Google';
        errEl.style.display = 'block';
      }
    }
  }).finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = originalHTML;
    }
  });
}

// Handle Google Redirect Result on load if popups are blocked
auth.getRedirectResult().then(result => {
  if (result && result.user) {
    document.getElementById('auth-screen').style.display = 'none';
  }
}).catch(err => {
  console.error('Redirect Auth Error:', err);
});

function logOut(){
  showAppConfirm(currentLang==='hi'?'क्या आप लॉग आउट करना चाहते हैं?':'Log out?', ()=>{
    if(unsubscribeEntries) unsubscribeEntries();
    if(unsubscribeEvents) unsubscribeEvents();
    auth.signOut();
  });
}

auth.onAuthStateChanged(user=>{
  if(user){
    currentUser=user;
    document.getElementById('auth-screen').style.display='none';
    document.getElementById('sync-status').textContent='Synced to cloud';
    listenToEntries();
    listenToEvents();
    if(typeof listenToLedger === 'function') listenToLedger();
    if(typeof updateVoiceFabVisibility === 'function') updateVoiceFabVisibility();
    loadBudget();
    checkHamburgerHint();
    document.getElementById('verify-banner').style.display = user.emailVerified ? 'none' : 'block';
  } else {
    currentUser=null;
    document.getElementById('auth-screen').style.display='flex';
    if(unsubscribeEntries) unsubscribeEntries();
    if(unsubscribeEvents) unsubscribeEvents();
    if(typeof updateVoiceFabVisibility === 'function') updateVoiceFabVisibility();
    entries=[];
    events=[];
    weeklyBudget=0;
  }
});

function resendVerification(){
  if(!currentUser)return;
  currentUser.sendEmailVerification().then(()=>{
    toast(currentLang==='hi' ? 'सत्यापन ईमेल फिर से भेजा गया' : 'Verification email sent again', 'success');
  }).catch(e=>{
    toast('Could not send: '+e.message, 'error');
  });
}
