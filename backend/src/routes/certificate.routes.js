const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { sendAutomaticReceipt, sendBulkAutomaticReceipt, sendStatusUpdateNotification } = require('../services/whatsapp.service');
const { checkJharsewaStatus, syncMultipleCertificates } = require('../services/jharsewa.service');

// 0. Export Certificates Report (CSV Download)
router.get('/export-csv', async (req, res) => {
  try {
    const { search, status, certType, hasDues, startDate, endDate } = req.query;

    const where = {};

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
    }

    if (certType && certType !== 'ALL') {
      where.certType = certType;
    }

    if (hasDues === 'true') {
      where.duesAmount = { gt: 0 };
    }

    if (search) {
      where.OR = [
        { refNo: { contains: search } },
        { applicantName: { contains: search } },
        { mobile: { contains: search } },
        { address: { contains: search } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const certificates = await prisma.certificate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Generate CSV Output with exact requested columns: Srl No, Date, Name, Reference No, Mobile No, Address, Current Status, Dues
    const headers = [
      'Srl No', 'Date', 'Name', 'Reference No', 'Mobile No', 'Address', 'Current Status', 'Dues'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [
      headers.join(','),
      ...certificates.map((c, idx) => [
        escapeCsv(idx + 1),
        escapeCsv(c.entryDate ? new Date(c.entryDate).toISOString().split('T')[0] : (c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '')),
        escapeCsv(c.applicantName),
        escapeCsv(c.refNo),
        escapeCsv(c.mobile),
        escapeCsv(c.address),
        escapeCsv(c.currentStatus),
        escapeCsv(c.duesAmount)
      ].join(','))
    ];

    const csvString = csvRows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=Certificate_Report_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send('\uFEFF' + csvString); // UTF-8 BOM for Excel compatibility
  } catch (error) {
    console.error('Error exporting certificates CSV:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1. Get all certificates with search, filter, pagination
router.get('/', async (req, res) => {
  try {
    const { search, status, certType, hasDues } = req.query;

    const where = {};

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
    }

    if (certType && certType !== 'ALL') {
      where.certType = certType;
    }

    if (hasDues === 'true') {
      where.duesAmount = { gt: 0 };
    }

    if (search) {
      where.OR = [
        { refNo: { contains: search } },
        { applicantName: { contains: search } },
        { mobile: { contains: search } },
        { address: { contains: search } },
      ];
    }

    const certificates = await prisma.certificate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        statusLogs: { orderBy: { updatedAt: 'desc' }, take: 5 },
        whatsappLogs: { orderBy: { sentAt: 'desc' }, take: 5 },
      }
    });

    res.json({ success: true, data: certificates });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get single certificate by ID
router.get('/:id', async (req, res) => {
  try {
    const certificate = await prisma.certificate.findUnique({
      where: { id: req.params.id },
      include: {
        statusLogs: { orderBy: { updatedAt: 'desc' } },
        whatsappLogs: { orderBy: { sentAt: 'desc' } },
      }
    });

    if (!certificate) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }

    res.json({ success: true, data: certificate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Create new Certificate record (Supports Single or Multi-Certificate Queue!)
router.post('/', async (req, res) => {
  try {
    let items = [];
    if (req.body.certificates && Array.isArray(req.body.certificates) && req.body.certificates.length > 0) {
      items = req.body.certificates;
    } else if (req.body.refNo || req.body.certType) {
      items = [req.body];
    }

    if (items.length > 0) {
      const createdCertificates = [];

      for (const item of items) {
        const { refNo, applicantName, mobile, address, certType, entryDate, currentStatus, additionalCharge, totalFee, paidAmount, remarks } = item;

        if (!refNo || !applicantName || !mobile || !certType) {
          const missing = [];
          if (!refNo) missing.push('Reference No');
          if (!applicantName) missing.push('Applicant Name');
          if (!mobile) missing.push('Mobile');
          if (!certType) missing.push('Certificate Type');
          return res.status(400).json({ success: false, error: `Missing required fields (${missing.join(', ')}) for item: ${certType || 'Certificate'}` });
        }

        const cleanRefNo = refNo.trim();
        const existing = await prisma.certificate.findUnique({ where: { refNo: cleanRefNo } });
        if (existing) {
          return res.status(400).json({ success: false, error: `Certificate with Reference Number ${cleanRefNo} already exists!` });
        }

        const extra = parseFloat(additionalCharge) || 0;
        const total = parseFloat(totalFee) || 0;
        const paid = parseFloat(paidAmount) || 0;
        const dues = Math.max(0, total - paid);

        const created = await prisma.certificate.create({
          data: {
            refNo: cleanRefNo,
            applicantName: applicantName.trim(),
            mobile: mobile.trim(),
            address: address ? address.trim() : null,
            certType: certType.trim(),
            entryDate: entryDate ? new Date(entryDate) : new Date(),
            currentStatus: currentStatus || 'INITIATED',
            additionalCharge: extra,
            totalFee: total,
            paidAmount: paid,
            duesAmount: dues,
            remarks: remarks ? remarks.trim() : null,
            statusLogs: {
              create: {
                oldStatus: null,
                newStatus: currentStatus || 'INITIATED',
                remarks: 'Initial Certificate Entry'
              }
            }
          }
        });
        createdCertificates.push(created);
      }

      // 🚀 Send Consolidated Bulk WhatsApp Message!
      let waResult = { success: false };
      try {
        waResult = await sendBulkAutomaticReceipt(createdCertificates);
        for (const cert of createdCertificates) {
          await prisma.whatsAppLog.create({
            data: {
              certificateId: cert.id,
              mobile: cert.mobile,
              messageType: 'INITIAL_RECEIPT',
              status: waResult.success ? 'SENT' : 'FAILED',
              error: waResult.error || waResult.reason || null
            }
          });
        }
      } catch (waErr) {
        console.error('Bulk Auto WhatsApp sending error:', waErr);
      }

      return res.status(201).json({
        success: true,
        data: createdCertificates,
        count: createdCertificates.length,
        whatsAppSent: waResult.success,
        message: `Successfully created ${createdCertificates.length} certificate entries!`
      });
    }

    return res.status(400).json({ success: false, error: 'Reference No, Applicant Name, Mobile, and Certificate Type are required.' });

    const cleanRefNo = refNo.trim();
    const existing = await prisma.certificate.findUnique({ where: { refNo: cleanRefNo } });
    if (existing) {
      return res.status(400).json({ success: false, error: `Certificate with Reference Number ${cleanRefNo} already exists!` });
    }

    const extra = parseFloat(additionalCharge) || 0;
    const total = parseFloat(totalFee) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const dues = Math.max(0, total - paid);

    const certificate = await prisma.certificate.create({
      data: {
        refNo: cleanRefNo,
        applicantName: applicantName.trim(),
        mobile: mobile.trim(),
        address: address ? address.trim() : null,
        certType: certType.trim(),
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        currentStatus: currentStatus || 'INITIATED',
        additionalCharge: extra,
        totalFee: total,
        paidAmount: paid,
        duesAmount: dues,
        remarks: remarks ? remarks.trim() : null,
        statusLogs: {
          create: {
            oldStatus: null,
            newStatus: currentStatus || 'INITIATED',
            remarks: 'Initial Certificate Entry'
          }
        }
      }
    });

    // 🚀 Automatic WhatsApp Message Dispatch!
    let waResult = { success: false };
    try {
      waResult = await sendAutomaticReceipt(certificate);
      await prisma.whatsAppLog.create({
        data: {
          certificateId: certificate.id,
          mobile: certificate.mobile,
          messageType: 'INITIAL_RECEIPT',
          status: waResult.success ? 'SENT' : 'FAILED',
          error: waResult.error || waResult.reason || null
        }
      });
    } catch (waErr) {
      console.error('Auto WhatsApp sending error:', waErr);
    }

    res.status(201).json({
      success: true,
      data: certificate,
      whatsAppSent: waResult.success,
      message: 'Certificate record created successfully!'
    });
  } catch (error) {
    console.error('Error creating certificate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Update Certificate Record & Payment/Status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { refNo, applicantName, mobile, address, certType, entryDate, currentStatus, totalFee, paidAmount, remarks } = req.body;

    const oldCert = await prisma.certificate.findUnique({ where: { id } });
    if (!oldCert) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }

    const total = (totalFee !== undefined && !isNaN(parseFloat(totalFee))) ? parseFloat(totalFee) : oldCert.totalFee;
    const paid = (paidAmount !== undefined && !isNaN(parseFloat(paidAmount))) ? parseFloat(paidAmount) : oldCert.paidAmount;
    const dues = Math.max(0, total - paid);

    const isStatusChanged = currentStatus && currentStatus !== oldCert.currentStatus;

    const updated = await prisma.certificate.update({
      where: { id },
      data: {
        refNo: refNo ? refNo.trim() : oldCert.refNo,
        applicantName: applicantName ? applicantName.trim() : oldCert.applicantName,
        mobile: mobile ? mobile.trim() : oldCert.mobile,
        address: address !== undefined ? address : oldCert.address,
        certType: certType ? certType.trim() : oldCert.certType,
        entryDate: entryDate ? new Date(entryDate) : oldCert.entryDate,
        currentStatus: currentStatus || oldCert.currentStatus,
        totalFee: total,
        paidAmount: paid,
        duesAmount: dues,
        remarks: remarks !== undefined ? remarks : oldCert.remarks,
      }
    });

    if (isStatusChanged) {
      await prisma.statusLog.create({
        data: {
          certificateId: id,
          oldStatus: oldCert.currentStatus,
          newStatus: currentStatus,
          remarks: `Status updated to ${currentStatus}`
        }
      });

      // Send WhatsApp Notification for status update
      try {
        const waRes = await sendStatusUpdateNotification(updated, oldCert.currentStatus, currentStatus);
        await prisma.whatsAppLog.create({
          data: {
            certificateId: id,
            mobile: updated.mobile,
            messageType: 'STATUS_UPDATE',
            status: waRes.success ? 'SENT' : 'FAILED',
            error: waRes.error || waRes.reason || null
          }
        });
      } catch (e) {
        console.error('Status WhatsApp notification error:', e);
      }
    }

    res.json({ success: true, data: updated, message: 'Record updated successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Single Certificate Jharsewa Status Sync
router.post('/:id/sync-jharsewa', async (req, res) => {
  try {
    let cert = await prisma.certificate.findUnique({ where: { id: req.params.id } });
    
    // Fallback: If cert not in local SQLite, check by refNo or body payload
    if (!cert && req.body && req.body.refNo) {
      cert = await prisma.certificate.findUnique({ where: { refNo: req.body.refNo.trim() } });
      if (!cert) {
        // Upsert into local DB on the fly
        cert = await prisma.certificate.create({
          data: {
            id: req.params.id,
            refNo: req.body.refNo.trim(),
            applicantName: req.body.applicantName || 'Applicant',
            mobile: req.body.mobile || '',
            certType: req.body.certType || 'JHIC',
            entryDate: req.body.entryDate ? new Date(req.body.entryDate) : new Date()
          }
        });
      }
    } else if (!cert && req.params.id && req.params.id.includes('/')) {
      cert = await prisma.certificate.findUnique({ where: { refNo: req.params.id.trim() } });
    }

    if (!cert) {
      return res.status(404).json({ success: false, error: 'Certificate not found in database. Please check Ref No.' });
    }

    let statusResult = { error: true };
    let attempt = 0;
    while (attempt < 3 && (statusResult.error || !statusResult.status)) {
      attempt++;
      if (attempt > 1) {
        console.log(`🔄 Single Sync Auto-Retry Attempt ${attempt}/3 for ${cert.refNo}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
      statusResult = await checkJharsewaStatus(cert.refNo, cert.entryDate);
    }

    if (statusResult.error || !statusResult.status) {
      return res.status(400).json({
        success: false,
        error: statusResult.details || 'Jharsewa Portal temporary unresponsive. Please try clicking Sync again in 5 seconds.',
        statusResult
      });
    }

    const oldStatus = cert.currentStatus;
    const newStatus = statusResult.status;

    let updatedCert = cert;
    const statusChanged = Boolean(newStatus && newStatus !== oldStatus);

    if (statusChanged) {
      updatedCert = await prisma.certificate.update({
        where: { id: cert.id },
        data: {
          currentStatus: newStatus,
          lastSyncedAt: new Date(),
        }
      });

      await prisma.statusLog.create({
        data: {
          certificateId: cert.id,
          oldStatus,
          newStatus,
          remarks: `Synced via Jharsewa Portal: ${statusResult.details}`
        }
      });

      // Send WhatsApp status update
      try {
        await sendStatusUpdateNotification(updatedCert, oldStatus, newStatus);
      } catch (e) {
        console.error('WhatsApp notification error:', e);
      }
      // Also update Firebase Cloud Firestore so live website reflects updated status immediately
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/certificate-master-db/databases/(default)/documents/certificates/${cert.id}?updateMask.fieldPaths=currentStatus&updateMask.fieldPaths=status&updateMask.fieldPaths=lastSyncedAt`;
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
      } catch (fbErr) {
        console.error('Firebase sync error during single status sync:', fbErr);
      }
    } else {
      updatedCert = await prisma.certificate.update({
        where: { id: cert.id },
        data: { lastSyncedAt: new Date() }
      });
    }

    res.json({
      success: true,
      data: updatedCert,
      statusResult,
      oldStatus,
      newStatus,
      statusChanged,
      message: statusResult.details || `Jharsewa status synced! Current status: ${newStatus}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Bulk Jharsewa Status Sync (Supports both /sync-all and /sync-all-jharsewa)
router.post(['/sync-all', '/sync-all-jharsewa'], async (req, res) => {
  try {
    let pendingCerts = [];
    if (req.body && Array.isArray(req.body.certificates) && req.body.certificates.length > 0) {
      pendingCerts = req.body.certificates;
    } else {
      pendingCerts = await prisma.certificate.findMany({
        where: {
          currentStatus: { in: ['INITIATED', 'HOLD', 'UNDER_PROCESS', 'PENDING', 'WAITING', 'CI_UNDER_PROCESS', 'CI_WAITING', 'CO_UNDER_PROCESS', 'CO_WAITING', 'SDO_UNDER_PROCESS'] }
        }
      });
    }

    if (pendingCerts.length === 0) {
      return res.json({ success: true, message: 'No pending certificates to sync.', syncedCount: 0 });
    }

    const syncResults = await syncMultipleCertificates(pendingCerts);

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
            remarks: 'Bulk Jharsewa Auto Sync'
          }
        });

        // WhatsApp notification
        try {
          await sendStatusUpdateNotification(updated, item.oldStatus, item.newStatus);
        } catch (e) {}

        // Live Real-Time Firebase Cloud Firestore Sync
        try {
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/certificate-master-db/databases/(default)/documents/certificates/${item.certId}?updateMask.fieldPaths=currentStatus&updateMask.fieldPaths=status&updateMask.fieldPaths=lastSyncedAt`;
          await fetch(firestoreUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                currentStatus: { stringValue: item.newStatus },
                status: { stringValue: item.newStatus },
                lastSyncedAt: { stringValue: new Date().toISOString() }
              }
            })
          });
        } catch (fbErr) {
          console.error('Firebase sync error during bulk status sync:', fbErr);
        }
      } else {
        await prisma.certificate.update({
          where: { id: item.certId },
          data: { lastSyncedAt: new Date() }
        });
      }
    }

    res.json({
      success: true,
      message: `Synced ${pendingCerts.length} certificates. ${updatedCount} status changes updated!`,
      results: syncResults,
      syncResults
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Filtered List Status Sync Endpoint (New Engine Route)
router.post('/sync-filtered', async (req, res) => {
  try {
    const { syncFilteredStatusCertificates } = require('../engines/statusFilterSync.engine');
    const result = await syncFilteredStatusCertificates(req.body || {});
    res.json(result);
  } catch (error) {
    console.error('Error in sync-filtered endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Download & Send PDF Certificate via WhatsApp
router.post('/:id/send-pdf', async (req, res) => {
  try {
    const cert = await prisma.certificate.findUnique({ where: { id: req.params.id } });
    if (!cert) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }

    const { customMobile } = req.body || {};
    const { downloadCertificatePDF2 } = require('../services/downloadEngine2.service');

    const result = await downloadCertificatePDF2(cert, customMobile);
    res.json({ success: true, message: `Download Engine 2.0: PDF Certificate processed & sent to ${customMobile || cert.mobile}!`, result });
  } catch (error) {
    console.error('Error in send-pdf endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8.5 Resend Automatic Receipt via WhatsApp
router.post('/:id/resend-receipt', async (req, res) => {
  try {
    const cert = await prisma.certificate.findUnique({ where: { id: req.params.id } });
    if (!cert) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }

    const waResult = await sendAutomaticReceipt(cert);
    if (waResult.success) {
      await prisma.whatsAppLog.create({
        data: {
          certificateId: cert.id,
          mobile: cert.mobile,
          messageType: 'INITIAL_RECEIPT_RESEND',
          status: 'SENT',
        }
      });
      res.json({ success: true, message: `WhatsApp Receipt resent to ${cert.mobile}!` });
    } else {
      res.status(400).json({ success: false, error: waResult.reason || waResult.error || 'Failed to send WhatsApp message' });
    }
  } catch (error) {
    console.error('Error resending receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// 9. Delete Certificate
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.statusLog.deleteMany({ where: { certificateId: id } });
    await prisma.whatsAppLog.deleteMany({ where: { certificateId: id } });
    await prisma.certificate.delete({ where: { id } });
    res.json({ success: true, message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


