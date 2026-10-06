export const CERTIFICATE_CATEGORIES = [
  {
    id: 'income',
    name: 'INCOME',
    title: 'Income Certificate (आय प्रमाण पत्र)',
    icon: 'FileText',
    color: 'emerald',
    subServices: [
      { code: 'JHIC', name: 'INC (Income Certificate)', prefix: 'JHIC/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'caste',
    name: 'CASTE',
    title: 'Caste Certificate (जाति प्रमाण पत्र)',
    icon: 'Shield',
    color: 'purple',
    subServices: [
      { code: 'JHCBC', name: 'JHCBC (Caste Certificate BC-1 / BC-2)', prefix: 'JHCBC/2026/', defaultFee: 100 },
      { code: 'JHNBC', name: 'JHNBC (Non-Creamy Layer Caste Certificate)- CO Level', prefix: 'JHNBC/2026/', defaultFee: 100 },
      { code: 'JHCSC', name: 'JHCSC (Scheduled Caste Certificate SC)- CO Level', prefix: 'JHCSC/2026/', defaultFee: 100 },
      { code: 'JHCST', name: 'JHCST (Scheduled Tribe Certificate ST)- Co Level', prefix: 'JHCST/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'residential',
    name: 'RESIDENTIAL',
    title: 'Residential Certificate (आवासीय प्रमाण पत्र)',
    icon: 'Home',
    color: 'blue',
    subServices: [
      { code: 'JHLRCO', name: 'JHLRCO (Local Resident Certificate CO)- CO Level', prefix: 'JHLRCO/2026/', defaultFee: 100 },
      { code: 'JHRES', name: 'JHRES (Residential Certificate)- SDO Level', prefix: 'JHRES/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'obc',
    name: 'OBC',
    title: 'OBC Certificate (अन्य पिछड़ा वर्ग)',
    icon: 'Award',
    color: 'fuchsia',
    subServices: [
      { code: 'JHCOB', name: 'JHCOB (OBC Central Format Certificate)- CO Level', prefix: 'JHCOB/2026/', defaultFee: 100 },
      { code: 'JHOBCH', name: 'JHOBCH (OBC State Format Certificate)- SDO/DC Level', prefix: 'JHOBCH/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'ews',
    name: 'EWS',
    title: 'EWS Certificate (ई.डब्ल्यू.एस. प्रमाण पत्र)',
    icon: 'CheckCircle',
    color: 'teal',
    subServices: [
      { code: 'JHEWS', name: 'JHEWS (EWS Central Certificate)- Co level', prefix: 'JHEWS/2026/', defaultFee: 100 },
      { code: 'JHEWSH', name: 'JHEWSH (EWS State Certificate)- SDO/DC Level', prefix: 'JHEWSH/2026/', defaultFee: 100 }
    ]
  },
  {
    id: 'marriage',
    name: 'MARRIAGE',
    title: 'Marriage Certificate (विवाह पंजीकरण)',
    icon: 'Heart',
    color: 'rose',
    subServices: [
      { code: 'JHMGR', name: 'Marriage Registration Certificate (JHMGR)', prefix: 'JHMGR/2026/', defaultFee: 200 }
    ]
  },
  {
    id: 'pancard',
    name: 'PAN CARD',
    title: 'PAN Card Services (पैन कार्ड)',
    icon: 'CreditCard',
    color: 'amber',
    subServices: [
      { code: 'PANNEW', name: 'New PAN Card Application (PANNEW)', prefix: 'PANNEW/2026/', defaultFee: 200 },
      { code: 'PANUPD', name: 'PAN Card Correction / Update (PANUPD)', prefix: 'PANUPD/2026/', defaultFee: 200 }
    ]
  }
];
