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
  const { hwid, hwids, allowedPcs, clientName, ownerName, phone, planType, expiresAt, licenseKey, status } = clientData;
  const cleanHwid = (hwid || (hwids && hwids[0]) || '').trim().toUpperCase();
  const clientRef = doc(db, "clients", cleanHwid);
  
  const payload = {
    hwid: cleanHwid,
    hwids: Array.isArray(hwids) && hwids.length > 0 ? hwids : [cleanHwid],
    allowedPcs: allowedPcs || 2,
    clientName: clientName || 'Client Shop',
    ownerName: ownerName || '',
    phone: phone || '',
    planType: planType || 'MONTHLY',
    status: status || 'ACTIVE',
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
    licenseKey: licenseKey || `CERT-KEY-${Date.now()}`,
    createdAt: clientData.createdAt || new Date().toISOString(),
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

// -------------------------------------------------------------
// JHARSEWA CERTIFICATES & MASTERS CLOUD FIREBASE FUNCTIONS
// -------------------------------------------------------------

// Fetch Certificates from Firebase Cloud
export async function fetchCertificatesFromFirebase() {
  try {
    const certsRef = collection(db, "certificates");
    const snapshot = await getDocs(certsRef);
    const certs = [];
    snapshot.forEach(docSnap => {
      certs.push({ id: docSnap.id, ...docSnap.data() });
    });
    return certs;
  } catch (error) {
    console.error("Error fetching certificates from Firebase:", error);
    return [];
  }
}

// Save or Update Certificate in Firebase Cloud
export async function saveCertificateToFirebase(certData) {
  try {
    const certId = certData.id ? String(certData.id) : String(Date.now());
    const certRef = doc(db, "certificates", certId);
    const payload = {
      ...certData,
      id: certId,
      updatedAt: new Date().toISOString()
    };
    await setDoc(certRef, payload, { merge: true });
    return payload;
  } catch (error) {
    console.error("Error saving certificate to Firebase:", error);
  }
}

// Bulk Sync Certificates to Firebase Cloud
export async function syncBulkCertificatesToFirebase(certList) {
  try {
    for (const cert of certList) {
      const certId = cert.id ? String(cert.id) : String(Date.now() + Math.random());
      const certRef = doc(db, "certificates", certId);
      await setDoc(certRef, { ...cert, id: certId, updatedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (error) {
    console.error("Error syncing bulk certificates to Firebase:", error);
  }
}

// Delete Certificate from Firebase Cloud
export async function deleteCertificateFromFirebase(certId) {
  try {
    await deleteDoc(doc(db, "certificates", String(certId)));
  } catch (error) {
    console.error("Error deleting certificate from Firebase:", error);
  }
}

// Fetch Master Service Categories from Firebase Cloud
export async function fetchMastersFromFirebase() {
  try {
    const mastersRef = collection(db, "masters");
    const snapshot = await getDocs(mastersRef);
    const masters = [];
    snapshot.forEach(docSnap => {
      masters.push({ id: docSnap.id, ...docSnap.data() });
    });
    return masters;
  } catch (error) {
    console.error("Error fetching masters from Firebase:", error);
    return [];
  }
}

// Save Master Category to Firebase Cloud
export async function saveMasterToFirebase(masterData) {
  try {
    const masterId = masterData.id ? String(masterData.id) : String(Date.now());
    const masterRef = doc(db, "masters", masterId);
    await setDoc(masterRef, { ...masterData, id: masterId, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.error("Error saving master to Firebase:", error);
  }
}
