import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Edit, Plus, Send, CheckCircle2, RefreshCw, 
  HelpCircle, Sparkles, Copy, Trash2, Smartphone, Save, ArrowLeft
} from 'lucide-react';
import { 
  fetchWhatsAppTemplatesFromFirebase, 
  subscribeWhatsAppTemplatesFromFirebase, 
  saveWhatsAppTemplateToFirebase,
  fetchAppSettingsFromFirebase,
  subscribeAppSettingsFromFirebase,
  saveAppSettingsToFirebase
} from '../firebase';

export const COMMON_HEADER = `*APNA DIGITAL HUB*
(A Part of Gattu Computer Works)
LIC Building, Khesmi, Gomoh, Dhanbad
Contact: 7781931880
------------------------------------`;

export const DEFAULT_WHATSAPP_TEMPLATES = [
  {
    templateKey: 'INITIAL_RECEIPT',
    title: 'आवेदन पंजीयन रसीद (Single Entry Receipt)',
    category: 'RECEIPT',
    messageText: `${COMMON_HEADER}
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
    title: 'एक साथ multiple पंजीयन रसीद (Bulk Entry Receipt)',
    category: 'RECEIPT',
    messageText: `${COMMON_HEADER}
*आवेदन पंजीयन रसीद ({totalCount} प्रमाणपत्र)*

आवेदक का नाम: *{applicantName}*
दिनांक: {entryDate}

{certListLines}{duesLine}

------------------------------------
आपकी सभी {totalCount} आवेदन रसीदें सफलतापूर्वक दर्ज कर ली गई हैं। स्थिति अपडेट होने पर आपको सूचित कर दिया जाएगा।
धन्यवाद!`
  },
  {
    templateKey: 'STATUS_DELIVERED',
    title: 'प्रमाणपत्र बन गया (Issued & Delivered Alert)',
    category: 'STATUS_UPDATE',
    messageText: `${COMMON_HEADER}
*स्थिति अपडेट - बधाई हो! प्रमाणपत्र निर्गत*

आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *निर्गत / बन चुका है (DELIVERED)*

आपका प्रमाणपत्र बन चुका है, कृपया सेंटर से संपर्क करके अपनी मूल प्रति प्राप्त करें।
धन्यवाद!`
  },
  {
    templateKey: 'STATUS_CI_UNDER_PROCESS',
    title: 'सर्किल इंस्पेक्टर स्तर पर प्रक्रिया में (CI Under Process)',
    category: 'STATUS_UPDATE',
    messageText: `${COMMON_HEADER}
*स्थिति अपडेट - सर्किल इंस्पेक्टर स्तर*

आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *सर्किल इंस्पेक्टर स्तर पर प्रक्रिया में (CI - Under Process)*

आपका आवेदन संबंधित अधिकारी के पास जांच प्रक्रिया में है।
धन्यवाद!`
  },
  {
    templateKey: 'STATUS_CO_UNDER_PROCESS',
    title: 'अंचलाधिकारी स्तर पर प्रक्रिया में (CO Under Process)',
    category: 'STATUS_UPDATE',
    messageText: `${COMMON_HEADER}
*स्थिति अपडेट - अंचलाधिकारी स्तर*

आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *अंचलाधिकारी स्तर पर प्रक्रिया में (Circle Officer - Under Process)*

आपका आवेदन अंतिम हस्ताक्षर एवं स्वीकृति प्रक्रिया में है।
धन्यवाद!`
  },
  {
    templateKey: 'STATUS_REJECTED',
    title: 'आवेदन निरस्त सूचना (Rejected Alert)',
    category: 'STATUS_UPDATE',
    messageText: `${COMMON_HEADER}
*स्थिति अपडेट - आवेदन निरस्त*

आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

वर्तमान स्थिति: *निरस्त (REJECTED)*

आपका आवेदन संबंधित अधिकारी द्वारा निरस्त कर दिया गया है। अधिक जानकारी या सुधार के लिए कृपया तत्काल सेंटर से संपर्क करें।
धन्यवाद!`
  },
  {
    templateKey: 'PDF_CAPTION',
    title: 'डिजिटल प्रमाणपत्र PDF फाइल कैप्शन (PDF Document Caption)',
    category: 'PDF_DISPATCH',
    messageText: `${COMMON_HEADER}
*प्रमाणपत्र (Certificate PDF Document)*

आवेदक का नाम: *{applicantName}*
प्रमाणपत्र प्रकार: *{certType}*
रेफरेंस नंबर: *{refNo}*

आपका प्रमाणपत्र पोर्टल से डाउनलोड कर PDF फाइल के रूप में संलग्न है।
धन्यवाद!`
  }
];


export default function MessageMasterView({ showToast, onBackToDashboard }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTestKey, setSendingTestKey] = useState(null);
  const [autoStatusWhatsApp, setAutoStatusWhatsApp] = useState(true);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const [formData, setFormData] = useState({
    templateKey: '',
    title: '',
    category: 'STATUS_UPDATE',
    messageText: ''
  });

  // Load Templates: Local backend first, Firebase fallback, or Defaults
  useEffect(() => {
    let isMounted = true;
    const loadTemplates = async () => {
      setLoading(true);
      try {
        // 1. Try local engine port 5000 / cloud backend API
        let apiData = null;
        try {
          const res = await fetch('http://localhost:5000/api/whatsapp-templates');
          if (res.ok) {
            const j = await res.json();
            if (j.success && Array.isArray(j.data) && j.data.length > 0) apiData = j.data;
          }
        } catch (e) {
          try {
            const res2 = await fetch('/api/whatsapp-templates');
            if (res2.ok) {
              const j2 = await res2.json();
              if (j2.success && Array.isArray(j2.data) && j2.data.length > 0) apiData = j2.data;
            }
          } catch (e2) {}
        }

        // 2. Fetch from Firebase
        const fbData = await fetchWhatsAppTemplatesFromFirebase();

        if (isMounted) {
          if (fbData && fbData.length > 0) {
            setTemplates(fbData);
          } else if (apiData && apiData.length > 0) {
            setTemplates(apiData);
            // Sync initial templates to Firebase for offline-online cloud persistence
            apiData.forEach(t => saveWhatsAppTemplateToFirebase(t).catch(() => {}));
          } else {
            setTemplates(DEFAULT_WHATSAPP_TEMPLATES);
            DEFAULT_WHATSAPP_TEMPLATES.forEach(t => saveWhatsAppTemplateToFirebase(t).catch(() => {}));
          }
        }
      } catch (err) {
        if (isMounted) setTemplates(DEFAULT_WHATSAPP_TEMPLATES);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTemplates();

    // Real-time listener from Firebase
    const unsub = subscribeWhatsAppTemplatesFromFirebase((fbList) => {
      if (fbList && fbList.length > 0) {
        setTemplates(fbList);
      }
    });

    // Real-time listener for app_settings
    const unsubSettings = subscribeAppSettingsFromFirebase((settings) => {
      if (settings && typeof settings.autoStatusWhatsApp === 'boolean') {
        setAutoStatusWhatsApp(settings.autoStatusWhatsApp);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsub === 'function') unsub();
      if (typeof unsubSettings === 'function') unsubSettings();
    };
  }, []);

  const handleToggleAutoStatus = async (newValue) => {
    try {
      setIsSavingSetting(true);
      setAutoStatusWhatsApp(newValue);
      await saveAppSettingsToFirebase({ autoStatusWhatsApp: newValue });
      showToast?.(
        'success',
        newValue ? 'Auto WhatsApp Activated' : 'Manual WhatsApp Activated',
        newValue 
          ? 'स्टेटस सिंक होते ही व्हाट्सएप मैसेज ऑटोमेटिक चला जाएगा।' 
          : 'स्टेटस सिंक होने पर व्हाट्सएप मैसेज केवल मैनुअल बटन दबाने पर जाएगा।'
      );
    } catch (err) {
      showToast?.('error', 'Setting Save Failed', err.message);
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleOpenEdit = (tpl) => {
    setEditingTemplate(tpl);
    setFormData({
      templateKey: tpl.templateKey,
      title: tpl.title || 'WhatsApp Message Format',
      category: tpl.category || 'STATUS_UPDATE',
      messageText: tpl.messageText || ''
    });
    setIsModalOpen(true);
  };

  const handleOpenCreateNew = () => {
    setEditingTemplate(null);
    setFormData({
      templateKey: `CUSTOM_${Date.now()}`,
      title: 'नया संदेश प्रारूप (Custom Message Template)',
      category: 'CUSTOM',
      messageText: `🏪 *अपना डिजिटल हब*
------------------------------------
नमस्ते *{applicantName}*,

रेफरेंस नंबर: *{refNo}*
प्रमाणपत्र प्रकार: *{certType}*

आपका संदेश विवरण यहाँ लिखें...

धन्यवाद!`
    });
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.messageText.trim()) {
      showToast?.('error', 'Validation Error', 'Title and Message Text are required!');
      return;
    }

    try {
      const payload = {
        templateKey: formData.templateKey,
        title: formData.title.trim(),
        category: formData.category,
        messageText: formData.messageText.trim()
      };

      // 1. Save to Firebase Cloud
      await saveWhatsAppTemplateToFirebase(payload);

      // 2. Save to Local Engine API
      try {
        await fetch(`http://localhost:5000/api/whatsapp-templates/${payload.templateKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        await fetch(`/api/whatsapp-templates/${payload.templateKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      }

      setTemplates(prev => {
        const idx = prev.findIndex(t => t.templateKey === payload.templateKey);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [...prev, payload];
      });

      setIsModalOpen(false);
      showToast?.('success', 'Template Saved', `"${payload.title}" updated successfully!`);
    } catch (err) {
      showToast?.('error', 'Save Failed', err.message);
    }
  };

  const handleSendTestMessage = async (tpl) => {
    if (!testPhone || testPhone.replace(/\D/g, '').length < 10) {
      showToast?.('error', 'Phone Required', 'Enter a valid 10-digit WhatsApp number to send preview test.');
      return;
    }

    const cleanNum = testPhone.replace(/\D/g, '');
    setSendingTestKey(tpl.templateKey);
    showToast?.('info', 'Sending Test', `Dispatching live preview to +91 ${cleanNum}...`);

    try {
      let res;
      try {
        res = await fetch('http://localhost:5000/api/whatsapp/test-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: cleanNum, message: tpl.messageText })
        });
      } catch (e) {
        res = await fetch('/api/whatsapp/test-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: cleanNum, message: tpl.messageText })
        });
      }

      const data = await res.json();
      if (data && data.success) {
        showToast?.('success', 'Test Delivered', `Preview successfully sent to +91 ${cleanNum}!`);
      } else {
        showToast?.('error', 'Test Failed', data?.error || 'Make sure WhatsApp Engine is connected.');
      }
    } catch (err) {
      showToast?.('error', 'Send Error', err.message);
    } finally {
      setSendingTestKey(null);
    }
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 border border-emerald-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-black shadow-inner text-2xl">
            💬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight">Message Master</h2>
              <span className="px-3 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider">
                WhatsApp Formats
              </span>
            </div>
            <p className="text-xs text-emerald-200/90 mt-1 max-w-xl">
              Customize live automated messages sent to applicants upon certificate entry, live status updates (Delivered / Rejected), and digital PDF receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
          )}

          <button
            onClick={handleOpenCreateNew}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition flex items-center gap-2 ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Create Custom Template</span>
          </button>
        </div>
      </div>

      {/* Auto vs Manual Status Update Message Control Card */}
      <div className="bg-white border-2 border-slate-200/90 hover:border-emerald-500/50 rounded-3xl p-5 md:p-6 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl shadow-inner border ${
              autoStatusWhatsApp 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              {autoStatusWhatsApp ? '⚡' : '👆'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm md:text-base font-black text-slate-900">
                  Status Update Message Dispatch Mode
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                  autoStatusWhatsApp 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {autoStatusWhatsApp ? '✓ AUTOMATIC' : 'MANUAL MODE'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {autoStatusWhatsApp ? (
                  <span>
                    <strong className="text-emerald-700">ऑटोमैटिक मोड (YES/Auto):</strong> झारसेवा पोर्टल से स्टेटस सिंक (Sync Status) होते ही आवेदक को नया स्टेटस व्हाट्सएप पर <strong>तुरंत ऑटोमेटिक</strong> चला जाएगा।
                  </span>
                ) : (
                  <span>
                    <strong className="text-amber-700">मैनुअल मोड (NO/Manual):</strong> पोर्टल से स्टेटस सिंक होने पर स्क्रीन पर नया स्टेटस अपडेट होगा, लेकिन व्हाट्सएप मैसेज <strong>सिर्फ तभी जाएगा जब आप "Send WhatsApp" बटन दबाएंगे</strong>।
                  </span>
                )}
              </p>
              <div className="mt-2 text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>नोट: नया प्रमाण पत्र दर्ज (New Entry) करते समय पंजीयन रसीद हमेशा 100% ऑटोमेटिक जाएगी।</span>
              </div>
            </div>
          </div>

          {/* Toggle Control: Checkbox / Switch Yes-No */}
          <div className="flex items-center gap-3 shrink-0 self-end md:self-center bg-slate-50 border border-slate-200 p-2 rounded-2xl">
            <button
              type="button"
              disabled={isSavingSetting}
              onClick={() => handleToggleAutoStatus(true)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                autoStatusWhatsApp
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⚡ AUTO (YES)</span>
            </button>

            <button
              type="button"
              disabled={isSavingSetting}
              onClick={() => handleToggleAutoStatus(false)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                !autoStatusWhatsApp
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👆 MANUAL (NO)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Test Mobile Dispatch Strip */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-emerald-600" />
          <div>
            <h4 className="text-xs font-extrabold text-slate-900">Live Preview Test Number</h4>
            <p className="text-[11px] text-slate-500">Enter your WhatsApp number to test-fire any template below with realistic applicant dummy data.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="e.g. 8210212926"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="w-full sm:w-44 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <span className="text-[10px] font-bold text-slate-400 uppercase hidden md:inline">Test Mobile</span>
        </div>
      </div>

      {/* Template Cards Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">Loading WhatsApp Templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
          {templates.map((tpl) => {
            const isReceipt = tpl.category === 'RECEIPT' || tpl.templateKey.includes('RECEIPT');
            const isDelivered = tpl.templateKey.includes('DELIVERED');
            const isRejected = tpl.templateKey.includes('REJECTED');

            const badgeColor = isDelivered 
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
              : isRejected 
              ? 'bg-rose-100 text-rose-800 border-rose-300'
              : isReceipt
              ? 'bg-blue-100 text-blue-800 border-blue-300'
              : 'bg-amber-100 text-amber-800 border-amber-300';

            return (
              <div 
                key={tpl.templateKey} 
                className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {isDelivered ? '🎉' : isRejected ? '❌' : isReceipt ? '📄' : '⏳'}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900">{tpl.title}</h3>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${badgeColor}`}>
                      {tpl.templateKey}
                    </span>
                  </div>

                  {/* WhatsApp Message Preview Box */}
                  <div className="relative">
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-emerald-300 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto shadow-inner select-all selection:bg-emerald-900">
                      {tpl.messageText}
                    </div>
                  </div>

                  {/* Available Dynamic Placeholders Indicator */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Live Tags Supported:</span>
                    <div className="flex flex-wrap gap-1 font-mono text-[9px]">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{"{applicantName}"}</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{"{refNo}"}</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{"{certType}"}</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{"{entryDate}"}</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{"{duesLine}"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEdit(tpl)}
                    className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-extrabold text-xs transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Format</span>
                  </button>

                  <button
                    onClick={() => handleSendTestMessage(tpl)}
                    disabled={sendingTestKey === tpl.templateKey}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${sendingTestKey === tpl.templateKey ? 'animate-bounce' : ''}`} />
                    <span>{sendingTestKey === tpl.templateKey ? 'Sending...' : 'Test Send'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT / CREATE TEMPLATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-7 max-w-xl w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-200">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingTemplate ? 'संदेश प्रारूप संपादित करें (Edit Template)' : 'नया संदेश प्रारूप जोड़ें (Add New Template)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Edit text layout, WhatsApp bold formatting (*), and dynamic tags.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">प्रारूप का नाम (Template Title) *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. प्रमाणपत्र बन गया (Delivered Alert)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">WhatsApp संदेश प्रारूप (Message Text Layout) *</label>
                <textarea
                  rows={9}
                  required
                  value={formData.messageText}
                  onChange={(e) => setFormData(prev => ({ ...prev, messageText: e.target.value }))}
                  placeholder="Enter message layout..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-emerald-300 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Supported Dynamic Tag Chips */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-1.5">
                <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wide flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  उपलब्ध लाइव टैग (Click to insert):
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  {[
                    '{applicantName}', 
                    '{refNo}', 
                    '{certType}', 
                    '{entryDate}', 
                    '{currentStatus}', 
                    '{duesLine}'
                  ].map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => setFormData(prev => ({ ...prev, messageText: prev.messageText + ' ' + tag }))}
                      className="px-2 py-0.5 rounded-lg bg-emerald-100/80 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition font-bold cursor-pointer"
                      title="Click to append tag"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  रद्द करें (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>प्रारूप सुरक्षित करें (Save Format)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
