const path = require('path');
const fs = require('fs');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service.js');

(async () => {
  try {
    const { page, browser } = await getOrCreateCSCSession();
    const targetDate = '19/08/2026';

    // Filter date & get data
    await page.evaluate((targetDate) => {
      const fromInput = document.querySelector('input[name*="from"], input[id*="from"]');
      if (fromInput) {
        fromInput.value = targetDate;
        fromInput.dispatchEvent(new Event('input', { bubbles: true }));
        fromInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
      const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
      if (getDataBtn) getDataBtn.click();
    }, targetDate);

    await new Promise(r => setTimeout(r, 4500));

    // Search and click Delivered
    await page.evaluate(() => {
      const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
      if (searchInput) {
        searchInput.value = '927294';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const matchRow = rows.find(r => r.innerText.includes('927294'));
      if (matchRow) {
        const delLink = Array.from(matchRow.querySelectorAll('a')).find(l => l.innerText.toLowerCase().includes('delivered')) || matchRow.querySelectorAll('a')[0];
        if (delLink) delLink.click();
      }
    });

    await new Promise(r => setTimeout(r, 4000));

    let targetFrame = null;
    for (const f of page.frames()) {
      const txt = await f.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (txt.includes('Application Reference Number')) {
        targetFrame = f;
        break;
      }
    }

    if (targetFrame) {
      // Click splitRelatedDocument View link
      await targetFrame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const splitLink = links.find(l => (l.getAttribute('onclick') || '').includes('splitRelatedDocument'));
        if (splitLink) splitLink.click();
      });

      await new Promise(r => setTimeout(r, 4000));

      console.log('--- ALL DOM MODALS / POPUPS IN MAIN PAGE ---');
      const htmls = await page.evaluate(() => {
        const modals = Array.from(document.querySelectorAll('.modal, div[id*="modal"], div[class*="popup"], iframe'));
        return modals.map(m => ({
          tag: m.tagName,
          id: m.id,
          className: m.className,
          src: m.getAttribute('src'),
          innerText: m.innerText ? m.innerText.substring(0, 300) : ''
        }));
      });

      console.log(JSON.stringify(htmls, null, 2));
    }

  } catch (err) {
    console.error('INSPECT ERROR:', err);
  } finally {
    process.exit(0);
  }
})();
