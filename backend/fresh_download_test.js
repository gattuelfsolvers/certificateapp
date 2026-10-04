const path = require('path');
const fs = require('fs');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service.js');

(async () => {
  console.log('🚀 Executing Complete Clean Certificate Download Flow for Shabba Parween (JHCBC/2026/927294)...');
  let cscSession = null;
  try {
    cscSession = await getOrCreateCSCSession();
    const { page, browser } = cscSession;

    console.log('📍 Clicking "View Submitted Application(s)" menu directly from active CSC session...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const submittedLink = links.find(l => (l.innerText || '').includes('View Submitted Application'));
      if (submittedLink) submittedLink.click();
    });

    await new Promise(r => setTimeout(r, 4000));

    // Fill From Date & To Date: 19/08/2026
    console.log('📅 Setting From Date & To Date: 19/08/2026...');
    await page.evaluate(() => {
      const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
      if (fromInput) {
        fromInput.value = '19/08/2026';
        fromInput.dispatchEvent(new Event('input', { bubbles: true }));
        fromInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
      if (toInput) {
        toInput.value = '19/08/2026';
        toInput.dispatchEvent(new Event('input', { bubbles: true }));
        toInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
      const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
      if (getDataBtn) getDataBtn.click();
    });

    await new Promise(r => setTimeout(r, 5000));

    // Search 927294 & Click Delivered
    console.log('🔍 Searching 927294 & clicking Delivered link...');
    const clickDelivered = await page.evaluate(() => {
      const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
      if (searchInput) {
        searchInput.value = '927294';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const matchRow = rows.find(r => r.innerText.includes('927294') || r.innerText.includes('JHCBC/2026/927294'));
      if (matchRow) {
        const delLink = Array.from(matchRow.querySelectorAll('a')).find(l => l.innerText.toLowerCase().includes('delivered')) || matchRow.querySelectorAll('a')[0];
        if (delLink) {
          delLink.click();
          return true;
        }
      }
      return false;
    });

    console.log('📌 Delivered link click status:', clickDelivered);
    if (!clickDelivered) {
      throw new Error('Could not find Delivered link in table for JHCBC/2026/927294.');
    }

    await new Promise(r => setTimeout(r, 4500));

    // Click splitRelatedDocument View link inside Modal Frame
    console.log('📜 Looking for Status Modal Frame...');
    let targetFrame = null;
    for (const f of page.frames()) {
      const txt = await f.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (txt.includes('Application Reference Number')) {
        targetFrame = f;
        break;
      }
    }

    if (!targetFrame) {
      throw new Error('Status Modal Frame containing application details not found.');
    }

    console.log('🎯 Found Status Modal Frame! Clicking splitRelatedDocument View link...');
    await targetFrame.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const splitLink = links.find(l => (l.getAttribute('onclick') || '').includes('splitRelatedDocument'));
      if (splitLink) splitLink.click();
    });

    await new Promise(r => setTimeout(r, 4500));

    // Click Output Certificate (English)
    console.log('📜 Looking for Output Certificate (English) link...');
    for (const f of page.frames()) {
      const clicked = await f.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, input'));
        const engLink = links.find(l => {
          const txt = (l.innerText || l.value || '').toLowerCase();
          const onclick = (l.getAttribute('onclick') || '').toLowerCase();
          return txt.includes('english') || onclick.includes('outputcertificateeng');
        });
        if (engLink) {
          engLink.click();
          return true;
        }
        return false;
      }).catch(() => false);

      if (clicked) {
        console.log('🎯 Output Certificate (English) link clicked successfully!');
        break;
      }
    }

    await new Promise(r => setTimeout(r, 5000));

    // Save Certificate PDF
    let finalCertPage = null;
    const allPages = await browser.pages();
    for (const p of allPages) {
      if (p !== page) {
        const pText = await p.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
        if (pText.includes('CASTE CERTIFICATE') || pText.includes('SHABBA') || pText.includes('GUNGHASA')) {
          finalCertPage = p;
          break;
        }
      }
    }

    if (!finalCertPage) {
      for (const f of page.frames()) {
        const fText = await f.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
        if (fText.includes('CASTE CERTIFICATE') || fText.includes('SHABBA') || fText.includes('GUNGHASA')) {
          console.log(`🎯 Found Certificate HTML inside frame: ${f.url()}`);
          const html = await f.content();
          finalCertPage = await browser.newPage();
          await finalCertPage.setContent(html, { waitUntil: 'networkidle0' });
          break;
        }
      }
    }

    if (finalCertPage) {
      const downloadPath = path.join(__dirname, 'public/downloads/JHCBC_2026_927294_FRESH.pdf');
      await finalCertPage.pdf({ path: downloadPath, format: 'A4', printBackground: true });
      console.log(`✅ CERTIFICATE PDF SUCCESSFULLY DOWNLOADED & SAVED AT: ${downloadPath}`);
    } else {
      console.log('⚠️ Certificate rendering frame was not captured.');
    }

  } catch (err) {
    console.error('❌ CERTIFICATE DOWNLOAD TEST ERROR:', err.message);
  } finally {
    if (cscSession && cscSession.browser) {
      console.log('🔒 Closing Jharsewa Browser Session & clearing connection...');
      await cscSession.browser.close().catch(() => null);
      console.log('✅ Jharsewa Session Closed Cleanly.');
    }
  }
})();
