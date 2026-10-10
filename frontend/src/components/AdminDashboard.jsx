import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, ShieldAlert, KeyRound, Plus, Search, Filter, 
  RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, LogOut, 
  Copy, Check, Download, Upload, Trash2, Edit, Smartphone, Store,
  Building2, Calendar, Shield, Activity, Power, RefreshCcw, Bell,
  ChevronRight, Layers, DollarSign, LayoutDashboard, Settings, Menu, PanelLeftClose, PanelLeft, UserCheck,
  UserCheck as ManageAccountIcon, MessageSquare, Key, CheckCircle, Send, QrCode, Sliders, Eye, Database, Lock
} from 'lucide-react';
import { 
  fetchClientsFromFirebase, 
  saveClientToFirebase, 
  updateClientStatusOnFirebase, 
  deleteClientFromFirebase, 
  generateLicenseKey,
  subscribeClientsFromFirebase,
  fetchCertificatesFromFirebase,
  syncBulkCertificatesToFirebase,
  fetchPlansFromFirebase,
  subscribePlansFromFirebase,
  savePlanToFirebase
} from '../firebase';

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'clients' | 'licenses' | 'plans' | 'data_master' | 'whatsapp_master'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [dataSearch, setDataSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [clientSubTab, setClientSubTab] = useState('LIVE'); // 'LIVE' | 'ARCHIVED'
  const [licenseSubTab, setLicenseSubTab] = useState('ACTIVE'); // 'ACTIVE' | 'ARCHIVED'
  
  // WhatsApp Master Templates State
  const [whatsappTemplates, setWhatsappTemplates] = useState([
    {
      templateKey: 'CLIENT_STATUS_UPDATE',
      title: '1. Client Status Update Template (Active / Blocked / Renewal)',
      category: 'CLIENT_ALERT',
      messageText: `🏪 *अपना डिजिटल हब - खाता स्थिति अपडेट* 🏪\n------------------------------------\nनमस्ते *{ownerName}* ({shopName}),\n\nआपके सॉफ़्टवेयर खाते की स्थिति अपडेट की गई है:\n\nवर्तमान स्थिति: *{status}*\nवैधता तिथि: *{expiresAt}*\nप्लांट प्रकार: *{planType}*\n\nधन्यवाद!`
    },
    {
      templateKey: 'CLIENT_KILLED_ALERT',
      title: '2. Client Account Killed Alert Template',
      category: 'CLIENT_ALERT',
      messageText: `🚫 *अपना डिजिटल हब - खाता ब्लॉक (ACCOUNT KILLED)* 🚫\n------------------------------------\nनमस्ते *{ownerName}* ({shopName}),\n\nसुरक्षा / प्रशासकीय कारणों से आपका सॉफ़्टवेयर खाता अस्थायी रूप से ब्लॉक कर दिया गया है।\n\nहार्डवेयर आईडी (HWID): *{hwid}*\nस्थिति: *BLOCKED / KILLED*\n\nखाता पुन: सक्रिय करवाने के लिए मास्टर एडमिन से तुरंत संपर्क करें।\n\nधन्यवाद!`
    },
    {
      templateKey: 'LICENSE_EXPIRY_WARNING',
      title: '3. License Expiry Warning Template',
      category: 'CLIENT_ALERT',
      messageText: `⚠️ *अपना डिजिटल हब - प्लान समाप्त (EXPIRED)* ⚠️\n------------------------------------\nनमस्ते *{ownerName}* ({shopName}),\n\nआपकी सॉफ़्टवेयर सदस्यता *{expiresAt}* को समाप्त हो चुकी है।\n\nप्लांट प्रकार: *{planType}*\nस्थिति: *EXPIRED*\n\nसॉफ़्टवेयर सेवाएँ निरन्तर जारी रखने के लिए कृपया अपनी सदस्यता का नवीनीकरण (Renew) करवाएं।\n\nधन्यवाद!`
    },
    {
      templateKey: 'HWID_UPDATE',
      title: '4. HWID / Registered PC Update Template',
      category: 'CLIENT_ALERT',
      messageText: `💻 *अपना डिजिटल हब - Hardware ID (PC) अपडेट* 💻\n------------------------------------\nनमस्ते *{ownerName}* ({shopName}),\n\nआपके खाते की रजिस्टर्ड PC Hardware ID (HWID) सूची अपडेट कर दी गई है:\n\nअनुमत PC संख्या: *{allowedPcs}*\nरजिस्टर्ड HWID: *{hwid}*\n\nअब आप केवल इन्हीं रजिस्टर्ड PC से लॉगिन कर सकते हैं।\n\nधन्यवाद!`
    }
  ]);

  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [testTemplatePhone, setTestTemplatePhone] = useState('');
  const [templateFormData, setTemplateFormData] = useState({ templateKey: '', title: '', messageText: '' });
  
  // Plans Master State with Facilities & Pricing Controls
  const [plans, setPlans] = useState([
    {
      id: 'FREE_TRIAL',
      name: 'Free Trial Plan',
      days: 7,
      originalPrice: 0,
      price: 0,
      entriesLimit: '5 Entries',
      status: 'ACTIVE',
      usersText: '1 PC',
      facilities: {
        autoWhatsapp: true,
        jharsewaSync: true,
        syncAll: false,
        backupAllowed: false,
        customerSupport: false
      }
    },
    {
      id: 'MONTHLY',
      name: 'Monthly Plan',
      days: 30,
      originalPrice: 149,
      price: 49,
      entriesLimit: 'Upto 100 Entries',
      status: 'ACTIVE',
      usersText: '1 PC',
      facilities: {
        autoWhatsapp: true,
        jharsewaSync: true,
        syncAll: false,
        backupAllowed: true,
        customerSupport: true
      }
    },
    {
      id: 'HALF_YEARLY',
      name: 'Half-Yearly Plan',
      days: 180,
      originalPrice: 699,
      price: 349,
      entriesLimit: 'Upto 1000 Entries',
      status: 'ACTIVE',
      usersText: '3 PCs',
      facilities: {
        autoWhatsapp: true,
        jharsewaSync: true,
        syncAll: true,
        backupAllowed: true,
        customerSupport: true
      }
    },
    {
      id: 'YEARLY',
      name: 'Yearly Plan',
      days: 365,
      originalPrice: 999,
      price: 599,
      entriesLimit: 'Unlimited',
      status: 'ACTIVE',
      usersText: '5 PCs',
      facilities: {
        autoWhatsapp: true,
        jharsewaSync: true,
        syncAll: true,
        backupAllowed: true,
        customerSupport: true
      }
    },
    {
      id: 'LIFETIME',
      name: 'Lifetime Plan',
      days: 364635,
      originalPrice: 5999,
      price: 2999,
      entriesLimit: 'Unlimited',
      status: 'ACTIVE',
      usersText: 'Unlimited',
      facilities: {
        autoWhatsapp: true,
        jharsewaSync: true,
        syncAll: true,
        backupAllowed: true,
        customerSupport: true
      }
    }
  ]);

  const [editingPlan, setEditingPlan] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  
  // Form State with Multi-HWID & Max PCs Support
  const [formData, setFormData] = useState({
    hwid: '',
    hwids: [],
    allowedPcs: 2,
    clientName: '',
    ownerName: '',
    phone: '',
    planType: 'MONTHLY',
    customDays: 30,
    licenseKey: '',
    status: 'ACTIVE'
  });

  const [newHwidInput, setNewHwidInput] = useState('');

  // Admin Password Change State
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Persistent WhatsApp Session & Anti-Spam Gateway State
  const [whatsappConfig, setWhatsappConfig] = useState(() => {
    const saved = localStorage.getItem('WA_GATEWAY_CONFIG');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      connectedPhone: 'NOT_LINKED',
      instanceStatus: 'DISCONNECTED', // 'CONNECTED' | 'DISCONNECTED'
      welcomeMsg: true,
      activationMsg: true,
      renewalMsg: true,
      expiryReminderMsg: true,
      apiToken: 'WA_API_KEY_APNA_HUB_9981',
      rateLimitSeconds: '3-7'
    };
  });

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [backendQrUri, setBackendQrUri] = useState(null);
  const [linkMode, setLinkMode] = useState('qr'); // 'qr' | 'code'
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCodeResult, setPairingCodeResult] = useState('');
  const [loadingPairingCode, setLoadingPairingCode] = useState(false);

  // Test WhatsApp Dispatcher State
  const [testPhoneInput, setTestPhoneInput] = useState('');
  const [sendingTestMessage, setSendingTestMessage] = useState(false);

  const handleSendTestMessage = async () => {
    if (!testPhoneInput.trim()) {
      showToast('error', 'Phone Required', 'Please enter a test mobile number.');
      return;
    }
    setSendingTestMessage(true);
    try {
      // Try local gateway first, fallback to cloud route
      let url = '/api/whatsapp/test-message';
      let targetRes = null;
      try {
        targetRes = await fetch('http://localhost:5000/api/whatsapp/test-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: testPhoneInput,
            message: '🚀 *TEST WHATSAPP MESSAGE* 🚀\n------------------------------------\nHello! WhatsApp Gateway linking is working 100% successfully from your Master Admin Dashboard.'
          })
        });
      } catch (err) {}

      if (!targetRes || !targetRes.ok) {
        targetRes = await fetch('/api/whatsapp/test-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: testPhoneInput,
            message: '🚀 *TEST WHATSAPP MESSAGE* 🚀\n------------------------------------\nHello! WhatsApp Gateway linking is working 100% successfully from your Master Admin Dashboard.'
          })
        });
      }

      const data = await targetRes.json();
      if (data.success) {
        showToast('success', 'Test Message Sent', `WhatsApp test message dispatched to ${testPhoneInput}!`);
      } else {
        showToast('error', 'Dispatch Failed', data.error || data.reason || 'Failed to send test message.');
      }
    } catch (e) {
      showToast('error', 'WhatsApp Test', e.message);
    } finally {
      setSendingTestMessage(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!pairingPhone.trim()) {
      showToast('error', 'Phone Required', 'Please enter your WhatsApp phone number.');
      return;
    }
    setLoadingPairingCode(true);
    setPairingCodeResult('');
    try {
      const res = await fetch('/api/whatsapp/pair-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: pairingPhone })
      });
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error('Server starting up. Please click "Get Code" again in 3 seconds.');
      }
      if (data.success && data.pairingCode) {
        setPairingCodeResult(data.pairingCode);
        showToast('success', 'Pairing Code Generated', 'Enter this 8-digit code in WhatsApp app Linked Devices.');
      } else {
        showToast('error', 'Pairing Failed', data.error || 'Failed to get pairing code. Please retry.');
      }
    } catch (e) {
      showToast('error', 'Pairing Code Request', e.message);
    } finally {
      setLoadingPairingCode(false);
    }
  };

  // Poll Backend Baileys Engine Status
  useEffect(() => {
    let isMounted = true;
    const checkWaStatus = async () => {
      try {
        let isConn = false;
        let phone = null;
        let qrData = null;

        // 1. First check cloud backend API status
        try {
          const res = await fetch('/api/whatsapp/status');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.isConnected) {
              isConn = true;
              phone = data.connectedPhone;
            } else if (data.qrCodeData) {
              qrData = data.qrCodeData;
            }
          }
        } catch (e) {}

        // 2. If cloud is disconnected, check Local PC Gateway Engine on localhost:5000
        if (!isConn) {
          try {
            const localRes = await fetch('http://localhost:5000/api/whatsapp/status');
            if (localRes.ok) {
              const localData = await localRes.json();
              if (localData.success && localData.isConnected) {
                isConn = true;
                phone = localData.connectedPhone;
              } else if (localData.qrCodeData) {
                qrData = localData.qrCodeData;
              }
            }
          } catch (e) {}
        }

        if (isMounted) {
          if (isConn) {
            setWhatsappConfig(prev => ({
              ...prev,
              instanceStatus: 'CONNECTED',
              connectedPhone: phone || prev.connectedPhone || '917781931880'
            }));
          } else {
            setWhatsappConfig(prev => ({
              ...prev,
              instanceStatus: 'DISCONNECTED',
              connectedPhone: 'NOT_LINKED'
            }));
            if (qrData && qrData.startsWith('data:image')) {
              setBackendQrUri(qrData);
            } else {
              setBackendQrUri('/public/whatsapp-qr.png');
            }
          }
        }
      } catch (e) {
        if (isMounted) {
          setBackendQrUri('/public/whatsapp-qr.png');
        }
      }
    };

    checkWaStatus();
    const interval = setInterval(checkWaStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Save WhatsApp Config to localStorage on update
  useEffect(() => {
    localStorage.setItem('WA_GATEWAY_CONFIG', JSON.stringify(whatsappConfig));
  }, [whatsappConfig]);

  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribeClients = subscribeClientsFromFirebase((updatedClients) => {
      setClients(updatedClients || []);
      setLoading(false);
    });

    const unsubscribePlans = subscribePlansFromFirebase((cloudPlans) => {
      if (cloudPlans && cloudPlans.length > 0) {
        setPlans(prevPlans => {
          return prevPlans.map(defaultPlan => {
            const matchedCloud = cloudPlans.find(cp => cp.id === defaultPlan.id);
            return matchedCloud ? { ...defaultPlan, ...matchedCloud } : defaultPlan;
          });
        });
      }
    });

    // Fetch cloud certificates for Data Master backup
    fetchCertificatesFromFirebase().then(certs => {
      setCertificates(certs || []);
    });

    return () => {
      unsubscribeClients();
      unsubscribePlans();
    };
  }, []);

  const handleDownloadClientCSVBackup = (shopClient, clientCerts) => {
    if (!clientCerts || clientCerts.length === 0) {
      showToast('info', 'No Entries', `No certificate entries found for ${shopClient.clientName || 'this client'}.`);
      return;
    }
    const headers = ['Ref No', 'Applicant Name', 'Certificate Type', 'Status', 'Applied Date', 'Mobile'];
    const rows = clientCerts.map(c => [
      `"${c.refNo || ''}"`,
      `"${c.applicantName || ''}"`,
      `"${c.certType || ''}"`,
      `"${c.status || ''}"`,
      `"${c.createdAt || c.entryDate || ''}"`,
      `"${c.mobile || ''}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeShopName = (shopClient.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute("download", `${safeShopName}_Entries_Backup_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'CSV Downloaded', `Backup CSV downloaded for ${shopClient.clientName}!`);
  };

  const handlePushRestoreDataToClient = async (shopClient, clientCerts) => {
    if (!clientCerts || clientCerts.length === 0) {
      showToast('error', 'No Backup Data', `No certificate backup records found to restore for ${shopClient.clientName}.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to Push Restore ${clientCerts.length} certificate backup entries to ${shopClient.clientName}?`)) return;

    try {
      await syncBulkCertificatesToFirebase(clientCerts);
      showToast('success', 'Backup Pushed & Restored', `Successfully pushed and restored ${clientCerts.length} entries for ${shopClient.clientName}!`);

      // Dispatch WhatsApp Restore Notification
      fetch('http://localhost:5000/api/whatsapp/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: shopClient,
          eventType: 'STATUS_CHANGE',
          extraInfo: { newStatus: `DATABASE RESTORED (${clientCerts.length} ENTRIES)` }
        })
      }).catch(() => {});
    } catch (err) {
      showToast('error', 'Restore Push Failed', err.message);
    }
  };

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenAddModal = () => {
    const defaultHwid = `HWID-WIN-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const generated = generateLicenseKey(defaultHwid, 'MONTHLY');
    setEditingClient(null);
    setIsViewOnly(false);
    setFormData({
      hwid: defaultHwid,
      hwids: [defaultHwid],
      allowedPcs: 2,
      clientName: '',
      ownerName: '',
      phone: '',
      planType: 'MONTHLY',
      customDays: 30,
      licenseKey: generated.licenseKey,
      status: 'ACTIVE'
    });
    setNewHwidInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setIsViewOnly(false);
    const existingHwids = Array.isArray(client.hwids) && client.hwids.length > 0 
      ? client.hwids 
      : [client.hwid || client.id];
      
    setFormData({
      hwid: client.hwid || client.id,
      hwids: existingHwids,
      allowedPcs: client.allowedPcs || 2,
      clientName: client.clientName || '',
      ownerName: client.ownerName || '',
      phone: client.phone || '',
      planType: client.planType || 'MONTHLY',
      customDays: 30,
      licenseKey: client.licenseKey || '',
      status: client.status || 'ACTIVE'
    });
    setNewHwidInput('');
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (client) => {
    setEditingClient(client);
    setIsViewOnly(true);
    const existingHwids = Array.isArray(client.hwids) && client.hwids.length > 0 
      ? client.hwids 
      : [client.hwid || client.id];
      
    setFormData({
      hwid: client.hwid || client.id,
      hwids: existingHwids,
      allowedPcs: client.allowedPcs || 2,
      clientName: client.clientName || '',
      ownerName: client.ownerName || '',
      phone: client.phone || '',
      planType: client.planType || 'MONTHLY',
      customDays: 30,
      licenseKey: client.licenseKey || '',
      status: client.status || 'ACTIVE'
    });
    setNewHwidInput('');
    setIsModalOpen(true);
  };

  const handleAddHwidTag = () => {
    if (!newHwidInput.trim()) return;
    const clean = newHwidInput.trim().toUpperCase();
    if (formData.hwids.includes(clean)) {
      showToast('info', 'Duplicate HWID', 'This Hardware ID is already added to the list.');
      return;
    }
    if (formData.hwids.length >= formData.allowedPcs) {
      showToast('error', 'PC Limit Exceeded', `Plan limit allows maximum ${formData.allowedPcs} PCs. Increase Allowed PCs limit first.`);
      return;
    }
    setFormData(prev => ({
      ...prev,
      hwids: [...prev.hwids, clean]
    }));
    setNewHwidInput('');
  };

  const handleRemoveHwidTag = (targetHwid) => {
    if (formData.hwids.length <= 1) {
      showToast('error', 'Action Restricted', 'Client must have at least 1 primary Hardware ID.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      hwids: prev.hwids.filter(h => h !== targetHwid)
    }));
  };

  const handlePlanTypeChange = (planId) => {
    const targetPlan = plans.find(p => p.id === planId);
    let days = targetPlan ? targetPlan.days : 30;
    let pcs = 1;
    if (planId === 'FREE_TRIAL') pcs = 1;
    if (planId === 'MONTHLY') pcs = 1;
    if (planId === 'HALF_YEARLY') pcs = 3;
    if (planId === 'YEARLY') pcs = 5;
    if (planId === 'LIFETIME') pcs = 10;

    const currentHwidsCount = formData.hwids ? formData.hwids.length : 1;
    const finalAllowedPcs = Math.max(pcs, currentHwidsCount);

    const generated = generateLicenseKey(formData.hwid || 'DEFAULT', planId);
    setFormData(prev => ({
      ...prev,
      planType: planId,
      customDays: days,
      allowedPcs: finalAllowedPcs,
      licenseKey: generated.licenseKey,
      hwids: prev.hwids && prev.hwids.length > 0 ? prev.hwids : [prev.hwid || 'DEFAULT']
    }));
  };

  const handleGenerateNewKey = () => {
    const generated = generateLicenseKey(formData.hwid || 'DEFAULT', formData.planType);
    setFormData(prev => ({ ...prev, licenseKey: generated.licenseKey }));
    showToast('info', 'New Key Generated', 'A fresh license key has been generated.');
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    try {
      let daysToAdd = 30;
      const targetPlan = plans.find(p => p.id === formData.planType);
      if (targetPlan) {
        daysToAdd = targetPlan.days;
      } else {
        if (formData.planType === 'FREE_TRIAL') daysToAdd = 7;
        else if (formData.planType === 'MONTHLY') daysToAdd = 30;
        else if (formData.planType === 'HALF_YEARLY') daysToAdd = 180;
        else if (formData.planType === 'YEARLY') daysToAdd = 365;
        else if (formData.planType === 'LIFETIME') daysToAdd = 364635;
      }

      // Always calculate fresh expiry from Today when saving/updating plan
      let expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysToAdd);

      const primaryHwid = (formData.hwids && formData.hwids.length > 0 ? formData.hwids[0] : formData.hwid).trim().toUpperCase();
      const validHwids = formData.hwids && formData.hwids.length > 0 ? formData.hwids : [primaryHwid];
      const finalAllowedPcs = Math.max(parseInt(formData.allowedPcs || 1), validHwids.length);

      const payload = {
        hwid: primaryHwid,
        hwids: validHwids,
        allowedPcs: finalAllowedPcs,
        clientName: formData.clientName.trim(),
        ownerName: formData.ownerName.trim(),
        phone: formData.phone.trim(),
        planType: formData.planType,
        status: formData.status,
        licenseKey: formData.licenseKey,
        createdAt: (editingClient && editingClient.createdAt) ? editingClient.createdAt : new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      };

      await saveClientToFirebase(payload);
      setIsModalOpen(false);
      showToast('success', 'Client Saved', `Client ${payload.clientName} saved successfully with ${payload.hwids.length} Whitelisted HWID(s)!`);

      // Auto-dispatch WhatsApp Notification to Client
      try {
        const eventType = editingClient ? 'PROFILE_UPDATE' : 'STATUS_CHANGE';
        const notifBody = JSON.stringify({ client: payload, eventType, extraInfo: { newStatus: payload.status } });

        fetch('http://localhost:5000/api/whatsapp/notify-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: notifBody
        }).catch(() => {
          fetch('/api/whatsapp/notify-client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: notifBody
          }).catch(() => {});
        });
      } catch (e) {}
    } catch (err) {
      showToast('error', 'Error Saving Client', err.message);
    }
  };

  const handleToggleStatus = async (hwid, currentStatus) => {
    const targetClient = clients.find(c => (c.hwid === hwid || c.id === hwid));
    if (!targetClient) return;

    const newStatus = currentStatus === 'ACTIVE' ? 'KILLED' : 'ACTIVE';
    try {
      let updatePayload = { status: newStatus };

      if (newStatus === 'KILLED') {
        // Freeze remaining days on archiving/killing
        const daysRemaining = calculateDaysLeft(targetClient.expiresAt);
        updatePayload.remainingDays = Math.max(0, daysRemaining);
      } else if (newStatus === 'ACTIVE') {
        // Restore license: check if key is expired
        const daysRemaining = targetClient.remainingDays !== undefined 
          ? targetClient.remainingDays 
          : calculateDaysLeft(targetClient.expiresAt);

        if (daysRemaining <= 0) {
          showToast('error', 'Restore Blocked', 'This key is already expired, So this key will not be able to be restored.');
          alert('This key is already expired, So this key will not be able to be restored.');
          return;
        }

        // Resume remaining days starting from Today
        let newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + daysRemaining);
        updatePayload.expiresAt = newExpiresAt.toISOString();
        updatePayload.remainingDays = null;
      }

      await saveClientToFirebase({
        ...targetClient,
        ...updatePayload
      });

      showToast(
        newStatus === 'KILLED' ? 'error' : 'success', 
        newStatus === 'ACTIVE' ? 'License Restored' : 'Status Changed', 
        newStatus === 'ACTIVE' ? `License restored for ${targetClient.clientName} with remaining validity!` : `Client license status set to ${newStatus}`
      );

      // Auto-dispatch WhatsApp Notification for KILLED / ACTIVE toggle
      const payload = {
        client: { ...targetClient, ...updatePayload },
        eventType: newStatus === 'KILLED' ? 'KILLED' : 'STATUS_CHANGE',
        extraInfo: { newStatus }
      };

      fetch('http://localhost:5000/api/whatsapp/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {
        fetch('/api/whatsapp/notify-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      });
    } catch (err) {
      showToast('error', 'Update Failed', err.message);
    }
  };

  const handleRestoreClient = async (client) => {
    const daysRemaining = client.remainingDays !== undefined 
      ? client.remainingDays 
      : calculateDaysLeft(client.expiresAt);

    if (daysRemaining <= 0) {
      alert('This key is already expired, So this key will not be able to be restored.');
      showToast('error', 'Restore Blocked', 'This key is already expired, So this key will not be able to be restored.');
      return;
    }

    try {
      let newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + daysRemaining);

      const updated = {
        ...client,
        status: 'ACTIVE',
        expiresAt: newExpiresAt.toISOString(),
        remainingDays: null
      };

      await saveClientToFirebase(updated);
      showToast('success', 'License Restored', `License restored for ${client.clientName} with ${daysRemaining} days remaining!`);

      // WhatsApp notify
      fetch('http://localhost:5000/api/whatsapp/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: updated, eventType: 'STATUS_CHANGE', extraInfo: { newStatus: 'ACTIVE' } })
      }).catch(() => {});
    } catch (err) {
      showToast('error', 'Restore Failed', err.message);
    }
  };

  const handleResetClientPassword = async (client) => {
    const defaultPassword = client.phone ? client.phone.trim() : '';
    if (!defaultPassword) {
      showToast('error', 'Reset Failed', 'Client mobile number missing.');
      return;
    }
    if (!window.confirm(`Reset password for "${client.clientName}"? Password will be set to mobile number: ${defaultPassword}`)) return;

    try {
      const updated = {
        ...client,
        password: defaultPassword
      };
      await saveClientToFirebase(updated);
      showToast('success', 'Password Reset', `Password reset! Default password set to client mobile number: ${defaultPassword}`);

      // Auto-dispatch WhatsApp notification to Client about password reset
      fetch('http://localhost:5000/api/whatsapp/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: updated,
          eventType: 'PROFILE_UPDATE',
          extraInfo: { note: `Password Reset Complete. Default Password is your registered mobile number: ${defaultPassword}` }
        })
      }).catch(() => {});
    } catch (err) {
      showToast('error', 'Reset Failed', err.message);
    }
  };

  const handleRenewLicense = async (client) => {
    try {
      let newExpiry = new Date();
      if (client.expiresAt && new Date(client.expiresAt) > new Date()) {
        newExpiry = new Date(client.expiresAt);
      }
      newExpiry.setDate(newExpiry.getDate() + 30);

      await saveClientToFirebase({
        ...client,
        status: 'ACTIVE',
        expiresAt: newExpiry.toISOString()
      });
      showToast('success', 'License Renewed', `Added +30 days to ${client.clientName}!`);
    } catch (err) {
      showToast('error', 'Renewal Failed', err.message);
    }
  };

  const handleResetHWID = async (client) => {
    try {
      const newHwid = `HWID-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const newKey = generateLicenseKey(newHwid, client.planType || 'MONTHLY').licenseKey;

      const updated = {
        ...client,
        hwid: newHwid,
        hwids: [newHwid],
        licenseKey: newKey
      };
      await saveClientToFirebase(updated);
      showToast('info', 'HWID Reset Complete', `Device lock reset for ${client.clientName}. Ready for formatted PC re-activation!`);

      // Auto-dispatch WhatsApp Notification for HWID Reset
      fetch('/api/whatsapp/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: updated, eventType: 'HWID_UPDATE' })
      }).catch(() => {});
    } catch (err) {
      showToast('error', 'Reset Failed', err.message);
    }
  };

  const handleDeleteClient = async (hwid, clientName) => {
    const targetClient = clients.find(c => (c.hwid === hwid || c.id === hwid));
    const isAlreadyArchived = clientSubTab === 'ARCHIVED' || (targetClient && targetClient.status === 'DELETED');

    if (isAlreadyArchived) {
      // Permanent Delete from Firebase Firestore Cloud Database
      if (!window.confirm(`⚠️ PERMANENT DELETE WARNING:\n\nAre you sure you want to PERMANENTLY DELETE client "${clientName}" from database?\nThis action CANNOT be undone!`)) return;
      try {
        await deleteClientFromFirebase(hwid);
        showToast('error', 'Permanent Delete Complete', `Client "${clientName}" permanently deleted from database.`);
      } catch (err) {
        showToast('error', 'Permanent Delete Failed', err.message);
      }
    } else {
      // Soft Archive (move to Archived Clients tab)
      if (!window.confirm(`Are you sure you want to move client "${clientName}" to Archived Clients?`)) return;
      try {
        if (targetClient) {
          const daysRemaining = calculateDaysLeft(targetClient.expiresAt);
          await saveClientToFirebase({
            ...targetClient,
            status: 'DELETED',
            remainingDays: Math.max(0, daysRemaining)
          });
          showToast('info', 'Client Archived', `Client "${clientName}" has been moved to Archived Clients.`);
        } else {
          await updateClientStatusOnFirebase(hwid, 'DELETED');
          showToast('info', 'Client Archived', `Client "${clientName}" has been moved to Archived Clients.`);
        }
      } catch (err) {
        showToast('error', 'Archive Failed', err.message);
      }
    }
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleBackupClientData = (client) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(client, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Backup_${client.clientName || 'Client'}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('success', 'Backup Downloaded', `Backup for ${client.clientName} saved!`);
  };

  // State to track dismissed free demo notification IDs
  const [dismissedRequests, setDismissedRequests] = useState(() => {
    const saved = localStorage.getItem('DISMISSED_ACCESS_REQUESTS');
    return saved ? JSON.parse(saved) : [];
  });

  const handleDismissRequest = (reqId) => {
    const updated = [...dismissedRequests, reqId];
    setDismissedRequests(updated);
    localStorage.setItem('DISMISSED_ACCESS_REQUESTS', JSON.stringify(updated));
  };

  // Access Requests Notification (All New Registrations with status PENDING)
  const accessRequests = clients.filter(c => {
    // Any registration account with status PENDING (Paid or Free Demo)
    if (c.status === 'PENDING') return true;
    return false;
  });

  // Stats Calculations
  const totalCount = clients.length;
  const activeCount = clients.filter(c => c.status === 'ACTIVE' && new Date(c.expiresAt) > new Date()).length;
  const expiredCount = clients.filter(c => new Date(c.expiresAt) <= new Date() || c.status === 'EXPIRED').length;
  const killedCount = clients.filter(c => c.status === 'KILLED' || c.status === 'INACTIVE' || c.status === 'DELETED').length;
  const pendingRequests = clients.filter(c => c.status === 'PENDING');
  const pendingCount = pendingRequests.length;

  const calculateDaysLeft = (expiresAtStr) => {
    if (!expiresAtStr) return 0;
    const diffTime = new Date(expiresAtStr) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filtered & Sorted Clients according to clientSubTab & statusFilter
  const filteredClients = clients
    .filter(c => {
      const matchesSearch = 
        (c.clientName && c.clientName.toLowerCase().includes(search.toLowerCase())) ||
        (c.ownerName && c.ownerName.toLowerCase().includes(search.toLowerCase())) ||
        (c.phone && c.phone.includes(search)) ||
        (c.licenseKey && c.licenseKey.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      const daysLeft = calculateDaysLeft(c.expiresAt);
      const isExp = daysLeft <= 0;
      const isKilled = c.status === 'KILLED' || c.status === 'INACTIVE' || c.status === 'DELETED';

      // clientSubTab Filter: LIVE vs ARCHIVED
      if (clientSubTab === 'LIVE') {
        // Live = Only Active clients (not killed/deleted, not expired)
        if (isKilled || (isExp && c.planType !== 'LIFETIME')) return false;
      } else if (clientSubTab === 'ARCHIVED') {
        // Archived = Only deleted / killed / expired members
        if (!isKilled && (!isExp || c.planType === 'LIFETIME')) return false;
      }

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ACTIVE') return c.status === 'ACTIVE' && !isExp;
      if (statusFilter === 'EXPIRED') return isExp || c.status === 'EXPIRED';
      if (statusFilter === 'KILLED') return isKilled;
      if (statusFilter === 'PENDING') return c.status === 'PENDING';
      return true;
    })
    .sort((a, b) => {
      // Sort LIVE clients by License Expiry Days (nearest expiry date first)
      if (clientSubTab === 'LIVE') {
        const daysA = calculateDaysLeft(a.expiresAt);
        const daysB = calculateDaysLeft(b.expiresAt);
        return daysA - daysB;
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex font-sans w-full">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 max-w-md animate-bounce ${
          toast.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800' :
          toast.type === 'info' ? 'bg-sky-50 border-sky-300 text-sky-800' :
          'bg-emerald-50 border-emerald-300 text-emerald-800'
        }`}>
          <div className="font-bold text-sm">{toast.title}: <span className="font-normal text-xs">{toast.message}</span></div>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION BAR (WITH DASHBOARD OPTION AT TOP) */}
      {isSidebarOpen && (
        <aside className="w-64 bg-slate-900 text-white shrink-0 flex flex-col justify-between border-r border-slate-800 min-h-screen sticky top-0 h-screen z-50 transition-all duration-300">
          <div className="p-6 space-y-6">
            {/* Logo & Admin Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg">
                <ShieldCheck className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight">Master Admin</h2>
                <p className="text-[11px] text-slate-400 font-medium">Apna Digital Hub</p>
              </div>
            </div>

            {/* Navigation Links - DASHBOARD AT TOP */}
            <nav className="space-y-1.5 pt-4 border-t border-slate-800">
              {/* 📊 DASHBOARD MENU OPTION (ABOVE CLIENT MASTER) */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm font-bold">📊</span>
                  <span className="text-sm font-bold whitespace-nowrap">Dashboard</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-extrabold text-[10px]">Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('clients')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                  activeTab === 'clients'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm font-bold">👥</span>
                  <span className="text-sm font-bold whitespace-nowrap">Client Master</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">{totalCount}</span>
              </button>

              <button
                onClick={() => setActiveTab('licenses')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                  activeTab === 'licenses'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm font-bold">🔑</span>
                  <span className="text-sm font-bold whitespace-nowrap">License Master</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">{activeCount}</span>
              </button>

              <button
                onClick={() => setActiveTab('plans')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                  activeTab === 'plans'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm font-black text-emerald-400">₹</span>
                  <span className="text-sm font-bold whitespace-nowrap">Plan Master</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">{plans.length}</span>
              </button>

              {/* 🗄️ DATA MASTER TAB */}
              <button
                onClick={() => setActiveTab('data_master')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                  activeTab === 'data_master'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm font-bold">🗄️</span>
                  <span className="text-sm font-bold whitespace-nowrap">Data Master</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold">{certificates.length || 0}</span>
              </button>

              {/* 💬 WHATSAPP MASTER TAB */}
              <button
                onClick={() => setActiveTab('whatsapp_master')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                  activeTab === 'whatsapp_master'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm font-bold">💬</span>
                  <span className="text-sm font-bold whitespace-nowrap">WhatsApp Master</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold">{whatsappTemplates.length || 5}</span>
              </button>

              {/* ⚙️ MANAGE ACCOUNT (ADMIN PASSWORD & WHATSAPP AUTOMATION) */}
              <button
                onClick={() => setActiveTab('account')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                  activeTab === 'account'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm font-bold">⚙️</span>
                  <span className="text-sm font-bold whitespace-nowrap">Manage Account</span>
                </div>
              </button>
            </nav>
          </div>

          <div className="p-4 border-t border-slate-800 text-center">
            <span className="text-[11px] text-slate-500 font-mono">Protected Master Admin</span>
          </div>
        </aside>
      )}

      {/* RIGHT MAIN CONTENT AREA - FULL WIDTH */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header Bar with Sidebar Toggle + Right Corner Action Buttons */}
        <header className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 text-white shadow-lg sticky top-0 z-40 px-6 md:px-8 py-4 w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Hide Sidebar Menu" : "Show Sidebar Menu"}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
            >
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-white">
                {activeTab === 'dashboard' && '📊 Master Overview Dashboard'}
                {activeTab === 'clients' && '👥 Client Master Management'}
                {activeTab === 'licenses' && '🔑 License Master & Device Control'}
                {activeTab === 'plans' && '💎 Plan Master & Pricing'}
                {activeTab === 'data_master' && '🗄️ Client Data Master & Cloud Backups'}
                {activeTab === 'whatsapp_master' && '💬 WhatsApp Master Templates'}
                {activeTab === 'account' && '⚙️ Manage Account & System Settings'}
                <span className="px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-900 text-[11px] font-black tracking-wider uppercase shadow">PRO</span>
              </h1>
              <p className="text-xs text-blue-100 font-medium">Multi-Tenant SaaS Licensing & Client Control Engine</p>
            </div>
          </div>

          {/* TOP RIGHT CORNER ACTION BUTTONS (+ Add New Client & Logout) */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              Add New Client
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>

        {/* Dashboard Body Container */}
        <main className="p-6 md:p-8 space-y-8 flex-1 w-full">
          
          {/* KPI Summary Metric Cards (5 Cards Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
            {/* Total Clients Card */}
            <div 
              onClick={() => { setActiveTab('clients'); setStatusFilter('ALL'); }}
              className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Total Clients</p>
                <h3 className="text-3xl font-extrabold text-indigo-950">{totalCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Active Subscriptions Card */}
            <div 
              onClick={() => { setActiveTab('clients'); setStatusFilter('ACTIVE'); }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Active Subscriptions</p>
                <h3 className="text-3xl font-extrabold text-emerald-950">{activeCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Expired Accounts Card */}
            <div 
              onClick={() => { setActiveTab('clients'); setStatusFilter('EXPIRED'); }}
              className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Expired Accounts</p>
                <h3 className="text-3xl font-extrabold text-amber-950">{expiredCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            {/* Killed / Blocked Card */}
            <div 
              onClick={() => { setActiveTab('clients'); setStatusFilter('KILLED'); }}
              className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Killed / Blocked</p>
                <h3 className="text-3xl font-extrabold text-rose-950">{killedCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>

            {/* Pending Approval Card */}
            <div 
              onClick={() => { setActiveTab('clients'); setStatusFilter('PENDING'); }}
              className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex items-center justify-between cursor-pointer relative"
            >
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-violet-600"></span>
                </span>
              )}
              <div>
                <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">Pending Approval</p>
                <h3 className="text-3xl font-extrabold text-violet-950">{pendingCount}</h3>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons Bar */}
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-violet-600" />
                Quick Admin Actions
              </h4>
              <span className="text-xs text-slate-400 font-medium">Direct Shortcuts</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 text-blue-900 border border-blue-100 hover:border-blue-300 transition group shadow-xs hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm shadow-blue-500/30">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-center">Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('clients')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-violet-50/80 hover:bg-violet-100/80 text-violet-900 border border-violet-100 hover:border-violet-300 transition group shadow-xs hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm shadow-violet-500/30">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-center">Client Master</span>
              </button>

              <button
                onClick={() => setActiveTab('licenses')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-900 border border-indigo-100 hover:border-indigo-300 transition group shadow-xs hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm shadow-indigo-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-center">License Master</span>
              </button>

              <button
                onClick={() => setActiveTab('plans')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-100 hover:border-emerald-300 transition group shadow-xs hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm shadow-emerald-500/30 text-lg font-black">
                  ₹
                </div>
                <span className="text-xs font-bold text-center">Plan Master</span>
              </button>

              <button
                onClick={() => setActiveTab('data_master')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-sky-50/80 hover:bg-sky-100/80 text-sky-900 border border-sky-100 hover:border-sky-300 transition group shadow-xs hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm shadow-sky-500/30">
                  <Database className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-center">Data Master</span>
              </button>

              <button
                onClick={() => setActiveTab('whatsapp_master')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-teal-50/80 hover:bg-teal-100/80 text-teal-900 border border-teal-100 hover:border-teal-300 transition group shadow-xs hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm shadow-teal-500/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-center">WhatsApp Master</span>
              </button>

              <button
                onClick={() => setActiveTab('account')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 text-amber-900 border border-amber-100 hover:border-amber-300 transition group shadow-xs hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm shadow-amber-500/30">
                  <Settings className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-center">Manage Account</span>
              </button>
            </div>
          </div>

          {/* New Client Registration Access Requests Notification Section (Free & Paid) */}
          {accessRequests.length > 0 && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg space-y-3 w-full">
              <div className="flex items-center justify-between font-extrabold text-base border-b border-white/20 pb-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 animate-bounce" />
                  New Client Access & Subscription Registrations ({accessRequests.length})
                </div>
                <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">
                  Free Demo & Paid Plan Requests
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full pt-1">
                {accessRequests.map(req => {
                  const reqId = req.hwid || req.id;
                  const isFree = req.requestedPlan === 'FREE_TRIAL' || req.planType === 'FREE_TRIAL';
                  const requestedPlanName = req.requestedPlan ? req.requestedPlan.replace('_', ' ') : 'FREE DEMO';

                  return (
                    <div key={reqId} className="bg-white/95 text-slate-800 p-4 rounded-xl shadow flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-sm font-bold text-slate-900">{req.clientName}</h4>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isFree ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {isFree ? 'FREE DEMO' : requestedPlanName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">
                          {req.phone} • {req.ownerName || 'CSC Center'}
                        </p>
                        {req.utrNumber && req.utrNumber !== 'N/A_FREE_TRIAL' && (
                          <p className="text-[11px] font-mono font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mt-1 inline-block">
                            UTR: {req.utrNumber}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isFree ? (
                          /* FREE DEMO ACCOUNT ACTIONS: View & Clear */
                          <>
                            <button 
                              onClick={() => handleOpenViewModal(req)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition flex items-center gap-1"
                              title="View Free Demo Account Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                            <button 
                              onClick={async () => {
                                await updateClientStatusOnFirebase(reqId, 'ACTIVE');
                                handleDismissRequest(reqId);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition flex items-center gap-1"
                              title="Approve Free Demo & Clear Notification"
                            >
                              Clear
                            </button>
                          </>
                        ) : (
                          /* PAID SUBSCRIPTION PLAN REQUEST ACTIONS: View Details, Approve & Reject */
                          <>
                            <button 
                              onClick={() => handleOpenViewModal(req)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition flex items-center gap-1"
                              title="View Full Details in Popup Modal"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Details
                            </button>
                            <button 
                              onClick={async () => {
                                const targetPlan = req.requestedPlan || 'MONTHLY';
                                let daysToAdd = 30;
                                if (targetPlan === 'HALF_YEARLY') daysToAdd = 180;
                                else if (targetPlan === 'YEARLY') daysToAdd = 365;

                                await saveClientToFirebase({
                                  ...req,
                                  planType: targetPlan,
                                  status: 'ACTIVE',
                                  expiresAt: new Date(Date.now() + daysToAdd * 86400000).toISOString()
                                });
                                handleDismissRequest(reqId);
                                showToast('success', 'Plan Approved', `${req.clientName}'s plan has been approved and activated!`);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={async () => {
                                await updateClientStatusOnFirebase(reqId, 'KILLED');
                                handleDismissRequest(reqId);
                                showToast('error', 'Request Rejected', `Registration for ${req.clientName} rejected.`);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 0: OVERVIEW DASHBOARD VIEW */}
          {(activeTab === 'dashboard' || activeTab === 'clients') && (
            <div className="space-y-4 w-full">
              {/* Sub-Navigation Tabs: Live vs Archived Clients */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 pl-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Client Sub-Filter:
                  </span>
                </div>

                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                  <button
                    onClick={() => setClientSubTab('LIVE')}
                    className={`px-5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
                      clientSubTab === 'LIVE'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Live Clients ({clients.filter(c => {
                      const d = calculateDaysLeft(c.expiresAt);
                      const isExp = d <= 0;
                      const isK = c.status === 'KILLED' || c.status === 'INACTIVE' || c.status === 'DELETED';
                      return !isK && (!isExp || c.planType === 'LIFETIME');
                    }).length})
                  </button>

                  <button
                    onClick={() => setClientSubTab('ARCHIVED')}
                    className={`px-5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
                      clientSubTab === 'ARCHIVED'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Archived Clients ({clients.filter(c => {
                      const d = calculateDaysLeft(c.expiresAt);
                      const isExp = d <= 0;
                      const isK = c.status === 'KILLED' || c.status === 'INACTIVE' || c.status === 'DELETED';
                      return isK || (isExp && c.planType !== 'LIFETIME');
                    }).length})
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm w-full">
                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search shop, owner, phone, key..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">All Statuses ({totalCount})</option>
                    <option value="ACTIVE">Active Only ({activeCount})</option>
                    <option value="EXPIRED">Expired Only ({expiredCount})</option>
                    <option value="KILLED">Killed / Blocked ({killedCount})</option>
                    <option value="PENDING">Pending Approval ({pendingCount})</option>
                  </select>
                </div>
              </div>

              {/* Client Master Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm w-full">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Shop & Owner Details</th>
                        <th className="px-6 py-4">Contact Phone</th>
                        <th className="px-6 py-4">Subscription Plan</th>
                        <th className="px-6 py-4">Status & Days Left</th>
                        <th className="px-6 py-4 text-right">Actions Suite</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {loading ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            Loading Client Licenses from Firebase Cloud...
                          </td>
                        </tr>
                      ) : filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            No clients found.
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map((client) => {
                          const daysLeft = calculateDaysLeft(client.expiresAt);
                          const isExpired = daysLeft <= 0;
                          const isKilled = client.status === 'KILLED' || client.status === 'INACTIVE';
                          const isPending = client.status === 'PENDING';

                          return (
                            <tr key={client.hwid || client.id} className="hover:bg-blue-50/30 transition">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-900 text-sm">{client.clientName || 'Unnamed Shop'}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                                  <Store className="w-3.5 h-3.5 text-blue-600" />
                                  {client.ownerName || 'Owner N/A'}
                                </div>
                              </td>

                              <td className="px-6 py-4 text-slate-700 font-mono font-semibold">
                                {client.phone || 'N/A'}
                              </td>

                              <td className="px-6 py-4">
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black uppercase">
                                  {client.planType || 'MONTHLY'}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 text-[10px] font-extrabold animate-pulse">
                                    <Clock className="w-3 h-3 text-violet-600" /> PENDING APPROVAL ({daysLeft > 0 ? `${daysLeft} Days Left` : 'Expired'})
                                  </span>
                                ) : isKilled ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-extrabold">
                                    <ShieldAlert className="w-3 h-3" /> KILLED / BLOCKED
                                  </span>
                                ) : isExpired ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                                    <Clock className="w-3 h-3" /> EXPIRED (0 Days)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE ({client.planType === 'LIFETIME' || daysLeft > 3000 ? 'Lifetime' : `${daysLeft} Days Left`})
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-4 text-right">
                                {activeTab === 'dashboard' ? (
                                  <button 
                                    onClick={() => handleOpenViewModal(client)} 
                                    title="View Client Details" 
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition inline-flex items-center gap-1.5"
                                  >
                                    <Eye className="w-4 h-4" />
                                    View
                                  </button>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {clientSubTab === 'ARCHIVED' && (
                                      <button 
                                        onClick={() => handleRestoreClient(client)} 
                                        title="Restore Client to Active" 
                                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
                                      >
                                        <RefreshCcw className="w-3.5 h-3.5" />
                                        Restore
                                      </button>
                                    )}
                                    <button onClick={() => handleResetClientPassword(client)} title="Reset Password to Mobile Number" className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition shadow-xs"><Lock className="w-4 h-4 text-amber-600" /></button>
                                    <button onClick={() => handleToggleStatus(client.hwid || client.id, client.status)} title={isKilled ? "Unblock Client" : "Kill / Terminate Client"} className={`p-2 rounded-xl border transition shadow-sm ${isKilled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}><ShieldAlert className="w-4 h-4" /></button>
                                    <button onClick={() => handleOpenEditModal(client)} title="Edit Client" className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleBackupClientData(client)} title="Download Backup" className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200"><Download className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteClient(client.hwid || client.id, client.clientName)} title="Delete Client" className="p-2 rounded-xl bg-slate-100 text-rose-600 border border-slate-200"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LICENSE MASTER VIEW */}
          {activeTab === 'licenses' && (
            <div className="space-y-4 w-full">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-blue-600" />
                    Central License Keys & Hardware ID Master
                  </h3>
                  <p className="text-xs text-slate-500 font-medium pt-1">
                    Manage client license keys, registered hardware IDs, registration dates, and expiry statuses.
                  </p>
                </div>

                {/* Sub-Navigation Tabs: Active vs Archived */}
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
                  <button
                    onClick={() => setLicenseSubTab('ACTIVE')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                      licenseSubTab === 'ACTIVE'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Active Licenses ({clients.filter(c => {
                      const d = calculateDaysLeft(c.expiresAt);
                      const isExp = d <= 0;
                      const isK = c.status === 'KILLED' || c.status === 'INACTIVE';
                      return c.status === 'ACTIVE' && !isExp && !isK;
                    }).length})
                  </button>

                  <button
                    onClick={() => setLicenseSubTab('ARCHIVED')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                      licenseSubTab === 'ARCHIVED'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Archived Licenses ({clients.filter(c => {
                      const d = calculateDaysLeft(c.expiresAt);
                      const isExp = d <= 0;
                      const isK = c.status === 'KILLED' || c.status === 'INACTIVE';
                      return c.status === 'EXPIRED' || c.status === 'PENDING' || isExp || isK;
                    }).length})
                  </button>
                </div>
              </div>

              {/* License Master Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm w-full">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Shop & Owner Name</th>
                        <th className="px-6 py-4">
                          <div>HARDWARE ID (HWID)</div>
                          <div className="text-[9px] font-semibold text-blue-600 lowercase tracking-normal">allowed pc count & whitelisted hwids</div>
                        </th>
                        <th className="px-6 py-4">License Key</th>
                        <th className="px-6 py-4">Reg. Date</th>
                        <th className="px-6 py-4">Expiry Date</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {loading ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                            Loading License Records from Firebase Cloud...
                          </td>
                        </tr>
                      ) : (() => {
                        const filteredLicenses = clients.filter(c => {
                          const daysLeft = calculateDaysLeft(c.expiresAt);
                          const isExpired = daysLeft <= 0;
                          const isKilled = c.status === 'KILLED' || c.status === 'INACTIVE';
                          const isPending = c.status === 'PENDING';
                          const isActiveOnly = c.status === 'ACTIVE' && !isExpired && !isKilled;

                          if (licenseSubTab === 'ACTIVE') {
                            return isActiveOnly;
                          } else {
                            // ARCHIVED: Expired, Killed, Pending or Blocked licenses
                            return isExpired || isKilled || isPending || c.status === 'EXPIRED';
                          }
                        });

                        if (filteredLicenses.length === 0) {
                          return (
                            <tr>
                              <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                {licenseSubTab === 'ACTIVE' ? 'No active license keys found.' : 'No archived (expired/killed) license keys found.'}
                              </td>
                            </tr>
                          );
                        }

                        return filteredLicenses.map((client) => {
                          const daysLeft = calculateDaysLeft(client.expiresAt);
                          const isExpired = daysLeft <= 0;
                          const isKilled = client.status === 'KILLED' || client.status === 'INACTIVE';
                          const isPending = client.status === 'PENDING';
                          const isLifetime = client.planType === 'LIFETIME' || daysLeft > 3000;
                          
                          // Reg Date: Date when license key was created/activated
                          const rawCreated = client.createdAt || client.updatedAt;
                          const regDate = rawCreated ? new Date(rawCreated).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
                          
                          const expDate = isLifetime ? 'Lifetime (आजीवन)' : (client.expiresAt ? new Date(client.expiresAt).toLocaleDateString('en-IN') : 'N/A');
                          const hwidList = Array.isArray(client.hwids) && client.hwids.length > 0 ? client.hwids : [client.hwid || 'N/A'];
                          const hwidDisplay = hwidList.join(', ');
                          const pcCount = client.allowedPcs || hwidList.length;

                          return (
                            <tr key={client.hwid || client.id} className="hover:bg-blue-50/30 transition">
                              {/* Shop & Owner Name */}
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-900 text-sm">{client.clientName || 'Unnamed Shop'}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                                  <Store className="w-3.5 h-3.5 text-blue-600" />
                                  {client.ownerName || 'Owner N/A'}
                                </div>
                              </td>

                              {/* Hardware ID (HWID) & PC Count */}
                              <td className="px-6 py-4 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded bg-blue-100 border border-blue-200 text-blue-900 text-[10px] font-extrabold font-mono">
                                    {hwidList.length} / {pcCount} PC Allowed
                                  </span>
                                </div>
                                <div className="font-mono font-semibold text-slate-700 max-w-[220px] truncate" title={hwidDisplay}>
                                  <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-800 inline-block max-w-full truncate">
                                    {hwidDisplay}
                                  </span>
                                </div>
                              </td>

                              {/* License Key */}
                              <td className="px-6 py-4 font-mono font-bold text-blue-700">
                                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl w-fit">
                                  <span>{client.licenseKey}</span>
                                  <button onClick={() => handleCopyKey(client.licenseKey)} className="text-blue-500 hover:text-blue-800 ml-1">
                                    {copiedKey === client.licenseKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>

                              {/* Registration Date */}
                              <td className="px-6 py-4 font-mono font-semibold text-slate-600">
                                {regDate}
                              </td>

                              {/* Expiry Date */}
                              <td className="px-6 py-4 font-mono font-bold text-slate-700">
                                {expDate}
                              </td>

                              {/* Status */}
                              <td className="px-6 py-4">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 text-[10px] font-extrabold animate-pulse">
                                    <Clock className="w-3 h-3 text-violet-600" /> PENDING
                                  </span>
                                ) : isKilled ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-extrabold">
                                    <ShieldAlert className="w-3 h-3" /> KILLED
                                  </span>
                                ) : isExpired ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                                    <Clock className="w-3 h-3" /> EXPIRED
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE
                                  </span>
                                )}
                              </td>

                              {/* Actions (Restore, Edit & Delete) */}
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {licenseSubTab === 'ARCHIVED' && (
                                    <button 
                                      onClick={() => handleRestoreClient(client)} 
                                      title="Restore License" 
                                      className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition shadow-xs flex items-center gap-1 font-bold text-xs"
                                    >
                                      <RefreshCw className="w-4 h-4 text-emerald-600" />
                                      <span className="text-[10px]">Restore</span>
                                    </button>
                                  )}
                                  <button onClick={() => handleOpenEditModal(client)} title="Edit License" className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition">
                                    <Edit className="w-4 h-4 text-slate-700" />
                                  </button>
                                  <button onClick={() => handleDeleteClient(client.hwid || client.id, client.clientName)} title="Delete License" className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 border border-slate-200 transition">
                                    <Trash2 className="w-4 h-4 text-rose-600" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLAN MASTER VIEW */}
          {activeTab === 'plans' && (
            <div className="space-y-6 w-full">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600 text-2xl font-black">₹</span>
                    Subscription Pricing & Plan Master
                  </h3>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 w-full">
                {plans.map(p => (
                  <div key={p.id} className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="font-black text-slate-900 text-sm tracking-tight">{p.name}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[9px] uppercase">
                          {p.status}
                        </span>
                      </div>

                      {/* Pricing Display */}
                      <div>
                        {p.originalPrice > 0 && p.originalPrice > p.price ? (
                          <div className="text-xs text-slate-400 line-through font-bold font-mono">
                            ₹{p.originalPrice}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 font-medium">Standard Price</div>
                        )}
                        <div className="text-2xl font-black text-emerald-600 font-mono">
                          ₹{p.price} <span className="text-[11px] font-bold text-slate-500 font-sans">/ {p.days >= 36500 ? 'Lifetime' : `${p.days} Days`}</span>
                        </div>
                      </div>

                      {/* Entries Limit Badge */}
                      <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-bold flex items-center justify-between">
                        <span>Cert. Entries:</span>
                        <span className="font-extrabold text-blue-700 font-mono">{p.entriesLimit || 'Unlimited'}</span>
                      </div>

                      {/* Facilities ON / OFF Checklist */}
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Plan Facilities:</span>

                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                          <span className="text-slate-700 font-semibold">Users (System Limit)</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-extrabold text-[10px] font-mono">{p.usersText || '1 PC'}</span>
                        </div>

                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                          <span className="text-slate-700 font-semibold">Auto WhatsApp Update</span>
                          {p.facilities?.autoWhatsapp !== false ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px]">Yes</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[9px]">No</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                          <span className="text-slate-700 font-semibold">Jharsewa Sync</span>
                          {p.facilities?.jharsewaSync !== false ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px]">Yes</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[9px]">No</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                          <span className="text-slate-700 font-semibold">Sync All</span>
                          {p.facilities?.syncAll ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px]">Yes</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[9px]">No</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                          <span className="text-slate-700 font-semibold">Backup Allowed</span>
                          {p.facilities?.backupAllowed ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px]">Yes</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[9px]">No</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                          <span className="text-slate-700 font-semibold">Customer Support</span>
                          {p.facilities?.customerSupport ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px]">Yes</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[9px]">No</span>
                          )}
                        </div>

                        {/* Extra PC Charge Note */}
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-center text-[10px] font-extrabold text-amber-900 mt-2 shadow-2xs">
                          ₹99/- Per PC <span className="font-semibold text-amber-700">(If Needed Extra PC)</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingPlan(p);
                        setPlanModalOpen(true);
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow transition flex items-center justify-center gap-1.5 mt-2"
                    >
                      <Edit className="w-3.5 h-3.5 text-blue-400" />
                      Edit Plan & Facilities
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: MANAGE ACCOUNT VIEW (ADMIN PASSWORD & WHATSAPP LINKING) */}
          {activeTab === 'account' && (
            <div className="space-y-6 w-full animate-in fade-in duration-300">
              {/* Header Title */}
              <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Settings className="w-6 h-6 text-emerald-600" />
                    Manage Account & System Settings
                  </h2>
                  <p className="text-xs text-slate-500 pt-1 font-medium">
                    Configure Master Admin password and WhatsApp automated messaging gateway for Client management.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. ADMIN PASSWORD CHANGE FORM */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Change Admin Password</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Update credentials for Master Admin Portal</p>
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (passForm.newPassword !== passForm.confirmPassword) {
                        showToast('error', 'Password Mismatch', 'New Password and Confirm Password do not match!');
                        return;
                      }
                      if (passForm.currentPassword !== 'Gattu@1994#') {
                        showToast('error', 'Authentication Failed', 'Current password entered is incorrect!');
                        return;
                      }
                      
                      // Auto-Unlink WhatsApp device security reset on Password Change
                      setWhatsappConfig(prev => ({
                        ...prev,
                        instanceStatus: 'DISCONNECTED',
                        connectedPhone: 'NOT_LINKED',
                        sessionKey: null
                      }));

                      showToast('success', 'Password Updated', 'Password changed! Security reset: Linked WhatsApp device has been UNLINKED.');
                      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }} 
                    className="space-y-4 text-xs"
                  >
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Current Password *</label>
                      <input 
                        type="password" 
                        required 
                        value={passForm.currentPassword} 
                        onChange={(e) => setPassForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter current password" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">New Password *</label>
                      <input 
                        type="password" 
                        required 
                        value={passForm.newPassword} 
                        onChange={(e) => setPassForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new strong password" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Confirm New Password *</label>
                      <input 
                        type="password" 
                        required 
                        value={passForm.confirmPassword} 
                        onChange={(e) => setPassForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Re-enter new password" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium" 
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition"
                    >
                      Update Password
                    </button>
                  </form>
                </div>

                {/* 2. WHATSAPP LINKING & AUTOMATIC MESSAGE SYSTEM */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">WhatsApp Gateway Linking</h3>
                        <p className="text-[11px] text-slate-500 font-medium">Auto-dispatch client notifications via WhatsApp</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border ${
                      whatsappConfig.instanceStatus === 'CONNECTED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        whatsappConfig.instanceStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}></span>
                      {whatsappConfig.instanceStatus}
                    </span>
                  </div>

                  {/* Connected WhatsApp Account Bar */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    whatsappConfig.instanceStatus === 'CONNECTED' 
                      ? 'bg-emerald-50/60 border-emerald-200' 
                      : 'bg-rose-50/60 border-rose-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <QrCode className={`w-6 h-6 ${whatsappConfig.instanceStatus === 'CONNECTED' ? 'text-emerald-700' : 'text-rose-600'}`} />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {whatsappConfig.instanceStatus === 'CONNECTED' ? 'Linked WhatsApp Number' : 'WhatsApp Gateway Disconnected'}
                        </div>
                        <div className="text-xs font-mono font-extrabold text-slate-700">
                          {whatsappConfig.instanceStatus === 'CONNECTED' ? `+${whatsappConfig.connectedPhone}` : 'No Active Device Session'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {whatsappConfig.instanceStatus === 'CONNECTED' ? (
                        <button 
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to UNLINK your active WhatsApp device?')) {
                              try {
                                await fetch('/api/whatsapp/logout', { method: 'POST' });
                              } catch(e) {}
                              setWhatsappConfig(prev => ({
                                ...prev,
                                instanceStatus: 'DISCONNECTED',
                                connectedPhone: 'NOT_LINKED',
                              }));
                              showToast('info', 'Device Unlinked', 'WhatsApp device session unlinked and logged out.');
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                        >
                          Unlink Device
                        </button>
                      ) : (
                        <button 
                          onClick={async () => {
                            try {
                              await fetch('/api/whatsapp/reconnect', { method: 'POST' });
                              const res = await fetch('/api/whatsapp/status');
                              const data = await res.json();
                              if (data.qrCodeData) setBackendQrUri(data.qrCodeData);
                            } catch(e) {}
                            setQrModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Link Device (Scan QR / Code)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TEST WHATSAPP CONNECTION DISPATCHER */}
                  <div className="p-4 bg-emerald-950/10 border border-emerald-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                        <Send className="w-4 h-4 text-emerald-600" />
                        Test WhatsApp Gateway Connection
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">Verify live message dispatch</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        placeholder="Enter Test Phone No (e.g. 9876543210)"
                        value={testPhoneInput}
                        onChange={(e) => setTestPhoneInput(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestMessage}
                        disabled={sendingTestMessage}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sendingTestMessage ? 'Sending...' : 'Send Test Message'}
                      </button>
                    </div>
                  </div>

                  {/* Automatic Message Trigger Controls */}
                  <div className="space-y-3 pt-1">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">Automatic Message Triggers:</h4>

                    <div className="space-y-2">
                      {/* Trigger 1: Welcome Note */}
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className={`w-4 h-4 ${whatsappConfig.welcomeMsg ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <div className="text-xs font-bold text-slate-800">Welcome Note & Credentials</div>
                            <div className="text-[10px] text-slate-500">Sent automatically when a new client registers/requests access</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={whatsappConfig.welcomeMsg} 
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, welcomeMsg: e.target.checked }))}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" 
                        />
                      </label>

                      {/* Trigger 2: License Activation */}
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className={`w-4 h-4 ${whatsappConfig.activationMsg ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <div className="text-xs font-bold text-slate-800">License Activation Alert</div>
                            <div className="text-[10px] text-slate-500">Sent with fresh license key when status set to ACTIVE</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={whatsappConfig.activationMsg} 
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, activationMsg: e.target.checked }))}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" 
                        />
                      </label>

                      {/* Trigger 3: License Renewal Confirmation */}
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className={`w-4 h-4 ${whatsappConfig.renewalMsg ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <div className="text-xs font-bold text-slate-800">License Renewal Confirmation</div>
                            <div className="text-[10px] text-slate-500">Sent upon +30 Days extension with new validity date</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={whatsappConfig.renewalMsg} 
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, renewalMsg: e.target.checked }))}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" 
                        />
                      </label>

                      {/* Trigger 4: License Expiry Reminder */}
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className={`w-4 h-4 ${whatsappConfig.expiryReminderMsg ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div>
                            <div className="text-xs font-bold text-slate-800">License Expiry Warning (3 Days Before)</div>
                            <div className="text-[10px] text-slate-500">Automated reminder with renewal payment link before account locks</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={whatsappConfig.expiryReminderMsg} 
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, expiryReminderMsg: e.target.checked }))}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" 
                        />
                      </label>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DATA MASTER VIEW (CLIENT CSV BACKUPS & PUSH RESTORE) */}
          {activeTab === 'data_master' && (
            <div className="space-y-6 w-full animate-in fade-in duration-300">
              {/* Header Title Banner */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-xl font-bold shadow-sm">
                    🗄️
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">Data Master & Client Cloud Backups</h3>
                    <p className="text-xs text-slate-500 font-medium">Automatic daily online client entry backups. Download CSV or Push Restore data to client software.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-black">
                    Total Cloud Entries: {certificates.length}
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={dataSearch}
                  onChange={(e) => setDataSearch(e.target.value)}
                  placeholder="Search client shop name, owner, or phone..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Data Master Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm w-full">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Shop & Owner Details</th>
                        <th className="px-6 py-4">Subscription Plan</th>
                        <th className="px-6 py-4">Auto Backup Status</th>
                        <th className="px-6 py-4">Total Saved Entries</th>
                        <th className="px-6 py-4 text-right">Data Master Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {loading ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            Loading Client Cloud Backups...
                          </td>
                        </tr>
                      ) : clients.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            No client accounts found.
                          </td>
                        </tr>
                      ) : (
                        clients.filter(c => {
                          if (!dataSearch.trim()) return true;
                          const q = dataSearch.toLowerCase();
                          return (c.clientName || '').toLowerCase().includes(q) ||
                                 (c.ownerName || '').toLowerCase().includes(q) ||
                                 (c.phone || '').includes(q);
                        }).map((client) => {
                          // Filter certificates strictly for this client (matched by phone, clientId or hwid)
                          const clientCerts = certificates.filter(cert => {
                            const cPhone = String(client.phone || '').trim();
                            const certPhone = String(cert.clientPhone || cert.clientId || '').trim();
                            const matchPhone = cPhone && (certPhone === cPhone);
                            const matchHwid = cert.hwid && (client.hwids || []).includes(cert.hwid);
                            // Legacy entries without client info belong to the primary admin client (7781931880)
                            const isLegacyPrimary = (!cert.clientId && !cert.clientPhone) && (cPhone === '7781931880');
                            return matchPhone || matchHwid || isLegacyPrimary;
                          });

                          const count = clientCerts.length;
                          const isOnlineActive = client.status === 'ACTIVE';

                          return (
                            <tr key={client.hwid || client.id} className="hover:bg-blue-50/30 transition">
                              {/* Shop & Owner Details */}
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-900 text-sm">{client.clientName || 'Unnamed Shop'}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                                  <Store className="w-3.5 h-3.5 text-blue-600" />
                                  {client.ownerName || 'Owner N/A'} • {client.phone}
                                </div>
                              </td>

                              {/* Subscription Plan */}
                              <td className="px-6 py-4">
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black uppercase">
                                  {client.planType || 'MONTHLY'}
                                </span>
                              </td>

                              {/* Daily Auto Backup Status */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${isOnlineActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                  <span className="font-bold text-slate-700 text-xs">
                                    {isOnlineActive ? 'Daily Sync Active (Online)' : 'Paused (Offline/Killed)'}
                                  </span>
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500 pt-0.5 font-mono">
                                  Last Backup: {(() => {
                                    const lastCert = clientCerts.length > 0 ? clientCerts[clientCerts.length - 1] : null;
                                    const rawDate = client.lastBackupAt || (lastCert && (lastCert.updatedAt || lastCert.createdAt)) || client.updatedAt;
                                    if (!rawDate) return 'Pending First Sync';
                                    const d = new Date(rawDate);
                                    return isNaN(d.getTime()) ? 'Pending First Sync' : `${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                                  })()}
                                </div>
                              </td>

                              {/* Total Saved Entries */}
                              <td className="px-6 py-4 font-mono font-bold text-blue-700">
                                <span className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-black">
                                  {count} Entries Saved
                                </span>
                              </td>

                              {/* Data Master Actions (Download CSV & Push Restore) */}
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleDownloadClientCSVBackup(client, clientCerts)}
                                    title="Download CSV Backup"
                                    className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition font-bold text-xs flex items-center gap-1.5 shadow-xs"
                                  >
                                    <Download className="w-4 h-4 text-blue-600" />
                                    Download CSV
                                  </button>

                                  <button
                                    onClick={() => handlePushRestoreDataToClient(client, clientCerts)}
                                    title="Push Restore Data to Client"
                                    className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
                                  >
                                    <RefreshCw className="w-4 h-4 text-emerald-600" />
                                    Push Restore
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: WHATSAPP MASTER TEMPLATE SUITE */}
          {activeTab === 'whatsapp_master' && (
            <div className="space-y-6 w-full">
              {/* Header Banner */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-xl font-bold shadow-sm">
                    💬
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">WhatsApp Master (Message Formats)</h3>
                    <p className="text-xs text-slate-500 font-medium">Manage, customize, and preview all automated WhatsApp message templates</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateFormData({
                        templateKey: `CUSTOM_${Date.now()}`,
                        title: 'New Custom WhatsApp Template',
                        messageText: `🏪 *अपना डिजिटल हब*\n------------------------------------\nनमस्ते *{ownerName}*,\n\nआपका संदेश विवरण यहाँ लिखें...\n\nधन्यवाद!`
                      });
                      setTemplateModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Template
                  </button>
                </div>
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {whatsappTemplates.map((tpl) => (
                  <div key={tpl.templateKey} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-extrabold text-slate-900">{tpl.title}</h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-bold uppercase">
                          {tpl.templateKey}
                        </span>
                      </div>

                      {/* Template Raw Text Box */}
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto shadow-inner select-all">
                        {tpl.messageText}
                      </div>

                      {/* Supported Tags Guide */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                        <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wide">Available Live Tags:</span>
                        <div className="flex flex-wrap gap-1.5 font-mono text-[10px] pt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">{"{ownerName}"}</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">{"{shopName}"}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">{"{status}"}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">{"{expiresAt}"}</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">{"{hwid}"}</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">{"{planType}"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setEditingTemplate(tpl);
                          setTemplateFormData({
                            templateKey: tpl.templateKey,
                            title: tpl.title,
                            messageText: tpl.messageText
                          });
                          setTemplateModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5 text-blue-600" />
                        Edit Format
                      </button>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Test Phone No"
                          value={testTemplatePhone}
                          onChange={(e) => setTestTemplatePhone(e.target.value)}
                          className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={async () => {
                            if (!testTemplatePhone.trim()) {
                              showToast('error', 'Phone Required', 'Enter phone number to preview test dispatch.');
                              return;
                            }
                            try {
                              const res = await fetch('http://localhost:5000/api/whatsapp/test-message', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ mobile: testTemplatePhone, message: tpl.messageText })
                              });
                              const data = await res.json();
                              if (data.success) {
                                showToast('success', 'Test Sent', `Template preview dispatched to ${testTemplatePhone}!`);
                              } else {
                                showToast('error', 'Test Failed', data.error || 'Failed to dispatch test message.');
                              }
                            } catch (e) {
                              showToast('error', 'Test Error', e.message);
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Test
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Store className="w-6 h-6 text-blue-600" />
                {isViewOnly ? 'View Client Account Details' : editingClient ? 'Edit Client Account' : 'Add New Client & Generate License'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-3xl font-bold">&times;</button>
            </div>

            <fieldset disabled={isViewOnly} className="space-y-5 text-sm font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 text-xs">Shop / CSC Center Name *</label>
                  <input type="text" required value={formData.clientName} onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))} placeholder="e.g. Gattu Jan Seva Kendra" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-semibold disabled:bg-slate-100 disabled:text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 text-xs">Owner Name *</label>
                  <input type="text" required value={formData.ownerName} onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))} placeholder="e.g. Nitish Nath" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-semibold disabled:bg-slate-100 disabled:text-slate-800" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 text-xs">WhatsApp Mobile No *</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={10}
                    value={formData.phone} 
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData(prev => ({ ...prev, phone: digitsOnly }));
                    }} 
                    placeholder="e.g. 9876543210" 
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono font-semibold disabled:bg-slate-100 disabled:text-slate-800" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 text-xs">Subscription Plan</label>
                  <select value={formData.planType} onChange={(e) => handlePlanTypeChange(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-bold disabled:bg-slate-100 disabled:text-slate-800">
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.days >= 36500 ? 'Lifetime' : `${p.days} Days`})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 text-xs flex items-center justify-between">
                  <span>Generated License Key</span>
                  {!isViewOnly && <button type="button" onClick={handleGenerateNewKey} className="text-blue-600 hover:underline text-xs font-bold">Generate Fresh Key</button>}
                </label>
                <input type="text" readOnly value={formData.licenseKey} className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-blue-800 font-mono text-sm font-black tracking-wide" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 text-xs">Allowed Multi-PC Limit *</label>
                  <select 
                    value={formData.allowedPcs} 
                    onChange={(e) => setFormData(prev => ({ ...prev, allowedPcs: parseInt(e.target.value) }))} 
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-bold disabled:bg-slate-100 disabled:text-slate-800"
                  >
                    <option value={1}>1 PC (Single System)</option>
                    <option value={2}>2 PCs (Dual Systems)</option>
                    <option value={3}>3 PCs (Standard Shop)</option>
                    <option value={5}>5 PCs (Multi-System Hub)</option>
                    <option value={10}>10 PCs (Enterprise Enterprise)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 text-xs">Account Status</label>
                  <select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-bold disabled:bg-slate-100 disabled:text-slate-800">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="KILLED">KILLED / BLOCKED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              {/* Multi-HWID Whitelist Management Box */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
                <div className="flex items-center justify-between">
                  <label className="block text-amber-900 font-extrabold text-xs">
                    Authorized Hardware IDs ({formData.hwids.length} / {formData.allowedPcs} Allowed PCs)
                  </label>
                  <span className="text-[10px] font-bold text-amber-700">Whitelisted Systems</span>
                </div>

                {/* Tag Chips */}
                <div className="flex flex-wrap gap-2">
                  {formData.hwids.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-mono text-xs font-bold shadow-sm">
                      <span>{h}</span>
                      {!isViewOnly && formData.hwids.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveHwidTag(h)} 
                          className="text-amber-700 hover:text-rose-600 font-black ml-1 text-sm"
                          title="Remove HWID"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add HWID Input & Add Button */}
                {!isViewOnly && (
                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="text" 
                      value={newHwidInput} 
                      onChange={(e) => setNewHwidInput(e.target.value)} 
                      placeholder="Enter additional HWID (e.g. HWID-WIN-9812-AA4B)" 
                      className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 text-amber-900 font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddHwidTag}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition shrink-0"
                    >
                      + Add PC HWID
                    </button>
                  </div>
                )}
              </div>
            </fieldset>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              {isViewOnly ? (
                <div className="flex items-center gap-3">
                  {editingClient && (editingClient.status === 'PENDING' || editingClient.requestedPlan) && (
                    <>
                      <button 
                        type="button" 
                        onClick={async () => {
                          const targetId = editingClient.hwid || editingClient.id;
                          const targetPlan = editingClient.requestedPlan || editingClient.planType || 'MONTHLY';
                          
                          let daysToAdd = 30;
                          if (targetPlan === 'FREE_TRIAL') daysToAdd = 7;
                          else if (targetPlan === 'MONTHLY') daysToAdd = 30;
                          else if (targetPlan === 'HALF_YEARLY') daysToAdd = 180;
                          else if (targetPlan === 'YEARLY') daysToAdd = 365;
                          else if (targetPlan === 'LIFETIME') daysToAdd = 364635;
                          
                          const newExpiresAt = new Date(Date.now() + daysToAdd * 86400000).toISOString();

                          await saveClientToFirebase({
                            ...editingClient,
                            planType: targetPlan,
                            status: 'ACTIVE',
                            expiresAt: newExpiresAt
                          });

                          handleDismissRequest(targetId);
                          setIsModalOpen(false);
                          showToast('success', 'Plan Approved', `${editingClient.clientName}'s plan has been upgraded to ${targetPlan}!`);
                        }} 
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition"
                      >
                        Approve & Upgrade Plan
                      </button>
                      <button 
                        type="button" 
                        onClick={async () => {
                          const targetId = editingClient.hwid || editingClient.id;
                          await updateClientStatusOnFirebase(targetId, 'KILLED');
                          handleDismissRequest(targetId);
                          setIsModalOpen(false);
                          showToast('error', 'Request Rejected', `Registration request for ${editingClient.clientName} has been rejected.`);
                        }} 
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition"
                      >
                        Reject Request
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs shadow-md">Close Window</button>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">Cancel</button>
                  <button type="button" onClick={handleSaveClient} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md">Save Client Details</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REAL-TIME WHATSAPP QR CODE SCAN MODAL */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                Scan WhatsApp Web QR Code
              </h3>
              <button 
                onClick={() => setQrModalOpen(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-300 font-medium">
                Open WhatsApp on phone → <strong className="text-emerald-400">Linked Devices</strong> → <strong className="text-emerald-400">Link a Device</strong>
              </p>
            </div>

            {/* Live QR Image Container */}
            <div className="p-4 bg-white rounded-2xl border-4 border-emerald-500/30 max-w-[260px] mx-auto shadow-inner flex flex-col items-center justify-center min-h-[260px]">
              {backendQrUri ? (
                <img 
                  src={backendQrUri} 
                  alt="WhatsApp Real-Time QR Code" 
                  onError={(e) => {
                    e.target.src = `/public/whatsapp-qr.png?t=${Date.now()}`;
                  }}
                  className="w-full h-auto rounded-lg mx-auto"
                />
              ) : (
                <div className="space-y-3 py-8 text-center">
                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-600 font-bold">Generating Fresh Live WhatsApp QR Code...</p>
                  <p className="text-[10px] text-slate-400">Please wait 2-3 seconds...</p>
                </div>
              )}
            </div>

            {/* OR LINK WITH 8-DIGIT PAIRING CODE (ALTERNATIVE) */}
            <div className="pt-2 border-t border-slate-800 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Link with 8-Digit Code (No QR Needed):
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Enter Phone No (e.g. 9876543210)"
                  value={pairingPhone}
                  onChange={(e) => setPairingPhone(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleRequestPairingCode}
                  disabled={loadingPairingCode}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shrink-0 disabled:opacity-50"
                >
                  {loadingPairingCode ? 'Getting...' : 'Get Code'}
                </button>
              </div>

              {pairingCodeResult && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-center space-y-1">
                  <p className="text-[10px] text-emerald-300 font-medium">WhatsApp Pairing Code:</p>
                  <div className="text-xl font-black font-mono tracking-widest text-emerald-400 select-all">
                    {pairingCodeResult}
                  </div>
                  <p className="text-[9px] text-slate-400">Open WhatsApp → Linked Devices → Link with phone number instead</p>
                </div>
              )}
            </div>

            {/* Anti-Spam Compliance Note */}
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-300 text-left space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>WhatsApp Terms & Anti-Spam Protection Active</span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                Messages dispatched with humanized random delays (3-7 seconds) to maintain WhatsApp official compliance and protect account health.
              </p>
            </div>

            <button
              onClick={() => setQrModalOpen(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
            >
              Done / Close Window
            </button>
          </div>
        </div>
      )}
      {/* Edit / Add WhatsApp Template Modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                {editingTemplate ? 'Edit WhatsApp Message Format' : 'Add New Custom WhatsApp Template'}
              </h3>
              <button onClick={() => setTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">&times;</button>
            </div>

            <div className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Template Title / Name *</label>
                <input
                  type="text"
                  required
                  value={templateFormData.title}
                  onChange={(e) => setTemplateFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">WhatsApp Message Text Format *</label>
                <textarea
                  rows={8}
                  required
                  value={templateFormData.messageText}
                  onChange={(e) => setTemplateFormData(prev => ({ ...prev, messageText: e.target.value }))}
                  placeholder="Enter message text with placeholders like {ownerName}, {shopName}, {status}, {expiresAt}, {hwid}..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                ></textarea>
              </div>

              {/* Supported Live Tags Helper */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                <span className="font-extrabold text-blue-900 text-[10px] uppercase tracking-wide">Supported Placeholders:</span>
                <p className="text-[11px] text-blue-800 leading-normal font-mono">
                  {"{ownerName}"}, {"{shopName}"}, {"{status}"}, {"{expiresAt}"}, {"{hwid}"}, {"{planType}"}, {"{allowedPcs}"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!templateFormData.messageText.trim()) {
                    showToast('error', 'Required Field', 'Message text format cannot be empty!');
                    return;
                  }
                  setWhatsappTemplates(prev => {
                    const idx = prev.findIndex(t => t.templateKey === templateFormData.templateKey);
                    if (idx >= 0) {
                      const copy = [...prev];
                      copy[idx] = { ...copy[idx], title: templateFormData.title, messageText: templateFormData.messageText };
                      return copy;
                    }
                    return [...prev, templateFormData];
                  });
                  setTemplateModalOpen(false);
                  showToast('success', 'Template Updated', 'WhatsApp message format updated successfully!');
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                Save Message Format
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PLAN MASTER MODAL */}
      {planModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                Edit Subscription Plan: {editingPlan.name}
              </h3>
              <button onClick={() => setPlanModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">&times;</button>
            </div>

            <div className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Strikethrough Price (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.originalPrice || 0}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, originalPrice: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g. 999"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Offer Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g. 599"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Validity Period (Days)</label>
                  <input
                    type="number"
                    value={editingPlan.days}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, days: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Certificate Entries Limit</label>
                  <input
                    type="text"
                    value={editingPlan.entriesLimit || 'Unlimited'}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, entriesLimit: e.target.value }))}
                    placeholder="e.g. 5, Upto 100, Unlimited"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Users (Allowed PC Systems Limit)</label>
                <input
                  type="text"
                  value={editingPlan.usersText || '1 PC'}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, usersText: e.target.value }))}
                  placeholder="e.g. 1 PC, 3 PCs, 5 PCs, Unlimited"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold font-mono"
                />
              </div>

              {/* Plan Facilities Toggle Switches */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Plan Facilities Toggle:</span>
                
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                    <span className="text-xs font-bold text-slate-800">Auto WhatsApp Update</span>
                    <input
                      type="checkbox"
                      checked={editingPlan.facilities?.autoWhatsapp !== false}
                      onChange={(e) => setEditingPlan(prev => ({
                        ...prev,
                        facilities: { ...prev.facilities, autoWhatsapp: e.target.checked }
                      }))}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                    <span className="text-xs font-bold text-slate-800">Jharsewa Sync</span>
                    <input
                      type="checkbox"
                      checked={editingPlan.facilities?.jharsewaSync !== false}
                      onChange={(e) => setEditingPlan(prev => ({
                        ...prev,
                        facilities: { ...prev.facilities, jharsewaSync: e.target.checked }
                      }))}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                    <span className="text-xs font-bold text-slate-800">Sync All</span>
                    <input
                      type="checkbox"
                      checked={editingPlan.facilities?.syncAll === true}
                      onChange={(e) => setEditingPlan(prev => ({
                        ...prev,
                        facilities: { ...prev.facilities, syncAll: e.target.checked }
                      }))}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                    <span className="text-xs font-bold text-slate-800">Backup Allowed</span>
                    <input
                      type="checkbox"
                      checked={editingPlan.facilities?.backupAllowed === true}
                      onChange={(e) => setEditingPlan(prev => ({
                        ...prev,
                        facilities: { ...prev.facilities, backupAllowed: e.target.checked }
                      }))}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                    <span className="text-xs font-bold text-slate-800">Customer Support</span>
                    <input
                      type="checkbox"
                      checked={editingPlan.facilities?.customerSupport === true}
                      onChange={(e) => setEditingPlan(prev => ({
                        ...prev,
                        facilities: { ...prev.facilities, customerSupport: e.target.checked }
                      }))}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setPlans(prev => prev.map(p => p.id === editingPlan.id ? editingPlan : p));
                  await savePlanToFirebase(editingPlan);
                  setPlanModalOpen(false);
                  showToast('success', 'Plan Details Updated', `Plan "${editingPlan.name}" pricing & details saved to cloud!`);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
              >
                Save Plan Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
