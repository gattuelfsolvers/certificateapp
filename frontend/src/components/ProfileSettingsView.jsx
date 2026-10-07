import React, { useState, useEffect } from 'react';
import { 
  User, Store, Phone, MapPin, Key, ShieldCheck, Cpu, Calendar, Clock, 
  Lock, Smartphone, CheckCircle2, MessageSquare, AlertCircle, Save, Eye, EyeOff, QrCode, RefreshCw, Zap, Send, FileEdit, Plus, Trash2, Edit, Monitor
} from 'lucide-react';

import { updateClientHwidsOnFirebase } from '../firebase';
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
      status: 'CONNECTED', // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTED'
      connectedPhone: clientData?.phone || '8210212926',
      autoNotifyStatusChange: true,
      autoSendPdfReceipt: true
    };
  });

  const [isQrLoading, setIsQrLoading] = useState(false);
  const [testMobileInput, setTestMobileInput] = useState(clientData?.phone || '8210212926');
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);

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
  const handleSimulateQrScan = () => {
    setIsQrLoading(true);
    setTimeout(() => {
      setIsQrLoading(false);
      const updated = { ...whatsappSetup, status: 'CONNECTED', connectedPhone: profile.phone };
      setWhatsappSetup(updated);
      localStorage.setItem('WHATSAPP_LINK_SETUP', JSON.stringify(updated));
      if (showToast) showToast('success', 'WhatsApp Linked', `WhatsApp connected with +91 ${profile.phone}`);
    }, 1500);
  };

  const handleDisconnectWhatsapp = () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp integration? Auto notifications will be paused.')) return;
    const updated = { ...whatsappSetup, status: 'DISCONNECTED' };
    setWhatsappSetup(updated);
    localStorage.setItem('WHATSAPP_LINK_SETUP', JSON.stringify(updated));
    if (showToast) showToast('info', 'WhatsApp Disconnected', 'WhatsApp bot disconnected.');
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
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                2. System License & Subscription Details
              </h3>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase tracking-wider">
                Active License
              </span>
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

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Subscription Plan</span>
                <span className="font-extrabold text-emerald-700 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  {licenseInfo.planType}
                </span>
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
                    <h4 className="text-xs font-black text-emerald-900">WhatsApp Bot Active</h4>
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
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-800">Scan QR Code to Link WhatsApp</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Link your WhatsApp Web to send automatic status updates & receipts to customers.</p>
              </div>
              <button
                onClick={handleSimulateQrScan}
                disabled={isQrLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition inline-flex items-center gap-2"
              >
                {isQrLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                <span>{isQrLoading ? 'Generating QR Code...' : 'Generate WhatsApp QR Code'}</span>
              </button>
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
    </div>
  );
}
