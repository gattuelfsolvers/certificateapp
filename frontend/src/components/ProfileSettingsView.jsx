import React, { useState, useEffect } from 'react';
import { 
  User, Store, Phone, MapPin, Key, ShieldCheck, Cpu, Calendar, Clock, 
  Lock, Smartphone, CheckCircle2, MessageSquare, AlertCircle, Save, Eye, EyeOff, QrCode, RefreshCw, Zap, Send, FileEdit, Plus, Trash2, Edit, Monitor,
  Sparkles, ArrowRight, X, ArrowUpCircle
} from 'lucide-react';

import { updateClientHwidsOnFirebase, saveClientToFirebase, subscribePlansFromFirebase } from '../firebase';
import axios from 'axios';

export default function ProfileSettingsView({ clientData, showToast }) {
  // 1. Client Personal & Business Details State
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('CLIENT_PROFILE_DETAILS');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      clientName: clientData?.clientName || 'Apna Digital Hub - Certificate Management',
      ownerName: clientData?.ownerName || 'CSC Partner',
      phone: clientData?.phone || '8210212926',
      address: clientData?.address || 'Main Road, CSC Digital Center, Ranchi, Jharkhand',
      password: ''
    };
  });

  const [showPassword, setShowPassword] = useState(false);

  // Request for Changes Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestFields, setRequestFields] = useState({
    shopName: false,
    ownerName: false,
    mobile: false
  });
  const [newValues, setNewValues] = useState({
    newShopName: '',
    newOwnerName: '',
    newMobile: ''
  });

  // Allowed PCs and HWID List State
  const allowedPcs = clientData?.allowedPcs || 2;
  const [hwidList, setHwidList] = useState(() => {
    const initialHwids = clientData?.hwids || [
      clientData?.hwid || localStorage.getItem('CLIENT_SYSTEM_HWID') || 'HWID-WIN-24E6-3A85'
    ];
    return Array.from(new Set(initialHwids.filter(Boolean)));
  });

  const [newHwidInput, setNewHwidInput] = useState('');
  const [editingHwidIndex, setEditingHwidIndex] = useState(null);
  const [editHwidInput, setEditHwidInput] = useState('');

  // 2. Dynamic License Details Calculation
  const calculateDaysLeft = () => {
    const plan = (clientData?.planType || 'MONTHLY').toUpperCase();
    if (plan.includes('LIFETIME')) {
      return 'Unlimited (Lifetime)';
    }

    if (clientData?.expiresAt) {
      const expDate = new Date(clientData.expiresAt);
      const now = new Date();
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? `${diffDays} Days Left` : 'Expired';
    }

    return '27 Days Left';
  };

  const rawPlanType = (clientData?.planType || 'MONTHLY').toUpperCase();
  const isLifetime = rawPlanType.includes('LIFETIME');

  const licenseInfo = {
    licenseKey: clientData?.licenseKey || localStorage.getItem('CLIENT_LICENSE_KEY') || 'CERT-MON-98A1-4B2C-78DE',
    hwid: clientData?.hwid || localStorage.getItem('CLIENT_SYSTEM_HWID') || 'HWID-WIN-24E6-3A85',
    regDate: clientData?.createdAt ? new Date(clientData.createdAt).toLocaleDateString() : '01-01-2026',
    planType: rawPlanType,
    daysLeftText: calculateDaysLeft()
  };

  // 3. Jharsewa Credentials State
  const [jharsewaCreds, setJharsewaCreds] = useState(() => {
    const saved = localStorage.getItem('JHARSEWA_CLIENT_CREDS');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      userId: '',
      password: '',
      autoSyncEnabled: true
    };
  });

  const [showJharsewaPass, setShowJharsewaPass] = useState(false);

  // 4. WhatsApp Automation & Bot Setup State
  const [whatsappSetup, setWhatsappSetup] = useState(() => {
    const saved = localStorage.getItem('WHATSAPP_LINK_SETUP');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      status: 'DISCONNECTED', // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTED'
      connectedPhone: clientData?.phone || '8210212926',
      autoNotifyStatusChange: true,
      autoSendPdfReceipt: true
    };
  });

  const [liveQrUri, setLiveQrUri] = useState(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [testMobileInput, setTestMobileInput] = useState(clientData?.phone || '8210212926');
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);
  const [pairingPhone, setPairingPhone] = useState(clientData?.phone || '');
  const [pairingCodeResult, setPairingCodeResult] = useState('');
  const [isGeneratingPairCode, setIsGeneratingPairCode] = useState(false);

  // Poll live WhatsApp engine status from local port 5000 or cloud backend
  useEffect(() => {
    let isMounted = true;
    const fetchWaStatus = async () => {
      try {
        let res = null;
        try {
          res = await fetch('http://localhost:5000/api/whatsapp/status');
        } catch (e) {
          res = await fetch('/api/whatsapp/status');
        }

        if (res && res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.success && data.isConnected) {
              setWhatsappSetup(prev => ({
                ...prev,
                status: 'CONNECTED',
                connectedPhone: data.connectedPhone || prev.connectedPhone
              }));
              setLiveQrUri(null);
            } else if (data.qrCodeData) {
              setLiveQrUri(data.qrCodeData);
              setWhatsappSetup(prev => ({ ...prev, status: 'SCAN_QR' }));
            } else {
              setWhatsappSetup(prev => ({ ...prev, status: 'DISCONNECTED' }));
            }
          }
        }
      } catch (err) {}
    };

    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // --- UPGRADE PLAN MODAL STATES ---
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState(1); // 1: Choose Plan, 2: Payment QR & UTR, 3: Success Thanks
  const [selectedUpgradePlanId, setSelectedUpgradePlanId] = useState('HALF_YEARLY');
  const [upgradeUtr, setUpgradeUtr] = useState('');
  const [upgradeUtrError, setUpgradeUtrError] = useState('');
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
  const [submittedUpgradeInfo, setSubmittedUpgradeInfo] = useState(null);

  // Available Subscription Plans
  const [allPlans, setAllPlans] = useState([
    {
      id: 'MONTHLY',
      name: 'Monthly Plan',
      badge: 'Starter',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      originalPrice: '₹149',
      price: '₹49',
      duration: '30 Days Validity',
      pcs: '1 PC Allowed',
      features: ['Upto 100 Entries', 'Jharsewa Auto Sync', 'Daily Cloud Backup', 'WhatsApp Integration'],
      tier: 1
    },
    {
      id: 'HALF_YEARLY',
      name: 'Half-Yearly Plan',
      badge: 'Top Selling',
      badgeColor: 'bg-amber-500/30 text-amber-300 border-amber-500/50',
      originalPrice: '₹699',
      price: '₹349',
      duration: '180 Days Validity',
      pcs: 'Multi-PC Sync',
      features: ['Upto 500 Entries', 'Realtime Fast Sync', 'Unlimited WhatsApp', 'Priority Server Bandwidth'],
      tier: 2
    },
    {
      id: 'YEARLY',
      name: 'Yearly Plan',
      badge: 'Best Value',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      originalPrice: '₹1,499',
      price: '₹599',
      duration: '365 Days Validity',
      pcs: '3 PCs Allowed',
      features: ['Unlimited Entries', 'Dedicated Cloud Server', 'Auto Backup Restore', '24x7 Priority Support'],
      tier: 3
    }
  ]);

  // Real-time subscribe to subscription plans
  useEffect(() => {
    const unsubscribe = subscribePlansFromFirebase((cloudPlans) => {
      if (cloudPlans && cloudPlans.length > 0) {
        setAllPlans(prev => {
          return prev.map(p => {
            const cp = cloudPlans.find(c => c.id === p.id);
            if (!cp) return p;
            return {
              ...p,
              name: cp.name || p.name,
              price: `₹${cp.price !== undefined ? cp.price : p.price}`,
              originalPrice: cp.originalPrice && cp.originalPrice > 0 ? `₹${cp.originalPrice}` : null,
              duration: cp.days >= 36500 ? 'Lifetime Validity' : `${cp.days || 30} Days Validity`,
              pcs: cp.usersText || `${cp.allowedPcs || 1} PC Allowed`,
              features: [
                cp.entriesLimit || (p.id === 'YEARLY' ? 'Unlimited Entries' : 'Certificate Entries'),
                'WhatsApp Integration',
                cp.facilities?.jharsewaSync !== false ? 'Jharsewa Auto Sync' : 'Standard Sync',
                cp.facilities?.backupAllowed !== false ? 'Daily Cloud Backup' : 'Local Backup'
              ]
            };
          });
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Filter plans available for upgrade based on current client plan
  const getEligibleUpgradePlans = () => {
    const curPlan = (clientData?.planType || 'FREE_TRIAL').toUpperCase();
    if (curPlan === 'FREE_TRIAL' || curPlan === 'DEMO' || curPlan === 'TRIAL' || !clientData?.planType) {
      // Free trial users see all paid plans: Monthly, Half-Yearly, Yearly
      return allPlans;
    }
    if (curPlan === 'MONTHLY') {
      // Monthly users see only higher tier plans: Half-Yearly and Yearly
      return allPlans.filter(p => p.id === 'HALF_YEARLY' || p.id === 'YEARLY');
    }
    if (curPlan === 'HALF_YEARLY') {
      // Half-Yearly users see only Yearly plan
      return allPlans.filter(p => p.id === 'YEARLY');
    }
    // Yearly or Lifetime users
    return allPlans.filter(p => p.id === 'YEARLY');
  };

  const handleOpenUpgradeModal = () => {
    const eligible = getEligibleUpgradePlans();
    if (eligible.length > 0) {
      setSelectedUpgradePlanId(eligible[0].id);
    }
    setUpgradeUtr('');
    setUpgradeUtrError('');
    setUpgradeStep(1);
    setIsUpgradeModalOpen(true);
  };

  const handleProceedToUpgradePayment = () => {
    setUpgradeUtr('');
    setUpgradeUtrError('');
    setUpgradeStep(2);
  };

  const handleUpgradeSubmit = async () => {
    const cleanUtr = upgradeUtr.trim().toUpperCase();
    if (!cleanUtr) {
      setUpgradeUtrError('कृपया पेमेंट करने के बाद 12 अंकों का UTR / UPI Ref Number अवश्य दर्ज करें!');
      return;
    }
    if (cleanUtr.length < 6) {
      setUpgradeUtrError('कृपया वैध UTR / Transaction Reference Number दर्ज करें (कम से कम 6 अंक/अक्षर)!');
      return;
    }

    setIsSubmittingUpgrade(true);
    setUpgradeUtrError('');

    try {
      const selectedPlanObj = allPlans.find(p => p.id === selectedUpgradePlanId) || { name: selectedUpgradePlanId, price: '' };
      const clientHwid = clientData?.hwid || hwidList[0] || localStorage.getItem('CLIENT_SYSTEM_HWID') || 'HWID-UNKNOWN';

      // Update client doc with pending upgrade request in Firebase Firestore
      const updatedClientPayload = {
        ...clientData,
        hwid: clientHwid,
        hwids: hwidList,
        clientName: profile.clientName || clientData?.clientName || 'Client Shop',
        ownerName: profile.ownerName || clientData?.ownerName || '',
        phone: profile.phone || clientData?.phone || '',
        status: 'PENDING', // PENDING shows in Admin Dashboard access requests banner
        requestedPlan: selectedUpgradePlanId,
        paymentStatus: 'UPGRADE_SUBMITTED',
        utrNumber: cleanUtr,
        paymentAmount: selectedPlanObj.price,
        upgradeRequestedAt: new Date().toISOString()
      };

      await saveClientToFirebase(updatedClientPayload);

      // Save locally as well
      const activeData = localStorage.getItem('ACTIVE_CLIENT_DATA');
      if (activeData) {
        try {
          const parsed = JSON.parse(activeData);
          parsed.status = 'PENDING';
          parsed.requestedPlan = selectedUpgradePlanId;
          parsed.utrNumber = cleanUtr;
          localStorage.setItem('ACTIVE_CLIENT_DATA', JSON.stringify(parsed));
        } catch (e) {}
      }

      setSubmittedUpgradeInfo({
        planName: selectedPlanObj.name,
        price: selectedPlanObj.price,
        duration: selectedPlanObj.duration,
        utrNumber: cleanUtr
      });

      setUpgradeStep(3);
      if (showToast) showToast('success', 'Upgrade Request Submitted', 'Your plan upgrade request has been submitted to Admin!');
    } catch (err) {
      console.error('Plan upgrade submission error:', err);
      setUpgradeUtrError('अपग्रेड सबमिट करने में समस्या आई। कृपया पुनः प्रयास करें या एडमिन से संपर्क करें।');
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  // Save Profile to LocalStorage
  const handleSaveProfile = (e) => {
    e.preventDefault();
    localStorage.setItem('CLIENT_PROFILE_DETAILS', JSON.stringify(profile));
    
    // Also update stored ACTIVE_CLIENT_DATA if present
    const activeData = localStorage.getItem('ACTIVE_CLIENT_DATA');
    if (activeData) {
      try {
        const parsed = JSON.parse(activeData);
        parsed.clientName = profile.clientName;
        parsed.ownerName = profile.ownerName;
        parsed.phone = profile.phone;
        parsed.address = profile.address;
        localStorage.setItem('ACTIVE_CLIENT_DATA', JSON.stringify(parsed));
      } catch (err) {}
    }

    if (showToast) showToast('success', 'Profile Updated', 'Shop and owner details updated successfully!');
  };

  // Save Jharsewa Creds to LocalStorage
  const handleSaveJharsewaCreds = (e) => {
    e.preventDefault();
    if (!jharsewaCreds.userId.trim()) {
      if (showToast) showToast('error', 'User ID Required', 'Please enter Jharsewa Login User ID');
      return;
    }
    localStorage.setItem('JHARSEWA_CLIENT_CREDS', JSON.stringify(jharsewaCreds));
    if (showToast) showToast('success', 'Jharsewa Linked', 'Jharsewa portal credentials saved for automated status checking.');
  };

  // WhatsApp Connect / Disconnect Handlers
  const handleRequestLiveQr = async () => {
    setIsQrLoading(true);
    try {
      let res;
      try {
        res = await fetch('http://localhost:5000/api/whatsapp/reconnect', { method: 'POST' });
      } catch (e) {
        res = await fetch('/api/whatsapp/reconnect', { method: 'POST' });
      }
      if (showToast) showToast('info', 'QR Requested', 'Generating WhatsApp QR code from Engine...');
      // Brief pause then poll immediately
      setTimeout(async () => {
        try {
          const sRes = await fetch('http://localhost:5000/api/whatsapp/status').catch(() => fetch('/api/whatsapp/status'));
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.qrCodeData) setLiveQrUri(sData.qrCodeData);
          }
        } catch (e) {}
        setIsQrLoading(false);
      }, 2000);
    } catch (err) {
      setIsQrLoading(false);
      if (showToast) showToast('error', 'QR Error', 'Failed to connect with WhatsApp engine.');
    }
  };

  const handleDisconnectWhatsapp = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp integration? Auto notifications will be paused.')) return;
    try {
      try {
        await fetch('http://localhost:5000/api/whatsapp/logout', { method: 'POST' });
      } catch (e) {
        await fetch('/api/whatsapp/logout', { method: 'POST' });
      }
      const updated = { ...whatsappSetup, status: 'DISCONNECTED' };
      setWhatsappSetup(updated);
      setLiveQrUri(null);
      localStorage.setItem('WHATSAPP_LINK_SETUP', JSON.stringify(updated));
      if (showToast) showToast('info', 'WhatsApp Disconnected', 'WhatsApp bot disconnected successfully.');
    } catch (err) {
      if (showToast) showToast('error', 'Disconnect Failed', err.message);
    }
  };

  const handleGeneratePairingCode = async () => {
    if (!pairingPhone || pairingPhone.replace(/\D/g, '').length < 10) {
      if (showToast) showToast('error', 'Phone Required', 'Enter valid 10-digit mobile number for Pairing Code.');
      return;
    }
    setIsGeneratingPairCode(true);
    setPairingCodeResult('');
    try {
      const clean = pairingPhone.replace(/\D/g, '');
      let res;
      try {
        res = await fetch('http://localhost:5000/api/whatsapp/pair-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: clean })
        });
      } catch (e) {
        res = await fetch('/api/whatsapp/pair-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: clean })
        });
      }
      const data = await res.json();
      if (data.success && data.pairingCode) {
        setPairingCodeResult(data.pairingCode);
        if (showToast) showToast('success', 'Pairing Code Ready', `Enter code ${data.pairingCode} in your phone.`);
      } else {
        if (showToast) showToast('error', 'Pair Code Failed', data.error || 'Could not generate code.');
      }
    } catch (err) {
      if (showToast) showToast('error', 'Pairing Error', err.message);
    } finally {
      setIsGeneratingPairCode(false);
    }
  };

  const handleSaveWhatsappSettings = () => {
    localStorage.setItem('WHATSAPP_LINK_SETUP', JSON.stringify(whatsappSetup));
    if (showToast) showToast('success', 'Automation Settings Saved', 'WhatsApp notification preferences updated.');
  };

  const handleSendTestWhatsapp = async () => {
    if (!testMobileInput || !testMobileInput.trim()) {
      if (showToast) showToast('error', 'Mobile Required', 'Please enter a 10-digit WhatsApp Mobile Number');
      return;
    }

    const cleanNum = testMobileInput.replace(/\D/g, '');
    if (cleanNum.length < 10) {
      if (showToast) showToast('error', 'Invalid Mobile', 'Mobile number must be at least 10 digits.');
      return;
    }

    setIsSendingTestMsg(true);
    if (showToast) showToast('info', 'Sending Test Message', `Dispatching test WhatsApp message to +91 ${cleanNum}...`);

    try {
      let res;
      try {
        res = await axios.post('http://localhost:5000/api/whatsapp/test-message', {
          mobile: cleanNum,
          message: '📲 *WhatsApp Bot Link Successful!* \nThis is a live connection test message from your Certificate Management Software.'
        });
      } catch (lErr) {
        res = await axios.post('/api/whatsapp/test-message', {
          mobile: cleanNum,
          message: '📲 *WhatsApp Bot Link Successful!* \nThis is a live connection test message from your Certificate Management Software.'
        });
      }

      if (res && res.data && res.data.success) {
        if (showToast) showToast('success', 'Test Message Delivered', `WhatsApp test message successfully delivered to +91 ${cleanNum}!`);
      } else {
        if (showToast) showToast('error', 'Test Failed', res?.data?.error || res?.data?.reason || 'Unable to send test WhatsApp message.');
      }
    } catch (err) {
      if (showToast) showToast('error', 'Send Error', err.response?.data?.error || err.message || 'WhatsApp Bot is offline or disconnected.');
    } finally {
      setIsSendingTestMsg(false);
    }
  };


  return (
    <div className="space-y-8 w-full animate-in fade-in duration-300">
      
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border border-blue-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black shadow-inner">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Profile & Account Settings
              <span className="px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider">
                Partner Portal
              </span>
            </h2>
            <p className="text-xs text-blue-200 mt-1 max-w-xl">
              Manage your business profile, view active license info, set up Jharsewa automation credentials, and pair your WhatsApp Bot.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

        {/* SECTION 1: CLIENT PERSONAL & BUSINESS PROFILE DETAILS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              1. Business & Owner Profile Details
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Editable
            </span>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-medium">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Shop / Business Name (Locked)</label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  readOnly
                  value={profile.clientName}
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-slate-700 font-bold cursor-not-allowed select-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Owner / CSC Partner Name (Locked)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    readOnly
                    value={profile.ownerName}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-slate-700 font-semibold cursor-not-allowed select-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Registered Phone / WhatsApp (Locked)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    readOnly
                    value={profile.phone}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-slate-700 font-mono font-bold cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Center / Shop Address (Editable)</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <textarea
                  rows="2"
                  value={profile.address}
                  onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500/20 font-medium"
                ></textarea>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-slate-700 font-bold mb-1">Change Account Password (Editable)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={profile.password}
                  onChange={(e) => setProfile(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter new password to change..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200/80 p-2.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Shop Name, Owner Name, और Registered Mobile Number बदलने के लिए अपने Admin से संपर्क करें। आप केवल Address और Password ही बदल सकते हैं।</span>
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md transition text-xs cursor-pointer"
              >
                <FileEdit className="w-4 h-4" />
                <span>Request for Changes</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-md transition text-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </div>


        {/* SECTION 2: LICENSE & SUBSCRIPTION DETAILS (READ ONLY) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  2. System License & Subscription Details
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenUpgradeModal}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                  <span>Upgrade Plan</span>
                </button>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase tracking-wider">
                  Active License
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">License Number / Key</span>
                <span className="font-mono text-xs font-black text-blue-700 break-all select-all">{licenseInfo.licenseKey}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Allowed Computers (PC Limit)</span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <span className="font-extrabold text-blue-700">{hwidList.length}</span> / {allowedPcs} Authorized PCs
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Registration Date</span>
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {licenseInfo.regDate}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Subscription Plan</span>
                  <span className="font-extrabold text-emerald-700 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    {licenseInfo.planType}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenUpgradeModal}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-black text-[11px] transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 text-amber-700" />
                  Upgrade
                </button>
              </div>
            </div>

            {/* REGISTERED HARDWARE ID (HWID) MANAGEMENT BOX */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-600" />
                  Registered Hardware IDs ({hwidList.length})
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  Limit: {allowedPcs} PCs
                </span>
              </div>

              {/* Add New Hardware ID Input Form */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Cpu className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newHwidInput}
                    onChange={(e) => setNewHwidInput(e.target.value)}
                    placeholder="Enter PC Hardware ID (e.g. HWID-WIN-24E6-3A85)..."
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newHwidInput.trim()) {
                      if (showToast) showToast('error', 'HWID Required', 'Please enter Hardware ID (HWID)');
                      return;
                    }
                    const cleanHwid = newHwidInput.trim().toUpperCase();
                    if (hwidList.includes(cleanHwid)) {
                      if (showToast) showToast('error', 'Already Registered', 'This HWID is already in your registered list');
                      return;
                    }
                    if (hwidList.length >= allowedPcs) {
                      if (showToast) showToast('error', 'PC Limit Exceeded', `Your plan allows maximum ${allowedPcs} authorized PCs.`);
                      return;
                    }

                    const updated = [...hwidList, cleanHwid];
                    setHwidList(updated);
                    setNewHwidInput('');

                    // Sync to Firebase & LocalStorage
                    const primaryKey = clientData?.hwid || hwidList[0] || localStorage.getItem('CLIENT_SYSTEM_HWID');
                    await updateClientHwidsOnFirebase(primaryKey, updated);
                    
                    const activeData = localStorage.getItem('ACTIVE_CLIENT_DATA');
                    if (activeData) {
                      try {
                        const parsed = JSON.parse(activeData);
                        parsed.hwids = updated;
                        localStorage.setItem('ACTIVE_CLIENT_DATA', JSON.stringify(parsed));
                      } catch (err) {}
                    }

                    if (showToast) showToast('success', 'HWID Added', `Hardware ID ${cleanHwid} added & saved to database.`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add HWID</span>
                </button>
              </div>

              {/* Added HWIDs List (Read-Only Once Added) */}
              <div className="space-y-2 pt-1">
                {hwidList.map((hwidItem, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-xs font-black text-slate-800 truncate select-all">{hwidItem}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-slate-400 font-bold text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Locked (Contact Admin to Remove)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center font-black">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[11px] font-extrabold uppercase text-emerald-100">Subscription Validity Status</div>
                <div className="text-sm font-black">{licenseInfo.daysLeftText}</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-white text-emerald-950 text-xs font-black shadow-sm">
              License Verified
            </span>
          </div>
        </div>


        {/* SECTION 3: JHARSEWA CREDENTIALS SETUP */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              3. Jharsewa Portal Credentials Setup
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Auto Sync Bot
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Enter your official Jharsewa Portal login credentials below. This allows the system to automatically fetch live application stages and status updates for your clients.
          </p>

          <form onSubmit={handleSaveJharsewaCreds} className="space-y-4 text-xs font-medium">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Jharsewa Login User ID *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={jharsewaCreds.userId}
                    onChange={(e) => setJharsewaCreds(prev => ({ ...prev, userId: e.target.value }))}
                    placeholder="e.g. CSC_RANCHI_01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Jharsewa Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showJharsewaPass ? 'text' : 'password'}
                    required
                    value={jharsewaCreds.password}
                    onChange={(e) => setJharsewaCreds(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJharsewaPass(!showJharsewaPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showJharsewaPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoSyncCheck"
                checked={jharsewaCreds.autoSyncEnabled}
                onChange={(e) => setJharsewaCreds(prev => ({ ...prev, autoSyncEnabled: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="autoSyncCheck" className="text-slate-700 font-bold cursor-pointer select-none">
                Enable background automatic status synchronization
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition"
              >
                <Save className="w-4 h-4" />
                <span>Save Jharsewa Credentials</span>
              </button>
            </div>
          </form>
        </div>


        {/* SECTION 4: WHATSAPP BOT LINKING SETUP */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              4. Dashboard WhatsApp Bot Linking
            </h3>
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              whatsappSetup.status === 'CONNECTED'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}>
              {whatsappSetup.status === 'CONNECTED' ? 'CONNECTED' : 'NOT LINKED'}
            </span>
          </div>

          {whatsappSetup.status === 'CONNECTED' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-900">WhatsApp Bot Active & Synchronized</h4>
                    <p className="text-[11px] text-emerald-700 font-mono font-bold">+91 {whatsappSetup.connectedPhone}</p>
                  </div>
                </div>

                <button
                  onClick={handleDisconnectWhatsapp}
                  className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 text-xs font-bold transition"
                >
                  Disconnect Bot
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <QrCode className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-800">Link WhatsApp via Local Engine</h4>
                <p className="text-[11px] text-slate-500">Scan QR code or use 8-Digit Pairing Code to link WhatsApp directly.</p>
              </div>

              {/* LIVE QR CODE DISPLAY */}
              {liveQrUri ? (
                <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/40 max-w-[220px] mx-auto shadow-sm text-center space-y-2">
                  <img src={liveQrUri} alt="WhatsApp QR Code" className="w-full h-auto rounded-lg mx-auto" />
                  <p className="text-[10px] text-emerald-800 font-bold animate-pulse">Scan with WhatsApp Linked Devices</p>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleRequestLiveQr}
                  disabled={isQrLoading}
                  className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition inline-flex items-center justify-center gap-2"
                >
                  {isQrLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  <span>{isQrLoading ? 'Requesting Live QR...' : (liveQrUri ? 'Refresh QR Code' : 'Show WhatsApp QR Code')}</span>
                </button>
              </div>

              {/* ALTERNATIVE: 8-DIGIT PAIRING CODE */}
              <div className="pt-3 border-t border-slate-200 text-left space-y-2">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  Or Link with 8-Digit Pairing Code (No QR Needed):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="Mobile (e.g. 8210212926)"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePairingCode}
                    disabled={isGeneratingPairCode}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl transition shrink-0"
                  >
                    {isGeneratingPairCode ? 'Generating...' : 'Get Code'}
                  </button>
                </div>
                {pairingCodeResult && (
                  <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-xl text-center space-y-1">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Your 8-Digit WhatsApp Code:</span>
                    <span className="text-xl font-mono font-black text-emerald-950 tracking-widest">{pairingCodeResult}</span>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Automation Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs font-medium">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Automated Notifications Preferences:</h4>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notifyStatus"
                checked={whatsappSetup.autoNotifyStatusChange}
                onChange={(e) => setWhatsappSetup(prev => ({ ...prev, autoNotifyStatusChange: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="notifyStatus" className="text-slate-700 font-bold cursor-pointer select-none">
                Send instant WhatsApp message when certificate status updates (Delivered / Rejected)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notifyPdf"
                checked={whatsappSetup.autoSendPdfReceipt}
                onChange={(e) => setWhatsappSetup(prev => ({ ...prev, autoSendPdfReceipt: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="notifyPdf" className="text-slate-700 font-bold cursor-pointer select-none">
                Auto send digital payment receipt to applicant WhatsApp number upon entry
              </label>
            </div>

          {/* Test WhatsApp Message Dispatch Tool */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 mt-4">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              Live WhatsApp Bot Connection Tester
            </h4>
            <p className="text-[11px] text-slate-500">
              Enter any WhatsApp mobile number below and click "Send Test Message" to verify if the bot is successfully delivering live WhatsApp alerts.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={testMobileInput}
                  onChange={(e) => setTestMobileInput(e.target.value)}
                  placeholder="Enter 10-digit WhatsApp Mobile Number (e.g. 8210212926)..."
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestWhatsapp}
                disabled={isSendingTestMsg}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingTestMsg ? 'animate-bounce' : ''}`} />
                <span>{isSendingTestMsg ? 'Sending Message...' : 'Send Test Message'}</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveWhatsappSettings}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition"
            >
              <Save className="w-4 h-4" />
              <span>Save WhatsApp Preferences</span>
            </button>
          </div>
          </div>
        </div>

      </div>

      {/* REQUEST FOR PROFILE CHANGES MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Request Profile Update</h3>
                  <p className="text-xs text-slate-500">Send change request directly to Admin WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Checkbox Section */}
            <div className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-800 font-extrabold text-sm mb-1">
                  What fields do you want to update? *
                </label>
                <p className="text-slate-500 text-[11px] mb-3">Select the locked fields you wish to update:</p>

                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  {/* 1. Shop Name Checkbox */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="chkShopName"
                        checked={requestFields.shopName}
                        onChange={(e) => setRequestFields(prev => ({ ...prev, shopName: e.target.checked }))}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="chkShopName" className="text-slate-800 font-bold cursor-pointer select-none">
                        Shop / Business Name
                      </label>
                    </div>

                    {requestFields.shopName && (
                      <div className="pl-6 animate-in fade-in">
                        <input
                          type="text"
                          value={newValues.newShopName}
                          onChange={(e) => setNewValues(prev => ({ ...prev, newShopName: e.target.value }))}
                          placeholder="Enter New Shop / Business Name..."
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    )}
                  </div>

                  {/* 2. Owner Name Checkbox */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="chkOwnerName"
                        checked={requestFields.ownerName}
                        onChange={(e) => setRequestFields(prev => ({ ...prev, ownerName: e.target.value }))}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="chkOwnerName" className="text-slate-800 font-bold cursor-pointer select-none">
                        Owner / CSC Partner Name
                      </label>
                    </div>

                    {requestFields.ownerName && (
                      <div className="pl-6 animate-in fade-in">
                        <input
                          type="text"
                          value={newValues.newOwnerName}
                          onChange={(e) => setNewValues(prev => ({ ...prev, newOwnerName: e.target.value }))}
                          placeholder="Enter New Owner Name..."
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    )}
                  </div>

                  {/* 3. Registered Mobile Checkbox */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="chkMobile"
                        checked={requestFields.mobile}
                        onChange={(e) => setRequestFields(prev => ({ ...prev, mobile: e.target.value }))}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="chkMobile" className="text-slate-800 font-bold cursor-pointer select-none">
                        Registered Mobile Number
                      </label>
                    </div>

                    {requestFields.mobile && (
                      <div className="pl-6 animate-in fade-in">
                        <input
                          type="text"
                          value={newValues.newMobile}
                          onChange={(e) => setNewValues(prev => ({ ...prev, newMobile: e.target.value }))}
                          placeholder="Enter New Registered Mobile Number..."
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!requestFields.shopName && !requestFields.ownerName && !requestFields.mobile}
                  onClick={() => {
                    const changes = [];
                    if (requestFields.shopName && newValues.newShopName.trim()) {
                      changes.push(`• New Shop Name: ${newValues.newShopName.trim()}`);
                    }
                    if (requestFields.ownerName && newValues.newOwnerName.trim()) {
                      changes.push(`• New Owner Name: ${newValues.newOwnerName.trim()}`);
                    }
                    if (requestFields.mobile && newValues.newMobile.trim()) {
                      changes.push(`• New Registered Mobile: ${newValues.newMobile.trim()}`);
                    }

                    if (changes.length === 0) {
                      if (showToast) showToast('error', 'New Values Required', 'Please enter new values for selected fields');
                      return;
                    }

                    const adminMsg = `*PROFILE CHANGE REQUEST FROM CLIENT*\n\n` +
                      `*Current Client Details:*\n` +
                      `• Current Shop Name: ${profile.clientName}\n` +
                      `• Current Owner: ${profile.ownerName}\n` +
                      `• Registered Mobile: ${profile.phone}\n` +
                      `• Hardware ID (HWID): ${licenseInfo.hwid}\n` +
                      `• License Status: ${licenseInfo.planType} (${licenseInfo.daysLeftText})\n\n` +
                      `*Requested Profile Updates:*\n` +
                      `${changes.join('\n')}\n\n` +
                      `Please update these profile details in Admin Panel. Thank you!`;

                    const encodedMsg = encodeURIComponent(adminMsg);
                    const whatsappUrl = `https://wa.me/918210212926?text=${encodedMsg}`;
                    window.open(whatsappUrl, '_blank');

                    setIsRequestModalOpen(false);
                    if (showToast) showToast('success', 'Request Dispatched', 'Opening WhatsApp to send change request to Admin!');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Request via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* UPGRADE PLAN MULTI-STEP MODAL */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 md:p-7 w-full shadow-2xl space-y-5 transition-all duration-300 max-h-[92vh] flex flex-col my-auto ${
            upgradeStep === 1 ? 'max-w-5xl' : upgradeStep === 2 ? 'max-w-4xl' : 'max-w-lg'
          }`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    Upgrade Your Subscription Plan
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                      Current: {licenseInfo.planType}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {upgradeStep === 1 && 'Step 1 of 2: Select your preferred upgrade plan'}
                    {upgradeStep === 2 && 'Step 2 of 2: Scan QR Code to Pay & Enter UTR Number'}
                    {upgradeStep === 3 && 'Upgrade Request Submitted Successfully!'}
                  </p>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold p-1 rounded-lg transition"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">

              {/* STEP 1: CHOOSE UPGRADE PLAN */}
              {upgradeStep === 1 && (
                <div className="space-y-6">
                  {(() => {
                    const eligiblePlans = getEligibleUpgradePlans();

                    if (eligiblePlans.length === 0) {
                      return (
                        <div className="text-center py-10 space-y-3">
                          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl font-black">
                            👑
                          </div>
                          <h4 className="text-lg font-black text-white">You are already on the Top Plan!</h4>
                          <p className="text-xs text-slate-400 max-w-md mx-auto">
                            Your account is active on the highest available subscription. If you need custom multi-branch or enterprise access, please contact Admin directly.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch pt-3 pb-4">
                        {eligiblePlans.map((plan) => {
                          const isSelected = selectedUpgradePlanId === plan.id;
                          return (
                            <div
                              key={plan.id}
                              onClick={() => setSelectedUpgradePlanId(plan.id)}
                              className={`relative rounded-3xl p-5 border transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-slate-950 border-amber-500 ring-4 ring-amber-500/30 shadow-2xl shadow-amber-500/20 scale-105 -translate-y-2 z-10'
                                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90 scale-98 opacity-90 hover:opacity-100'
                              }`}
                            >
                              {/* Plan Header & Badge */}
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-wider ${plan.badgeColor}`}>
                                    {plan.badge}
                                  </span>
                                  {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-lg animate-in zoom-in-50 duration-200">
                                      ✓
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <h4 className="text-base font-black text-white">{plan.name}</h4>
                                  <div className="mt-1.5 flex items-baseline gap-2">
                                    {plan.originalPrice && (
                                      <span className="text-xs font-bold text-slate-500 line-through">
                                        {plan.originalPrice}
                                      </span>
                                    )}
                                    <span className="text-2xl font-black text-white">{plan.price}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">/ {plan.duration}</span>
                                  </div>
                                  <p className="text-[11px] text-emerald-400 font-extrabold mt-1">{plan.pcs}</p>
                                </div>

                                {/* Features List */}
                                <div className="border-t border-slate-800/80 pt-3.5 space-y-2">
                                  {plan.features.map((feat, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                      <span className="text-amber-400 font-bold">✓</span>
                                      {feat}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-5 pt-2">
                                <button
                                  type="button"
                                  className={`w-full py-2.5 rounded-xl text-xs font-black transition ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {isSelected ? 'Selected Upgrade Plan' : 'Select Plan'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsUpgradeModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleProceedToUpgradePayment}
                      className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/40 transition flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>Proceed to Payment (क्यूआर कोड)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PAYMENT QR CODE & UTR SUBMISSION */}
              {upgradeStep === 2 && (
                <div className="space-y-4 py-1 animate-in fade-in">
                  {(() => {
                    const currentPlan = allPlans.find(p => p.id === selectedUpgradePlanId) || {
                      name: 'Upgrade Plan',
                      price: '₹349',
                      duration: 'Validity'
                    };

                    return (
                      <>
                        {/* Top Plan Name & Rate Header Bar */}
                        <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-orange-950/70 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-lg text-amber-400 font-black shrink-0">
                              ⚡
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">चयनित अपग्रेड प्लान (Selected Upgrade Plan)</div>
                              <h3 className="text-sm sm:text-base font-black text-white">{currentPlan.name}</h3>
                              <p className="text-[11px] text-amber-300 font-semibold">{currentPlan.duration} • {currentPlan.pcs || 'Multi-PC Sync'}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 bg-slate-950/90 px-3.5 py-1.5 rounded-xl border border-amber-500/20">
                            <div className="text-[9px] text-slate-400 font-bold uppercase">भुगतान राशि</div>
                            <div className="text-xl font-black text-amber-400 font-mono">{currentPlan.price}</div>
                          </div>
                        </div>

                        {/* 2-Column Responsive Layout: Left QR Code, Right UTR & Instructions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          {/* LEFT COLUMN: QR Code Box */}
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl text-center space-y-2.5">
                            <div className="text-[11px] font-bold text-slate-300 flex items-center justify-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                              <span>PhonePe / GPay / Paytm से QR स्कैन करें</span>
                            </div>

                            <div className="p-2.5 bg-white rounded-xl shadow-inner inline-block mx-auto border border-amber-500/40">
                              <img 
                                src="/payment_qr.png" 
                                alt="Payment QR Code" 
                                className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg mx-auto"
                              />
                            </div>

                            <div className="text-[11px] font-mono text-slate-400">
                              UPI ID: <span className="font-bold text-amber-300 select-all">7781931880@ybl</span>
                            </div>
                          </div>

                          {/* RIGHT COLUMN: Instructions & UTR Input Field */}
                          <div className="space-y-3.5 text-left">
                            {/* Notice Banner */}
                            <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-400/50 rounded-2xl p-3.5 shadow-md">
                              <p className="text-xs sm:text-sm font-black text-amber-300 uppercase leading-snug tracking-wide">
                                📢 पेमेंट करने के बाद अपना UTR नंबर लिखकर सबमिट करें।
                              </p>
                              <p className="text-[11px] text-slate-200 font-bold mt-1.5 bg-slate-950/60 p-2 rounded-lg border border-amber-500/20">
                                ✓ Successful payment verify hone ke baad aapka plan upgrade kar diya jayega.
                              </p>
                            </div>

                            {/* Mandatory UTR / UPI Ref Number Input Field */}
                            <div className="space-y-1.5">
                              <label className="block text-xs font-black text-slate-200 uppercase tracking-wide">
                                UTR / UPI Reference Number <span className="text-rose-500">* (अनिवार्य)</span>
                              </label>
                              <input
                                type="text"
                                value={upgradeUtr}
                                onChange={(e) => {
                                  setUpgradeUtr(e.target.value);
                                  setUpgradeUtrError('');
                                }}
                                placeholder="e.g. 4289XXXXXXXX (12 अंकों का UTR नंबर)"
                                className="w-full bg-slate-950 border-2 border-amber-500/50 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs sm:text-sm tracking-wider font-bold shadow-inner placeholder-slate-600 focus:outline-none transition"
                              />

                              {upgradeUtrError && (
                                <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
                                  ⚠️ {upgradeUtrError}
                                </div>
                              )}
                            </div>

                            {/* Quick Help Tip */}
                            <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                              💡 <strong>UTR कहाँ मिलेगा?</strong> PhonePe/GPay में पेमेंट सफलता स्क्रीन के नीचे <code className="text-amber-300 font-mono">UTR / UPI Ref ID</code> लिखा होता है।
                            </div>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => setUpgradeStep(1)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                          >
                            ← प्लान बदलें (Back)
                          </button>

                          <button
                            type="button"
                            disabled={isSubmittingUpgrade}
                            onClick={handleUpgradeSubmit}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 transition flex items-center gap-2 transform active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            {isSubmittingUpgrade ? (
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                सबमिट हो रहा है...
                              </span>
                            ) : (
                              <>
                                <span>अपग्रेड रिक्वेस्ट सबमिट करें</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* STEP 3: THANKS TO UPGRADE BEAUTIFUL POPUP */}
              {upgradeStep === 3 && submittedUpgradeInfo && (
                <div className="py-6 text-center space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></div>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-3xl shadow-xl shadow-emerald-500/30">
                      🎉
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                      Request Submitted Successfully
                    </span>
                    <h3 className="text-2xl font-black text-white">
                      Thanks for Upgrading! 🙏
                    </h3>
                    <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                      धन्यवाद! आपकी <strong className="text-amber-300">{submittedUpgradeInfo.planName}</strong> के लिए अपग्रेड रिक्वेस्ट और UTR नंबर एडमिन को सफलतापूर्वक भेज दी गई है।
                    </p>
                  </div>

                  {/* Submission Summary Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Upgrade Plan:</span>
                      <span className="text-amber-400 font-bold">{submittedUpgradeInfo.planName}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Amount Paid:</span>
                      <span className="text-emerald-400 font-bold">{submittedUpgradeInfo.price}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Validity:</span>
                      <span className="text-blue-400 font-bold">{submittedUpgradeInfo.duration}</span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-slate-400">Submitted UTR:</span>
                      <span className="text-white font-bold tracking-wider select-all">{submittedUpgradeInfo.utrNumber}</span>
                    </div>
                  </div>

                  {/* Verification Note */}
                  <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-3.5 max-w-md mx-auto text-xs text-blue-200">
                    ℹ️ <strong>Status:</strong> Successful payment verify hone ke baad aapka plan upgrade kar diya jayega.
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsUpgradeModalOpen(false)}
                      className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-900/40 transition active:scale-95 cursor-pointer"
                    >
                      Done / Close Window
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
