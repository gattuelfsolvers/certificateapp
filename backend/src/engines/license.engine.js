const si = require('systeminformation');
const crypto = require('crypto');
const prisma = require('../db');

const SECRET_SALT = 'CERT_ENTRY_MANAGEMENT_MASTER_KEY_2026_SALT';

/**
 * Get Hardware ID (HWID) based on Motherboard UUID, CPU ID, and Disk System Serial
 */
async function getSystemHWID() {
  try {
    const systemData = await si.system();
    const cpuData = await si.cpu();
    const diskLayout = await si.diskLayout();

    const uuid = systemData.uuid || systemData.serial || 'GENERIC_UUID';
    const cpuId = cpuData.processorId || cpuData.brand || 'GENERIC_CPU';
    const diskSerial = (diskLayout.length > 0 ? diskLayout[0].serialNum : 'GENERIC_DISK');

    const rawId = `HWID_${uuid}_${cpuId}_${diskSerial}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hash = crypto.createHash('sha256').update(rawId + SECRET_SALT).digest('hex').substring(0, 16).toUpperCase();
    
    // Format: HWID-XXXX-XXXX-XXXX
    return `HWID-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  } catch (err) {
    console.error('Error generating HWID:', err);
    return 'HWID-DEFAULT-0000-1111';
  }
}

/**
 * Generate License Key for a HWID and Expiry Plan
 */
function generateLicenseKey(hwid, planType = 'MONTHLY', customExpiryDate = null) {
  const cleanHwid = hwid.trim().toUpperCase();
  let expiresAt = new Date();

  if (customExpiryDate) {
    expiresAt = new Date(customExpiryDate);
  } else if (planType === 'HALF_YEARLY') {
    expiresAt.setDate(expiresAt.getDate() + 180);
  } else if (planType === 'YEARLY') {
    expiresAt.setDate(expiresAt.getDate() + 365);
  } else {
    expiresAt.setDate(expiresAt.getDate() + 30);
  }

  const expiryTimestamp = expiresAt.getTime();
  const payload = `${cleanHwid}:${planType}:${expiryTimestamp}`;
  
  const hmac = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex').substring(0, 16).toUpperCase();
  const expHex = expiryTimestamp.toString(16).toUpperCase();

  // License Key Format: CERT-PLAN-EXPHEX-HMAC
  const licenseKey = `CERT-${planType.substring(0, 3)}-${expHex}-${hmac.substring(0, 4)}-${hmac.substring(4, 8)}`;

  return {
    licenseKey,
    hwid: cleanHwid,
    planType,
    expiresAt
  };
}

/**
 * Validate License Key against System HWID and Clock Rollback Check
 */
async function validateLicenseKey(licenseKey, currentHwid) {
  try {
    if (!licenseKey || !licenseKey.trim().startsWith('CERT-')) {
      return { valid: false, reason: 'Invalid License Key format.' };
    }

    const parts = licenseKey.trim().split('-');
    if (parts.length < 5) {
      return { valid: false, reason: 'Malformed License Key.' };
    }

    const planCode = parts[1];
    const expHex = parts[2];
    const hmacPart = parts[3] + parts[4];
    const expiryTimestamp = parseInt(expHex, 16);

    let planType = 'MONTHLY';
    if (planCode === 'HAF' || planCode === 'HAL') planType = 'HALF_YEARLY';
    if (planCode === 'YEA') planType = 'YEARLY';

    const payload = `${currentHwid.trim().toUpperCase()}:${planType}:${expiryTimestamp}`;
    const expectedHmac = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex').substring(0, 16).toUpperCase();

    if (expectedHmac.substring(0, 8) !== hmacPart) {
      return { valid: false, reason: 'License Key does not match this computer Hardware ID (HWID).' };
    }

    const now = Date.now();

    // Check Expiry Date
    if (now > expiryTimestamp) {
      return { valid: false, reason: 'License Key has EXPIRED. Please renew your subscription!' };
    }

    // Anti-Date-Tampering Clock Rollback Detection
    const dbRecord = await prisma.licenseRecord.findUnique({ where: { hwid: currentHwid } });
    if (dbRecord && dbRecord.lastClockCheck) {
      const lastCheckTime = new Date(dbRecord.lastClockCheck).getTime();
      // If current system time is more than 2 hours behind last recorded check time
      if (now < lastCheckTime - (2 * 60 * 60 * 1000)) {
        return { valid: false, reason: 'SYSTEM CLOCK TAMPERING DETECTED! PC Date/Time was altered backwards.' };
      }
    }

    // Update last clock check timestamp in DB
    await prisma.licenseRecord.upsert({
      where: { hwid: currentHwid },
      update: {
        licenseKey,
        planType,
        status: 'ACTIVE',
        lastClockCheck: new Date(now),
        expiresAt: new Date(expiryTimestamp)
      },
      create: {
        hwid: currentHwid,
        licenseKey,
        planType,
        status: 'ACTIVE',
        activatedAt: new Date(),
        expiresAt: new Date(expiryTimestamp),
        lastClockCheck: new Date(now)
      }
    });

    return {
      valid: true,
      planType,
      expiresAt: new Date(expiryTimestamp),
      message: 'License Active & Valid'
    };
  } catch (err) {
    console.error('License Validation Error:', err);
    return { valid: false, reason: err.message };
  }
}

/**
 * Check Current License Status of Machine
 */
async function checkCurrentMachineLicense() {
  const hwid = await getSystemHWID();
  
  // 👑 Master Admin is ALWAYS LIFETIME ACTIVE and bypasses license activation screens
  return {
    active: true,
    hwid,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 99 * 365 * 24 * 60 * 60 * 1000),
    planType: 'LIFETIME',
    reason: '👑 Master Admin System Access Granted'
  };
}

module.exports = {
  getSystemHWID,
  generateLicenseKey,
  validateLicenseKey,
  checkCurrentMachineLicense
};
