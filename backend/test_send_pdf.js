const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getOrCreateCSCSession } = require('./src/services/jharsewa.service');
const { sendAutomaticReceipt, formatJid } = require('./src/services/whatsapp.service');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

async function testDownloadAndSend() {
  console.log('🚀 Starting Automated PDF Download & WhatsApp Send for JHCBC/2026/536311 to 8210212926...');
  
  const { page } = await getOrCreateCSCSession();

  // 1. Set Date 25/07/2026
  await page.evaluate(() => {
    const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
    if (fromInput) {
      fromInput.value = '25/07/2026';
      fromInput.dispatchEvent(new Event('input', { bubbles: true }));
      fromInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
    if (toInput) {
      toInput.value = '25/07/2026';
      toInput.dispatchEvent(new Event('input', { bubbles: true }));
      toInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
    const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
    if (getDataBtn) getDataBtn.click();
  });

  await new Promise(r => setTimeout(r, 4500));

  // 2. Search 536311 and click Delivered
  console.log('🔍 Searching 536311 & clicking Delivered link...');
  await page.evaluate(() => {
    const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
    if (searchInput) {
      searchInput.value = '536311';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
    }
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const matchRow = rows.find(r => r.innerText.includes('536311'));
    if (matchRow) {
      const delLink = Array.from(matchRow.querySelectorAll('a')).find(l => l.innerText.toLowerCase().includes('delivered'));
      if (delLink) delLink.click();
    }
  });

  await new Promise(r => setTimeout(r, 4000));

  // 3. Click View in Status Modal
  console.log('🔍 Clicking View inside Status Modal...');
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        const viewLinks = Array.from(document.querySelectorAll('a')).filter(a => a.getAttribute('onclick') && a.getAttribute('onclick').includes('splitRelatedDocument'));
        if (viewLinks.length > 0) viewLinks[0].click();
      });
    } catch(e) {}
  }

  await new Promise(r => setTimeout(r, 4000));

  // 4. Click outputcertificateEng link
  console.log('📜 Clicking outputcertificateEng link...');
  const downloadsDir = path.join(__dirname, 'public/downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadsDir,
  });

  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const engLink = links.find(a => a.innerText.includes('outputcertificateEng'));
        const fallback = links.find(a => a.innerText.toLowerCase().includes('output') || a.innerText.toLowerCase().includes('certificate'));
        const target = engLink || fallback;
        if (target) target.click();
      });
    } catch(e) {}
  }

  await new Promise(r => setTimeout(r, 6000));

  // Check downloaded file
  const downloadedFiles = fs.readdirSync(downloadsDir).filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
  console.log('📂 Downloaded files in dir:', downloadedFiles);

  if (downloadedFiles.length > 0) {
    const latestFile = path.join(downloadsDir, downloadedFiles[downloadedFiles.length - 1]);
    console.log(`✅ PDF downloaded successfully at: ${latestFile}`);

    // Send via WhatsApp using Baileys socket
    const authDir = path.join(__dirname, 'auth_info_baileys');
    const { state } = await useMultiFileAuthState(authDir);
    const sock = makeWASocket({ auth: state });

    await new Promise(res => setTimeout(res, 2500));

    const jid = '918210212926@s.whatsapp.net';
    const pdfBuffer = fs.readFileSync(latestFile);

    console.log(`🚀 Sending PDF Certificate to ${jid} via WhatsApp...`);
    await sock.sendMessage(jid, {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: 'JHCBC_2026_536311_Certificate.pdf',
      caption: '📄 *अपना डिजिटल हब*\n\nआपका प्रमाणपत्र (Caste Certificate) सफलतापूर्वक डाउनलोड कर दिया गया है।\n\nरेफरेंस नंबर: *JHCBC/2026/536311*\n\nधन्यवाद!'
    });

    console.log('🎉 WHATSAPP PDF CERTIFICATE SENT SUCCESSFULLY TO 8210212926!');
  } else {
    console.error('❌ PDF file download timeout/not found.');
  }

  process.exit(0);
}

testDownloadAndSend();
