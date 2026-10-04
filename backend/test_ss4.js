const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service');

async function captureZoomedOutStatus() {
  const { page } = await getOrCreateCSCSession();
  await page.setViewport({ width: 1650, height: 900 });

  // Set date 12/09/2026
  await page.evaluate(() => {
    const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
    if (fromInput) {
      fromInput.value = '12/09/2026';
      fromInput.dispatchEvent(new Event('input', { bubbles: true }));
      fromInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
    if (toInput) {
      toInput.value = '12/09/2026';
      toInput.dispatchEvent(new Event('input', { bubbles: true }));
      toInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
    const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
    if (getDataBtn) getDataBtn.click();
  });

  await new Promise(r => setTimeout(r, 4500));

  // Search 1430626 & scroll table right
  await page.evaluate(() => {
    const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
    if (searchInput) {
      searchInput.value = '1430626';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
    }
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const matchRow = rows.find(r => r.innerText.includes('1430626'));
    if (matchRow) {
      matchRow.style.backgroundColor = '#ffff99';
    }
  });

  await new Promise(r => setTimeout(r, 1500));

  const publicDir = path.join(__dirname, 'public');
  const ssPath = path.join(publicDir, 'portal_status_1430626.png');
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log('📸 Saved wide viewport screenshot');
  process.exit(0);
}

captureZoomedOutStatus();
