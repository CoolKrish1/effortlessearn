import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxdJ6f2WtbfIzjBjQDybxCSYYYEkTgc0E",
  authDomain: "effortless-earn-7f39e.firebaseapp.com",
  projectId: "effortless-earn-7f39e",
  storageBucket: "effortless-earn-7f39e.firebasestorage.app",
  messagingSenderId: "554178513766",
  appId: "1:554178513766:web:d8d7edf915a95349cb16a7",
  measurementId: "G-FLV8NJM726"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
