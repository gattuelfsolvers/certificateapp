const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const prisma = require('../db');

let sock = null;
let isConnected = false;
let qrCodeDataUri = null;
let connectedPhone = null;

// Persistent Database Auth State Adapter for Baileys (Prevents Render disk wipe session loss)
async function useDatabaseAuthState() {
  const readData = async (id) => {
    try {
      const row = await prisma.whatsAppSession.findUnique({ where: { id } });
      if (row && row.data) {
        return JSON.parse(row.data, BufferJSON.reviver);
      }
    } catch (e) {}
    return null;
  };

  const writeData = async (id, data) => {
    try {
      const jsonStr = JSON.stringify(data, BufferJSON.replacer);
      await prisma.whatsAppSession.upsert({
        where: { id },
        create: { id, data: jsonStr },
        update: { data: jsonStr }
      });
    } catch (e) {
      console.error('Failed to write whatsapp session to DB:', e);
    }
  };

  const removeData = async (id) => {
    try {
      await prisma.whatsAppSession.delete({ where: { id } });
    } catch (e) {}
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = Baileys.proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const keyId = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(keyId, value));
              } else {
                tasks.push(removeData(keyId));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData('creds', creds)
  };
}

// Anti-Spam Rate-Limiter Message Queue (WhatsApp Official Terms Safety Compliance)
const messageQueue = [];
let isProcessingQueue = false;

// Minimum delay between messages: 3500ms to 7500ms (Random Humanized Delay)
function getRandomDelay(min = 3500, max = 7500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Enqueue message to Anti-Spam rate-limited queue
 */
function enqueueMessage(taskFn) {
  return new Promise((resolve, reject) => {
    messageQueue.push({ taskFn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;

  const { taskFn, resolve, reject } = messageQueue.shift();

  try {
    const result = await taskFn();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    const delay = getRandomDelay();
    console.log(`⏳ Anti-Spam Protection: Waiting ${Math.round(delay / 1000)} seconds before next WhatsApp dispatch...`);
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, delay);
  }
}

async function logoutWhatsApp() {
  try {
    const authDir = path.join(__dirname, '../../auth_info_baileys');
    if (sock) {
      await sock.logout();
    }
    sock = null;
    isConnected = false;
    qrCodeDataUri = null;
    connectedPhone = null;

    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    console.log('🚪 WhatsApp Device Unlinked and Auth Credentials Cleared.');
    return { success: true, message: 'WhatsApp unlinked successfully.' };
  } catch (err) {
    console.error('Logout error:', err);
    return { success: false, error: err.message };
  }
}

async function initWhatsApp() {
  try {
    const authDir = path.join(__dirname, '../../auth_info_baileys');
    const publicDir = path.join(__dirname, '../../public');

    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Desktop'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrCodeDataUri = await QRCode.toDataURL(qr);
          const qrFilePath = path.join(publicDir, 'whatsapp-qr.png');
          await QRCode.toFile(qrFilePath, qr, { width: 350 });
          console.log(`📸 Saved stable WhatsApp QR Image to: ${qrFilePath}`);
        } catch (e) {
          console.error('Failed to generate DataURI/File QR:', e);
        }
        console.log('\n====================================================');
        console.log('📱 WHATSAPP QR CODE READY: Scan from WhatsApp');
        console.log('====================================================');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'close') {
        isConnected = false;
        connectedPhone = null;
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        console.log('WhatsApp connection closed. Status Code:', statusCode);
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 4000);
        } else {
          console.log('Logged out. Clearing auth info...');
          if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
          }
          setTimeout(initWhatsApp, 4000);
        }
      } else if (connection === 'open') {
        isConnected = true;
        qrCodeDataUri = null;
        const userJid = sock.user?.id || '';
        connectedPhone = userJid.split('@')[0].split(':')[0];
        console.log('\n===========================================');
        console.log(`✅ WHATSAPP CONNECTED: +${connectedPhone}`);
        console.log('===========================================\n');
      }
    });
  } catch (error) {
    console.error('WhatsApp Initialization Error:', error);
  }
}

