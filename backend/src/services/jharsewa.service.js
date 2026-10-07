const puppeteer = require('puppeteer');
const { createWorker } = require('tesseract.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const { processIncomeCertificate } = require('../engines/income.engine');
const { processResidentialCertificate } = require('../engines/residential.engine');
const { processCasteCertificate } = require('../engines/caste.engine');

// Global CSC Browser Session variables for reuse & keep-alive
let globalBrowser = null;
let globalPage = null;
let lastSessionTime = 0;
const SESSION_TIMEOUT_MS = 25 * 60 * 1000; // 25 Minutes timeout reset window

/**
 * Preprocess green captcha image for high accuracy OCR
 */
async function cleanGreenCaptchaImage(buffer) {
  try {
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width * 2, img.height * 2);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, img.width * 2, img.height * 2);

    const imgData = ctx.getImageData(0, 0, img.width * 2, img.height * 2);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (g > 80 && g > r * 1.15 && g > b * 1.15) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      } else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toBuffer('image/png');
  } catch (err) {
    return buffer;
  }
}

/**
 * Ensure active logged-in session on Jharsewa CSC Portal
 */
async function getOrCreateCSCSession(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && globalBrowser && globalPage && (now - lastSessionTime < SESSION_TIMEOUT_MS)) {
    try {
      const isAlive = await globalPage.evaluate(() => {
        const text = document.body ? document.body.innerText : '';
        if (text.includes('SESSION INVALIDATED') || text.includes('session has been expired') || text.includes('another system')) {
          return false;
        }
        return !!(document.body && (text.includes('NITISH NATH') || text.includes('View Submitted Application')));
      });
      if (isAlive) {
        return { browser: globalBrowser, page: globalPage, reused: true };
      }
    } catch (e) {
      console.warn('⚠️ Existing session check failed, recreating session...');
    }
  }

  // Close old browser if open
  if (globalBrowser) {
    await globalBrowser.close().catch(() => null);
    globalBrowser = null;
    globalPage = null;
  }

  console.log('🔑 Launching new Jharsewa CSC Portal login session...');
  globalBrowser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800']
  });

  globalPage = await globalBrowser.newPage();
  await globalPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const homeUrl = 'https://jharsewa.jharkhand.gov.in/';
  await globalPage.goto(homeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  await globalPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, button, input[type="button"]'));
    const loginBtn = btns.find(b => (b.innerText && b.innerText.toUpperCase().includes('LOGIN')) || (b.value && b.value.toUpperCase().includes('LOGIN')) || (b.href && b.href.includes('login')));
    if (loginBtn) loginBtn.click();
    else if (typeof window.loginUrl === 'function') window.loginUrl();
  });

  await new Promise(r => setTimeout(r, 2000));

  let attempts = 0;
  let loggedIn = false;

  while (attempts < 5 && !loggedIn) {
    attempts++;
    console.log(`🔑 Jharsewa CSC Login Attempt ${attempts}/5...`);

    const isLoginVisible = await globalPage.evaluate(() => {
      return !!document.querySelector('input[name="username"], #username, input[type="password"]');
    });

    if (!isLoginVisible) {
      await globalPage.evaluate(() => {
        if (typeof window.loginUrl === 'function') window.loginUrl();
      });
      await new Promise(r => setTimeout(r, 2000));
    }

    // Fetch dynamic Jharsewa Credentials from DB or environment
    const prisma = require('../db');
    let jUsername = 'cscgunghasa@gmail.com';
    let jPassword = 'Gattu@1994#';
    try {
      const uRec = await prisma.setting.findUnique({ where: { key: 'JHARSEWA_USERNAME' } });
      const pRec = await prisma.setting.findUnique({ where: { key: 'JHARSEWA_PASSWORD' } });
      if (uRec && uRec.value) jUsername = uRec.value.trim();
      if (pRec && pRec.value) jPassword = pRec.value.trim();
    } catch (e) {}

    await globalPage.evaluate((uVal, pVal) => {
      const u = document.querySelector('input[name="username"], #username, input[id*="user"]');
      if (u) { u.value = uVal; u.dispatchEvent(new Event('input', { bubbles: true })); }
      const p = document.querySelector('input[name="password"], #password, input[type="password"]');
      if (p) { p.value = pVal; p.dispatchEvent(new Event('input', { bubbles: true })); }
    }, jUsername, jPassword);

    if (attempts > 1) {
      await globalPage.evaluate(() => {
        const reloadImg = document.querySelector('img[src*="captcha"] + img, img[onclick*="captcha"], #captchaImage');
        if (reloadImg) reloadImg.click();
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    // Direct Base64 Canvas Export from img#captchaImage
    let captchaBuffer = null;
    try {
      const base64Data = await globalPage.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll('img#captchaImage, img[src*="captchaImage"], img[src*="captcha"]'));
        const greenImg = imgs.find(img => img.src && (img.src.includes('captcha') || img.src.includes('captchaImage')));
        if (!greenImg) return null;

        const canvas = document.createElement('canvas');
        canvas.width = greenImg.naturalWidth || greenImg.width || 220;
        canvas.height = greenImg.naturalHeight || greenImg.height || 60;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(greenImg, 0, 0);
        return canvas.toDataURL('image/png');
      });

      if (base64Data) {
        const base64Clean = base64Data.replace(/^data:image\/png;base64,/, "");
        captchaBuffer = Buffer.from(base64Clean, 'base64');
      }
    } catch (e) {
      console.error('Failed extracting base64 captcha:', e.message);
    }

    if (captchaBuffer) {
      const cleanedBuffer = await cleanGreenCaptchaImage(captchaBuffer);
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
      const { data: { text } } = await worker.recognize(cleanedBuffer);
      await worker.terminate();

      let captchaText = text.replace(/[^A-Z0-9]/gi, '').toUpperCase().trim();
      if (captchaText.length > 6) captchaText = captchaText.substring(0, 6);
      console.log(`🤖 Decrypted Captcha: "${captchaText}"`);

      await globalPage.evaluate((val) => {
        const inputs = document.querySelectorAll('#captchaAnswer, input[name="captchaAnswer"], input[placeholder="Captcha"], input[placeholder*="captcha"]');
        inputs.forEach(c => {
          if (c) {
            c.value = val;
            c.dispatchEvent(new Event('input', { bubbles: true }));
            c.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }, captchaText);
    }

    try {
      await Promise.all([
        globalPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null),
        globalPage.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
          const loginSub = btns.find(b => (b.value && b.value.toLowerCase().includes('login')) || (b.innerText && b.innerText.toLowerCase().includes('login')));
          if (loginSub) loginSub.click();
          else if (document.forms[0]) document.forms[0].submit();
        })
      ]);
    } catch (navErr) {}

    await new Promise(r => setTimeout(r, 2000));

    let checkLogin = { isLogged: false, err: false };
    try {
      checkLogin = await globalPage.evaluate(() => {
        const text = document.body ? document.body.innerText : '';
        const isLogged = text.includes('LOGOUT') || text.includes('Logout') || text.includes('Welcome') || text.includes('Manage Profile') || text.includes('Apply for services');
        const err = text.includes('Invalid') || text.includes('wrong characters') || text.includes('CAPTCHA');
        return { isLogged, err };
      });
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        checkLogin = await globalPage.evaluate(() => {
          const text = document.body ? document.body.innerText : '';
          const isLogged = text.includes('LOGOUT') || text.includes('Logout') || text.includes('Welcome') || text.includes('Manage Profile') || text.includes('Apply for services');
          const err = text.includes('Invalid') || text.includes('wrong characters') || text.includes('CAPTCHA');
          return { isLogged, err };
        });
      } catch (e2) {}
    }

    if (checkLogin.isLogged) {
      loggedIn = true;
      console.log('🎉 CSC Account Login Successful!');

      // Navigate to View Submitted Application(s)
      await globalPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const viewStatusMenu = links.find(l => l.innerText && l.innerText.includes('View Status of Application'));
        if (viewStatusMenu) viewStatusMenu.click();
      });

      await new Promise(r => setTimeout(r, 1000));

      await globalPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const subMenu = links.find(l => l.innerText && l.innerText.includes('View Submitted Application'));
        if (subMenu) subMenu.click();
      });

      await new Promise(r => setTimeout(r, 4000));
    }
  }

  if (!loggedIn) {
    throw new Error('CSC Portal Login failed after 5 attempts.');
  }

  lastSessionTime = Date.now();
  return { browser: globalBrowser, page: globalPage, reused: false };
}

