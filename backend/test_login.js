const puppeteer = require('puppeteer');
const { createWorker } = require('tesseract.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

async function cleanGreenCaptchaImage(buffer) {
  try {
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (g > 100 && g > r * 1.2 && g > b * 1.2) {
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

async function testLogin() {
  console.log('🔑 Testing Jharsewa Login with ID: cscgunghasa@gmail.com...');

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const homeUrl = 'https://jharsewa.jharkhand.gov.in/';
  await page.goto(homeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Click LOGIN button on homepage or navigate to login URL
  await page.evaluate(() => {
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
    console.log(`🔑 Login Captcha Attempt ${attempts}/5...`);

    // If login modal / page is not open, open it
    const isLoginVisible = await page.evaluate(() => {
      return !!document.querySelector('input[name="username"], #username, input[type="password"]');
    });

    if (!isLoginVisible) {
      await page.evaluate(() => {
        if (typeof window.loginUrl === 'function') window.loginUrl();
      });
      await new Promise(r => setTimeout(r, 2000));
    }

    // Type Username & Password
    await page.evaluate(() => {
      const u = document.querySelector('input[name="username"], #username, input[id*="user"]');
      if (u) { u.value = 'cscgunghasa@gmail.com'; u.dispatchEvent(new Event('input', { bubbles: true })); }
      const p = document.querySelector('input[name="password"], #password, input[type="password"]');
      if (p) { p.value = 'Gattu@1994#'; p.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    // Refresh captcha if attempt > 1
    if (attempts > 1) {
      await page.evaluate(() => {
        const reloadImg = document.querySelector('img[src*="captcha"] + img, img[onclick*="captcha"], #captchaImage');
        if (reloadImg) reloadImg.click();
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    // Solve Captcha
    const captchaElement = await page.$('#captchaImage, img[src*="captcha"]');
    let captchaText = '';
    if (captchaElement) {
      const captchaBuffer = await captchaElement.screenshot();
      const cleanedBuffer = await cleanGreenCaptchaImage(captchaBuffer);
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
      const { data: { text } } = await worker.recognize(cleanedBuffer);
      await worker.terminate();

      captchaText = text.replace(/[^A-Z0-9]/gi, '').toUpperCase().trim();
      if (captchaText.length > 6) captchaText = captchaText.substring(0, 6);
      console.log(`🤖 Login Captcha Solved: "${captchaText}"`);

      await page.evaluate((val) => {
        const c = document.querySelector('input[name="captchaAnswer"], #captchaAnswer, input[id*="captcha"]');
        if (c) {
          c.value = val;
          c.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, captchaText);
    }

    // Click Login Submit
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
      const loginSub = btns.find(b => (b.value && b.value.toLowerCase().includes('login')) || (b.innerText && b.innerText.toLowerCase().includes('login')));
      if (loginSub) loginSub.click();
      else if (document.forms[0]) document.forms[0].submit();
    });

    await new Promise(r => setTimeout(r, 5000));

    // Check if logged in successfully (Dashboard / Home / Logout button present)
    const checkLogin = await page.evaluate(() => {
      const html = document.documentElement ? document.documentElement.outerHTML : '';
      const text = document.body ? document.body.innerText : '';
      const isLogged = text.includes('LOGOUT') || text.includes('Logout') || text.includes('Welcome') || text.includes('Manage Profile') || text.includes('Apply for services');
      const err = text.includes('Invalid') || text.includes('wrong characters') || text.includes('CAPTCHA');
      return { isLogged, err };
    });

    if (checkLogin.isLogged) {
      loggedIn = true;
      console.log('🎉 LOGIN SUCCESSFUL!');

      // Navigate to View Submitted Application(s)
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const viewStatusMenu = links.find(l => l.innerText && l.innerText.includes('View Status of Application'));
        if (viewStatusMenu) viewStatusMenu.click();
      });

      await new Promise(r => setTimeout(r, 1000));

      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const subMenu = links.find(l => l.innerText && l.innerText.includes('View Submitted Application'));
        if (subMenu) subMenu.click();
      });

      await new Promise(r => setTimeout(r, 4000));
      await page.screenshot({ path: path.join(publicDir, 'submitted_applications.png') });
      console.log('📸 Saved submitted applications screenshot to public/submitted_applications.png');

      // Click Get Data button
      console.log('🔍 Clicking Get Data button...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
        const getDataBtn = btns.find(b => (b.value && b.value.toUpperCase().includes('GET DATA')) || (b.innerText && b.innerText.toUpperCase().includes('GET DATA')));
        if (getDataBtn) getDataBtn.click();
      });

      await new Promise(r => setTimeout(r, 4000));

      // Target certificate for inspection: JHCBC/2026/536311 (25/07/2026)
      console.log('📅 Updating From Date & To Date to 25/07/2026 for JHCBC/2026/536311...');
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

      console.log('🔍 Clicking Delivered link / AppRef link for JHCBC/2026/536311 to see download options...');
      const clickResult = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const matchRow = rows.find(r => r.innerText.includes('536311'));
        if (matchRow) {
          const links = Array.from(matchRow.querySelectorAll('a'));
          const info = links.map(l => ({ text: l.innerText.trim(), href: l.href, onclick: l.getAttribute('onclick') }));
          // Click Delivered link or AppRef link
          const delLink = links.find(l => l.innerText.toLowerCase().includes('delivered')) || links[0];
          if (delLink) {
            delLink.click();
          }
          return { foundRow: true, links: info };
        }
        return { foundRow: false };
      });

      console.log('🔗 Link click info:', JSON.stringify(clickResult, null, 2));
      await new Promise(r => setTimeout(r, 4000));

      // Check for iframes or dynamically opened dialogs
      const popupDetails = await page.evaluate(() => {
        const frames = Array.from(document.querySelectorAll('iframe'));
        const frameInfo = frames.map(f => ({ src: f.src, id: f.id, name: f.name }));

        // Search for Output Certificate text or links across body & frames
        const allAnchors = Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.innerText.trim(),
          href: a.href,
          onclick: a.getAttribute('onclick')
        })).filter(a => a.text.toLowerCase().includes('certificate') || a.text.toLowerCase().includes('download') || a.text.toLowerCase().includes('view') || a.text.toLowerCase().includes('issued') || a.text.toLowerCase().includes('slip'));

        return { frameInfo, certificateLinks: allAnchors };
      });
      console.log('📌 Popup Details:', JSON.stringify(popupDetails, null, 2));

      // Inspect frame links for JHCOB/2026/81892
      const allFrameLinks = [];
      for (const frame of page.frames()) {
        try {
          const links = await frame.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
              text: a.innerText.trim(),
              href: a.href,
              onclick: a.getAttribute('onclick')
            })).filter(a => a.text.length > 0);
          });
          allFrameLinks.push(...links);
        } catch (e) {}
      }
      console.log('📌 JHCOB Modal All Links:', JSON.stringify(allFrameLinks, null, 2));

      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: path.join(publicDir, 'download_page_result.png'), fullPage: true });
      console.log('📸 Saved download page screenshot to public/download_page_result.png');
    } else {
      console.warn(`⚠️ Login attempt ${attempts} failed: ${checkLogin.err ? 'Captcha/Auth Error' : 'Retrying...'}`);
    }
  }

  // Screenshot after login
  await page.screenshot({ path: path.join(publicDir, 'login_result.png') });
  console.log('📸 Saved login screenshot to public/login_result.png');

  await browser.close();
  process.exit(0);
}

testLogin();