/**
 * Format phone number to WhatsApp JID (e.g., 919876543210@s.whatsapp.net)
 */
function formatJid(phoneInput) {
  if (!phoneInput) return null;
  const rawPhone = phoneInput.replace(/\D/g, '');
  const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
  return `${phone}@s.whatsapp.net`;
}

async function getTemplateText(key, placeholders = {}) {
  try {
    let tpl = await prisma.whatsAppTemplate.findUnique({ where: { templateKey: key } });
    if (!tpl || !tpl.messageText) {
      const { DEFAULT_TEMPLATES } = require('../routes/whatsappTemplate.routes');
      const found = DEFAULT_TEMPLATES.find(t => t.templateKey === key);
      if (found) tpl = found;
    }

    if (!tpl || !tpl.messageText) return null;

    let text = tpl.messageText;
    for (const [pKey, pVal] of Object.entries(placeholders)) {
      const regex = new RegExp(`\\{${pKey}\\}`, 'g');
      text = text.replace(regex, pVal !== undefined && pVal !== null ? pVal : '');
    }
    return text;
  } catch (err) {
    console.error(`Error loading WhatsApp template for ${key}:`, err);
    return null;
  }
}

/**
 * Automatic WhatsApp Receipt message when certificate is entered
 */
async function sendAutomaticReceipt(cert) {
  if (!cert || !cert.mobile) {
    console.log('⚠️ Skipping WhatsApp receipt: No mobile number provided');
    return { success: false, reason: 'No mobile number' };
  }

  const jid = formatJid(cert.mobile);
  if (!jid) return { success: false, reason: 'Invalid mobile number' };

  const formattedDate = new Date(cert.entryDate || Date.now()).toLocaleDateString('en-IN');
  const duesLine = (cert.duesAmount && cert.duesAmount > 0) ? `\nबकाया राशि (Dues): *₹${cert.duesAmount}*` : '';
  const currentStatusText = cert.currentStatus === 'UNDER_PROCESS' ? 'प्रक्रिया में (UNDER PROCESS)' : (cert.currentStatus || 'UNDER_PROCESS');

  let messageText = await getTemplateText('INITIAL_RECEIPT', {
    applicantName: cert.applicantName,
    certType: cert.certType,
    refNo: cert.refNo,
    entryDate: formattedDate,
    currentStatus: currentStatusText,
    duesLine
  });

  if (!messageText) {
    messageText = `📄 *अपना डिजिटल हब* 📄
------------------------------------
*आवेदन पंजीयन रसीद*

आवेदक का नाम: *${cert.applicantName}*
प्रमाणपत्र प्रकार: *${cert.certType}*
रेफरेंस नंबर: *${cert.refNo}*
दिनांक: ${formattedDate}
वर्तमान स्थिति: *${currentStatusText}*${duesLine}

------------------------------------
आपका आवेदन सफलतापूर्वक दर्ज कर लिया गया है। स्थिति अपडेट होने पर आपको सूचित कर दिया जाएगा।
धन्यवाद!`;
  }

  if (sock && isConnected) {
    try {
      await sock.sendMessage(jid, { text: messageText });
      console.log(`🚀 AUTOMATIC RECEIPT WHATSAPP SENT to ${cert.mobile} for Ref: ${cert.refNo}`);
      return { success: true };
    } catch (err) {
      console.error('Failed to send WhatsApp receipt:', err);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`ℹ️ WhatsApp not connected yet. Skipped sending message to ${cert.mobile}`);
    return { success: false, reason: 'WhatsApp engine not connected' };
  }
}

/**
 * Send Consolidated WhatsApp Receipt for Multiple Certificates entered at once
 */