/**
 * Map CSC Portal Raw Status to System Internal Status Enum
 */
function mapCSCStatusToInternal(rawStatus, prefixUpper, taskNameLevel = '') {
  const statusUpper = (rawStatus || '').toUpperCase().trim();
  const taskUpper = (taskNameLevel || '').toUpperCase().trim();

  if (statusUpper.includes('REJECT') || statusUpper.includes('CANCEL')) {
    return { status: 'REJECTED', details: `Application status verified: REJECTED (${rawStatus})` };
  }
  if (statusUpper.includes('DELIVER') || statusUpper.includes('ISSUED')) {
    return { 
      status: 'DELIVERED', 
      details: `Application status verified: Delivered` 
    };
  }
  if (statusUpper.includes('WAITING') || statusUpper.includes('APPLICANT')) {
    return { 
      status: 'CO_WAITING', 
      details: `Application status verified: Waiting for Applicant Response` 
    };
  }
  if (statusUpper.includes('INITIAT')) {
    return { status: 'INITIATED', details: `Application status verified: Submitted / Initiated` };
  }
  
  // Dynamic Officer Level checking from Modal Active Task Row when main table status is Under Process
  // 1. CI Priority Check (Must be evaluated BEFORE CO)
  if (taskUpper.includes('CIRCLE INSPECTOR') || taskUpper.includes('VERIFICATION-CI') || taskUpper.includes('APPROVAL-CI') || taskUpper.includes('INSPECTOR') || taskUpper.includes(' CI') || taskUpper.endsWith('-CI') || taskUpper.startsWith('CI-')) {
    return { status: 'CI_UNDER_PROCESS', details: `Application status verified: Circle Inspector - Under Process` };
  }
  // 2. SDO / DC Priority Check
  if (taskUpper.includes('SDO') || taskUpper.includes('SUB DIVISIONAL') || taskUpper.includes('APPROVAL-SDO') || taskUpper.includes('APPROVAL - SDO') || taskUpper.includes('VERIFICATION-SDO') || taskUpper.includes('DC') || taskUpper.includes('DEPUTY COMMISSIONER')) {
    return { status: 'SDO_UNDER_PROCESS', details: `Application status verified: SDO / DC Level - Under Process` };
  }
  // 3. CO Priority Check
  if (taskUpper.includes('CIRCLE OFFICER') || taskUpper.includes('APPROVAL-CO') || taskUpper.includes('VERIFICATION-CO') || taskUpper.includes(' CO') || taskUpper.endsWith(' CO') || taskUpper.startsWith('CO-') || (taskUpper.includes('OFFICER') && !taskUpper.includes('INSPECTOR') && !taskUpper.includes('SUB DIVISIONAL'))) {
    return { status: 'CO_UNDER_PROCESS', details: `Application status verified: Circle Officer - Under Process` };
  }
  // 4. RK / Revenue Karmachari Check
  if (taskUpper.includes('RK') || taskUpper.includes('REVENUE KARMACHARI') || taskUpper.includes('KARMACHARI')) {
    return { status: 'CO_UNDER_PROCESS', details: `Application status verified: Revenue Karmachari / Circle Officer - Under Process` };
  }

  // Default Under process fallback: Return error instead of mutating status when officer level cannot be determined!
  return { 
    error: true,
    status: null, 
    details: `Sync Failed: Unable to determine specific officer level (CI/CO/SDO/RK) from tracking modal for status "${rawStatus}". Status left unchanged.` 
  };
}

