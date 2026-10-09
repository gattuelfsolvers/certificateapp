/**
 * 📅 DateEngine - Isolated Strict Date Parser Engine
 * Guarantees DD/MM/YYYY format across the entire application.
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
        // YYYY/MM/DD
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY
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

function parseDateObject(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.split('T')[0].trim().replace(/-/g, '/');
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (parts[2].length === 4) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
  }
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getSyncDateRange(entryDateInput) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const entryDate = parseDateObject(entryDateInput);

  // If entryDate is within last 89 days from today, range is: (today - 89 days) to today
  const minCurrentWindowDate = new Date(today.getTime());
  minCurrentWindowDate.setDate(minCurrentWindowDate.getDate() - 89);
  minCurrentWindowDate.setHours(0, 0, 0, 0);

  if (entryDate >= minCurrentWindowDate && entryDate <= today) {
    return {
      fromDateStr: formatDateDDMMYYYY(minCurrentWindowDate),
      toDateStr: formatDateDDMMYYYY(today),
      fromDateObj: minCurrentWindowDate,
      toDateObj: today
    };
  }

  // Otherwise, construct a strict 90-day window covering entryDate (entryDate - 5 days to entryDate + 84 days)
  const fromDate = new Date(entryDate.getTime());
  fromDate.setDate(fromDate.getDate() - 5);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(fromDate.getTime());
  toDate.setDate(toDate.getDate() + 89);
  toDate.setHours(23, 59, 59, 999);

  const finalToDate = toDate > today ? today : toDate;

  return {
    fromDateStr: formatDateDDMMYYYY(fromDate),
    toDateStr: formatDateDDMMYYYY(finalToDate),
    fromDateObj: fromDate,
    toDateObj: finalToDate
  };
}

function isDateWithinPortalRange(entryDateInput, portalFromStr, portalToStr) {
  if (!entryDateInput || !portalFromStr || !portalToStr) return false;
  const entryObj = parseDateObject(entryDateInput);
  
  const fromParts = portalFromStr.split('/');
  const toParts = portalToStr.split('/');
  
  if (fromParts.length !== 3 || toParts.length !== 3) return false;
  
  const fromDateObj = new Date(parseInt(fromParts[2]), parseInt(fromParts[1]) - 1, parseInt(fromParts[0]), 0, 0, 0);
  const toDateObj = new Date(parseInt(toParts[2]), parseInt(toParts[1]) - 1, parseInt(toParts[0]), 23, 59, 59);

  return entryObj >= fromDateObj && entryObj <= toDateObj;
}

/**
 * 🎯 Group list of certificates into optimal 90-day date buckets
 * Bucket 0: Current 90-day window (today - 89 days to today)
 * Older Buckets: 90-day chunks based on entryDate descending
 */
function groupCertificatesBy90DayWindows(certificates = []) {
  if (!certificates || certificates.length === 0) return [];

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const currentFrom = new Date(today.getTime());
  currentFrom.setDate(currentFrom.getDate() - 89);
  currentFrom.setHours(0, 0, 0, 0);

  const currentBatch = {
    fromDateStr: formatDateDDMMYYYY(currentFrom),
    toDateStr: formatDateDDMMYYYY(today),
    fromDateObj: currentFrom,
    toDateObj: today,
    isCurrentWindow: true,
    certificates: []
  };

  const olderCerts = [];

  for (const cert of certificates) {
    const d = parseDateObject(cert.entryDate);
    if (d >= currentFrom && d <= today) {
      currentBatch.certificates.push(cert);
    } else {
      olderCerts.push(cert);
    }
  }

  const batches = [];
  if (currentBatch.certificates.length > 0) {
    batches.push(currentBatch);
  }

  // Sort older certificates descending by entry date
  olderCerts.sort((a, b) => parseDateObject(b.entryDate) - parseDateObject(a.entryDate));

  // Partition older certs into 90-day chunks
  for (const cert of olderCerts) {
    const certDate = parseDateObject(cert.entryDate);

    // Find if already fits into an existing older batch
    let matchedBatch = batches.find(b => !b.isCurrentWindow && certDate >= b.fromDateObj && certDate <= b.toDateObj);

    if (!matchedBatch) {
      // Create new batch with max 90 days window
      // ToDate is certDate + 5 days (bounded by today), FromDate is ToDate - 89 days
      const bTo = new Date(certDate.getTime());
      bTo.setDate(bTo.getDate() + 5);
      bTo.setHours(23, 59, 59, 999);
      const finalBTo = bTo > today ? today : bTo;

      const bFrom = new Date(finalBTo.getTime());
      bFrom.setDate(bFrom.getDate() - 89);
      bFrom.setHours(0, 0, 0, 0);

      matchedBatch = {
        fromDateStr: formatDateDDMMYYYY(bFrom),
        toDateStr: formatDateDDMMYYYY(finalBTo),
        fromDateObj: bFrom,
        toDateObj: finalBTo,
        isCurrentWindow: false,
        certificates: []
      };
      batches.push(matchedBatch);
    }

    matchedBatch.certificates.push(cert);
  }

  return batches;
}

module.exports = {
  formatDateDDMMYYYY,
  parseDateObject,
  getSyncDateRange,
  isDateWithinPortalRange,
  groupCertificatesBy90DayWindows
};

