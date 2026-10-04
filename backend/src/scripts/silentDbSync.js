const prisma = require('../db');
const { syncMultipleCertificates } = require('../services/jharsewa.service');

async function runSilentCorrection() {
  console.log('🔄 Fetching all pending/under-process certificates for Silent Status Correction...');
  const certs = await prisma.certificate.findMany({
    where: {
      currentStatus: {
        in: ['INITIATED', 'HOLD', 'UNDER_PROCESS', 'PENDING', 'WAITING', 'CI_UNDER_PROCESS', 'CI_WAITING', 'CO_UNDER_PROCESS', 'CO_WAITING', 'SDO_UNDER_PROCESS']
      }
    },
    select: {
      id: true,
      refNo: true,
      currentStatus: true,
      entryDate: true,
      applicantName: true
    }
  });

  console.log(`📋 Found ${certs.length} active certificates to verify and update silently.`);

  if (certs.length === 0) {
    console.log('✨ No certificates require correction.');
    process.exit(0);
  }

  const results = await syncMultipleCertificates(certs);

  let updatedCount = 0;
  for (const r of results) {
    if (r.synced && r.newStatus && r.newStatus !== r.oldStatus) {
      console.log(`✅ SILENT UPDATE: ${r.refNo} (${r.applicantName || ''}) | Old: ${r.oldStatus} ➡️ New: ${r.newStatus} (Task: "${r.taskNameLevel || ''}")`);
      
      // Silent database update - ZERO WhatsApp messages sent!
      await prisma.certificate.update({
        where: { id: r.certId },
        data: {
          currentStatus: r.newStatus,
          lastSyncedAt: new Date(),
          remarks: `Silent Status Correction: ${r.newStatus} (Task: ${r.taskNameLevel || 'Direct Portal Match'})`
        }
      });

      await prisma.statusLog.create({
        data: {
          certificateId: r.certId,
          oldStatus: r.oldStatus,
          newStatus: r.newStatus,
          remarks: `Updated silently without WhatsApp message (Task: ${r.taskNameLevel || 'Portal Status'})`
        }
      });

      updatedCount++;
    } else if (r.synced) {
      console.log(`ℹ️ UNCHANGED: ${r.refNo} | Status verified as ${r.oldStatus} (Task: "${r.taskNameLevel || ''}")`);
      await prisma.certificate.update({
        where: { id: r.certId },
        data: { lastSyncedAt: new Date() }
      });
    } else {
      console.log(`⚠️ SKIPPED/FAILED SYNC: ${r.refNo} (Status retained: ${r.oldStatus})`);
    }
  }

  console.log(`🎉 SILENT DB CORRECTION COMPLETED! Updated ${updatedCount} / ${certs.length} certificates.`);
  process.exit(0);
}

runSilentCorrection().catch(err => {
  console.error('❌ Silent Correction Error:', err);
  process.exit(1);
});
