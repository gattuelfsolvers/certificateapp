const express = require('express');
const router = express.Router();
const prisma = require('../db');
const {
  getSystemHWID,
  generateLicenseKey,
  validateLicenseKey,
  checkCurrentMachineLicense
} = require('../engines/license.engine');

// Master Admin Password Hash / Auth Check
const MASTER_EMAIL = 'gattu.elfsolvers@gmail.com';
const MASTER_PASS = 'MasterAdmin@2026#';

// 1. Get Machine HWID & Current License Status
router.get('/status', async (req, res) => {
  try {
    const status = await checkCurrentMachineLicense();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error getting license status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.5. Remote Verification Endpoint for Client Instances (Also syncs Shop Name & Owner Name!)
router.post('/verify-remote', async (req, res) => {
  try {
    const { hwid, shopName, ownerName, shopPhone } = req.body;
    if (!hwid || !hwid.trim()) {
      return res.status(400).json({ valid: false, reason: 'HWID is required for remote verification' });
    }

    const cleanHwid = hwid.trim().toUpperCase();
    const clientRecord = await prisma.clientMaster.findUnique({
      where: { hwid: cleanHwid }
    });

    if (!clientRecord) {
      return res.json({
        valid: false,
        status: 'UNREGISTERED',
        reason: 'Client license record is not registered in Master Admin DB.'
      });
    }

    // Auto-sync Shop Name, Owner Name & Phone if sent by client software
    if (shopName || ownerName || shopPhone) {
      await prisma.clientMaster.update({
        where: { hwid: cleanHwid },
        data: {
          clientName: shopName && shopName.trim() ? shopName.trim() : clientRecord.clientName,
          ownerName: ownerName && ownerName.trim() ? ownerName.trim() : clientRecord.ownerName,
          phone: shopPhone && shopPhone.trim() ? shopPhone.trim() : clientRecord.phone
        }
      }).catch(() => null);
    }

    if (clientRecord.status !== 'ACTIVE') {
      return res.json({
        valid: false,
        status: clientRecord.status,
        reason: `Client license is ${clientRecord.status} (Remote Kill/Revoke).`
      });
    }

    const now = Date.now();
    const expTime = new Date(clientRecord.expiresAt).getTime();
    if (now > expTime) {
      return res.json({
        valid: false,
        status: 'EXPIRED',
        reason: 'Client subscription plan has expired.'
      });
    }

    return res.json({
      valid: true,
      status: 'ACTIVE',
      planType: clientRecord.planType,
      expiresAt: clientRecord.expiresAt,
      licenseKey: clientRecord.licenseKey,
      keyGeneratedAt: clientRecord.keyGeneratedAt || clientRecord.createdAt,
      reason: 'License active & verified'
    });
  } catch (error) {
    console.error('Error verifying remote client license:', error);
    res.status(500).json({ valid: false, error: error.message });
  }
});

// 2. Activate Machine License Key
router.post('/activate', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey || !licenseKey.trim()) {
      return res.status(400).json({ success: false, error: 'License Key is required!' });
    }

    const currentHwid = await getSystemHWID();
    const valRes = await validateLicenseKey(licenseKey.trim(), currentHwid);

    if (!valRes.valid) {
      return res.status(400).json({ success: false, error: valRes.reason });
    }

    res.json({
      success: true,
      message: '🎉 Software License Activated Successfully!',
      planType: valRes.planType,
      expiresAt: valRes.expiresAt
    });
  } catch (error) {
    console.error('Error activating license:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Master Admin Login (Google OAuth & Email Sync)
router.post('/master-login', async (req, res) => {
  try {
    const { email, password, googleAuth } = req.body;
    const targetEmail = email ? email.toLowerCase().trim() : '';

    if (targetEmail === MASTER_EMAIL) {
      return res.json({
        success: true,
        masterToken: 'MASTER_SUPER_ADMIN_SESSION_TOKEN_2026',
        message: '👑 Welcome Master Admin!',
        email: MASTER_EMAIL
      });
    }

    return res.status(401).json({
      success: false,
      error: `❌ You are not authorized for this! Access Denied.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Master Admin: Generate License Key / Verify Existing Valid Key Retention
router.post('/generate-key', async (req, res) => {
  try {
    const { hwid, planType, clientName, ownerName, phone, customExpiryDate, forceNewKey } = req.body;
    if (!hwid || !hwid.trim()) {
      return res.status(400).json({ success: false, error: 'Client Hardware ID (HWID) is required!' });
    }

    const cleanHwid = hwid.trim().toUpperCase();

    // 🔒 Pre-Verification Check: Check if valid unexpired key already exists for this client
    const existingClient = await prisma.clientMaster.findUnique({ where: { hwid: cleanHwid } });
    const now = Date.now();

    if (existingClient && !forceNewKey) {
      const expTime = new Date(existingClient.expiresAt).getTime();

      // If existing key is still valid (or has paused remaining validity)
      if (expTime > now || (existingClient.pausedRemainingMs && existingClient.pausedRemainingMs > 0)) {
        let remainingDays = 0;
        if (existingClient.status === 'KILLED' && existingClient.pausedRemainingMs) {
          remainingDays = Math.ceil(existingClient.pausedRemainingMs / (1000 * 60 * 60 * 24));
        } else {
          remainingDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
        }

        return res.json({
          success: true,
          isExistingValidKey: true,
          message: `ℹ️ Active License Key already exists for ${existingClient.clientName || cleanHwid}! Remaining Validity: ${remainingDays} Days.`,
          licenseKey: existingClient.licenseKey,
          hwid: cleanHwid,
          planType: existingClient.planType,
          expiresAt: existingClient.expiresAt,
          remainingDays
        });
      }
    }

    // Generate New License Key if expired or forced
    const keyData = generateLicenseKey(cleanHwid, planType || 'MONTHLY', customExpiryDate);

    // Save/Update in ClientMaster database
    await prisma.clientMaster.upsert({
      where: { hwid: cleanHwid },
      update: {
        licenseKey: keyData.licenseKey,
        planType: keyData.planType,
        status: 'ACTIVE',
        expiresAt: keyData.expiresAt,
        pausedRemainingMs: null,
        killedAt: null,
        keyGeneratedAt: new Date(),
        clientName: clientName || 'Client Shop',
        ownerName: ownerName || '',
        phone: phone || ''
      },
      create: {
        clientName: clientName || 'Client Shop',
        ownerName: ownerName || '',
        phone: phone || '',
        hwid: cleanHwid,
        licenseKey: keyData.licenseKey,
        planType: keyData.planType,
        status: 'ACTIVE',
        expiresAt: keyData.expiresAt,
        keyGeneratedAt: new Date()
      }
    });

    res.json({
      success: true,
      isExistingValidKey: false,
      message: '🎉 New License Key generated successfully!',
      ...keyData
    });
  } catch (error) {
    console.error('Error generating key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Master Admin: List All Clients (Optionally include archived)
router.get('/clients', async (req, res) => {
  try {
    const { includeArchived } = req.query;
    const isArchivedFilter = includeArchived === 'true' ? true : false;

    const clients = await prisma.clientMaster.findMany({
      where: {
        isArchived: isArchivedFilter,
        AND: [
          { clientName: { not: { contains: 'Master Admin' } } },
          { hwid: { not: { contains: 'DA2B-3CE3' } } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Master Admin: Toggle Remote Status / Update Client License Status (With Validity Pause & Resume Rollover!)
router.post('/toggle-client-status', async (req, res) => {
  try {
    const { hwid, status } = req.body; // status: 'ACTIVE', 'KILLED', 'EXPIRED'
    if (!hwid) {
      return res.status(400).json({ success: false, error: 'HWID is required' });
    }

    const cleanHwid = hwid.trim().toUpperCase();

    // Protection check for Master Admin record
    const targetClient = await prisma.clientMaster.findUnique({ where: { hwid: cleanHwid } });
    if (targetClient && (targetClient.clientName.includes('Master Admin') || targetClient.hwid.includes('DA2B-3CE3'))) {
      return res.status(403).json({
        success: false,
        error: '🛡️ Master Admin License Status is PERMANENTLY LOCKED! It cannot be killed or revoked.'
      });
    }

    if (!targetClient) {
      return res.status(404).json({ success: false, error: 'Client record not found' });
    }

    const now = Date.now();
    const updateData = { status };

    // ⏸️ CASE 1: KILLED / TERMINATED -> Freeze and Save Unused Remaining Validity Days
    if (status === 'KILLED') {
      const expTime = new Date(targetClient.expiresAt).getTime();
      const remainingMs = Math.max(0, expTime - now);
      updateData.pausedRemainingMs = remainingMs;
      updateData.killedAt = new Date(now);
    }

    // ▶️ CASE 2: RE-ACTIVATED -> Resume Unused Remaining Days from New Activation Date!
    if (status === 'ACTIVE' && targetClient.status === 'KILLED' && targetClient.pausedRemainingMs && targetClient.pausedRemainingMs > 0) {
      const newExpDate = new Date(now + targetClient.pausedRemainingMs);
      updateData.expiresAt = newExpDate;
      updateData.pausedRemainingMs = null;
      updateData.killedAt = null;
    }

    const updated = await prisma.clientMaster.update({
      where: { hwid: cleanHwid },
      data: updateData
    });

    // Also update local LicenseRecord if running on same machine
    await prisma.licenseRecord.updateMany({
      where: { hwid: cleanHwid },
      data: { status }
    }).catch(() => null);

    res.json({
      success: true,
      message: status === 'ACTIVE' && targetClient.pausedRemainingMs
        ? `🎉 Client software reactivated! Unused validity resumed from today until ${new Date(updated.expiresAt).toLocaleDateString('en-GB')}.`
        : `Client status updated to ${status}!`,
      client: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// 7. Master Admin: Create Client Manually
router.post('/clients/create', async (req, res) => {
  try {
    const { clientName, ownerName, phone, hwid, planType, status, expiresAt } = req.body;
    if (!hwid || !hwid.trim()) {
      return res.status(400).json({ success: false, error: 'Hardware ID (HWID) is required!' });
    }

    const created = await prisma.clientMaster.create({
      data: {
        clientName: clientName || 'Client Shop',
        ownerName: ownerName || '',
        phone: phone || '',
        hwid: hwid.trim(),
        licenseKey: req.body.licenseKey || `MANUAL-${Date.now()}`,
        planType: planType || 'MONTHLY',
        status: status || 'ACTIVE',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({ success: true, message: 'Client record added manually!', client: created });
  } catch (error) {
    console.error('Error creating client manually:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Master Admin: Update Client Record (Edit)
router.put('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, ownerName, phone, hwid, planType, status, expiresAt } = req.body;

    const updated = await prisma.clientMaster.update({
      where: { id: String(id) },
      data: {
        clientName,
        ownerName,
        phone,
        hwid,
        planType,
        status,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      }
    });

    res.json({ success: true, message: 'Client details updated!', client: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Master Admin: Soft Delete / Archive Client Record (Preserves License Key, HWID & History)
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.query;
    
    // Check if target client is Master Admin record
    const targetClient = await prisma.clientMaster.findUnique({
      where: { id: String(id) }
    });

    if (!targetClient) {
      return res.status(404).json({ success: false, error: 'Client record not found.' });
    }

    if (targetClient.clientName.includes('Master Admin') || targetClient.hwid.includes('DA2B-3CE3')) {
      return res.status(403).json({
        success: false,
        error: '🛡️ Master Admin License Record is PERMANENTLY LOCKED & PROTECTED! It cannot be deleted.'
      });
    }

    // Soft delete by updating isArchived flag and setting archivedAt timestamp
    await prisma.clientMaster.update({
      where: { id: String(id) },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        deletionReason: reason || 'Archived by Master Admin'
      }
    });

    res.json({
      success: true,
      message: `📦 Client '${targetClient.clientName}' moved to Deleted History Archive! Serial Key and HWID details are safely preserved.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9.5. Master Admin: Restore Archived Client back to Active List
router.post('/clients/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    
    const restored = await prisma.clientMaster.update({
      where: { id: String(id) },
      data: {
        isArchived: false,
        archivedAt: null,
        deletionReason: null
      }
    });

    res.json({
      success: true,
      message: `✅ Client '${restored.clientName}' successfully restored back to Active Clients list!`,
      client: restored
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9.6. Master Admin: Permanently Delete Client Record (Hard Delete if explicitly requested)
router.delete('/clients/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;

    const targetClient = await prisma.clientMaster.findUnique({
      where: { id: String(id) }
    });

    if (!targetClient) {
      return res.status(404).json({ success: false, error: 'Client record not found.' });
    }

    if (targetClient.clientName.includes('Master Admin') || targetClient.hwid.includes('DA2B-3CE3')) {
      return res.status(403).json({
        success: false,
        error: '🛡️ Master Admin License Record is PERMANENTLY LOCKED & PROTECTED! It cannot be deleted.'
      });
    }

    await prisma.clientMaster.delete({
      where: { id: String(id) }
    });

    res.json({ success: true, message: 'Client record permanently deleted from database!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Client Auto-Backup Endpoint (Pushes client entries to Master Admin Backup Vault)
router.post('/sync-backup', async (req, res) => {
  try {
    const { hwid, certificates } = req.body;
    if (!hwid || !certificates || !Array.isArray(certificates)) {
      return res.status(400).json({ success: false, error: 'HWID and valid certificates array required.' });
    }

    const cleanHwid = hwid.trim().toUpperCase();
    let syncedCount = 0;

    for (const cert of certificates) {
      if (!cert.refNo || !cert.applicantName) continue;

      await prisma.clientBackup.upsert({
        where: {
          hwid_refNo: {
            hwid: cleanHwid,
            refNo: cert.refNo.trim()
          }
        },
        update: {
          applicantName: cert.applicantName,
          mobile: cert.mobile || '',
          address: cert.address || '',
          certType: cert.certType || 'Income Certificate',
          currentStatus: cert.currentStatus || 'INITIATED',
          totalFee: parseFloat(cert.totalFee) || 0,
          paidAmount: parseFloat(cert.paidAmount) || 0,
          duesAmount: parseFloat(cert.duesAmount) || 0,
          remarks: cert.remarks || '',
          backedUpAt: new Date()
        },
        create: {
          hwid: cleanHwid,
          refNo: cert.refNo.trim(),
          applicantName: cert.applicantName,
          mobile: cert.mobile || '',
          address: cert.address || '',
          certType: cert.certType || 'Income Certificate',
          currentStatus: cert.currentStatus || 'INITIATED',
          totalFee: parseFloat(cert.totalFee) || 0,
          paidAmount: parseFloat(cert.paidAmount) || 0,
          duesAmount: parseFloat(cert.duesAmount) || 0,
          remarks: cert.remarks || ''
        }
      });
      syncedCount++;
    }

    res.json({
      success: true,
      message: `Backup vault synced ${syncedCount} records for HWID ${cleanHwid}!`,
      syncedCount
    });
  } catch (error) {
    console.error('Error syncing client backup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. Master Admin: Get Client Backup Vault Data by HWID
router.get('/client-backup/:hwid', async (req, res) => {
  try {
    const { hwid } = req.params;
    const cleanHwid = hwid.trim().toUpperCase();

    const backups = await prisma.clientBackup.findMany({
      where: { hwid: cleanHwid },
      orderBy: { entryDate: 'desc' }
    });

    res.json({
      success: true,
      hwid: cleanHwid,
      totalBackupRecords: backups.length,
      backups
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 12. Master Admin: Export Client Backup Vault Data to CSV / Excel
router.get('/client-backup/export-csv/:hwid', async (req, res) => {
  try {
    const { hwid } = req.params;
    const cleanHwid = hwid.trim().toUpperCase();

    const client = await prisma.clientMaster.findUnique({ where: { hwid: cleanHwid } });
    const backups = await prisma.clientBackup.findMany({
      where: { hwid: cleanHwid },
      orderBy: { entryDate: 'desc' }
    });

    let csvContent = 'Reference No,Applicant Name,Mobile,Address,Certificate Type,Entry Date,Current Status,Total Fee,Paid Amount,Dues Amount,Remarks,Backed Up At\n';

    for (const b of backups) {
      const row = [
        `"${b.refNo.replace(/"/g, '""')}"`,
        `"${b.applicantName.replace(/"/g, '""')}"`,
        `"${b.mobile}"`,
        `"${(b.address || '').replace(/"/g, '""')}"`,
        `"${(b.certType || '').replace(/"/g, '""')}"`,
        `"${new Date(b.entryDate).toISOString().split('T')[0]}"`,
        `"${b.currentStatus}"`,
        b.totalFee,
        b.paidAmount,
        b.duesAmount,
        `"${(b.remarks || '').replace(/"/g, '""')}"`,
        `"${new Date(b.backedUpAt).toISOString()}"`
      ].join(',');

      csvContent += row + '\n';
    }

    const clientNameSanitized = client ? client.clientName.replace(/[^a-zA-Z0-9]/g, '_') : cleanHwid;
    const filename = `Backup_${clientNameSanitized}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. Master Admin: Push Restore Data directly into Client Database (Port 5001)
router.post('/client-backup/push-restore/:hwid', async (req, res) => {
  try {
    const { hwid } = req.params;
    const cleanHwid = hwid.trim().toUpperCase();

    const backups = await prisma.clientBackup.findMany({
      where: { hwid: cleanHwid },
      orderBy: { entryDate: 'desc' }
    });

    if (backups.length === 0) {
      return res.status(404).json({ success: false, error: `No backup vault records found for HWID: ${cleanHwid}` });
    }

    // Call Client App local backend restore endpoint (Port 5001)
    const axios = require('axios');
    const clientAppUrl = process.env.CLIENT_APP_URL || 'http://localhost:5001/api';

    const response = await axios.post(`${clientAppUrl}/certificates/restore-from-vault`, {
      certificates: backups
    }, { timeout: 15000 });

    res.json({
      success: true,
      message: `🎉 Successfully restored ${response.data.restoredCount || backups.length} backup records directly into Client Software DB!`,
      restoredCount: response.data.restoredCount || backups.length
    });
  } catch (error) {
    console.error('Error pushing restore to client:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || `Failed to push restore to Client App: ${error.message}`
    });
  }
});

// 14. Submit Payment & Activation Request from Client App
router.post('/payment-requests/create', async (req, res) => {
  try {
    const { hwid, shopName, ownerName, phone, planName, planPrice } = req.body;
    if (!hwid || !phone) {
      return res.status(400).json({ success: false, error: 'HWID and Phone are required.' });
    }

    const cleanHwid = hwid.trim().toUpperCase();

    // Check if there is already a PENDING request for this phone or HWID
    const existingPending = await prisma.paymentRequest.findFirst({
      where: {
        OR: [
          { phone: phone ? phone.trim() : '' },
          { hwid: cleanHwid }
        ],
        status: 'PENDING'
      }
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        error: '⚠️ Already a pending request exists for this number/HWID. Please wait for Master Admin approval or contact support!'
      });
    }

    // Auto-determine plan type from planName (supports "180 Days", "365 Days", "30 Days", "Half", "Yearly", etc.)
    const detectPlanType = (name) => {
      if (!name) return 'MONTHLY';
      const str = String(name).toLowerCase();
      if (str.includes('180') || str.includes('half')) return 'HALF_YEARLY';
      if (str.includes('365') || str.includes('year')) return 'YEARLY';
      return 'MONTHLY';
    };

    // Auto-update ClientMaster details
    await prisma.clientMaster.upsert({
      where: { hwid: cleanHwid },
      update: {
        clientName: shopName || 'Client Shop',
        ownerName: ownerName || '',
        phone: phone || ''
      },
      create: {
        clientName: shopName || 'Client Shop',
        ownerName: ownerName || '',
        phone: phone || '',
        hwid: cleanHwid,
        licenseKey: `PENDING-PAYMENT-${Date.now()}`,
        planType: detectPlanType(planName),
        status: 'EXPIRED',
        expiresAt: new Date()
      }
    }).catch(() => null);

    const newRequest = await prisma.paymentRequest.create({
      data: {
        hwid: cleanHwid,
        shopName: shopName || 'Client Shop',
        ownerName: ownerName || '',
        phone: phone || '',
        planName: planName || 'Subscription Plan',
        planPrice: parseFloat(planPrice) || 0,
        status: 'PENDING'
      }
    });

    res.json({
      success: true,
      message: '🎉 Payment & Activation request logged into Master Admin Server!',
      request: newRequest
    });
  } catch (error) {
    console.error('Error creating payment request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 14.5 Master Admin: Delete Payment Request
router.delete('/payment-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.paymentRequest.delete({
      where: { id: String(id) }
    });
    res.json({ success: true, message: 'Payment request deleted successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 15. Master Admin: Get All Payment & Activation Requests
router.get('/payment-requests', async (req, res) => {
  try {
    const requests = await prisma.paymentRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 16. Master Admin: Approve Payment Request & Generate License Key
router.post('/payment-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { planType, customDays } = req.body;

    const request = await prisma.paymentRequest.findUnique({ where: { id: String(id) } });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Payment request not found.' });
    }

    const cleanHwid = request.hwid.trim().toUpperCase();
    const detectPlanType = (name) => {
      if (!name) return 'MONTHLY';
      const str = String(name).toLowerCase();
      if (str.includes('180') || str.includes('half')) return 'HALF_YEARLY';
      if (str.includes('365') || str.includes('year')) return 'YEARLY';
      return 'MONTHLY';
    };

    const targetPlan = planType || detectPlanType(request.planName);

    // Generate new valid license key
    const keyData = generateLicenseKey(cleanHwid, targetPlan, customDays);

    // Update ClientMaster
    await prisma.clientMaster.upsert({
      where: { hwid: cleanHwid },
      update: {
        licenseKey: keyData.licenseKey,
        planType: keyData.planType,
        status: 'ACTIVE',
        expiresAt: keyData.expiresAt,
        clientName: request.shopName,
        ownerName: request.ownerName,
        phone: request.phone,
        keyGeneratedAt: new Date()
      },
      create: {
        clientName: request.shopName,
        ownerName: request.ownerName,
        phone: request.phone,
        hwid: cleanHwid,
        licenseKey: keyData.licenseKey,
        planType: keyData.planType,
        status: 'ACTIVE',
        expiresAt: keyData.expiresAt,
        keyGeneratedAt: new Date()
      }
    });

    // Update PaymentRequest status
    const updated = await prisma.paymentRequest.update({
      where: { id: String(id) },
      data: {
        status: 'APPROVED',
        generatedKey: keyData.licenseKey
      }
    });

    res.json({
      success: true,
      message: `🎉 Payment request approved! License key ${keyData.licenseKey} generated and assigned for ${request.shopName}!`,
      request: updated,
      licenseKey: keyData.licenseKey
    });
  } catch (error) {
    console.error('Error approving payment request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

