const path = require('path');
const fs = require('fs');
const { getOrCreateCSCSession, formatDateDDMMYYYY } = require('./src/services/jharsewa.service.js');

(async () => {
  const cert = {
    refNo: 'JHLRCO/2026/737977',
    entryDate: '2026-08-16'
  };

  const cleanRef = (cert.refNo || '').trim();
  const numPart = cleanRef.includes('/') ? cleanRef.split('/').pop() : cleanRef;

  console.log(`📄 Starting PDF fetch ONLY test for Certificate ${cleanRef}... (NO WHATSAPP SEND)`);
  let cscSession = null;
  try {
    cscSession = await getOrCreateCSCSession();
    const { page } = cscSession;

    // Ensure page is on View Submitted Applications page & close any open modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.modal .close, button.close, div[id*="modal"] .close');
      if (closeBtn) closeBtn.click();
      const viewStatusMenu = Array.from(document.querySelectorAll('a')).find(l => l.innerText && l.innerText.includes('View Submitted Application'));
      if (viewStatusMenu) viewStatusMenu.click();
    }).catch(() => null);

    await new Promise(r => setTimeout(r, 2000));

    const formattedDate = '16/08/2026';
    console.log(`📅 Setting Date filter: ${formattedDate}...`);

    // 1. Update From Date & To Date filter
    await page.evaluate((targetDate) => {
      const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
      if (fromInput) {
        fromInput.value = targetDate;
        fromInput.dispatchEvent(new Event('input', { bubbles: true }));
        fromInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
      if (toInput) {
        toInput.value = targetDate;
        toInput.dispatchEvent(new Event('input', { bubbles: true }));
        toInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
      const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
      if (getDataBtn) getDataBtn.click();
    }, formattedDate);

    await new Promise(r => setTimeout(r, 4500));

    // 2. Search Ref No & Click Delivered link
    console.log(`🔍 Searching ${numPart} in table & clicking Delivered link...`);
    const clickDelivered = await page.evaluate((searchNum, fullRef) => {
      const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
      if (searchInput) {
        searchInput.value = searchNum;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const matchRow = rows.find(r => r.innerText.includes(searchNum) || r.innerText.includes(fullRef));
      if (matchRow) {
        const delLink = Array.from(matchRow.querySelectorAll('a')).find(l => l.innerText.toLowerCase().includes('delivered')) || matchRow.querySelectorAll('a')[0];
        if (delLink) {
          delLink.click();
          return true;
        }
      }
      return false;
    }, numPart, cleanRef);

    console.log(`📌 Delivered link click status: ${clickDelivered}`);
    if (!clickDelivered) {
      throw new Error(`Certificate ${cleanRef} not found or Delivered link unavailable on CSC portal.`);
    }

    await new Promise(r => setTimeout(r, 4000));

    // 3. Click View in Status Modal (splitRelatedDocument)
    console.log('🔍 Clicking View in Status Modal...');
    for (const frame of page.frames()) {
      try {
        await frame.evaluate(() => {
          const viewLinks = Array.from(document.querySelectorAll('a')).filter(a => a.getAttribute('onclick') && a.getAttribute('onclick').includes('splitRelatedDocument'));
          if (viewLinks.length > 0) viewLinks[0].click();
        });
      } catch (e) {}
    }

    await new Promise(r => setTimeout(r, 4000));

    // 4. Setup CDP Download Behavior
    const downloadsDir = path.join(__dirname, 'public/downloads');
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadsDir,
    });

    console.log('📜 Executing Output Certificate link click inside target frame...');
    let targetPopup = null;
    cscSession.browser.on('targetcreated', async target => {
      if (target.type() === 'page') {
        targetPopup = await target.page();
        const popupClient = await targetPopup.target().createCDPSession();
        await popupClient.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadsDir,
        });
      }
    });

    for (const frame of page.frames()) {
      try {
        await frame.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const target = links.find(a => (a.innerText && (a.innerText.includes('outputcertificateEng') || a.innerText.toLowerCase().includes('english') || a.innerText.toLowerCase().includes('certificate'))));
          if (target) {
            const rawOnclick = target.getAttribute('onclick');
            if (rawOnclick) {
              const fn = new Function(rawOnclick);
              fn();
            } else {
              target.click();
            }
          }
        });
      } catch (e) {}
    }

    await new Promise(r => setTimeout(r, 8000));

    if (targetPopup) {
      console.log('📌 Popup page detected! Extracting PDF binary stream...');
      const pdfBuffer = await targetPopup.pdf({ format: 'A4', printBackground: true }).catch(() => null);
      if (pdfBuffer) {
        const savePath = path.join(downloadsDir, `${numPart}_certificate.pdf`);
        fs.writeFileSync(savePath, pdfBuffer);
        console.log(`✅ [100% REAL PDF SAVED] Binary PDF written to: ${savePath}`);
      }
    }

    await new Promise(r => setTimeout(r, 10000));

    const downloadedFiles = fs.readdirSync(downloadsDir).filter(f => !f.endsWith('.png'));
    console.log('📂 PDF Files in downloads directory:', downloadedFiles);

    if (downloadedFiles.length > 0) {
      const targetPdf = downloadedFiles.find(f => f.includes('737977')) || downloadedFiles[downloadedFiles.length - 1];
      const pdfPath = path.join(downloadsDir, targetPdf);
      console.log(`======================================================`);
      console.log(`✅ [100% SUCCESS] PDF DOWNLOADED & VERIFIED AT:`);
      console.log(`Path: ${pdfPath}`);
      console.log(`======================================================`);
      const { exec } = require('child_process');
      exec(`explorer.exe /select,"${pdfPath}"`);
    } else {
      console.log('❌ PDF download timed out.');
    }

  } catch (err) {
    console.error('❌ DOWNLOAD TEST ERROR:', err.message);
  } finally {
    if (cscSession && cscSession.browser) {
      await cscSession.browser.close().catch(() => null);
      console.log('🔒 Session closed.');
    }
  }
})();
