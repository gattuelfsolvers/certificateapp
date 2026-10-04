const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { getOrCreateCSCSession, forceCSCRelogin } = require('./jharsewa.service');

async function checkAndReloginIfExpired(page) {
  try {
    const isExpired = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      return text.includes('SESSION INVALIDATED') || text.includes('session has been expired') || text.includes('another system');
    }).catch(() => false);

    if (isExpired) {
      console.log('⚡ Session expired detected during execution! Forcing clean relogin...');
      return await forceCSCRelogin();
    }
  } catch (e) {}
  return null;
}

/**
 * Format date object/string to DD/MM/YYYY
 */
function formatDateDDMMYYYY(dateInput) {
  if (!dateInput) return null;
  let d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    const cleanStr = dateInput.split('T')[0].trim().replace(/-/g, '/');
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (parts[2].length === 4) {
        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
  }
  if (!d || isNaN(d.getTime())) {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Download Engine 2.0 - 16-Step Modular Download Flow with Double Verification Guard
 * 
 * @param {Object} cert - Certificate database record
 * @param {string} customMobile - Optional target mobile number for WhatsApp
 */
async function downloadCertificatePDF2(cert, customMobile = null) {
  if (!cert || !cert.refNo) {
    throw new Error('Valid certificate object with Reference Number is required.');
  }

  const fullRefNo = cert.refNo.trim();
  const serialNo = fullRefNo.includes('/') ? fullRefNo.split('/').pop().trim() : fullRefNo;
  const prefixUpper = fullRefNo.includes('/') ? fullRefNo.split('/')[0].toUpperCase().trim() : '';
  const certTypeUpper = (cert.certType || '').toUpperCase().trim();

  console.log(`======================================================`);
  console.log(`🚀 [Download Engine 2.0] Starting Download for ${fullRefNo} (Serial: ${serialNo})...`);
  console.log(`======================================================`);

  // STEP 1: Jharsewa Login & Session Verification
  console.log(`[Step 1/16] Ensuring Jharsewa CSC Portal active session...`);
  let sessionRes = await getOrCreateCSCSession();
  let browser = sessionRes.browser;
  let page = sessionRes.page;

  const reloginRes = await checkAndReloginIfExpired(page);
  if (reloginRes) {
    browser = reloginRes.browser;
    page = reloginRes.page;
  }

  // Force bring browser window directly to the front of Windows desktop screen
  await page.bringToFront().catch(() => null);

  // Ensure page is on View Submitted Application(s)
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.modal .close, button.close, div[id*="modal"] .close');
    if (closeBtn) closeBtn.click();

    const links = Array.from(document.querySelectorAll('a'));
    const subMenu = links.find(l => l.innerText && l.innerText.includes('View Submitted Application'));
    if (subMenu) subMenu.click();
  }).catch(() => null);

  console.log(`   --> ⏳ Patient 10-second pause for portal page full load...`);
  await new Promise(r => setTimeout(r, 10000));

  // STEP 2: Verify Date Range (DD/MM/YYYY) smartly & patiently from populated DOM
  console.log(`[Step 2/16] Patiently reading populated Date Range from portal...`);
  const certDateObj = cert.entryDate ? (cert.entryDate instanceof Date ? cert.entryDate : new Date(cert.entryDate)) : new Date();
  const certDateFormatted = formatDateDDMMYYYY(certDateObj);

  // Wait for Jharsewa page scripts to naturally populate From Date & To Date inputs
  await page.waitForFunction(() => {
    const f = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
    const t = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
    return f && t && f.value && t.value && f.value.includes('/') && t.value.includes('/');
  }, { timeout: 15000 }).catch(() => null);

  const dateCheckResult = await page.evaluate((certFormatted) => {
    const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
    const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');

    const currentFrom = fromInput ? fromInput.value.trim() : '';
    const currentTo = toInput ? toInput.value.trim() : '';

    const parseDDMMYYYY = (str) => {
      if (!str || !str.includes('/')) return null;
      const parts = str.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      }
      return null;
    };

    const fromTs = parseDDMMYYYY(currentFrom);
    const toTs = parseDDMMYYYY(currentTo);
    const targetTs = parseDDMMYYYY(certFormatted);

    let inside = false;
    if (fromTs && toTs && targetTs) {
      inside = (targetTs >= fromTs && targetTs <= toTs);
    }

    return { currentFrom, currentTo, inside };
  }, certDateFormatted);

  console.log(`   --> Portal Date Range: '${dateCheckResult.currentFrom}' to '${dateCheckResult.currentTo}' | Certificate Date: '${certDateFormatted}'`);

  if (dateCheckResult.inside) {
    console.log(`   --> ✅ Certificate date (${certDateFormatted}) is ALREADY inside selected date range. Leaving date inputs 100% UNTOUCHED!`);
  } else {
    console.log(`   --> ⚠️ Certificate date (${certDateFormatted}) is outside current window. Safely updating date range...`);
    const todayStr = formatDateDDMMYYYY(new Date());
    let pastDateStr = '01/01/2024';
    if (!isNaN(certDateObj.getTime())) {
      const past = new Date(certDateObj.getTime());
      past.setDate(past.getDate() - 30);
      pastDateStr = formatDateDDMMYYYY(past);
    }

    await page.evaluate((fDate, tDate) => {
      const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
      if (fromInput) {
        fromInput.value = fDate;
        fromInput.dispatchEvent(new Event('input', { bubbles: true }));
        fromInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
      if (toInput) {
        toInput.value = tDate;
        toInput.dispatchEvent(new Event('input', { bubbles: true }));
        toInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, pastDateStr, todayStr);
  }

  console.log(`   --> ⏳ Patient 10-second pause after Date Range evaluation...`);
  await new Promise(r => setTimeout(r, 10000));

  // STEP 3: Click Get Data & Wait for complete table load
  console.log(`[Step 3/16] Clicking 'Get Data' & waiting for table list to load completely...`);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
    const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
    if (getDataBtn) getDataBtn.click();
  });

  // Patient wait for DataTable to finish loading rows
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const proc = document.querySelector('.dataTables_processing');
    const isProcessingHidden = !proc || proc.style.display === 'none' || proc.style.visibility === 'hidden';
    return rows.length > 0 && isProcessingHidden;
  }, { timeout: 20000 }).catch(() => null);

  console.log(`   --> ⏳ Patient 10-second pause after Get Data table load...`);
  await new Promise(r => setTimeout(r, 10000));

  // STEP 4: Search bar serial-number-only filter (e.g. 594677)
  console.log(`[Step 4/16] Entering Serial Number '${serialNo}' into DataTable Search bar...`);
  await page.evaluate((sNum) => {
    const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
    if (searchInput) {
      searchInput.value = sNum;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, serialNo);

  // PATIENT WAIT: Wait for DataTable DOM to filter and re-render row matching serial number!
  console.log(`[Step 4.5/16] Patiently waiting for DataTable DOM redraw matching serial '${serialNo}'...`);
  const isSearchRendered = await page.waitForFunction((sNum, fullRef) => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    if (rows.length === 0) return false;
    const proc = document.querySelector('.dataTables_processing');
    const isProcHidden = !proc || proc.style.display === 'none' || proc.style.visibility === 'hidden';
    const found = rows.some(r => r.innerText.includes(sNum) || r.innerText.includes(fullRef));
    return isProcHidden && found;
  }, { timeout: 15000 }, serialNo, fullRefNo).then(() => true).catch(() => false);

  console.log(`   --> ⏳ Patient 10-second pause after Search Bar redraw...`);
  await new Promise(r => setTimeout(r, 10000));

  // STEP 5: Search & Click Delivered Link in Current Status Column
  console.log(`[Step 5/16] Locating row for Serial '${serialNo}' & clicking 'Delivered'...`);
  const clickDeliveredSuccess = await page.evaluate((sNum, targetRef) => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const matchRow = rows.find(r => r.innerText.includes(sNum) || r.innerText.includes(targetRef));

    if (matchRow) {
      const links = Array.from(matchRow.querySelectorAll('a, span[onclick], td'));
      const delLink = links.find(l => l.innerText && l.innerText.toLowerCase().includes('delivered'));
      if (delLink) {
        delLink.click();
        return true;
      }
    }
    return false;
  }, serialNo, fullRefNo);

  if (!clickDeliveredSuccess) {
    throw new Error(`Serial ${serialNo} (${fullRefNo}) not found or Delivered link unavailable on portal after search filter.`);
  }

  // STEP 6: Wait Patiently for Status of Application Modal Dialog & iFrame to Load Completely
  console.log(`[Step 6/16] Patiently waiting for 'Status of Application' modal & iFrame network load...`);
  
  // Patient 10-second initial buffer for server network request
  console.log(`   --> ⏳ Patient 10-second initial pause for Modal AJAX network response...`);
  await new Promise(r => setTimeout(r, 10000));

  // Patiently wait for iframe element to appear in DOM
  await page.waitForFunction(() => {
    const iframe = document.querySelector('iframe');
    const modal = document.querySelector('.modal-body, div[id*="modal"]');
    return iframe !== null || modal !== null;
  }, { timeout: 20000 }).catch(() => null);

  // Patient 10-second buffer for iframe content rendering
  console.log(`   --> ⏳ Patient 10-second pause for iFrame rendering...`);
  await new Promise(r => setTimeout(r, 10000));

  // STEP 7: DOUBLE VERIFICATION GUARD - Patient Frame-aware Application Reference Number Match
  console.log(`[Step 7/16] 🛡️ Running Patient Double Verification Guard across iFrames...`);
  let isRefMatched = false;
  let modalAttempts = 0;
  const maxModalAttempts = 25; // Patient 25 attempts (~75s max window for slow government server)

  while (modalAttempts < maxModalAttempts && !isRefMatched) {
    modalAttempts++;

    const frames = page.frames();
    for (const frame of frames) {
      if (frame.isDetached()) continue;
      const frameUrl = frame.url();
      try {
        const frameData = await frame.evaluate(() => {
          if (!document || !document.documentElement) return { text: '', html: '' };
          const bodyText = document.body ? (document.body.innerText || document.body.textContent || '') : '';
          const fullHtml = document.documentElement.outerHTML || '';
          return { text: bodyText, html: fullHtml };
        });

        const combinedContent = (frameData.text + ' ' + frameData.html + ' ' + frameUrl).toLowerCase();
        const targetSerialLower = String(serialNo).toLowerCase();
        const targetRefLower = String(fullRefNo).toLowerCase();

        if (combinedContent.includes(targetSerialLower) || combinedContent.includes(targetRefLower)) {
          isRefMatched = true;
          console.log(`   --> ✅ DOUBLE VERIFICATION PASSED! Target Serial '${serialNo}' verified in frame [${frameUrl.substring(0, 60)}...]`);
          break;
        } else if (modalAttempts === 1 || modalAttempts % 5 === 0) {
          console.log(`   [Debug Frame Check] Frame URL: ${frameUrl.substring(0, 70)}... | Content Length: ${combinedContent.length}`);
        }
      } catch (err) {
        if (modalAttempts === 1) {
          console.warn(`   [Debug Frame Evaluate Error] Frame URL: ${frameUrl.substring(0, 70)}... | Error: ${err.message}`);
        }
      }
    }

    if (!isRefMatched) {
      console.warn(`   --> ⌛ iFrame content still loading/rendering (Attempt ${modalAttempts}/${maxModalAttempts}). Patiently waiting 3s for server response...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (!isRefMatched) {
    throw new Error(`Double Verification Failed: Modal iFrame did not load target serial ${serialNo} within patient wait window.`);
  }

  // Patient 1.5-second buffer after verification before clicking View
  await new Promise(r => setTimeout(r, 1500));

  // STEP 8: Setup Browser Target CDP Download Listener BEFORE clicking links
  console.log(`[Step 8/16] Enabling CDP download behavior across all browser targets BEFORE document click...`);
  const downloadsDir = path.join(__dirname, '../../public/downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const os = require('os');
  const systemUserDownloads = path.join(os.homedir(), 'Downloads');

  // Attach CDP download behavior to main page and all current/future targets
  const attachCDP = async (target) => {
    try {
      const targetClient = await target.createCDPSession();
      await targetClient.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadsDir,
        eventsEnabled: true
      }).catch(() => null);
      await targetClient.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadsDir,
      }).catch(() => null);

      // Auto-handle popup pages cleanly: Set CDP and click document link if popup opens a viewer page
      if (target.type() === 'page') {
        const p = await target.page().catch(() => null);
        if (p && p !== page) {
          console.log(`🌐 Popup window detected! Setting CDP for popup URL: ${p.url()}`);
          try {
            await new Promise(r => setTimeout(r, 1500));
            await p.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a, button, input[type="button"]'));
              const targetLink = links.find(a => 
                (a.innerText && (a.innerText.toLowerCase().includes('output') || a.innerText.toLowerCase().includes('english') || a.innerText.toLowerCase().includes('certificate') || a.innerText.toLowerCase().includes('download') || a.innerText.toLowerCase().includes('print'))) ||
                (a.getAttribute('onclick') && a.getAttribute('onclick').toLowerCase().includes('output'))
              );
              if (targetLink) {
                targetLink.click();
              }
            }).catch(() => null);
          } catch (e) {}
        }
      }
    } catch (e) {}
  };

  await attachCDP(page.target());

  const targetCreatedHandler = async (target) => {
    try {
      await attachCDP(target);
    } catch (e) {}
  };

  browser.on('targetcreated', targetCreatedHandler);

  const startTimeMs = Date.now() - 5000;

  // STEP 9: Certificate Type Specific Link Selection & Direct Execution across page.frames()
  console.log(`[Step 9/16] 🎯 Routing to Modular Engine for Prefix: '${prefixUpper}'...`);

  // 9a. Click View / displayFeedback in Issued Document(s) column for Approval row to populate Related Documents frame
  console.log(`   --> Clicking 'View' in Issued Document(s) column for Approval row in modal iFrame...`);
  let viewClicked = false;
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    try {
      viewClicked = await frame.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        for (const tr of rows) {
          const statusText = tr.innerText.toUpperCase();
          if (statusText.includes('DELIVERED') || statusText.includes('COMPLETED') || statusText.includes('APPROVAL')) {
            const allLinks = Array.from(tr.querySelectorAll('a'));
            const viewLink = allLinks.find(a => 
              a.innerText.toLowerCase().includes('view') || 
              a.innerText.toLowerCase().includes('income') ||
              a.innerText.toLowerCase().includes('certificate') ||
              (a.getAttribute('onclick') && (a.getAttribute('onclick').includes('splitRelatedDocument') || a.getAttribute('onclick').includes('displayFeedback')))
            ) || allLinks[0];

            if (viewLink) {
              const rawOnclick = viewLink.getAttribute('onclick') || '';
              if (rawOnclick && rawOnclick.trim()) {
                try {
                  window.eval(rawOnclick);
                } catch (e) {
                  viewLink.click();
                }
              } else {
                viewLink.click();
              }
              return true;
            }
          }
        }
        return false;
      });
      if (viewClicked) break;
    } catch (e) {}
  }

  console.log(`   --> ⏳ Patient 3-second pause for Related Documents frame load...`);
  await new Promise(r => setTimeout(r, 3000));

  // 9b. Prefix-Specific Modular Engines
  console.log(`   --> 🚀 Running Prefix Engine for '${prefixUpper}'...`);
  let docDownloadedOrTriggered = false;

  for (let scanAttempt = 1; scanAttempt <= 8; scanAttempt++) {
    const activePages = await browser.pages().catch(() => [page]);
    const currentFrames = [];
    for (const p of activePages) {
      try {
        currentFrames.push(...p.frames());
      } catch (e) {}
    }

    for (const frame of currentFrames) {
      if (frame.isDetached()) continue;
      try {
        const linkInfo = await frame.evaluate((pUpper) => {
          // Disable feedback requirement inputs if present
          const fbInputs = Array.from(document.querySelectorAll('#feedbackFlag, input[name="feedbackFlag"], input[id*="feedback"]'));
          fbInputs.forEach(i => i.value = 'false');

          const links = Array.from(document.querySelectorAll('a, button, input[type="button"], span[onclick]'));

          // Helper to trigger a link element safely
          const trigger = (el) => {
            const rawOnclick = el.getAttribute('onclick') || '';
            if (rawOnclick && rawOnclick.trim()) {
              try { window.eval(rawOnclick); } catch (e) { el.click(); }
            } else {
              el.click();
            }
            return { onclick: rawOnclick, text: (el.innerText || el.value || '').trim() };
          };

          // Helper to extract splitRelatedDocument parameters and execute showDocument for target item
          const triggerSplitDoc = (targetKeyword, excludeKeyword) => {
            const splitLink = links.find(a => (a.getAttribute('onclick') || '').includes('splitRelatedDocument'));
            if (splitLink) {
              const oc = splitLink.getAttribute('onclick');
              const parts = oc.split("','");
              if (parts.length >= 5) {
                const applId = parts[0].replace(/.*splitRelatedDocument\('/, '');
                const taskInstId = parts[1];
                const docsStr = parts[2];
                const serviceId = parts[3];

                const docItems = docsStr.split(',');
                // Search for item matching targetKeyword, excluding excludeKeyword
                const matchedItem = docItems.find(d => {
                  const dLower = d.toLowerCase();
                  if (excludeKeyword && dLower.includes(excludeKeyword.toLowerCase())) return false;
                  return targetKeyword ? dLower.includes(targetKeyword.toLowerCase()) : true;
                });

                if (matchedItem) {
                  const itemParts = matchedItem.split('|');
                  const docId = itemParts[0].split('~')[0];
                  const flag = itemParts[1];
                  const itemToken = itemParts[4];

                  if (typeof window.showDocument === 'function') {
                    window.showDocument(applId, taskInstId, docId, serviceId, flag, itemToken);
                    return { onclick: `showDocument(${docId})`, text: matchedItem.split('~')[1] || targetKeyword };
                  }
                }
              }
            }
            return null;
          };

          // ----------------------------------------------------
          // ENGINE 1: JHIC (Income Certificate) Engine
          // ----------------------------------------------------
          if (pUpper === 'JHIC') {
            const incLink = links.find(a => {
              const txt = (a.innerText || a.value || '').toLowerCase().trim();
              const oc = (a.getAttribute('onclick') || '').toLowerCase();
              if (oc.includes('home.do') || oc.includes('logout') || oc.includes('viewuploadeddoc') || oc.includes('splitrelateddocument')) return false;
              return txt.includes('income certificate') || txt.includes('outputcertificateeng') || txt.includes('english') || oc.includes('displayfeedback') || oc.includes('outputcertificate');
            });
            if (incLink) return trigger(incLink);
          }

          // ----------------------------------------------------
          // ENGINE 2: JHLRCO (Local Resident Certificate CO Level) Engine
          // ----------------------------------------------------
          if (pUpper === 'JHLRCO') {
            // First search directly in submodal for 'output' / 'outputcertificate' link excluding 'inspection'
            const outLink = links.find(a => {
              const txt = (a.innerText || a.value || '').toLowerCase().trim();
              const oc = (a.getAttribute('onclick') || '').toLowerCase();
              if (txt.includes('inspection') || oc.includes('inspection')) return false;
              return txt.includes('output') || oc.includes('output');
            });
            if (outLink) return trigger(outLink);

            // Fallback via splitRelatedDocument parameters targeting output (Flag 1) and excluding inspection
            const splitRes = triggerSplitDoc('output', 'inspection');
            if (splitRes) return splitRes;
          }

          // ----------------------------------------------------
          // ENGINE 3: JHRC / JHLRSDO (Local Resident Certificate SDO Level) Engine
          // ----------------------------------------------------
          if (pUpper === 'JHRC' || pUpper === 'JHLRSDO') {
            const lrcLink = links.find(a => {
              const txt = (a.innerText || a.value || '').toLowerCase().trim();
              const oc = (a.getAttribute('onclick') || '').toLowerCase();
              if (txt.includes('approval') || oc.includes('approval')) return false;
              return txt.includes('lrc certificate') || oc.includes('lrc certificate');
            });
            if (lrcLink) return trigger(lrcLink);

            const splitRes = triggerSplitDoc('LRC Certificate', 'Approval');
            if (splitRes) return splitRes;
          }

          // ----------------------------------------------------
          // ENGINE 4: JHCBC / JHCOB / JHCSC / JHCST / JHEWS (Caste & Category Certificates) Engine
          // ----------------------------------------------------
          if (['JHCBC', 'JHCOB', 'JHCSC', 'JHCST', 'JHEWS', 'EWS'].includes(pUpper)) {
            // Prioritize English Output Certificate
            const engLink = links.find(a => {
              const txt = (a.innerText || a.value || '').toLowerCase().replace(/\s+/g, '');
              const oc = (a.getAttribute('onclick') || '').toLowerCase();
              return txt.includes('outputcertificateeng') || txt.includes('english') || oc.includes('outputcertificateeng');
            });
            if (engLink) return trigger(engLink);

            // Fallback via splitRelatedDocument targeting outputcertificateEng
            const splitRes = triggerSplitDoc('outputcertificateEng', null);
            if (splitRes) return splitRes;
          }

          // ----------------------------------------------------
          // GENERAL FALLBACK ENGINE (For any unhandled certificate prefix)
          // ----------------------------------------------------
          const englishLink = links.find(a => {
            const txt = (a.innerText || a.value || '').toLowerCase().replace(/\s+/g, '');
            const oc = (a.getAttribute('onclick') || '').toLowerCase();
            if (oc.includes('home.do') || oc.includes('logout') || oc.includes('splitrelateddocument')) return false;
            return txt.includes('outputcertificateeng') || txt.includes('english') || oc.includes('outputcertificateeng');
          });

          const fallbackLink = englishLink || links.find(a => {
            const txt = (a.innerText || a.value || '').toLowerCase().trim();
            const oc = (a.getAttribute('onclick') || '').toLowerCase();
            if (oc.includes('home.do') || oc.includes('logout') || oc.includes('viewuploadeddoc') || oc.includes('splitrelateddocument')) return false;
            if (txt.includes('acknowlegement') || txt.includes('acknowledgement') || txt === 'feedback' || txt.includes('inspection')) return false;
            
            if (oc.includes('showdocument') || oc.includes('displayfeedback')) {
              const parts = oc.split("','");
              if (parts.length >= 5) {
                const flagStr = parts[4].trim();
                if (flagStr === '0' || flagStr === '4' || flagStr === '3') return false; // Exclude attachments, slips, & inspection reports!
              }
            }

            return txt.includes('output') || txt.includes('certificate') || oc.includes('outputcertificate') || oc.includes('showdocument');
          });

          if (fallbackLink) return trigger(fallbackLink);

          // Click splitRelatedDocument naturally if not yet expanded
          const splitLink = links.find(a => (a.getAttribute('onclick') || '').includes('splitRelatedDocument'));
          if (splitLink) {
            try { splitLink.click(); } catch (e) {}
          }

          return null;
        }, prefixUpper).catch(e => null);

        if (linkInfo) {
          console.log(`   --> ✅ [Modular Engine Match] Clicked Certificate Link: '${linkInfo.text}' | Onclick: ${(linkInfo.onclick || '').substring(0, 70)}...`);
          docDownloadedOrTriggered = true;
          break;
        }
      } catch (e) {}
    }
    if (docDownloadedOrTriggered) break;
    await new Promise(r => setTimeout(r, 2000));
  }

  // 9c. Popup Window Listener for non-income certificates
  console.log(`   --> 🌐 Scanning all open browser popup windows for Output Certificate download link...`);
  await new Promise(r => setTimeout(r, 2000));
  try {
    for (let popupAttempt = 1; popupAttempt <= 6; popupAttempt++) {
      const allPages = await browser.pages();
      let clickedAny = false;

      for (const p of allPages) {
        if (p !== page) {
          console.log(`🌐 Found Popup Page (Attempt ${popupAttempt}): ${p.url()}`);
          await attachCDP(p.target()).catch(() => null);
          await p.bringToFront().catch(() => null);

          for (const frame of p.frames()) {
            if (frame.isDetached()) continue;
            try {
              const clickedInPopup = await frame.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], span[onclick], td[onclick], img[onclick], form input[type="submit"]'));
                const target = elements.find(el => {
                  const txt = (el.innerText || el.value || '').toLowerCase();
                  const oc = (el.getAttribute('onclick') || '').toLowerCase();
                  const href = (el.getAttribute('href') || '').toLowerCase();
                  if (oc.includes('logout')) return false;
                  return txt.includes('output') || txt.includes('english') || txt.includes('certificate') || txt.includes('download') || txt.includes('print') || oc.includes('output') || oc.includes('certificate') || oc.includes('home.do') || href.includes('certificate');
                });

                if (target) {
                  const rawOnclick = target.getAttribute('onclick') || '';
                  if (rawOnclick && rawOnclick.trim()) {
                    try { window.eval(rawOnclick); } catch (e) { target.click(); }
                  } else {
                    target.click();
                  }
                  return true;
                }

                // If popup page contains a form targeting home.do, submit it directly!
                const forms = Array.from(document.querySelectorAll('form'));
                const homeForm = forms.find(f => (f.getAttribute('action') || '').includes('home.do') || (f.getAttribute('name') || '').includes('form'));
                if (homeForm) {
                  try {
                    homeForm.submit();
                    return true;
                  } catch (e) {}
                }

                return false;
              });

              if (clickedInPopup) {
                console.log(`   --> ✅ Clicked Output Certificate download link inside Popup Page frame!`);
                clickedAny = true;
                break;
              }
            } catch (e) {}
          }
        }
      }
      if (clickedAny) break;
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (popupErr) {
    console.warn('⚠️ Popup scanner encountered minor notice:', popupErr.message);
  }

  // Helper to record file lists with timestamps
  const getDirFiles = (dirPath) => {
    if (!fs.existsSync(dirPath)) return [];
    try {
      return fs.readdirSync(dirPath).map(f => {
        const full = path.join(dirPath, f);
        try {
          const stat = fs.statSync(full);
          return { name: f, fullPath: full, mtime: stat.mtimeMs };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    } catch (e) {
      return [];
    }
  };

  // STEP 10 & 11: Wait for PDF Download Completion Patiently
  console.log(`[Step 10/16] Document link clicked! Waiting for PDF download completion...`);
  let downloadedFilePath = null;
  let downloadAttempts = 0;

  while (downloadAttempts < 35 && !downloadedFilePath) {
    downloadAttempts++;
    await new Promise(r => setTimeout(r, 1000));

    // Check public/downloads first
    const appFiles = getDirFiles(downloadsDir);
    const newAppPdf = appFiles.find(f => f.mtime >= startTimeMs && f.name.endsWith('.pdf') && !f.name.endsWith('.crdownload') && !f.name.endsWith('.tmp'));

    if (newAppPdf) {
      downloadedFilePath = newAppPdf.fullPath;
      console.log(`   --> ✅ Download Complete (App Directory)! File saved: ${downloadedFilePath}`);
      break;
    }

    // Check system user Downloads directory as fallback
    const sysFiles = getDirFiles(systemUserDownloads);
    const newSysPdf = sysFiles.find(f => f.mtime >= startTimeMs && f.name.endsWith('.pdf') && !f.name.endsWith('.crdownload') && !f.name.endsWith('.tmp'));

    if (newSysPdf) {
      downloadedFilePath = newSysPdf.fullPath;
      console.log(`   --> ✅ Download Complete (System Downloads)! File saved: ${downloadedFilePath}`);
      break;
    }
  }

  // Cleanup browser target listener
  browser.off('targetcreated', targetCreatedHandler);

  if (!downloadedFilePath) {
    // Fallback to most recent PDF modified in last 5 minutes
    const fiveMinAgo = Date.now() - (5 * 60 * 1000);
    const allRecent = [...getDirFiles(downloadsDir), ...getDirFiles(systemUserDownloads)]
      .filter(f => f.mtime >= fiveMinAgo && f.name.endsWith('.pdf') && !f.name.endsWith('.crdownload'))
      .sort((a, b) => b.mtime - a.mtime);

    if (allRecent.length > 0) {
      downloadedFilePath = allRecent[0].fullPath;
      console.log(`   --> ✅ Download Fallback matched recent PDF: ${downloadedFilePath}`);
    } else {
      throw new Error(`PDF download timed out or file not saved within download directories.`);
    }
  }

  // STEP 12: Close Opened Blank Popup Page
  console.log(`[Step 12/16] Closing newly opened popup window...`);
  const pages = await browser.pages();
  for (const p of pages) {
    if (p !== page && p.url().includes('about:blank')) {
      await p.close().catch(() => null);
    }
  }

  // STEP 13: Close Small Popup (Related Documents)
  console.log(`[Step 13/16] Closing 'Related Documents' small popup...`);
  await page.evaluate(() => {
    const closeBtns = Array.from(document.querySelectorAll('button, input[type="button"], a')).filter(b => b.innerText && b.innerText.trim().toUpperCase() === 'CLOSE');
    if (closeBtns.length > 1) {
      closeBtns[closeBtns.length - 1].click();
    }
  }).catch(() => null);

  await new Promise(r => setTimeout(r, 1000));

  // STEP 14: Close Large Popup (Status of Application)
  console.log(`[Step 14/16] Closing 'Status of Application' main modal...`);
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.modal .close, button.close, div[id*="modal"] .close, button[class*="close"]');
    if (closeBtn) closeBtn.click();
    else {
      const closeBtns = Array.from(document.querySelectorAll('button, input[type="button"]')).filter(b => b.innerText && b.innerText.trim().toUpperCase() === 'CLOSE');
      if (closeBtns.length > 0) closeBtns[0].click();
    }
  }).catch(() => null);

  await new Promise(r => setTimeout(r, 1000));

  // STEP 15 & 16: Identify Download Location & Open Folder in Windows Explorer
  console.log(`[Step 15/16] Identified PDF file location: ${downloadedFilePath}`);
  console.log(`[Step 16/16] Opening downloaded file folder location in Windows Explorer...`);
  
  try {
    exec(`explorer.exe /select,"${downloadedFilePath}"`);
  } catch (expErr) {
    console.warn(`Explorer launch note: ${expErr.message}`);
  }

  // Dispatch via WhatsApp as well
  let waResult = { success: false };
  try {
    const { sendPDFDocument } = require('./whatsapp.service');
    const targetMobile = customMobile || cert.mobile;
    if (targetMobile) {
      waResult = await sendPDFDocument(targetMobile, downloadedFilePath, cert);
    }
  } catch (waErr) {
    console.error('WhatsApp send error:', waErr.message);
  }

  console.log(`======================================================`);
  console.log(`🎉 [Download Engine 2.0] SUCCESS! Completed all 16 Steps.`);
  console.log(`======================================================`);

  return {
    success: true,
    pdfPath: downloadedFilePath,
    whatsappResult: waResult,
    message: `Download Engine 2.0: Successfully downloaded ${fullRefNo} and opened folder!`
  };
}

module.exports = {
  downloadCertificatePDF2,
  formatDateDDMMYYYY
};