async function sendBulkAutomaticReceipt(certList) {
  if (!certList || certList.length === 0) return { success: false, reason: 'No certificates' };
  if (certList.length === 1) return sendAutomaticReceipt(certList[0]);

  const firstCert = certList[0];
  if (!firstCert || !firstCert.mobile) return { success: false, reason: 'No mobile' };

  const jid = formatJid(firstCert.mobile);
  if (!jid) return { success: false, reason: 'Invalid mobile' };

  const formattedDate = new Date(firstCert.entryDate || Date.now()).toLocaleDateString('en-IN');

  let totalDues = 0;

  const certLines = certList.map((c, i) => {
    totalDues += (c.duesAmount || 0);

    return `${i + 1}. *${c.certType}*
   - रेफरेंस नंबर: *${c.refNo}*`;
  }).join('\n\n');

  const duesLine = (totalDues > 0) ? `\n------------------------------------\n*कुल बकाया राशि (Dues): ₹${totalDues}*` : '';

  let messageText = await getTemplateText('BULK_RECEIPT', {
    totalCount: certList.length,
    applicantName: firstCert.applicantName,
    entryDate: formattedDate,
    certListLines: certLines,
    duesLine
  });

  if (!messageText) {
    messageText = `📄 *अपना डिजिटल हब* 📄
------------------------------------
*आवेदन पंजीयन रसीद (${certList.length} प्रमाणपत्र)*

आवेदक का नाम: *${firstCert.applicantName}*
दिनांक: ${formattedDate}

${certLines}${duesLine}

------------------------------------
आपकी सभी ${certList.length} आवेदन रसीदें सफलतापूर्वक दर्ज कर ली गई हैं। स्थिति अपडेट होने पर आपको सूचित कर दिया जाएगा।
धन्यवाद!`;
  }

  if (sock && isConnected) {
    try {
      await sock.sendMessage(jid, { text: messageText });
      console.log(`🚀 BULK RECEIPT WHATSAPP SENT to ${firstCert.mobile} for ${certList.length} certs`);
      return { success: true };
    } catch (err) {
      console.error('Failed to send bulk WhatsApp receipt:', err);
      return { success: false, error: err.message };
    }
  } else {
    return { success: false, reason: 'WhatsApp engine not connected' };
  }
}

/**
 * Send WhatsApp notification when Certificate Status changes (Delivered, Rejected, etc.)
 */
