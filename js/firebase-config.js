import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app-check.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNtYbNMR8eK7jb6UjZWWWqx3vxkSA0sfw",
  authDomain: "novara-1.firebaseapp.com",
  projectId: "novara-1",
  storageBucket: "novara-1.firebasestorage.app",
  messagingSenderId: "1044016221037",
  appId: "1:1044016221037:web:c5b58e5eb427007bd86864",
  measurementId: "G-HML9QRXSC3"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
self.FIREBASE_APPCHECK_DEBUG_TOKEN = location.hostname === "localhost";
//TODO: BE CAREFUL WITH DEBUG TOKEN!!!
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider("6LdvSsYtAAAAAEGwZp95ajStW3YMPzQiBL9UI9g1"),
  isTokenAutoRefreshEnabled: true
});
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseAuth = auth;
window.sendSignInLinkToEmail = sendSignInLinkToEmail;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;

window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;