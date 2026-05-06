import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink }
from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNtYbNMR8eK7jb6UjZWWWqx3vxkSA0sfw",
  authDomain: "novara-1.firebaseapp.com",
  projectId: "novara-1",
  storageBucket: "novara-1.firebasestorage.app",
  messagingSenderId: "1044016221037",
  appId: "1:1044016221037:web:c5b58e5eb427007bd86864"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

window.firebaseAuth = auth;
window.sendSignInLinkToEmail = sendSignInLinkToEmail;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;