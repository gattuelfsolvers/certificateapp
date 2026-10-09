/**
 * 🔥 FIREBASE REALTIME QUEUE SERVICE
 * 
 * 100% Cloud-Driven Sync Engine:
 * Listens to Google Cloud Firestore in real-time.
 * When ANY user clicks "Sync" or "Sync All" on Render (or mobile browser),
 * Firestore sets `syncRequested: true`.
 * 
 * This background daemon immediately picks it up:
 * 1. Solves Captcha & checks live status on Jharsewa via local Puppeteer session.
 * 2. Writes the new status directly back to Cloud Firestore in real-time.
 * 3. Delivers automated WhatsApp message directly to applicant's phone.
 * 
 * NO CSV files, NO Git Commits, NO Render Rebuilds required!
 */

const { collection, onSnapshot, doc, setDoc, getDocs } = require('firebase/firestore');
const { db } = require('../config/firebase');
const { checkJharsewaStatus } = require('./jharsewa.service');
const { sendTestWhatsAppMessage } = require('./whatsapp.service');
const { getSystemHWID } = require('../engines/license.engine');
const prisma = require('../db');

// Local Machine Hardware ID for targeted queue filtering & licensing
let currentLocalHwid = null;
let isMachineLicenseActive = false;

// In-memory sequential queue & lock
const pendingQueueItems = [];
const enqueuedIds = new Set();
let isWorkerRunning = false;
let isListenerActive = false;

// Shop Profile details fallback helper
async function getShopDetails() {
  try {
    const settingShop = await prisma.setting.findUnique({ where: { key: 'SHOP_NAME' } });
    const settingPhone = await prisma.setting.findUnique({ where: { key: 'SHOP_PHONE' } });
    const settingAddress = await prisma.setting.findUnique({ where: { key: 'SHOP_ADDRESS' } });

    return {
      shopName: settingShop?.value || 'Apna Digital Hub - Certificate Management',
      phone: settingPhone?.value || '8210212926',
      address: settingAddress?.value || 'Main Road, CSC Digital Center, Ranchi, Jharkhand'
    };
  } catch (e) {
    return {
      shopName: 'Apna Digital Hub - Certificate Management',
      phone: '8210212926',
      address: 'Main Road, CSC Digital Center, Ranchi, Jharkhand'
    };
  }
}

// Certificate type full name mapper
function getCertFullDisplayName(code) {
  if (!code) return 'Certificate';
  const c = String(code).trim().toUpperCase();
  if (c.includes('JHIC')) return 'INC (Income Certificate)';
  if (c.includes('JHCBC')) return 'JHCBC (Caste Certificate BC-1 / BC-2)';
  if (c.includes('JHNBC')) return 'JHNBC (Non-Creamy Layer Caste Certificate)';
  if (c.includes('JHCSC')) return 'JHCSC (Scheduled Caste Certificate SC)';
  if (c.includes('JHCST')) return 'JHCST (Scheduled Tribe Certificate ST)';
  if (c.includes('JHLRCO')) return 'JHLRCO (Local Resident Certificate CO Level)';
  if (c.includes('JHRES')) return 'JHRES (Residential Certificate SDO Level)';
  if (c.includes('JHCOB')) return 'JHCOB (OBC Central Format Certificate)';
  if (c.includes('JHOBCH')) return 'JHOBCH (OBC State Format Certificate)';
  if (c.includes('JHEWS')) return 'JHEWS (EWS Central Certificate)';
  if (c.includes('JHEWSH')) return 'JHEWSH (EWS State Certificate)';
  if (c.includes('JHMGR')) return 'Marriage Registration Certificate (JHMGR)';
  if (c.includes('PANNEW')) return 'New PAN Card Application (PANNEW)';
  if (c.includes('PANUPD')) return 'PAN Card Correction / Update (PANUPD)';
  return code;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  } catch (e) {}
  return String(dateStr).split('T')[0];
}

/**
 * Process a single certificate sync request from Firebase Queue
 */
