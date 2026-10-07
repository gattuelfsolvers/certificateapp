/**
 * 📁 CSV Folder Watcher Service
 * Monitors Downloads / Sync folder for incoming certificate CSV sync trigger files.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const prisma = require('../db');
const { checkJharsewaStatus } = require('../services/jharsewa.service');
const { sendStatusUpdateNotification } = require('../services/whatsapp.service');

// Get default Downloads folder path
const userHome = os.homedir();
const downloadsDir = path.join(userHome, 'Downloads');

let isProcessing = false;

/**
 * Parse single or multi-row CSV content
 */
function parseCsvContent(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('reference'));
  const idIdx = headers.findIndex(h => h.includes('id'));
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const statusIdx = headers.findIndex(h => h.includes('status'));

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(cell => cell.replace(/^"|"$/g, '').trim());
    const refNo = refIdx !== -1 ? row[refIdx] : (row[0] || '');
    if (refNo && refNo.includes('/')) {
      records.push({
        id: idIdx !== -1 ? row[idIdx] : null,
        refNo: refNo,
        entryDate: dateIdx !== -1 ? row[dateIdx] : null,
        currentStatus: statusIdx !== -1 ? row[statusIdx] : 'INITIATED'
      });
    }
  }
  return records;
}

/**
 * Patch updated certificate status directly to Cloud Firestore API
 */
async function patchFirestoreCloud(certId, newStatus) {
  if (!certId) return;
  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/certificate-master-db/databases/(default)/documents/certificates/${certId}?updateMask.fieldPaths=currentStatus&updateMask.fieldPaths=status&updateMask.fieldPaths=lastSyncedAt`;
    await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          currentStatus: { stringValue: newStatus },
          status: { stringValue: newStatus },
          lastSyncedAt: { stringValue: new Date().toISOString() }
        }
      })
    });
    console.log(`🔥 [CsvWatcher] Patched ${certId} -> ${newStatus} to Cloud Firestore!`);
  } catch (err) {
    console.error('⚠️ [CsvWatcher] Firestore patch error:', err.message);
  }
}

/**
 * Process single detected CSV sync file
 */
async function processCsvSyncFile(filePath) {
  try {
    console.log(`📥 [CsvWatcher] Detected CSV Sync Trigger File: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parseCsvContent(content);

    if (records.length === 0) {
      console.log('⚠️ [CsvWatcher] No valid certificate reference numbers found in CSV.');
      return;
    }

    console.log(`🔄 [CsvWatcher] Found ${records.length} certificate record(s) to sync from CSV...`);

    let updatedCount = 0;
    const updatedRows = [];

    for (const rec of records) {
      console.log(`🔎 [CsvWatcher] Querying Jharsewa for Ref: ${rec.refNo}...`);
      const statusResult = await checkJharsewaStatus(rec.refNo, rec.entryDate);

      if (!statusResult.error && statusResult.status) {
        const newStatus = statusResult.status;
        const oldStatus = rec.currentStatus;
        const statusChanged = Boolean(newStatus !== oldStatus);

        console.log(`✅ [CsvWatcher] Status for ${rec.refNo}: ${newStatus} (Changed: ${statusChanged})`);

        // Find or create in local SQLite DB
        let cert = await prisma.certificate.findUnique({ where: { refNo: rec.refNo } });
        if (!cert) {
          cert = await prisma.certificate.create({
            data: {
              refNo: rec.refNo,
              applicantName: 'CSV Sync Applicant',
              mobile: '',
              certType: rec.refNo.split('/')[0] || 'JHIC',
              currentStatus: newStatus
            }
          });
        } else {
          cert = await prisma.certificate.update({
            where: { id: cert.id },
            data: { currentStatus: newStatus, lastSyncedAt: new Date() }
          });
        }

        // Patch to Cloud Firestore
        await patchFirestoreCloud(rec.id || cert.id, newStatus);

        if (statusChanged) {
          updatedCount++;
          try {
            await sendStatusUpdateNotification(cert, oldStatus, newStatus);
          } catch (e) {}
        }
      }
    }

    console.log(`🎉 [CsvWatcher] CSV Sync Complete! Updated ${updatedCount} records.`);

    // Safely remove or archive processed CSV trigger file
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️ [CsvWatcher] Cleaned up processed CSV file: ${filePath}`);
    } catch (e) {}

  } catch (err) {
    console.error('❌ [CsvWatcher] Error processing CSV file:', err);
  }
}

/**
 * Start watching Downloads directory for CSV sync files
 */
function startCsvFolderWatcher() {
  if (!fs.existsSync(downloadsDir)) return;

  console.log(`👀 [CsvWatcher] Watching Downloads directory for CSV Sync files: ${downloadsDir}`);

  fs.watch(downloadsDir, (eventType, filename) => {
    if (filename && filename.toLowerCase().includes('sync') && filename.toLowerCase().endsWith('.csv')) {
      const fullPath = path.join(downloadsDir, filename);
      if (fs.existsSync(fullPath) && !isProcessing) {
        isProcessing = true;
        setTimeout(async () => {
          await processCsvSyncFile(fullPath);
          isProcessing = false;
        }, 1500);
      }
    }
  });
}

module.exports = { startCsvFolderWatcher, processCsvSyncFile };
