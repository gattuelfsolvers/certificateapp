const { getOrCreateCSCSession } = require('../services/jharsewa.service');

async function debugModal() {
  console.log('🔍 Starting Modal Inspection for JHCBC/2026/923413...');
  const { page } = await getOrCreateCSCSession();

  await page.bringToFront().catch(() => null);

  // Set date range
  await page.evaluate(() => {
    const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
    if (fromInput) {
      fromInput.value = '19/08/2026';
      fromInput.dispatchEvent(new Event('input', { bubbles: true }));
      fromInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
    const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
    if (getDataBtn) getDataBtn.click();
  });

  await new Promise(r => setTimeout(r, 4500));

  // Search DataTables input
  await page.evaluate(() => {
    const input = document.querySelector('input[type="search"], .dataTables_filter input');
    if (input) {
      input.value = '923413';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('keyup', { bubbles: true }));
    }
  });

  await new Promise(r => setTimeout(r, 4000));

  // Click Delivered link
  const clicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const matchRow = rows.find(r => r.innerText.includes('923413'));
    if (matchRow) {
      const a = Array.from(matchRow.querySelectorAll('a')).find(x => x.innerText.toLowerCase().includes('delivered'));
      if (a) {
        a.click();
        return true;
      }
    }
    return false;
  });

  console.log('📍 Clicked Delivered link:', clicked);
  await new Promise(r => setTimeout(r, 12000));

  const frames = page.frames();
  console.log(`📋 Total frames in page: ${frames.length}`);

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    try {
      const info = await f.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, input[type="button"], span[onclick]')).map(el => ({
          tag: el.tagName,
          text: (el.innerText || el.value || '').trim(),
          onclick: el.getAttribute('onclick') || '',
          href: el.getAttribute('href') || ''
        }));
        return {
          url: window.location.href,
          snippet: document.body ? document.body.innerText.replace(/\s+/g, ' ').substring(0, 500) : '',
          links
        };
      });

      console.log(`\n=================== FRAME ${i} (${info.url}) ===================`);
      console.log(`TEXT SNIPPET: "${info.snippet}"`);
      console.log(`ALL LINKS (${info.links.length}):`);
      info.links.forEach((l, idx) => {
        console.log(`  [${idx}] Tag: ${l.tag} | Text: "${l.text}" | Onclick: "${l.onclick}" | Href: "${l.href}"`);
      });
    } catch (err) {
      console.log(`Frame ${i} evaluate error:`, err.message);
    }
  }

  process.exit(0);
}

debugModal().catch(err => {
  console.error('❌ Debug error:', err);
  process.exit(1);
});
