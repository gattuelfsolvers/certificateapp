const express = require('express');
const router = express.Router();
const prisma = require('../db');

// Get Jharsewa Credentials
router.get('/jharsewa-credentials', async (req, res) => {
  try {
    const userSetting = await prisma.setting.findUnique({ where: { key: 'JHARSEWA_USERNAME' } });
    const passSetting = await prisma.setting.findUnique({ where: { key: 'JHARSEWA_PASSWORD' } });

    res.json({
      success: true,
      username: userSetting ? userSetting.value : 'cscgunghasa@gmail.com',
      password: passSetting ? passSetting.value : 'Gattu@1994#'
    });
  } catch (error) {
    console.error('Error fetching Jharsewa credentials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Jharsewa Credentials
router.post('/jharsewa-credentials', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and Password are required!' });
    }

    await prisma.setting.upsert({
      where: { key: 'JHARSEWA_USERNAME' },
      update: { value: username.trim() },
      create: { key: 'JHARSEWA_USERNAME', value: username.trim() }
    });

    await prisma.setting.upsert({
      where: { key: 'JHARSEWA_PASSWORD' },
      update: { value: password.trim() },
      create: { key: 'JHARSEWA_PASSWORD', value: password.trim() }
    });

    res.json({
      success: true,
      message: 'Jharsewa Account Credentials updated successfully!'
    });
  } catch (error) {
    console.error('Error updating Jharsewa credentials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download Local Engine Installer Zip
router.get('/download-local-engine', (req, res) => {
  const zipPath = path.join(__dirname, '../../public/App-Local-Engine-Setup.zip');
  if (require('fs').existsSync(zipPath)) {
    res.download(zipPath, 'App-Local-Engine-Setup.zip');
  } else {
    res.status(404).json({ success: false, error: 'Local Engine Setup zip package not found.' });
  }
});

// Get Shop & Center Profile Settings
router.get('/shop-profile', async (req, res) => {
  try {
    const keys = ['SHOP_NAME', 'OWNER_NAME', 'SHOP_PHONE', 'SHOP_ADDRESS'];
    const settingsMap = {};
    for (const k of keys) {
      const rec = await prisma.setting.findUnique({ where: { key: k } });
      settingsMap[k] = rec ? rec.value : '';
    }

    res.json({
      success: true,
      shopName: settingsMap['SHOP_NAME'] || 'Pragya Kendra & Cyber Center',
      ownerName: settingsMap['OWNER_NAME'] || 'Administrator',
      shopPhone: settingsMap['SHOP_PHONE'] || '',
      shopAddress: settingsMap['SHOP_ADDRESS'] || ''
    });
  } catch (error) {
    console.error('Error fetching shop profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Shop & Center Profile Settings
router.post('/shop-profile', async (req, res) => {
  try {
    const { shopName, ownerName, shopPhone, shopAddress } = req.body;

    if (!shopName || !shopName.trim()) {
      return res.status(400).json({ success: false, error: 'Shop/Center Name is required!' });
    }

    const payload = {
      SHOP_NAME: (shopName || '').trim(),
      OWNER_NAME: (ownerName || '').trim(),
      SHOP_PHONE: (shopPhone || '').trim(),
      SHOP_ADDRESS: (shopAddress || '').trim()
    };

    for (const [key, value] of Object.entries(payload)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });
    }

    res.json({
      success: true,
      message: 'Shop & Center Profile updated successfully!'
    });
  } catch (error) {
    console.error('Error updating shop profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