async function sendStatusUpdateNotification(cert, oldStatus, newStatus) {
  if (!cert || !cert.mobile) return { success: false, reason: 'No mobile number' };
  const jid = formatJid(cert.mobile);
  if (!jid) return { success: false, reason: 'Invalid mobile' };

  let templateKey = `STATUS_${newStatus}`;
  if (newStatus === 'CO_DELIVERED') templateKey = 'STATUS_DELIVERED';

  let messageText = await getTemplateText(templateKey, {
    applicantName: cert.applicantName,
    certType: cert.certType,
    refNo: cert.refNo
  });

  if (!messageText) {
    let statusText = newStatus;
    let emoji = '⏳';
    if (newStatus === 'CI_UNDER_PROCESS') {
      emoji = '⏳';
      statusText = 'सर्किल इंस्पेक्टर स्तर पर प्रक्रिया में (CI - Under Process)';
    } else if (newStatus === 'CI_WAITING') {
      emoji = '⚠️';
      statusText = 'सर्किल इंस्पेक्टर - आवेदक की प्रतिक्रिया की प्रतीक्षा में (CI - Waiting for Applicant Response)';
    } else if (newStatus === 'CO_UNDER_PROCESS') {
      emoji = '⏳';
      statusText = 'अंचलाधिकारी स्तर पर प्रक्रिया में (Circle Officer - Under Process)';
    } else if (newStatus === 'CO_WAITING') {
      emoji = '⚠️';
      statusText = 'अंचलाधिकारी - आवेदक की प्रतिक्रिया की प्रतीक्षा में (Circle Officer - Waiting for Applicant Response)';
    } else if (newStatus === 'CO_DELIVERED' || newStatus === 'DELIVERED') {
      emoji = '🎉';
      statusText = 'अंचलाधिकारी स्तर से निर्गत (Circle Officer - Delivered)';
    } else if (newStatus === 'SDO_UNDER_PROCESS') {
      emoji = '⏳';
      statusText = 'अनुमंडल पदाधिकारी स्तर पर प्रक्रिया में (SDO - Under Process)';
    } else if (newStatus === 'SDO_DELIVERED') {
      emoji = '🎉';
      statusText = 'अनुमंडल पदाधिकारी स्तर से निर्गत (SDO - Delivered)';
    } else if (newStatus === 'INITIATED') {
      emoji = '📝';
      statusText = 'आवेदन सबमिट कर दिया गया है (Initiated)';
    } else if (newStatus === 'REJECTED') {
      emoji = '❌';
      statusText = 'निरस्त (REJECTED)';
    } else if (newStatus === 'UNDER_PROCESS') {
      emoji = '⏳';
      statusText = 'प्रक्रिया में (UNDER PROCESS)';
    }

    const isDelivered = newStatus === 'DELIVERED' || newStatus === 'CO_DELIVERED' || newStatus === 'SDO_DELIVERED';
    const isRejected = newStatus === 'REJECTED';
    const isWaiting = newStatus === 'CI_WAITING' || newStatus === 'CO_WAITING';

    messageText = `${emoji} *अपना डिजिटल हब - स्थिति अपडेट* ${emoji}
------------------------------------
आवेदक का नाम: *${cert.applicantName}*
प्रमाणपत्र प्रकार: *${cert.certType}*
रेफरेंस नंबर: *${cert.refNo}*

वर्तमान स्थिति: *${statusText}*

${isDelivered ? 'आपका प्रमाणपत्र बन चुका है, कृपया सेंटर से संपर्क करके प्राप्त करें।' : ''}
${isRejected ? 'आपका आवेदन निरस्त कर दिया गया है। अधिक जानकारी के लिए सेंटर से संपर्क करें।' : ''}
${isWaiting ? 'आपके आवेदन पर अधिकारी द्वारा जानकारी/दस्तावेज़ की मांग की गई है। कृपया सेंटर से संपर्क करें।' : ''}

धन्यवाद!`;
  }

  if (sock && isConnected) {
    try {
      await sock.sendMessage(jid, { text: messageText });
      console.log(`🚀 STATUS UPDATE WHATSAPP SENT to ${cert.mobile} (${newStatus})`);
      return { success: true };
    } catch (err) {
      console.error('Failed to send WhatsApp status update:', err);
      return { success: false, error: err.message };
    }
  } else {
    return { success: false, reason: 'WhatsApp engine not connected' };
  }
}

/**
 * Send PDF Document Certificate to applicant via WhatsApp
 */
