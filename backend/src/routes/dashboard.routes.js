const express = require('express');
const router = express.Router();
const prisma = require('../db');

// Summary statistics for Dashboard
router.get('/stats', async (req, res) => {
  try {
    const totalEntries = await prisma.certificate.count();
    const underProcessCount = await prisma.certificate.count({
      where: {
        currentStatus: { in: ['UNDER_PROCESS', 'CI_UNDER_PROCESS', 'CI_WAITING', 'CO_UNDER_PROCESS', 'CO_WAITING', 'SDO_UNDER_PROCESS', 'WAITING'] }
      }
    });
    const deliveredCount = await prisma.certificate.count({
      where: {
        currentStatus: { in: ['DELIVERED', 'CO_DELIVERED', 'SDO_DELIVERED'] }
      }
    });
    const rejectedCount = await prisma.certificate.count({ where: { currentStatus: 'REJECTED' } });
    const waitingCount = await prisma.certificate.count({ where: { currentStatus: 'WAITING' } });

    // Financial calculations
    const totals = await prisma.certificate.aggregate({
      _sum: {
        totalFee: true,
        paidAmount: true,
        duesAmount: true,
      }
    });

    const duesCount = await prisma.certificate.count({ where: { duesAmount: { gt: 0 } } });

    const recentEntries = await prisma.certificate.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      stats: {
        totalEntries,
        underProcessCount,
        deliveredCount,
        rejectedCount,
        waitingCount,
        duesCount,
        totalFees: totals._sum.totalFee || 0,
        totalPaid: totals._sum.paidAmount || 0,
        totalDues: totals._sum.duesAmount || 0,
      },
      recentEntries
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
