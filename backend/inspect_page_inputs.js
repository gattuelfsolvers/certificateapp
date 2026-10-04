const path = require('path');
const fs = require('fs');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service.js');

(async () => {
  console.log('🚀 Inspecting Jharsewa Frames for View Submitted Applications...');
  let cscSession = null;
  try {
    cscSession = await getOrCreateCSCSession();
    const { page } = cscSession;

    await page.goto('https://jharsewa.jharkhand.gov.in/applicationTrackStatus.do', { waitUntil: 'networkidle2' });

    console.log('Main Page URL:', page.url());
    console.log('Total Frames:', page.frames().length);

    for (let i = 0; i < page.frames().length; i++) {
      const f = page.frames()[i];
      console.log(`\nFrame [${i}] URL: ${f.url()}`);
      const txt = await f.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      console.log(`Frame [${i}] Text Sample:\n${txt.substring(0, 300)}`);
      
      const inputs = await f.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, button, a')).map(i => ({
          tag: i.tagName,
          type: i.type,
          name: i.name,
          id: i.id,
          text: (i.innerText || i.value || '').trim()
        }));
      }).catch(() => []);
      console.log(`Frame [${i}] Form Inputs Count:`, inputs.length);
      if (inputs.length > 0) {
        console.log(`Frame [${i}] Form Inputs Sample:`, JSON.stringify(inputs.slice(0, 10), null, 2));
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