async function sendPDFDocument(mobile, pdfFilePath, cert) {
  if (!mobile) return { success: false, error: 'Mobile number missing' };
  const jid = formatJid(mobile);
  if (!jid) return { success: false, error: 'Invalid mobile number' };

  if (!sock || !isConnected) {
    throw new Error('WhatsApp engine is not connected. Scan QR code first!');
  }

  const pdfBuffer = fs.readFileSync(pdfFilePath);
  const cleanRef = (cert.refNo || '').replace(/\//g, '_');
  const fileName = `${cleanRef}_Certificate.pdf`;

  let captionText = await getTemplateText('PDF_CAPTION', {
    applicantName: cert.applicantName,
    certType: cert.certType,
    refNo: cert.refNo
  });

  if (!captionText) {
    captionText = `📄 *अपना डिजिटल हब* 📄
------------------------------------
*प्रमाणपत्र (Certificate PDF)*

आवेदक का नाम: *${cert.applicantName}*
प्रमाणपत्र प्रकार: *${cert.certType}*
रेफरेंस नंबर: *${cert.refNo}*

आपका प्रमाणपत्र सफलतापूर्वक पोर्टल से डाउनलोड कर आपको भेजा जा रहा है।
धन्यवाद!`;
  }

  await sock.sendMessage(jid, {
    document: pdfBuffer,
    mimetype: 'application/pdf',
    fileName: fileName,
    caption: captionText
  });

  console.log(`🚀 CERTIFICATE PDF SENT SUCCESSFULLY to ${mobile} for Ref: ${cert.refNo}`);
  return { success: true, message: `PDF Certificate sent to ${mobile}` };
}

function getWhatsAppStatus() {
  return {
    isConnected,
    connectedPhone,
    qrCodeData: qrCodeDataUri,
  };
}

/**
 * Send Test WhatsApp Message to preview custom message text
 */
async function sendTestWhatsAppMessage(mobile, messageText) {
  if (!mobile) return { success: false, error: 'Mobile number missing' };
  const jid = formatJid(mobile);
  if (!jid) return { success: false, error: 'Invalid mobile number' };

  if (!sock || !isConnected) {
    return { success: false, error: 'WhatsApp engine is not connected. Please scan QR code in WhatsApp QR & Logs menu first!' };
  }

  // Replace placeholders with realistic demo data if present
  let testContent = (messageText || '')
    .replace(/\{applicantName\}/g, 'रमेश कुमार (TEST)')
    .replace(/\{refNo\}/g, 'JHIC/2026/999999')
    .replace(/\{certType\}/g, 'Income Certificate (JHIC)')
    .replace(/\{entryDate\}/g, new Date().toLocaleDateString('en-IN'))
    .replace(/\{currentStatus\}/g, 'सर्किल इंस्पेक्टर स्तर पर प्रक्रिया में (CI - Under Process)')
    .replace(/\{duesLine\}/g, '\nबकाया राशि (Dues): *₹150*')
    .replace(/\{totalCount\}/g, '3')
    .replace(/\{certListLines\}/g, '1. *Income Certificate (JHIC)*\n   - रेफरेंस नंबर: *JHIC/2026/999999*\n\n2. *Caste Certificate (JHCBC)*\n   - रेफरेंस नंबर: *JHCBC/2026/888888*');

  try {
    const res = await enqueueMessage(() => sock.sendMessage(jid, { text: testContent }));
    return { success: true, messageId: res?.key?.id || 'SENT' };
  } catch (err) {
    console.error('Failed to send test WhatsApp message:', err);
    return { success: false, error: err.message };
  }
}

async function requestPairingCode(phoneNumber) {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  if (!sock) {
    await initWhatsApp();
    // Give 2 seconds for socket handshake
    await new Promise(r => setTimeout(r, 2000));
  }

  try {
    if (!sock || typeof sock.requestPairingCode !== 'function') {
      await initWhatsApp();
      await new Promise(r => setTimeout(r, 2500));
    }
    const code = await sock.requestPairingCode(formattedPhone);
    return { success: true, pairingCode: code };
  } catch (err) {
    console.error('Failed to request pairing code:', err);
    // Retry once after re-initializing socket
    try {
      await initWhatsApp();
      await new Promise(r => setTimeout(r, 3000));
      if (sock && typeof sock.requestPairingCode === 'function') {
        const retryCode = await sock.requestPairingCode(formattedPhone);
        return { success: true, pairingCode: retryCode };
      }
    } catch (retryErr) {
      console.error('Retry pairing code failed:', retryErr);
    }
    return { success: false, error: err.message || 'WhatsApp engine is busy. Please try again in 5 seconds.' };
  }
}

module.exports = {
  initWhatsApp,
  logoutWhatsApp,
  requestPairingCode,
  sendAutomaticReceipt: (cert) => enqueueMessage(() => sendAutomaticReceipt(cert)),
  sendBulkAutomaticReceipt: (certList) => enqueueMessage(() => sendBulkAutomaticReceipt(certList)),
  sendStatusUpdateNotification: (cert, oldStatus, newStatus) => enqueueMessage(() => sendStatusUpdateNotification(cert, oldStatus, newStatus)),
  sendPDFDocument: (mobile, pdfFilePath, cert) => enqueueMessage(() => sendPDFDocument(mobile, pdfFilePath, cert)),
  getWhatsAppStatus,
  sendTestWhatsAppMessage,
};

