const puppeteer = require('puppeteer');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service');

async function testModalTaskInspection() {
  console.log('🔍 Testing Modal Level Inspection for JHCOB/2026/106622...');
  const { page } = await getOrCreateCSCSession();

  // Set date 14/09/2026
  await page.evaluate(() => {
    const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
    if (fromInput) {
      fromInput.value = '14/09/2026';
      fromInput.dispatchEvent(new Event('input', { bubbles: true }));
      fromInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
    if (toInput) {
      toInput.value = '14/09/2026';
      toInput.dispatchEvent(new Event('input', { bubbles: true }));
      toInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
    const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
    if (getDataBtn) getDataBtn.click();
  });

  await new Promise(r => setTimeout(r, 4500));

  // Click Under Process link on 106622 row
  await page.evaluate(() => {
    const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
    if (searchInput) {
      searchInput.value = '106622';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
    }
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const matchRow = rows.find(r => r.innerText.includes('106622'));
    if (matchRow) {
      const links = Array.from(matchRow.querySelectorAll('a'));
      if (links.length > 0) links[0].click();
    }
  });

  await new Promise(r => setTimeout(r, 4000));

  // Inspect Modal Tasks
  let modalTaskDetails = [];
  for (const frame of page.frames()) {
    try {
      const details = await frame.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.map(r => r.innerText.replace(/\s+/g, ' ').trim());
      });
      if (details.length > 0) modalTaskDetails.push(...details);
    } catch(e) {}
  }

  console.log('📌 Modal Task Rows Extracted:', JSON.stringify(modalTaskDetails, null, 2));
  process.exit(0);
}

testModalTaskInspection();
