const express = require('express');
const router = express.Router();
const prisma = require('../db');

const DEFAULT_TEMPLATES = [
  {
    templateKey: 'INITIAL_RECEIPT',
    title: 'आवेदन पंजीयन रसीद (Initial Receipt)',
    category: 'RECEIPT',
    messageText: `📄 *अपना डिजिटल हब* 📄
------------------------------------
*आवेदन पंजीयन रसीद*

आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*
दिनांक: {entryDate}
वर्तमान स्थिति: *{currentStatus}*{duesLine}

------------------------------------
आपका आवेदन सफलतापूर्वक दर्ज कर लिया गया है। स्थिति अपडेट होने पर आपको सूचित कर दिया जाएगा।
धन्यवाद!`
  },
  {
    templateKey: 'BULK_RECEIPT',
    title: 'एक साथ multiple पंजीयन रसीद (Bulk Receipt)',
    category: 'RECEIPT',
    messageText: `📄 *अपना डिजिटल हब* 📄
------------------------------------
*आवेदन पंजीयन रसीद ({totalCount} प्रमाणपत्र)*

आवेदक का नाम: *{applicantName}*
दिनांक: {entryDate}

{certListLines}{duesLine}

------------------------------------
आपकी सभी {totalCount} आवेदन रसीदें सफलतापूर्वक दर्ज कर ली गई हैं। स्थिति अपडेट होने पर आपको सूचित कर दिया जाएगा।
धन्यवाद!`
  },
  {
    templateKey: 'STATUS_INITIATED',
    title: 'Status Update - Initiated (सबमिट हुआ)',
    category: 'STATUS_UPDATE',
    messageText: `📝 *अपना डिजिटल हब - स्थिति अपडेट* 📝
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *आवेदन सबमिट कर दिया गया है (Initiated)*

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_UNDER_PROCESS',
    title: 'Status Update - General Under Process (प्रक्रिया में)',
    category: 'STATUS_UPDATE',
    messageText: `⏳ *अपना डिजिटल हब - स्थिति अपडेट* ⏳
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *प्रक्रिया में (UNDER PROCESS)*

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_CI_UNDER_PROCESS',
    title: 'Status Update - Circle Inspector Under Process',
    category: 'STATUS_UPDATE',
    messageText: `⏳ *अपना डिजिटल हब - स्थिति अपडेट* ⏳
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *सर्किल इंस्पेक्टर स्तर पर प्रक्रिया में (CI - Under Process)*

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_CI_WAITING',
    title: 'Status Update - Circle Inspector Waiting (दस्तावेज़ मांग)',
    category: 'STATUS_UPDATE',
    messageText: `⚠️ *अपना डिजिटल हब - स्थिति अपडेट* ⚠️
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *सर्किल इंस्पेक्टर - आवेदक की प्रतिक्रिया की प्रतीक्षा में (CI - Waiting for Applicant Response)*

आपके आवेदन पर अधिकारी द्वारा जानकारी/दस्तावेज़ की मांग की गई है। कृपया सेंटर से संपर्क करें।

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_CO_UNDER_PROCESS',
    title: 'Status Update - Circle Officer Under Process',
    category: 'STATUS_UPDATE',
    messageText: `⏳ *अपना डिजिटल हब - स्थिति अपडेट* ⏳
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *अंचलाधिकारी स्तर पर प्रक्रिया में (Circle Officer - Under Process)*

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_CO_WAITING',
    title: 'Status Update - Circle Officer Waiting (दस्तावेज़ मांग)',
    category: 'STATUS_UPDATE',
    messageText: `⚠️ *अपना डिजिटल हब - स्थिति अपडेट* ⚠️
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *अंचलाधिकारी - आवेदक की प्रतिक्रिया की प्रतीक्षा में (Circle Officer - Waiting for Applicant Response)*

आपके आवेदन पर अधिकारी द्वारा जानकारी/दस्तावेज़ की मांग की गई है। कृपया सेंटर से संपर्क करें।

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_SDO_UNDER_PROCESS',
    title: 'Status Update - SDO Under Process',
    category: 'STATUS_UPDATE',
    messageText: `⏳ *अपना डिजिटल हब - स्थिति अपडेट* ⏳
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *अनुमंडल पदाधिकारी स्तर पर प्रक्रिया में (SDO - Under Process)*

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_DELIVERED',
    title: 'Status Update - Circle Officer Delivered (निर्गत/बन गया)',
    category: 'STATUS_UPDATE',
    messageText: `🎉 *अपना डिजिटल हब - स्थिति अपडेट* 🎉
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *अंचलाधिकारी स्तर से निर्गत (Circle Officer - Delivered)*

आपका प्रमाणपत्र बन चुका है, कृपया सेंटर से संपर्क करके प्राप्त करें।

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_SDO_DELIVERED',
    title: 'Status Update - SDO Delivered (निर्गत/बन गया)',
    category: 'STATUS_UPDATE',
    messageText: `🎉 *अपना डिजिटल हब - स्थिति अपडेट* 🎉
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *अनुमंडल पदाधिकारी स्तर से निर्गत (SDO - Delivered)*

आपका प्रमाणपत्र बन चुका है, कृपया सेंटर से संपर्क करके प्राप्त करें।

धन्यवाद!`
  },
  {
    templateKey: 'STATUS_REJECTED',
    title: 'Status Update - Rejected (निरस्त)',
    category: 'STATUS_UPDATE',
    messageText: `❌ *अपना डिजिटल हब - स्थिति अपडेट* ❌
------------------------------------
आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *निरस्त (REJECTED)*

आपका आवेदन निरस्त कर दिया गया है। अधिक जानकारी के लिए सेंटर से संपर्क करें।

धन्यवाद!`
  },
  {
    templateKey: 'PDF_CAPTION',
    title: 'PDF Certificate Document Caption (PDF फाइल मैसेज)',
    category: 'PDF_DISPATCH',
    messageText: `📄 *अपना डिजिटल हब* 📄
------------------------------------
*प्रमाणपत्र (Certificate PDF)*

आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

आपका प्रमाणपत्र सफलतापूर्वक पोर्टल से डाउनलोड कर आपको भेजा जा रहा है।
धन्यवाद!`
  }
];