/**
 * Helper to format date object/string as DD/MM/YYYY
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
      if (parts[0].length === 4) { // YYYY/MM/DD
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (parts[2].length === 4) { // DD/MM/YYYY
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
 * Calculate Date range: Max 90 days window for portal queries
 */
function getSyncDateRange(entryDateInput) {
  const today = new Date();
  let entryDate = today;

  if (entryDateInput) {
    const d = entryDateInput instanceof Date ? entryDateInput : new Date(entryDateInput);
    if (!isNaN(d.getTime())) {
      entryDate = d;
    }
  }

  // Rule (a): Date range must be max 90 days
  // From Date: Entry Date (or 10 days prior)
  // To Date: From Date + 89 days (max 90 days window) or Today
  const fromDate = new Date(entryDate.getTime());
  fromDate.setDate(fromDate.getDate() - 5); // 5 days margin before entry date

  const toDate = new Date(fromDate.getTime());
  toDate.setDate(toDate.getDate() + 89); // Max 90 days window

  const finalToDate = toDate > today ? today : toDate;

  return {
    fromDateStr: formatDateDDMMYYYY(fromDate),
    toDateStr: formatDateDDMMYYYY(finalToDate),
    fromDateObj: fromDate,
    toDateObj: finalToDate
  };
}

/**
 * Check if a given entry date falls within active portal From/To date strings
 */
