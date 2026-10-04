/**
 * ⚙️ LogicEngine - Core Business Logic & Status Mapping Engine
 */

function mapCSCStatusToInternal(rawStatus, prefixUpper = '', taskNameLevel = '') {
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

  // Default Under process fallback: Return CO_UNDER_PROCESS / UNDER_PROCESS instead of failing
  if (statusUpper.includes('UNDER PROCESS') || statusUpper.includes('PROCESS')) {
    return { status: 'CO_UNDER_PROCESS', details: `Application status verified: Under Process` };
  }

  return { 
    error: true,
    status: null, 
    details: `Sync Failed: Unable to determine status for "${rawStatus}". Status left unchanged.` 
  };
}

module.exports = {
  mapCSCStatusToInternal
};

