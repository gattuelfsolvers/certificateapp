const puppeteer = require('puppeteer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Get Captcha API Key from database settings or environment variables
 */
async function getCaptchaApiKey() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'CAPTCHA_API_KEY' } });
    if (setting && setting.value && setting.value.trim()) {
      return setting.value.trim();
    }
  } catch (e) {}
  return process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY || process.env.CAPSOLVER_API_KEY || null;
}

/**
 * Solve Google reCAPTCHA v2 via 2Captcha / CapSolver API automatically
 */
async function solveReCaptchaV2(page, pageUrl, apiKey) {
  if (!apiKey) {
    console.warn('⚠️ CAPTCHA_API_KEY is not set. Please set CAPTCHA_API_KEY in Settings or .env');
    return false;
  }

  console.log('🤖 Extracting Google reCAPTCHA v2 SiteKey from Protean page...');

  // Extract sitekey from DOM
  const siteKey = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[src*="recaptcha"]');
    if (iframe && iframe.src) {
      const match = iframe.src.match(/k=([^&]+)/);
      if (match) return match[1];
    }
    const recaptchaDiv = document.querySelector('.g-recaptcha, div[data-sitekey]');
    if (recaptchaDiv) return recaptchaDiv.getAttribute('data-sitekey');
    return null;
  });

  if (!siteKey) {
    console.warn('⚠️ reCAPTCHA sitekey not found on page.');
    return false;
  }

  console.log(`🔑 SiteKey extracted: ${siteKey}`);
  console.log('🚀 Sending reCAPTCHA v2 task to 2Captcha / CapSolver API...');

  try {
    // 1. Submit task to 2Captcha API
    const inUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
    const inRes = await axios.get(inUrl);

    if (!inRes.data || inRes.data.status !== 1) {
      console.warn('⚠️ 2Captcha task submission failed:', inRes.data?.request || 'Unknown error');
      return false;
    }

    const taskId = inRes.data.request;
    console.log(`⏳ Captcha task submitted. Task ID: ${taskId}. Waiting for solution token...`);

    // 2. Poll for solution token
    const fetchUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`;
    let solvedToken = null;
    let pollAttempts = 0;

    while (pollAttempts < 24 && !solvedToken) {
      pollAttempts++;
      await new Promise(r => setTimeout(r, 5000));

      const res = await axios.get(fetchUrl);
      if (res.data && res.data.status === 1) {
        solvedToken = res.data.request;
        console.log('🎉 Google reCAPTCHA v2 solved successfully!');
        break;
      } else if (res.data && res.data.request !== 'CAPCHA_NOT_READY') {
        console.warn('⚠️ Captcha solver returned error:', res.data.request);
        break;
      }
      console.log(`   --> Waiting for captcha token... (Attempt ${pollAttempts}/24)`);
    }

    if (!solvedToken) return false;

    // 3. Inject solved g-recaptcha-response token into page DOM
    await page.evaluate((token) => {
      const gEl = document.getElementById('g-recaptcha-response') || document.querySelector('textarea[name="g-recaptcha-response"]');
      if (gEl) {
        gEl.style.display = 'block';
        gEl.value = token;
        gEl.innerHTML = token;
      }
      
      // Execute grecaptcha callback if defined
      if (typeof ___grecaptcha_cfg !== 'undefined' && ___grecaptcha_cfg.clients) {
        for (const cid of Object.keys(___grecaptcha_cfg.clients)) {
          const client = ___grecaptcha_cfg.clients[cid];
          for (const k of Object.keys(client)) {
            if (client[k] && typeof client[k].callback === 'function') {
              client[k].callback(token);
            }
          }
        }
      }
    }, solvedToken);

    return true;

  } catch (err) {
    console.error('Error during automated captcha solving:', err.message);
    return false;
  }
}

/**
 * PAN Engine 2.0 - Protean / NSDL 15-Digit Acknowledgment Status Tracking
 * 
 * @param {string} ackNo - 15-digit NSDL Acknowledgment Number
 * @param {string} appType - 'PAN_NEW' or 'PAN_CORRECTION'
 */
async function checkNSDLPanStatus(ackNo, appType = 'PAN_NEW') {
  if (!ackNo) throw new Error('Valid 15-digit NSDL Acknowledgment Number is required.');
  
  const cleanAck = ackNo.trim().replace(/\D/g, '');
  if (cleanAck.length !== 15) {
    throw new Error(`Invalid Acknowledgment Number '${ackNo}'. Must be exactly 15 digits.`);
  }

  console.log(`======================================================`);
  console.log(`💳 [PAN Engine 2.0] Tracking PAN Status for Ack No: ${cleanAck}...`);
  console.log(`======================================================`);

  const apiKey = await getCaptchaApiKey();

  let browser = null;
  try {
    const extensionPath = path.resolve(__dirname, '../../extensions/buster');
    const userDataDir = path.resolve(__dirname, '../../puppeteer_profile');

    browser = await puppeteer.launch({
      headless: false,
      protocolTimeout: 300000,
      userDataDir: userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    page.setDefaultNavigationTimeout(60000);

    const nsdlUrls = [
      'https://tin.tin.proteantech.in/pantan/StatusTrack.html',
      'https://reservices.tin.nsdl.com/cgi-bin/tinpanning/statusTrack.cgi',
      'https://tin.tin.nsdl.com/pantan/StatusTrack.html'
    ];
    let nsdlUrl = nsdlUrls[0];
    console.log(`[Step 1/4] Navigating to NSDL / Protean Status Track portal (${nsdlUrl})...`);
    
    let loadedPage = false;
    for (const url of nsdlUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        nsdlUrl = url;
        loadedPage = true;
        break;
      } catch (e) {
        console.warn(`⚠️ URL '${url}' unreachable, trying fallback...`);
      }
    }

    if (!loadedPage) {
      throw new Error('Protean NSDL PAN status track portal is currently unreachable.');
    }

    let attempts = 0;
    let statusResult = null;

    while (attempts < 3 && !statusResult) {
      attempts++;
      console.log(`[Step 2/4] Form Submission Attempt ${attempts}/3...`);

      // Select Application Type: PAN - New / Change Request
      const selectHandle = await page.$('select[name="application_type"], select[id*="app"]').catch(() => null);
      if (selectHandle) {
        await selectHandle.select('N').catch(() => null);
      }

      // Select radio button for ACKNOWLEDGEMENT NUMBER
      const radioHandle = await page.$('input[type="radio"][value*="ACK"], input[type="radio"][name*="ack"]').catch(() => null);
      if (radioHandle) {
        await radioHandle.click().catch(() => null);
      }

      // Fill Acknowledgment Number
      const inputHandle = await page.$('input[name="stage2_ack_no"], input[name*="ack"], input[id*="ack"]').catch(() => null);
      if (inputHandle) {
        await inputHandle.click({ clickCount: 3 }).catch(() => null);
        await inputHandle.type(cleanAck, { delay: 50 }).catch(() => null);
      }

      // reCAPTCHA v2 handling via Buster Extension auto-solver
      console.log('🤖 Looking for Google reCAPTCHA iframe and clicking checkbox...');
      try {
        const frame = page.frames().find(f => f.url().includes('api2/anchor') || f.url().includes('recaptcha'));
        if (frame) {
          const evalPromise = frame.evaluate(() => {
            const el = document.getElementById('recaptcha-anchor') || document.querySelector('.recaptcha-checkbox-border');
            if (el) el.click();
          });
          await Promise.race([evalPromise, new Promise(r => setTimeout(r, 3000))]).catch(() => null);
          console.log('✅ reCAPTCHA checkbox clicked!');
          await new Promise(r => setTimeout(r, 2000));

          // Trigger Buster solver button inside bframe iframe
          const bframe = page.frames().find(f => f.url().includes('api2/bframe') || f.url().includes('bframe'));
          if (bframe) {
            console.log('🎯 Buster bframe detected! Triggering Speech Solver button...');
            await bframe.evaluate(() => {
              const busterBtn = document.querySelector('.help-button-holder, .buster-button, button#solver-button, .rc-button-audio');
              if (busterBtn) busterBtn.click();
            }).catch(() => null);
            await new Promise(r => setTimeout(r, 8000));
          }
        }
      } catch (captchaErr) {
        console.warn('⚠️ reCAPTCHA interaction note:', captchaErr.message);
      }

      // Fallback: If API key present, solve via 2Captcha / CapSolver
      if (apiKey) {
        await solveReCaptchaV2(page, nsdlUrl, apiKey);
      }

      // Submit Form
      const submitBtn = await page.$('input[type="submit"], input[value*="Submit"], button[type="submit"]').catch(() => null);
      if (submitBtn) {
        await submitBtn.click().catch(() => null);
      }

      await new Promise(r => setTimeout(r, 5000));

      // Inspect Result Page (Safe evaluation with 5s timeout)
      const evalResultPromise = page.evaluate((ack) => {
        const bodyText = document.body ? document.body.innerText : '';
        if (bodyText.includes('Invalid Captcha') || bodyText.includes('wrong code') || bodyText.includes('Select captcha')) {
          return null;
        }

        const rows = Array.from(document.querySelectorAll('table tbody tr, table tr'));
        let name = '';
        let category = '';
        let rawStatus = '';
        let panNumber = '';

        for (const r of rows) {
          const text = r.innerText;
          if (text.includes('Name')) {
            const parts = text.split(':');
            if (parts.length > 1) name = parts[1].trim();
          }
          if (text.includes('Category')) {
            const parts = text.split(':');
            if (parts.length > 1) category = parts[1].trim();
          }
          if (text.includes('Status')) {
            const parts = text.split(':');
            if (parts.length > 1) rawStatus = parts[1].trim();
          }
          if (text.includes('Permanent Account Number') || text.includes('PAN')) {
            const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
            if (panMatch) panNumber = panMatch[0];
          }
        }

        if (!rawStatus && bodyText.includes(ack)) {
          rawStatus = bodyText;
        }

        if (rawStatus || bodyText.includes('Acknowledgment Number')) {
          return {
            found: true,
            name,
            category,
            rawStatus: rawStatus || 'Application Processed',
            panNumber,
            fullText: bodyText.substring(0, 500)
          };
        }

        return null;
      }, cleanAck);

      statusResult = await Promise.race([
        evalResultPromise,
        new Promise(r => setTimeout(() => r(null), 5000))
      ]).catch(() => null);
    }

    await browser.close();
    browser = null;

    if (!statusResult) {
      return {
        success: false,
        ackNo: cleanAck,
        currentStatus: 'PENDING',
        requiresApiKey: !apiKey,
        message: apiKey 
          ? 'PAN Engine 2.0: Portal response timed out or captcha error.' 
          : 'PAN Engine 2.0: Google reCAPTCHA API Key required. Please set CAPTCHA_API_KEY in Settings or .env file.'
      };
    }

    // Map Raw Status to System Internal Status
    let mappedStatus = 'UNDER_PROCESS';
    const statusUpper = statusResult.rawStatus.toUpperCase();

    if (statusUpper.includes('DISPATCH') || statusUpper.includes('POST') || statusUpper.includes('DELIVERED')) {
      mappedStatus = 'DISPATCHED';
    } else if (statusUpper.includes('ALLOTTED') || statusUpper.includes('GENERATED') || statusUpper.includes('ISSUED')) {
      mappedStatus = 'DELIVERED';
    } else if (statusUpper.includes('REJECT') || statusUpper.includes('INCOMPLETE') || statusUpper.includes('CANCEL')) {
      mappedStatus = 'REJECTED';
    } else if (statusUpper.includes('UNDER PROCESS') || statusUpper.includes('RECEIVED')) {
      mappedStatus = 'UNDER_PROCESS';
    }

    // Sync to Database if record exists
    try {
      const existingPan = await prisma.panApplication.findUnique({ where: { ackNo: cleanAck } });
      if (existingPan) {
        await prisma.panApplication.update({
          where: { id: existingPan.id },
          data: {
            currentStatus: mappedStatus,
            statusDetails: statusResult.rawStatus,
            panNumber: statusResult.panNumber || existingPan.panNumber,
            lastSyncedAt: new Date()
          }
        });

        if (existingPan.currentStatus !== mappedStatus) {
          await prisma.panStatusLog.create({
            data: {
              panApplicationId: existingPan.id,
              oldStatus: existingPan.currentStatus,
              newStatus: mappedStatus,
              remarks: statusResult.rawStatus
            }
          });
        }
      }
    } catch (dbErr) {
      console.warn('⚠️ DB Sync skipped:', dbErr.message);
    }

    console.log(`======================================================`);
    console.log(`🎉 [PAN Engine 2.0] SUCCESS! Tracked Ack: ${cleanAck} | Status: ${mappedStatus}`);
    console.log(`======================================================`);

    return {
      success: true,
      ackNo: cleanAck,
      applicantName: statusResult.name,
      currentStatus: mappedStatus,
      statusDetails: statusResult.rawStatus,
      panNumber: statusResult.panNumber,
      message: `PAN Engine 2.0: Successfully tracked status for Ack No ${cleanAck}`
    };

  } catch (err) {
    if (browser) await browser.close().catch(() => null);
    console.error(`PAN Engine 2.0 Error for Ack ${cleanAck}:`, err.message);
    return {
      success: false,
      ackNo: cleanAck,
      error: err.message,
      message: `PAN Engine 2.0 Tracking failed: ${err.message}`
    };
  }
}

module.exports = {
  checkNSDLPanStatus,
  solveReCaptchaV2
};