function isDateWithinPortalRange(entryDateInput, portalFromStr, portalToStr) {
  if (!entryDateInput || !portalFromStr || !portalToStr) return false;
  const d = entryDateInput instanceof Date ? entryDateInput : new Date(entryDateInput);
  if (isNaN(d.getTime())) return false;

  const parseDDMMYYYY = (str) => {
    const parts = str.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
  };

  const fromObj = parseDDMMYYYY(portalFromStr);
  const toObj = parseDDMMYYYY(portalToStr);

  if (!fromObj || !toObj) return false;

  // Set time to midnight for exact comparison
  const checkTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const fromTime = new Date(fromObj.getFullYear(), fromObj.getMonth(), fromObj.getDate()).getTime();
  const toTime = new Date(toObj.getFullYear(), toObj.getMonth(), toObj.getDate()).getTime();

  return checkTime >= fromTime && checkTime <= toTime;
}

/**
 * Query single certificate status via active CSC session adhering to user rules:
 * Rule (a): Max 90 days range.
 * Rule (b): If entry date is within current portal date range, DO NOT change dates.
 *           If outside range, update From/To to match certificate entry date (max 90 days).
 */
async function checkJharsewaStatus(refNo, entryDateInput) {
  if (!refNo) throw new Error('Reference Number is required');
  const cleanRef = refNo.trim();
  const numPart = cleanRef.includes('/') ? cleanRef.split('/').pop() : cleanRef;
  const prefixUpper = cleanRef.includes('/') ? cleanRef.split('/')[0].toUpperCase() : '';

  if (prefixUpper === 'JHIC') {
    return await processIncomeCertificate(cleanRef, entryDateInput, getOrCreateCSCSession);
  }
  if (prefixUpper === 'JHLRCO' || prefixUpper === 'JHRC' || prefixUpper === 'JHLRSDO') {
    return await processResidentialCertificate(cleanRef, entryDateInput, getOrCreateCSCSession);
  }
  if (prefixUpper === 'JHCBC' || prefixUpper === 'JHCOB' || prefixUpper === 'JHCSC' || prefixUpper === 'JHCST' || prefixUpper === 'JHNBC') {
    return await processCasteCertificate(cleanRef, entryDateInput, getOrCreateCSCSession);
  }

  try {
    let session;
    try {
      session = await getOrCreateCSCSession();
    } catch (sErr) {
      console.warn('⚠️ Session error, retrying with fresh session:', sErr.message);
      session = await getOrCreateCSCSession(true);
    }
    let { page } = session;

    // Check active portal dates currently set in DOM
    const currentPortalDates = await page.evaluate(() => {
      const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
      const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
      return {
        from: fromInput ? fromInput.value : '',
        to: toInput ? toInput.value : ''
      };
    });

    const isAlreadyInRange = isDateWithinPortalRange(entryDateInput, currentPortalDates.from, currentPortalDates.to);

    if (isAlreadyInRange) {
      console.log(`⚡ Entry date for ${cleanRef} is ALREADY inside active portal range (${currentPortalDates.from} to ${currentPortalDates.to}). Skipping date input change!`);
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => null),
          page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
            const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
            if (getDataBtn) getDataBtn.click();
          })
        ]);
      } catch (e) {}
      await new Promise(r => setTimeout(r, 2000));
    } else {
      const { fromDateStr, toDateStr } = getSyncDateRange(entryDateInput);
      console.log(`📅 Entry date for ${cleanRef} is OUTSIDE current portal range. Updating portal date range to: ${fromDateStr} to ${toDateStr}...`);

      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => null),
          page.evaluate((fDate, tDate) => {
            const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
            if (fromInput && fDate) {
              fromInput.value = fDate;
              fromInput.dispatchEvent(new Event('input', { bubbles: true }));
              fromInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
            if (toInput && tDate) {
              toInput.value = tDate;
              toInput.dispatchEvent(new Event('input', { bubbles: true }));
              toInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
            const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
            if (getDataBtn) getDataBtn.click();
          }, fromDateStr, toDateStr)
        ]);
      } catch (e) {}

      await new Promise(r => setTimeout(r, 2000));
    }

    lastSessionTime = Date.now();

    // Search in DataTables input ONLY by serial number numPart (last digits after /2026/)
    const itemResult = await page.evaluate((fullRef, searchNum) => {
      const targetQuery = searchNum || fullRef;
      const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
      if (searchInput) {
        searchInput.value = targetQuery;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      let rows = Array.from(document.querySelectorAll('table tbody tr'));
      if (rows.length === 0 || rows[0].innerText.includes('No matching records') || rows[0].innerText.includes('No data available')) {
        if (searchInput && searchNum && searchNum !== fullRef) {
          searchInput.value = searchNum;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));
          rows = Array.from(document.querySelectorAll('table tbody tr'));
        }
      }

      if (rows.length === 0 || rows[0].innerText.includes('No matching records') || rows[0].innerText.includes('No data available')) {
        return { found: false, rawStatus: 'Not Found / Date Window Exceeded' };
      }

      // Exact row search matching fullRef or searchNum (NO fallback to rows[0]!)
      const matchRow = rows.find(r => r.innerText.includes(fullRef)) || rows.find(r => searchNum && r.innerText.includes(searchNum));
      if (!matchRow) {
        return { found: false, rawStatus: 'Not Found / Reference Match Failed' };
      }

      const cols = Array.from(matchRow.querySelectorAll('td'));
      if (cols.length >= 7) {
        return {
          found: true,
          appRefNo: cols[2]?.innerText.trim(),
          submissionDate: cols[4]?.innerText.trim(),
          dueDate: cols[5]?.innerText.trim(),
          rawStatus: cols[6]?.innerText.trim()
        };
      }

      return { found: false, rawStatus: matchRow.innerText.trim() };
    }, cleanRef, numPart);

    if (!itemResult.found) {
      return {
        error: true,
        status: null,
        details: `Sync Failed: Certificate reference number '${refNo}' not found on Jharsewa portal for active date range. Please retry.`
      };
    }

    let finalRawStatus = itemResult.rawStatus;
    let taskNameLevel = '';

    // ONLY click modal if main table status strictly contains "UNDER PROCESS"
    const isMainUnderProcess = itemResult.rawStatus.toUpperCase().includes('UNDER PROCESS');
    if (isMainUnderProcess) {
      try {
        console.log(`🔍 Inspecting Modal Task Level for ${refNo}...`);
        await page.evaluate((fullRef, searchNum) => {
          const rows = Array.from(document.querySelectorAll('table tbody tr'));
          const matchRow = rows.find(r => r.innerText.includes(fullRef)) || rows.find(r => searchNum && r.innerText.includes(searchNum));
          if (matchRow) {
            const links = Array.from(matchRow.querySelectorAll('a'));
            if (links.length > 0) links[0].click();
          }
        }, cleanRef, numPart);

        await new Promise(r => setTimeout(r, 3500));

        // Structured extraction: Find exact row where Status column (4th column) is 'Under Process' or 'Waiting'
        let extractedTaskName = '';
        for (const frame of page.frames()) {
          if (frame.isDetached()) continue;
          try {
            const foundTask = await frame.evaluate(() => {
              const rows = Array.from(document.querySelectorAll('table tbody tr'));
              for (const tr of rows) {
                const tds = Array.from(tr.querySelectorAll('td'));
                if (tds.length >= 5) {
                  const taskName = tds[1]?.innerText.replace(/\s+/g, ' ').trim() || '';
                  const statusCell = tds[4]?.innerText.replace(/\s+/g, ' ').trim() || '';
                  if (statusCell.toUpperCase().includes('UNDER PROCESS') || statusCell.toUpperCase().includes('WAITING')) {
                    return taskName;
                  }
                }
              }
              return '';
            });
            if (foundTask) {
              extractedTaskName = foundTask;
              break;
            }
          } catch (e) {}
        }

        if (extractedTaskName) {
          taskNameLevel = extractedTaskName;
          console.log(`📌 Extracted Modal Active Task Name from Under Process Row: "${extractedTaskName}"`);
        }

        // Close modal safely
        for (const frame of page.frames()) {
          if (frame.isDetached()) continue;
          try {
            await frame.evaluate(() => {
              const closeBtn = document.querySelector('.modal .close, button.close, div[id*="modal"] .close, button[class*="close"]');
              if (closeBtn) closeBtn.click();
            });
          } catch (e) {}
        }
      } catch (modalErr) {
        console.warn('⚠️ Modal task level inspection skipped:', modalErr.message);
      }
    }

    const mapped = mapCSCStatusToInternal(finalRawStatus, prefixUpper, taskNameLevel);
    if (mapped.error) {
      return {
        error: true,
        status: null,
        details: mapped.details,
        rawStatus: finalRawStatus
      };
    }
    return {
      status: mapped.status,
      details: mapped.details,
      rawStatus: finalRawStatus,
      taskNameLevel,
      submissionDate: itemResult.submissionDate,
      dueDate: itemResult.dueDate
    };

  } catch (err) {
    console.error(`Error in checkJharsewaStatus for ${refNo}:`, err.message);
    if (err.message.includes('context was destroyed') || err.message.includes('Target closed') || err.message.includes('Navigation failed')) {
      console.log(`🔄 Retrying ${refNo} with forced fresh session...`);
      try {
        await getOrCreateCSCSession(true);
      } catch (rErr) {}
    }
    return {
      error: true,
      status: null,
      details: `Sync failed: ${err.message}. Please click Sync again.`
    };
  }
}

