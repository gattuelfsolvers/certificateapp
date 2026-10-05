export const CERTIFICATE_CATEGORIES = [
  {
    id: 'income',
    name: 'INCOME',
    title: 'Income Certificate (आय प्रमाण पत्र)',
    icon: 'FileText',
    color: 'emerald',
    subServices: [
      { code: 'JHIC', name: 'Income Certificate (JHIC)', prefix: 'JHIC/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'caste',
    name: 'CASTE',
    title: 'Caste Certificate (जाति प्रमाण पत्र)',
    icon: 'Shield',
    color: 'purple',
    subServices: [
      { code: 'JHCBC', name: 'Caste Certificate BC-1 / BC-2 (JHCBC)', prefix: 'JHCBC/2026/', defaultFee: 100 },
      { code: 'JHNBC', name: 'Non-Creamy Layer Certificate (JHNBC)', prefix: 'JHNBC/2026/', defaultFee: 100 },
      { code: 'JHCSC', name: 'Scheduled Caste Certificate SC (JHCSC)', prefix: 'JHCSC/2026/', defaultFee: 100 },
      { code: 'JHCST', name: 'Scheduled Tribe Certificate ST (JHCST)', prefix: 'JHCST/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'residential',
    name: 'RESIDENTIAL',
    title: 'Residential Certificate (आवासीय प्रमाण पत्र)',
    icon: 'Home',
    color: 'blue',
    subServices: [
      { code: 'JHLRCO', name: 'Local Resident Certificate CO (JHLRCO)', prefix: 'JHLRCO/2026/', defaultFee: 100 },
      { code: 'JHRC', name: 'Residential Certificate (JHRC)', prefix: 'JHRC/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'obc',
    name: 'OBC',
    title: 'OBC Certificate (अन्य पिछड़ा वर्ग)',
    icon: 'Award',
    color: 'fuchsia',
    subServices: [
      { code: 'JHCOB', name: 'OBC Central Format Certificate (JHCOB)', prefix: 'JHCOB/2026/', defaultFee: 100 },
      { code: 'JHOBCH', name: 'OBC State Format Certificate (JHOBCH)', prefix: 'JHOBCH/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'ews',
    name: 'EWS',
    title: 'EWS Certificate (ई.डब्ल्यू.एस. प्रमाण पत्र)',
    icon: 'CheckCircle',
    color: 'teal',
    subServices: [
      { code: 'JHEWS', name: 'EWS Central Certificate (JHEWS)', prefix: 'JHEWS/2026/', defaultFee: 100 },
      { code: 'JHEWSH', name: 'EWS State Certificate (JHEWSH)', prefix: 'JHEWSH/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'marriage',
    name: 'MARRIAGE',
    title: 'Marriage Certificate (विवाह पंजीकरण)',
    icon: 'Heart',
    color: 'rose',
    subServices: [
      { code: 'JHMGR', name: 'Marriage Registration Certificate (JHMGR)', prefix: 'JHMGR/2026/', defaultFee: 150 }
    ]
  },
  {
    id: 'pancard',
    name: 'PAN CARD',
    title: 'PAN Card Services (पैन कार्ड)',
    icon: 'CreditCard',
    color: 'amber',
    subServices: [
      { code: 'PANNEW', name: 'New PAN Card Application (PANNEW)', prefix: 'PANNEW/2026/', defaultFee: 120 },
      { code: 'PANUPD', name: 'PAN Card Correction / Update (PANUPD)', prefix: 'PANUPD/2026/', defaultFee: 120 }
    ]
  }
];
