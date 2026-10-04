const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { checkNSDLPanStatus } = require('../services/panEngine2.service');

const prisma = new PrismaClient();

// 1. Get All PAN Applications
router.get('/', async (req, res) => {
  try {
    const panList = await prisma.panApplication.findMany({
      orderBy: { createdAt: 'desc' },
      include: { panLogs: true }
    });
    res.json({ success: true, data: panList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Add New PAN Application
router.post('/', async (req, res) => {
  try {
    const { ackNo, applicantName, mobile, dob, appType } = req.body;
    if (!ackNo || !applicantName || !mobile) {
      return res.status(400).json({ success: false, message: 'ackNo, applicantName, and mobile are required fields.' });
    }

    const cleanAck = ackNo.trim().replace(/\D/g, '');
    const newPan = await prisma.panApplication.create({
      data: {
        ackNo: cleanAck,
        applicantName: applicantName.trim(),
        mobile: mobile.trim(),
        dob: dob ? dob.trim() : null,
        appType: appType || 'PAN_NEW',
        currentStatus: 'INITIATED'
      }
    });

    res.status(201).json({ success: true, data: newPan, message: 'PAN Application created successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Track PAN Application Status using PAN Engine 2.0 (By ID)
router.post('/:id/track', async (req, res) => {
  try {
    const { id } = req.params;
    const pan = await prisma.panApplication.findUnique({ where: { id } });
    if (!pan) {
      return res.status(404).json({ success: false, message: 'PAN Application not found.' });
    }

    const trackResult = await checkNSDLPanStatus(pan.ackNo, pan.appType);
    res.json({ success: true, data: trackResult });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3b. Direct Track by Ack Number (For quick testing & engine check)
router.get('/track-ack/:ackNo', async (req, res) => {
  try {
    const { ackNo } = req.params;
    const trackResult = await checkNSDLPanStatus(ackNo);
    res.json({ success: true, data: trackResult });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Delete PAN Application Entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.panApplication.delete({ where: { id } });
    res.json({ success: true, message: 'PAN Application deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
