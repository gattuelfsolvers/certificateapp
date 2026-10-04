import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot, deleteDoc, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDclObUAWjLXtZY0CdeY1h0rGqsRUXnv_g",
  authDomain: "certificate-master-db.firebaseapp.com",
  projectId: "certificate-master-db",
  storageBucket: "certificate-master-db.firebasestorage.app",
  messagingSenderId: "1033336737307",
  appId: "1:1033336737307:web:58a4bab4ffb4f762dc32be",
  measurementId: "G-D9ZGVYKNGG"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Real-Time Firebase License Key Generator
export function generateLicenseKey(hwid, planType = 'MONTHLY', customExpiryDate = null) {
  const cleanHwid = hwid.trim().toUpperCase();
  let expiresAt = new Date();

  if (customExpiryDate) {
    expiresAt = new Date(customExpiryDate);
  } else if (planType === 'FREE_TRIAL') {
    expiresAt.setDate(expiresAt.getDate() + 7);
  } else if (planType === 'HALF_YEARLY') {
    expiresAt.setDate(expiresAt.getDate() + 180);
  } else if (planType === 'YEARLY') {
    expiresAt.setDate(expiresAt.getDate() + 365);
  } else {
    expiresAt.setDate(expiresAt.getDate() + 30);
  }

  const expHex = expiresAt.getTime().toString(16).toUpperCase();
  const licenseKey = `CERT-${planType.substring(0, 3)}-${expHex}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  return {
    licenseKey,
    hwid: cleanHwid,
    planType,
    expiresAt
  };
}

// Master Admin: Save / Activate Client on Firebase Cloud
export async function saveClientToFirebase(clientData) {
  const { hwid, clientName, ownerName, phone, planType, expiresAt, licenseKey, status } = clientData;
  const cleanHwid = hwid.trim().toUpperCase();
  const clientRef = doc(db, "clients", cleanHwid);
  
  const payload = {
    hwid: cleanHwid,
    clientName: clientName || 'Client Shop',
    ownerName: ownerName || '',
    phone: phone || '',
    planType: planType || 'MONTHLY',
    status: status || 'ACTIVE',
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
    licenseKey: licenseKey || `CERT-KEY-${Date.now()}`,
    updatedAt: new Date().toISOString()
  };

  await setDoc(clientRef, payload, { merge: true });
  return payload;
}

// Master Admin: Toggle Client Status (ACTIVE / KILLED / EXPIRED)
export async function updateClientStatusOnFirebase(hwid, newStatus) {
  const cleanHwid = hwid.trim().toUpperCase();
  const clientRef = doc(db, "clients", cleanHwid);
  await setDoc(clientRef, { status: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
}

// Master Admin: Delete Client from Firebase
export async function deleteClientFromFirebase(hwid) {
  const cleanHwid = hwid.trim().toUpperCase();
  await deleteDoc(doc(db, "clients", cleanHwid));
}

// Master Admin: Fetch All Clients from Firebase Firestore
export async function fetchClientsFromFirebase() {
  try {
    const clientsRef = collection(db, "clients");
    const snapshot = await getDocs(clientsRef);
    const clients = [];
    snapshot.forEach(docSnap => {
      clients.push({ id: docSnap.id, ...docSnap.data() });
    });
    return clients;
  } catch (error) {
    console.error("Error fetching clients from Firebase:", error);
    return [];
  }
}

// Master Admin: Real-Time Listener for Clients Collection
export function subscribeClientsFromFirebase(onUpdate) {
  const clientsRef = collection(db, "clients");
  return onSnapshot(clientsRef, (snapshot) => {
    const clients = [];
    snapshot.forEach(docSnap => {
      clients.push({ id: docSnap.id, ...docSnap.data() });
    });
    onUpdate(clients);
  }, (error) => {
    console.error("Error in clients snapshot listener:", error);
  });
}