async function processQueueItem(certId, certData) {
  console.log(`\n======================================================`);
  console.log(`⚡ [FirebaseQueue] PROCESSING QUEUE ITEM for ID: ${certId}`);
  console.log(`📄 Ref No: ${certData.refNo} | Applicant: ${certData.applicantName}`);
  console.log(`======================================================`);

  const certRef = doc(db, 'certificates', String(certId));

  try {
    // 1. Mark as PROCESSING in Firebase so UI immediately shows loading indicator
    await setDoc(certRef, {
      syncStatus: 'PROCESSING',
      syncStartedAt: new Date().toISOString()
    }, { merge: true });

    // 2. Query Jharsewa via local Puppeteer engine
    const statusResult = await checkJharsewaStatus(certData.refNo, certData.entryDate);

    if (statusResult.error) {
      console.error(`❌ [FirebaseQueue] Jharsewa Query Failed for ${certData.refNo}:`, statusResult.error);
      await setDoc(certRef, {
        syncRequested: false,
        syncStatus: 'ERROR',
        syncError: statusResult.error,
        lastSyncedAt: new Date().toISOString()
      }, { merge: true });
      return;
    }

    const newStatus = statusResult.status || 'INITIATED';
    const oldStatus = certData.currentStatus || 'INITIATED';

    console.log(`✅ [FirebaseQueue] LIVE STATUS FOUND: ${newStatus} (Previous: ${oldStatus})`);

    // 3. Update Firestore immediately in real-time
    const updatedPayload = {
      currentStatus: newStatus,
      status: newStatus,
      syncRequested: false,
      syncStatus: 'COMPLETED',
      syncError: null,
      lastSyncedAt: new Date().toISOString()
    };

    await setDoc(certRef, updatedPayload, { merge: true });
    console.log(`🔥 [FirebaseQueue] Updated Cloud Firestore for ${certData.refNo} -> ${newStatus}`);

    // 4. Update local SQLite DB if record exists
    try {
      await prisma.certificate.updateMany({
        where: { refNo: certData.refNo },
        data: { currentStatus: newStatus, lastSyncedAt: new Date() }
      });
    } catch (dbErr) {}

    // 5. Send automated WhatsApp message to applicant if mobile is present
    if (certData.mobile) {
      try {
        const shop = await getShopDetails();
        const fullCertName = getCertFullDisplayName(certData.certType);
        const formattedDate = formatDate(certData.entryDate);
        const dues = certData.duesAmount || 0;

        const messageText = `*${shop.shopName}*
📞 ${shop.phone}
📍 ${shop.address}
-----------------------
📄 रेफरेंस नंबर: *${certData.refNo}*
👤 आवेदक का नाम: *${certData.applicantName}*
📜 प्रमाण पत्र का प्रकार: *${fullCertName}*
📅 आवेदन तिथि: *${formattedDate}*
🔄 अद्यतन स्थिति (Status): *${newStatus}*
💰 बकाया राशि (Dues): *₹${dues}*

किसी प्रकार के अपडेट पर आपको सूचित किया जाएगा। धन्यवाद!`;

        await sendTestWhatsAppMessage(certData.mobile, messageText);
        console.log(`📲 [FirebaseQueue] WhatsApp update delivered to +91 ${certData.mobile}!`);
      } catch (waErr) {
        console.warn(`⚠️ [FirebaseQueue] WhatsApp send failed:`, waErr.message);
      }
    }

  } catch (err) {
    console.error(`💥 [FirebaseQueue] Exception processing ${certData.refNo}:`, err);
    try {
      await setDoc(certRef, {
        syncRequested: false,
        syncStatus: 'ERROR',
        syncError: err.message,
        lastSyncedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e2) {}
  }
}

/**
 * Sequential FIFO Queue Worker (Guarantees NO parallel Puppeteer collisions!)
 */
async function processSequentialQueue() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    while (pendingQueueItems.length > 0) {
      const item = pendingQueueItems.shift();
      if (item) {
        try {
          await processQueueItem(item.certId, item.certData);
        } catch (itemErr) {
          console.error(`💥 Queue Worker item error:`, itemErr);
        } finally {
          enqueuedIds.delete(item.certId);
        }
        // Small pause between queue items to allow Puppeteer DOM stability
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  } finally {
    isWorkerRunning = false;
  }
}

function enqueueItem(certId, certData) {
  if (enqueuedIds.has(certId)) return;

  // 🛡️ Multi-Client HWID Queue Isolation:
  // If request specifies targetClientHwid, only the designated machine handles it!
  if (certData.targetClientHwid && currentLocalHwid) {
    const cleanTarget = String(certData.targetClientHwid).trim().toUpperCase();
    const cleanCurrent = String(currentLocalHwid).trim().toUpperCase();
    if (cleanTarget !== cleanCurrent) {
      // Intended for another PC - do NOT touch!
      return;
    }
  }

  enqueuedIds.add(certId);
  pendingQueueItems.push({ certId, certData });
  processSequentialQueue().catch(err => {
    console.error('💥 Error in sequential queue loop:', err);
    isWorkerRunning = false;
  });
}

/**
 * Verify whether this machine's HWID is whitelisted in Firebase Master DB
 */
async function verifyLocalMachineAuthorization() {
  try {
    currentLocalHwid = await getSystemHWID();
    console.log(`🔒 [License Guard] Current Machine HWID: ${currentLocalHwid}`);

    const clientsRef = collection(db, 'clients');
    const snapshot = await getDocs(clientsRef);
    let matchedClient = null;

    snapshot.forEach(docSnap => {
      const c = docSnap.data();
      const hwidList = Array.isArray(c.hwids) && c.hwids.length > 0 
        ? c.hwids.map(h => String(h).toUpperCase())
        : [(c.hwid || '').toUpperCase()];

      if (hwidList.includes(currentLocalHwid.toUpperCase())) {
        matchedClient = c;
      }
    });

    if (!matchedClient) {
      console.warn(`\n======================================================`);
      console.warn(`⛔ [LICENSE GUARD] ACCESS DENIED!`);
      console.warn(`Machine HWID: ${currentLocalHwid} is NOT whitelisted in Master DB.`);
      console.warn(`Background Sync Engine will remain in STANDBY mode.`);
      console.warn(`Contact Master Admin (7781931880) to whitelist this PC.`);
      console.warn(`======================================================\n`);
      isMachineLicenseActive = false;
      return false;
    }

    if (matchedClient.status !== 'ACTIVE') {
      console.warn(`⛔ [LICENSE GUARD] Client account ${matchedClient.clientName} status is "${matchedClient.status}". Engine suspended.`);
      isMachineLicenseActive = false;
      return false;
    }

    isMachineLicenseActive = true;
    console.log(`✅ [License Guard] Machine HWID Authorized for: ${matchedClient.clientName} (${matchedClient.phone})`);
    return true;
  } catch (err) {
    console.error('❌ [License Guard] Error verifying machine license:', err.message);
    // Fallback: allow if offline development or transient network glitch
    return true;
  }
}

/**
 * Start listening to Cloud Firestore queue in real-time
 */
async function startFirebaseQueueListener() {
  if (!db) {
    console.warn('⚠️ [FirebaseQueue] Firebase DB not initialized. Realtime queue cannot start.');
    return;
  }

  if (isListenerActive) {
    console.log('⚡ [FirebaseQueue] Listener is already active.');
    return;
  }

  // 1. Verify Machine Authorization before starting listener
  const authorized = await verifyLocalMachineAuthorization();
  if (!authorized) {
    console.warn('⏸️ [FirebaseQueue] Sync listener not started: Machine not authorized.');
    return;
  }

  console.log('🚀 [FirebaseQueue] Starting Realtime Cloud Firestore Queue Listener (Sequential Mutex Enabled)...');
  isListenerActive = true;

  try {
    const certsRef = collection(db, 'certificates');
    onSnapshot(certsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docData = change.doc.data();
          const certId = change.doc.id;

          // Check if sync was requested
          if (docData.syncRequested === true || docData.syncStatus === 'QUEUED') {
            enqueueItem(certId, docData);
          }
        }
      });
    }, (error) => {
      console.error('❌ [FirebaseQueue] Firestore listener error:', error);
      isListenerActive = false;
      // Auto-reconnect after 10 seconds
      setTimeout(startFirebaseQueueListener, 10000);
    });

    console.log('✅ [FirebaseQueue] LISTENING LIVE TO FIREBASE! Sequential Queue Worker Ready.');
  } catch (err) {
    console.error('❌ [FirebaseQueue] Initialization failed:', err);
    isListenerActive = false;
  }
}

module.exports = {
  startFirebaseQueueListener,
  verifyLocalMachineAuthorization
};
