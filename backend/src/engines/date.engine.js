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
  const entryDate = parseDateObject(entryDateInput);

  const fromDate = new Date(entryDate.getTime());
  fromDate.setDate(fromDate.getDate() - 5); // 5 days prior margin

  const toDate = new Date(fromDate.getTime());
  toDate.setDate(toDate.getDate() + 89); // Max 90 days portal window

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
  
  const fromDateObj = new Date(parseInt(fromParts[2]), parseInt(fromParts[1]) - 1, parseInt(fromParts[0]));
  const toDateObj = new Date(parseInt(toParts[2]), parseInt(toParts[1]) - 1, parseInt(toParts[0]), 23, 59, 59);

  return entryObj >= fromDateObj && entryObj <= toDateObj;
}

module.exports = {
  formatDateDDMMYYYY,
  parseDateObject,
  getSyncDateRange,
  isDateWithinPortalRange
};