/**
 * Fast Bulk Status Sync adhering to Rule (c):
 * 1. Build list of all certificates internally and sort/group by date.
 * 2. Check current active portal date range.
 * 3. Separate certificates in-range vs out-of-range.
 * 4. FIRST sync all in-range certificates immediately without changing date filter.
 * 5. THEN group out-of-range certificates by 90-day date windows, set date filter, and sync.
 */
async function syncMultipleCertificates(certificates) {
  if (!certificates || certificates.length === 0) return [];

  console.log(`🚀 Starting Bulk CSC Batch Sync for ${certificates.length} certificates (User Rules Enforced)...`);
  const { page } = await getOrCreateCSCSession();

  // Read active portal dates
  const currentPortalDates = await page.evaluate(() => {
    const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
    const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
    return {
      from: fromInput ? fromInput.value : '',
      to: toInput ? toInput.value : ''
    };
  });

  console.log(`📍 Active Portal Date Range: From ${currentPortalDates.from} To ${currentPortalDates.to}`);

  // Partition certificates: In-Range vs Out-of-Range
  const inRangeCerts = [];
  const outRangeCerts = [];

  for (const cert of certificates) {
    if (isDateWithinPortalRange(cert.entryDate, currentPortalDates.from, currentPortalDates.to)) {
      inRangeCerts.push(cert);
    } else {
      outRangeCerts.push(cert);
    }
  }

  console.log(`📊 Partition Results: ${inRangeCerts.length} certificates in active range, ${outRangeCerts.length} out-of-range.`);

  const results = [];

  // Helper function to sync array of certificates on currently loaded portal page
  const syncCertBatchOnCurrentPage = async (certList) => {
    for (const cert of certList) {
      const cleanRef = (cert.refNo || '').trim();
      const numPart = cleanRef.includes('/') ? cleanRef.split('/').pop() : cleanRef;
      const prefixUpper = cleanRef.includes('/') ? cleanRef.split('/')[0].toUpperCase() : '';

      try {
        const itemResult = await page.evaluate((fullRef, searchNum) => {
          const searchInput = document.querySelector('input[type="search"], .dataTables_filter input, #submittedApplicationTable_filter input');
          if (searchInput) {
            searchInput.value = searchNum || fullRef;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          let rows = Array.from(document.querySelectorAll('table tbody tr'));
          if (rows.length === 0 || rows[0].innerText.includes('No matching records') || rows[0].innerText.includes('No data available')) {
            return { found: false, rawStatus: 'Not Found' };
          }

          const matchRow = rows.find(r => r.innerText.includes(fullRef)) || rows.find(r => searchNum && r.innerText.includes(searchNum));
          if (!matchRow) return { found: false, rawStatus: 'Not Found' };

          const cols = Array.from(matchRow.querySelectorAll('td'));
          if (cols.length >= 7) {
            return {
              found: true,
              rawStatus: cols[6]?.innerText.trim()
            };
          }
          return { found: false, rawStatus: matchRow.innerText.trim() };
        }, cleanRef, numPart);

        if (itemResult.found) {
          let taskNameLevel = '';
          if (itemResult.rawStatus.toUpperCase().includes('UNDER PROCESS') || itemResult.rawStatus.toUpperCase().includes('WAITING')) {
            try {
              await page.evaluate((fullRef, searchNum) => {
                let rows = Array.from(document.querySelectorAll('table tbody tr'));
                const matchRow = rows.find(r => r.innerText.includes(fullRef)) || rows.find(r => searchNum && r.innerText.includes(searchNum));
                if (matchRow) {
                  const links = Array.from(matchRow.querySelectorAll('a'));
                  if (links.length > 0) links[0].click();
                }
              }, cleanRef, numPart);

              await new Promise(r => setTimeout(r, 3500));

              for (const frame of page.frames()) {
                if (frame.isDetached()) continue;
                try {
                  const foundTask = await frame.evaluate(() => {
                    const rows = Array.from(document.querySelectorAll('table tbody tr'));
                    for (const tr of rows) {
                      const tds = Array.from(tr.querySelectorAll('td'));
                      if (tds.length >= 5) {
                        const taskName = tds[1]?.innerText.replace(/\s+/g, ' ').trim() || '';
                        const statusCell = tds[4]?.innerText.replace(/\s+/g, ' ').trim() || '';
                        if (statusCell.toUpperCase().includes('UNDER PROCESS') || statusCell.toUpperCase().includes('WAITING')) {
                          return taskName;
                        }
                      }
                    }
                    return '';
                  });
                  if (foundTask) {
                    taskNameLevel = foundTask;
                    break;
                  }
                } catch (e) {}
              }

              for (const frame of page.frames()) {
                if (frame.isDetached()) continue;
                try {
                  await frame.evaluate(() => {
                    const closeBtn = document.querySelector('.modal .close, button.close, div[id*="modal"] .close, button[class*="close"]');
                    if (closeBtn) closeBtn.click();
                  });
                } catch (e) {}
              }
            } catch (modalErr) {
              console.warn('⚠️ Bulk Modal extraction skipped:', modalErr.message);
            }
          }

          const mapped = mapCSCStatusToInternal(itemResult.rawStatus, prefixUpper, taskNameLevel);
          if (mapped.error) {
            results.push({
              certId: cert.id,
              refNo: cert.refNo,
              oldStatus: cert.currentStatus,
              newStatus: cert.currentStatus,
              error: mapped.details,
              synced: false
            });
          } else {
            results.push({
              certId: cert.id,
              refNo: cert.refNo,
              oldStatus: cert.currentStatus,
              newStatus: mapped.status,
              rawStatus: itemResult.rawStatus,
              taskNameLevel,
              synced: true
            });
          }
        } else {
          results.push({
            certId: cert.id,
            refNo: cert.refNo,
            oldStatus: cert.currentStatus,
            newStatus: cert.currentStatus,
            synced: false
          });
        }
      } catch (e) {
        results.push({
          certId: cert.id,
          refNo: cert.refNo,
          oldStatus: cert.currentStatus,
          newStatus: cert.currentStatus,
          error: e.message,
          synced: false
        });
      }
    }
  };

  // STEP 1: Sync In-Range certificates FIRST without touching portal date filter
  if (inRangeCerts.length > 0) {
    console.log(`⚡ [STEP 1] Syncing ${inRangeCerts.length} certificates within active date range...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
      const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
      if (getDataBtn) getDataBtn.click();
    });
    await new Promise(r => setTimeout(r, 4000));
    await syncCertBatchOnCurrentPage(inRangeCerts);
  }

  // STEP 2: Group Out-of-Range certificates into 90-day date windows and sync
  if (outRangeCerts.length > 0) {
    console.log(`📅 [STEP 2] Grouping & syncing ${outRangeCerts.length} out-of-range certificates...`);

    const dateMap = {};
    for (const cert of outRangeCerts) {
      const { fromDateStr, toDateStr } = getSyncDateRange(cert.entryDate);
      const key = `${fromDateStr}_${toDateStr}`;
      if (!dateMap[key]) dateMap[key] = { fromDateStr, toDateStr, certs: [] };
      dateMap[key].certs.push(cert);
    }

    for (const key of Object.keys(dateMap)) {
      const group = dateMap[key];
      console.log(`📅 Updating Portal Date Range for Out-of-Range Group (${group.certs.length} certs): ${group.fromDateStr} to ${group.toDateStr}...`);

      await page.evaluate((fDate, tDate) => {
        const fromInput = document.querySelector('input[name*="from"], input[id*="from"], input[name*="From"]');
        if (fromInput && fDate) {
          fromInput.value = fDate;
          fromInput.dispatchEvent(new Event('input', { bubbles: true }));
          fromInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const toInput = document.querySelector('input[name*="to"], input[id*="to"], input[name*="To"]');
        if (toInput && tDate) {
          toInput.value = tDate;
          toInput.dispatchEvent(new Event('input', { bubbles: true }));
          toInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
        const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
        if (getDataBtn) getDataBtn.click();
      }, group.fromDateStr, group.toDateStr);

      await new Promise(r => setTimeout(r, 4500));
      await syncCertBatchOnCurrentPage(group.certs);
    }
  }

  console.log(`✅ Bulk Sync Complete for ${certificates.length} certificates!`);
  return results;
}

/**
 * Download Certificate PDF from Jharsewa CSC portal & Send via WhatsApp
 */
async function downloadAndSendCertificatePDF(cert, customMobile = null) {
  const cleanRef = (cert.refNo || '').trim();
  const numPart = cleanRef.includes('/') ? cleanRef.split('/').pop() : cleanRef;
  const targetMobile = customMobile || cert.mobile;

  if (!targetMobile) {
    throw new Error('Mobile number is required to send PDF certificate via WhatsApp.');
  }

  console.log(`📄 Starting PDF fetch for Certificate ${cleanRef}... Target Mobile: ${targetMobile}`);
  const { page } = await getOrCreateCSCSession();

  // Ensure page is on View Submitted Applications page & close any open modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.modal .close, button.close, div[id*="modal"] .close');
    if (closeBtn) closeBtn.click();
    const viewStatusMenu = Array.from(document.querySelectorAll('a')).find(l => l.innerText && l.innerText.includes('View Submitted Application'));
    if (viewStatusMenu) viewStatusMenu.click();
  }).catch(() => null);

  await new Promise(r => setTimeout(r, 2000));

  const formattedDate = formatDateDDMMYYYY(cert.entryDate) || formatDateDDMMYYYY(new Date());

  // 1. Update From Date & To Date filter
  await page.evaluate((targetDate) => {
    if (targetDate && targetDate !== 'DEFAULT') {
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
    }
    const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
    const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
    if (getDataBtn) getDataBtn.click();
  }, formattedDate);

  await new Promise(r => setTimeout(r, 4500));
  lastSessionTime = Date.now();

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

  // 4. Download PDF to downloads dir
  const downloadsDir = path.join(__dirname, '../../public/downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadsDir,
  });

  console.log('📜 Auto-selecting English PDF output link...');
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        // Rule: Always pick English version if available
        const engLink = links.find(a => a.innerText.includes('outputcertificateEng') || a.innerText.toLowerCase().includes('english') || a.innerText.toLowerCase().includes('eng'));
        const fallback = links.find(a => a.innerText.toLowerCase().includes('output') || a.innerText.toLowerCase().includes('lrc') || a.innerText.toLowerCase().includes('certificate'));
        const target = engLink || fallback;
        if (target) target.click();
      });
    } catch (e) {}
  }

  await new Promise(r => setTimeout(r, 6000));

  // 5. Send PDF via WhatsApp
  const { sendPDFDocument } = require('./whatsapp.service');
  const downloadedFiles = fs.readdirSync(downloadsDir).filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));

  if (downloadedFiles.length > 0) {
    const latestFileName = downloadedFiles[downloadedFiles.length - 1];
    const pdfPath = path.join(downloadsDir, latestFileName);

    console.log(`✅ PDF downloaded successfully at: ${pdfPath}`);
    const whatsappResult = await sendPDFDocument(targetMobile, pdfPath, cert);
    return whatsappResult;
  } else {
    throw new Error('PDF file download timed out from portal.');
  }
}

async function forceCSCRelogin() {
  console.log('🔄 Session expiry detected! Forcing clean CSC portal relogin...');
  return await getOrCreateCSCSession(true);
}

module.exports = {
  checkJharsewaStatus,
  syncMultipleCertificates,
  getOrCreateCSCSession,
  forceCSCRelogin,
  downloadAndSendCertificatePDF
};

