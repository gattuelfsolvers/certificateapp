const express = require('express');
const router = express.Router();
const { getWhatsAppStatus, initWhatsApp, logoutWhatsApp } = require('../services/whatsapp.service');
const prisma = require('../db');

// Get WhatsApp QR code & connection status
router.get('/status', (req, res) => {
  const status = getWhatsAppStatus();
  res.json({ success: true, ...status });
});

// Re-initialize WhatsApp / Request QR
router.post('/reconnect', async (req, res) => {
  try {
    await initWhatsApp();
    res.json({ success: true, message: 'WhatsApp reconnect initiated.' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Request WhatsApp 8-Digit Pairing Code
router.post('/pair-code', async (req, res) => {
  try {
    const { requestPairingCode } = require('../services/whatsapp.service');
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    const result = await requestPairingCode(phoneNumber);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Send Test WhatsApp Message
router.post('/test-message', async (req, res) => {
  try {
    const { sendTestWhatsAppMessage } = require('../services/whatsapp.service');
    const { mobile, message } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, error: 'Mobile number is required' });
    }
    const result = await sendTestWhatsAppMessage(mobile, message);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Send Automated Client Notification (STATUS_CHANGE, EXPIRED, KILLED, PROFILE_UPDATE, HWID_UPDATE)
router.post('/notify-client', async (req, res) => {
  try {
    const { sendClientNotification } = require('../services/whatsapp.service');
    const { client, eventType, extraInfo } = req.body;
    if (!client || !client.phone || !eventType) {
      return res.status(400).json({ success: false, error: 'Client details & eventType required' });
    }
    const result = await sendClientNotification(client, eventType, extraInfo);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Logout / Unlink WhatsApp Device
router.post('/logout', async (req, res) => {
  try {
    const result = await logoutWhatsApp();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get WhatsApp Logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await prisma.whatsAppLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        certificate: {
          select: { refNo: true, applicantName: true, certType: true }
        }
      }
    });
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
