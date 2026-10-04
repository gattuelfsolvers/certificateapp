const prisma = require('../db');
const { syncMultipleCertificates } = require('../services/jharsewa.service');
const { sendStatusUpdateNotification } = require('../services/whatsapp.service');

/**
 * FilteredStatusSyncEngine
 * 
 * Safely executes batch Jharsewa status sync strictly for certificates 
 * matching the selected status filter (and optional search / certType filters).
 * Purane kisi bhi engine ya logic ko EDIT/TOUCH nahi karta.
 * 
 * @param {Object} filterOptions - { status, certType, search, hasDues }
 */
async function syncFilteredStatusCertificates(filterOptions = {}) {
  const { status, certType, search, hasDues } = filterOptions;

  const where = {};

  // Build target status filter
  if (status && status !== 'ALL') {
    if (status === 'WAITING') {
      where.currentStatus = { in: ['WAITING', 'CI_WAITING', 'CO_WAITING'] };
    } else if (status === 'UNDER_PROCESS') {
      where.currentStatus = { in: ['UNDER_PROCESS', 'CI_UNDER_PROCESS', 'CO_UNDER_PROCESS', 'SDO_UNDER_PROCESS'] };
    } else if (status === 'DELIVERED') {
      where.currentStatus = { in: ['DELIVERED', 'CO_DELIVERED', 'SDO_DELIVERED'] };
    } else {
      where.currentStatus = status;
    }
  } else {
    // If 'ALL' or empty, restrict to active/pending statuses by default
    where.currentStatus = { in: ['INITIATED', 'HOLD', 'UNDER_PROCESS', 'PENDING', 'WAITING', 'CI_UNDER_PROCESS', 'CI_WAITING', 'CO_UNDER_PROCESS', 'CO_WAITING', 'SDO_UNDER_PROCESS'] };
  }

  // Certificate Type Filter
  if (certType && certType !== 'ALL') {
    where.certType = certType;
  }

  // Dues Filter
  if (hasDues === true || hasDues === 'true') {
    where.duesAmount = { gt: 0 };
  }

  // Search query filter (Reference Number, Applicant Name, Mobile, Address)
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { refNo: { contains: q } },
      { applicantName: { contains: q } },
      { mobile: { contains: q } },
      { address: { contains: q } },
    ];
  }

  console.log(`======================================================`);
  console.log(`🚀 [FilteredStatusSyncEngine] Fetching target certificates with filter:`, JSON.stringify(where));
  console.log(`======================================================`);

  const targetCertificates = await prisma.certificate.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  if (targetCertificates.length === 0) {
    return {
      success: true,
      message: 'Is filter list me sync karne ke liye koi certificate nahi mila.',
      syncedCount: 0,
      updatedCount: 0,
      results: []
    };
  }

  console.log(`📌 Found ${targetCertificates.length} target certificate(s) matching active filter list. Triggering portal batch sync...`);

  // Leverage current session-safe bulk sync routine
  const syncResults = await syncMultipleCertificates(targetCertificates);

  let updatedCount = 0;
  for (const item of syncResults) {
    if (item.newStatus && item.newStatus !== item.oldStatus) {
      updatedCount++;
      const updated = await prisma.certificate.update({
        where: { id: item.certId },
        data: {
          currentStatus: item.newStatus,
          lastSyncedAt: new Date()
        }
      });

      await prisma.statusLog.create({
        data: {
          certificateId: item.certId,
          oldStatus: item.oldStatus,
          newStatus: item.newStatus,
          remarks: `Filtered List Sync (${status || 'CUSTOM_VIEW'})`
        }
      });

      // Send WhatsApp notification if status changed
      try {
        await sendStatusUpdateNotification(updated, item.oldStatus, item.newStatus);
      } catch (e) {
        console.warn('⚠️ WhatsApp notification notice:', e.message);
      }
    } else {
      await prisma.certificate.update({
        where: { id: item.certId },
        data: { lastSyncedAt: new Date() }
      });
    }
  }

  console.log(`======================================================`);
  console.log(`🎉 [FilteredStatusSyncEngine] Completed! Synced: ${targetCertificates.length}, Status Updated: ${updatedCount}`);
  console.log(`======================================================`);

  return {
    success: true,
    message: `Filtered List Sync Complete: ${targetCertificates.length} certificate(s) checked, ${updatedCount} updated!`,
    syncedCount: targetCertificates.length,
    updatedCount,
    results: syncResults
  };
}

module.exports = {
  syncFilteredStatusCertificates
};
