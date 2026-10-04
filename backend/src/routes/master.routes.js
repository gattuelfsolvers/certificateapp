const express = require('express');
const router = express.Router();
const prisma = require('../db');

// Get all master certificate categories
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.certTypeMaster.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create master category
router.post('/', async (req, res) => {
  try {
    const { name, subCategory, prefix, price } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Certificate Type Name is required' });
    }

    const category = await prisma.certTypeMaster.create({
      data: {
        name: name.trim(),
        subCategory: subCategory ? subCategory.trim() : null,
        prefix: prefix ? prefix.trim().toUpperCase() : (subCategory ? subCategory.trim().toUpperCase() : name.substring(0, 5).toUpperCase()),
        price: parseFloat(price) || 0,
      }
    });

    res.status(201).json({ success: true, data: category, message: 'Master category created!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update master category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subCategory, prefix, price } = req.body;

    const updated = await prisma.certTypeMaster.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        subCategory: subCategory !== undefined ? subCategory.trim() : undefined,
        prefix: prefix !== undefined ? prefix.trim().toUpperCase() : undefined,
        price: price !== undefined ? parseFloat(price) || 0 : undefined,
      }
    });

    res.json({ success: true, data: updated, message: 'Master category updated!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete master category
router.delete('/:id', async (req, res) => {
  try {
    await prisma.certTypeMaster.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Master category deleted!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
