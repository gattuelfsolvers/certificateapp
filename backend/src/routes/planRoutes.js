const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to seed default plans if table is empty
async function seedDefaultPlans() {
  const count = await prisma.planMaster.count();
  if (count === 0) {
    const defaultPlans = [
      {
        planKey: 'MONTHLY',
        title: 'Monthly Plan (30 Days)',
        subtitle: '30 Days Full Software Access',
        badgeText: 'Starter Plan',
        durationDays: 30,
        price: 149,
        perDayCost: 4.96,
        isPopular: false,
        isBestValue: false,
        sortOrder: 1,
        featuresJson: JSON.stringify([
          { name: 'Auto Jharsewa Sync', included: true },
          { name: 'Auto Whatsapp Status Update', included: true },
          { name: 'Sync All Certificate', included: false },
          { name: 'Sync One Certificate', included: true },
          { name: 'Backup Download', included: true },
          { name: 'Customer Support', included: true }
        ])
      },
      {
        planKey: 'HALF_YEARLY',
        title: 'Half Yearly Plan (180 Days)',
        subtitle: '180 Days Full Software Access',
        badgeText: 'Most Popular',
        durationDays: 180,
        price: 699,
        perDayCost: 3.88,
        isPopular: true,
        isBestValue: false,
        sortOrder: 2,
        featuresJson: JSON.stringify([
          { name: 'Auto Jharsewa Sync', included: true },
          { name: 'Auto Whatsapp Status Update', included: true },
          { name: 'Sync All Certificate', included: true },
          { name: 'Sync One Certificate', included: true },
          { name: 'Backup Download', included: true },
          { name: 'Customer Support', included: true }
        ])
      },
      {
        planKey: 'YEARLY',
        title: 'Yearly Plan (365 Days)',
        subtitle: '365 Days Full Software Access',
        badgeText: 'Best Value',
        durationDays: 365,
        price: 999,
        perDayCost: 2.73,
        isPopular: false,
        isBestValue: true,
        sortOrder: 3,
        featuresJson: JSON.stringify([
          { name: 'Auto Jharsewa Sync', included: true },
          { name: 'Auto Whatsapp Status Update', included: true },
          { name: 'Sync All Certificate', included: true },
          { name: 'Sync One Certificate', included: true },
          { name: 'Backup Download', included: true },
          { name: 'Customer Support', included: true }
        ])
      }
    ];

    for (const plan of defaultPlans) {
      await prisma.planMaster.create({ data: plan });
    }
  }
}

// GET /api/plans - Get all active plans (Public for Client App & Master Admin)
router.get('/', async (req, res) => {
  try {
    await seedDefaultPlans();
    const plans = await prisma.planMaster.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    
    // Parse featuresJson for each plan
    const formatted = plans.map(p => {
      let features = [];
      try { features = JSON.parse(p.featuresJson); } catch (e) {}
      return { ...p, features };
    });

    return res.json({ success: true, plans: formatted });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/plans/create - Create new plan
router.post('/create', async (req, res) => {
  try {
    const { planKey, title, subtitle, badgeText, durationDays, price, features, isPopular, isBestValue, sortOrder } = req.body;
    
    if (!planKey || !title || !price || !durationDays) {
      return res.status(400).json({ success: false, error: 'Plan Key, Title, Price, and Duration Days are required!' });
    }

    const priceNum = parseFloat(price);
    const daysNum = parseInt(durationDays);
    const perDayCost = Number((priceNum / daysNum).toFixed(2));

    const newPlan = await prisma.planMaster.create({
      data: {
        planKey: planKey.trim().toUpperCase(),
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : `${daysNum} Days Full Software Access`,
        badgeText: badgeText ? badgeText.trim() : null,
        durationDays: daysNum,
        price: priceNum,
        perDayCost,
        featuresJson: JSON.stringify(features || []),
        isPopular: Boolean(isPopular),
        isBestValue: Boolean(isBestValue),
        sortOrder: sortOrder ? parseInt(sortOrder) : 10
      }
    });

    return res.json({ success: true, message: 'Plan created successfully!', plan: newPlan });
  } catch (error) {
    console.error('Error creating plan:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/plans/:id - Update plan
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { planKey, title, subtitle, badgeText, durationDays, price, features, isPopular, isBestValue, isActive, sortOrder } = req.body;

    const priceNum = parseFloat(price);
    const daysNum = parseInt(durationDays);
    const perDayCost = Number((priceNum / daysNum).toFixed(2));

    const updated = await prisma.planMaster.update({
      where: { id },
      data: {
        planKey: planKey ? planKey.trim().toUpperCase() : undefined,
        title: title ? title.trim() : undefined,
        subtitle: subtitle !== undefined ? subtitle.trim() : undefined,
        badgeText: badgeText !== undefined ? badgeText.trim() : undefined,
        durationDays: daysNum,
        price: priceNum,
        perDayCost,
        featuresJson: features ? JSON.stringify(features) : undefined,
        isPopular: isPopular !== undefined ? Boolean(isPopular) : undefined,
        isBestValue: isBestValue !== undefined ? Boolean(isBestValue) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : undefined
      }
    });

    return res.json({ success: true, message: 'Plan updated successfully!', plan: updated });
  } catch (error) {
    console.error('Error updating plan:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/plans/:id - Delete plan
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.planMaster.delete({ where: { id } });
    return res.json({ success: true, message: 'Plan deleted successfully!' });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
