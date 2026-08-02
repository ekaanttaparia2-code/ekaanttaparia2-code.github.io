/* Firebase configuration and service initialization with Offline Persistence. */

// --- Firebase setup ---
const firebaseConfig = {
  apiKey: "AIzaSyCxs1ltKht43N9JuwAIKymk0drlGsjxCvM",
  authDomain: "pockettrack-23776.firebaseapp.com",
  projectId: "pockettrack-23776",
  storageBucket: "pockettrack-23776.firebasestorage.app",
  messagingSenderId: "376126656745",
  appId: "1:376126656745:web:58a906c7a272d058d6e078",
  measurementId: "G-89ZKVRGJ6R"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- Enable Offline Persistence ---
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.log('Multiple tabs open, persistence enabled in primary tab');
  } else if (err.code === 'unimplemented') {
    console.log('Browser does not support offline persistence');
  }
});
