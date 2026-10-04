const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service');

async function scrollStatusTable() {
  const { page } = await getOrCreateCSCSession();

  // Scroll table wrapper or window to right
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.dataTables_wrapper, .table-responsive, div[style*="overflow"]');
    if (scrollContainer) {
      scrollContainer.scrollLeft = 2000;
    }
  });

  await new Promise(r => setTimeout(r, 1500));

  const publicDir = path.join(__dirname, 'public');
  const ssPath = path.join(publicDir, 'portal_status_1430626.png');
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log('📸 Saved full table screenshot');
  process.exit(0);
}

scrollStatusTable();
