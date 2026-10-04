const path = require('path');
const fs = require('fs');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service.js');

(async () => {
  console.log('🚀 Inspecting popup target URL after clicking Output Certificate (English)...');
  let cscSession = null;
  try {
    cscSession = await getOrCreateCSCSession();
    const { page, browser } = cscSession;

    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const submittedLink = links.find(l => (l.innerText || '').includes('View Submitted Application'));
      if (submittedLink) submittedLink.click();
    });
    await new Promise(r => setTimeout(r, 4000));

    await page.evaluate(() => {
      const fromInput = document.querySelector('input[name*="from"], input[id*="from"]');
      if (fromInput) fromInput.value = '19/08/2026';
      const toInput = document.querySelector('input[name*="to"], input[id*="to"]');
      if (toInput) toInput.value = '19/08/2026';
      const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
      const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
      if (getDataBtn) getDataBtn.click();
    });
    await new Promise(r => setTimeout(r, 5000));

    await page.evaluate(() => {
      const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
      if (searchInput) {
        searchInput.value = '927294';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const matchRow = rows.find(r => r.innerText.includes('927294'));
      if (matchRow) {
        const delLink = Array.from(matchRow.querySelectorAll('a')).find(l => l.innerText.toLowerCase().includes('delivered')) || matchRow.querySelectorAll('a')[0];
        if (delLink) delLink.click();
      }
    });
    await new Promise(r => setTimeout(r, 4500));

    let targetFrame = null;
    for (const f of page.frames()) {
      const txt = await f.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (txt.includes('Application Reference Number')) {
        targetFrame = f;
        break;
      }
    }

    if (targetFrame) {
      await targetFrame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const splitLink = links.find(l => (l.getAttribute('onclick') || '').includes('splitRelatedDocument'));
        if (splitLink) splitLink.click();
      });
      await new Promise(r => setTimeout(r, 4500));

      for (const f of page.frames()) {
        const engInfo = await f.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button, input'));
          const engLink = links.find(l => {
            const txt = (l.innerText || l.value || '').toLowerCase();
            const onclick = (l.getAttribute('onclick') || '').toLowerCase();
            return txt.includes('english') || onclick.includes('outputcertificateeng');
          });
          if (engLink) {
            return {
              href: engLink.getAttribute('href'),
              onclick: engLink.getAttribute('onclick'),
              outerHTML: engLink.outerHTML
            };
          }
          return null;
        }).catch(() => null);

        if (engInfo) {
          console.log('🎯 Found English Certificate Link Attributes:\n', JSON.stringify(engInfo, null, 2));
          break;
        }
      }
    }

  } catch (err) {
    console.error('INSPECT ERROR:', err.message);
  } finally {
    if (cscSession && cscSession.browser) {
      await cscSession.browser.close().catch(() => null);
    }
  }
})();
