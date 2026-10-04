const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, updateDoc } = require('firebase/firestore');

// Real Google Firebase Credentials for Master Admin Panel
const firebaseConfig = {
  apiKey: "AIzaSyDclObUAWjLXtZY0CdeY1h0rGqsRUXnv_g",
  authDomain: "certificate-master-db.firebaseapp.com",
  projectId: "certificate-master-db",
  storageBucket: "certificate-master-db.firebasestorage.app",
  messagingSenderId: "1033336737307",
  appId: "1:1033336737307:web:58a4bab4ffb4f762dc32be",
  measurementId: "G-D9ZGVYKNGG"
};

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('👑 Master Admin Firebase Connected Successfully to project: certificate-master-db');
} catch (e) {
  console.warn('Master Firebase init error:', e.message);
}

module.exports = { db };
