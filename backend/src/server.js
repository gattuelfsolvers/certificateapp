const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const certificateRoutes = require('./routes/certificate.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const { router: whatsappTemplateRoutes } = require('./routes/whatsappTemplate.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const masterRoutes = require('./routes/master.routes');
const panRoutes = require('./routes/pan.routes');
const settingRoutes = require('./routes/setting.routes');
const licenseRoutes = require('./routes/license.routes');
const planRoutes = require('./routes/planRoutes');
const { initWhatsApp } = require('./services/whatsapp.service');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets (QR Code, etc.)
app.use('/public', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/certificates', certificateRoutes);
app.use('/api/pan', panRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/whatsapp-templates', whatsappTemplateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/plans', planRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Certificate Entry Management API', timestamp: new Date() });
});

// Serve static React frontend build (Single Server Fullstack)
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (require('fs').existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/public')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CERTIFICATE ENTRY BACKEND RUNNING ON PORT: ${PORT}`);
  console.log(`======================================================\n`);

  // Initialize WhatsApp client daemon
  console.log('Initializing WhatsApp Engine...');
  initWhatsApp();
});