// Helper to seed missing templates
async function ensureTemplatesSeeded() {
  for (const tpl of DEFAULT_TEMPLATES) {
    const existing = await prisma.whatsAppTemplate.findUnique({ where: { templateKey: tpl.templateKey } });
    if (!existing) {
      await prisma.whatsAppTemplate.create({
        data: {
          templateKey: tpl.templateKey,
          title: tpl.title,
          category: tpl.category,
          messageText: tpl.messageText
        }
      });
    }
  }
}

// 1. Get all WhatsApp Templates
router.get('/', async (req, res) => {
  try {
    await ensureTemplatesSeeded();
    const templates = await prisma.whatsAppTemplate.findMany({
      orderBy: { updatedAt: 'asc' }
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Error fetching WhatsApp templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Update single WhatsApp Template
router.put('/:templateKey', async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { messageText, title } = req.body;

    if (!messageText || messageText.trim() === '') {
      return res.status(400).json({ success: false, error: 'Message text cannot be empty!' });
    }

    const updated = await prisma.whatsAppTemplate.upsert({
      where: { templateKey },
      update: {
        messageText: messageText.trim(),
        title: title ? title.trim() : undefined
      },
      create: {
        templateKey,
        title: title || templateKey,
        messageText: messageText.trim()
      }
    });

    res.json({ success: true, data: updated, message: 'Template updated successfully!' });
  } catch (error) {
    console.error('Error updating WhatsApp template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Send Test WhatsApp Message
router.post('/send-test', async (req, res) => {
  try {
    const { mobile, messageText } = req.body;
    if (!mobile || mobile.trim() === '') {
      return res.status(400).json({ success: false, error: 'Mobile number is required for test message!' });
    }

    const { sendTestWhatsAppMessage } = require('../services/whatsapp.service');
    const result = await sendTestWhatsAppMessage(mobile.trim(), messageText);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error sending test WhatsApp message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, DEFAULT_TEMPLATES, ensureTemplatesSeeded };
