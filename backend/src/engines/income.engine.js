/**
 * 💼 IncomeEngine - Dedicated JHIC Certificate Status Sync Engine
 */
const { getSyncDateRange, isDateWithinPortalRange } = require('./date.engine');
const { mapCSCStatusToInternal } = require('./logic.engine');

async function processIncomeCertificate(refNo, entryDateInput, getCSCSession) {
  if (!refNo) throw new Error('Reference Number is required');
  const cleanRef = refNo.trim();
  const numPart = cleanRef.includes('/') ? cleanRef.split('/').pop() : cleanRef;

  const { page } = await getCSCSession();

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
    console.log(`⚡ [IncomeEngine] Entry date for ${cleanRef} is ALREADY inside active portal range (${currentPortalDates.from} to ${currentPortalDates.to}).`);
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
    console.log(`📅 [IncomeEngine] Updating portal date range to: ${fromDateStr} to ${toDateStr}...`);

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

  // Search in DataTables input by full ref first, then fallback to last digits numPart
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
      if (searchInput && fullRef) {
        searchInput.value = fullRef;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        rows = Array.from(document.querySelectorAll('table tbody tr'));
      }
    }

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
      details: `Sync Failed: Income Certificate reference number '${refNo}' not found on Jharsewa portal.`
    };
  }

  let taskNameLevel = '';
  const isMainUnderProcess = itemResult.rawStatus.toUpperCase().includes('UNDER PROCESS');
  if (isMainUnderProcess) {
    try {
      await page.evaluate((fullRef, searchNum) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const matchRow = rows.find(r => r.innerText.includes(fullRef)) || rows.find(r => searchNum && r.innerText.includes(searchNum));
        if (matchRow) {
          const links = Array.from(matchRow.querySelectorAll('a'));
          if (links.length > 0) links[0].click();
        }
      }, cleanRef, numPart);

      await new Promise(r => setTimeout(r, 3500));

      // Extract active task level strictly from the row where Status column is Under Process / Waiting
      const extractTask = () => {
        const rows = Array.from(document.querySelectorAll('table tbody tr, .modal table tbody tr, iframe table tbody tr'));
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
      };

      let foundTask = await page.evaluate(extractTask);
      if (!foundTask) {
        for (const frame of page.frames()) {
          if (frame.isDetached()) continue;
          try {
            foundTask = await frame.evaluate(extractTask);
            if (foundTask) break;
          } catch (e) {}
        }
      }

      if (foundTask) {
        taskNameLevel = foundTask;
        console.log(`📌 Extracted Modal Active Task Name (Under Process Row): "${foundTask}"`);
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
    } catch (modalErr) {}
  }

  const mapped = mapCSCStatusToInternal(itemResult.rawStatus, 'JHIC', taskNameLevel);
  if (mapped.error) {
    return {
      error: true,
      status: null,
      details: mapped.details,
      rawStatus: itemResult.rawStatus
    };
  }

  return {
    status: mapped.status,
    details: mapped.details,
    rawStatus: itemResult.rawStatus,
    taskNameLevel,
    submissionDate: itemResult.submissionDate,
    dueDate: itemResult.dueDate
  };
}

module.exports = {
  processIncomeCertificate
};

