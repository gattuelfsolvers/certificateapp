import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, ShieldAlert, KeyRound, Plus, Search, Filter, 
  RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, LogOut, 
  Copy, Check, Download, Upload, Trash2, Edit, Smartphone, Store,
  Building2, Calendar, Shield, Activity, Power, RefreshCcw, Bell,
  ChevronRight, Layers, DollarSign, LayoutDashboard, Settings, Menu, PanelLeftClose, PanelLeft, UserCheck,
  UserCheck as ManageAccountIcon, MessageSquare, Key, CheckCircle, Send, QrCode, Sliders, Eye
} from 'lucide-react';
import { 
  fetchClientsFromFirebase, 
  saveClientToFirebase, 
  updateClientStatusOnFirebase, 
  deleteClientFromFirebase, 
  generateLicenseKey,
  subscribeClientsFromFirebase 
} from '../firebase';

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'clients' | 'licenses' | 'plans'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Plans Master State with Max Allowed PCs
  const [plans, setPlans] = useState([
    { id: 'FREE_TRIAL', name: 'Free Trial', days: 7, price: 0, status: 'ACTIVE', maxPcs: 1 },
    { id: 'MONTHLY', name: 'Monthly Plan', days: 30, price: 299, status: 'ACTIVE', maxPcs: 2 },
    { id: 'HALF_YEARLY', name: 'Half-Yearly Plan', days: 180, price: 1499, status: 'ACTIVE', maxPcs: 5 },
    { id: 'YEARLY', name: 'Yearly Plan', days: 365, price: 2499, status: 'ACTIVE', maxPcs: 10 }
  ]);

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
      const data = await res.json();
      if (data.success && data.pairingCode) {
        setPairingCodeResult(data.pairingCode);
        showToast('success', 'Pairing Code Generated', 'Enter this 8-digit code in WhatsApp app Linked Devices.');
      } else {
        showToast('error', 'Pairing Failed', data.error || 'Failed to get pairing code.');
      }
    } catch (e) {
      showToast('error', 'Request Failed', e.message);
    } finally {
      setLoadingPairingCode(false);
    }
  };

  // Poll Backend Baileys Engine Status
  useEffect(() => {
    let isMounted = true;
    const checkWaStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (!res.ok) throw new Error('API offline');
        const data = await res.json();
        if (data.success && isMounted) {
          if (data.isConnected) {
            setWhatsappConfig(prev => ({
              ...prev,
              instanceStatus: 'CONNECTED',
              connectedPhone: data.connectedPhone || prev.connectedPhone || '919876543210'
            }));
          } else {
            if (data.qrCodeData && data.qrCodeData.startsWith('data:image')) {
              setBackendQrUri(data.qrCodeData);
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
    const unsubscribe = subscribeClientsFromFirebase((updatedClients) => {
      setClients(updatedClients || []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const handlePlanTypeChange = (plan) => {
    let days = 30;
    let pcs = 2;
    if (plan === 'FREE_TRIAL') { days = 7; pcs = 1; }
    if (plan === 'MONTHLY') { days = 30; pcs = 2; }
    if (plan === 'HALF_YEARLY') { days = 180; pcs = 5; }
    if (plan === 'YEARLY') { days = 365; pcs = 10; }

    const generated = generateLicenseKey(formData.hwid || 'DEFAULT', plan);
    setFormData(prev => ({
      ...prev,
      planType: plan,
      customDays: days,
      allowedPcs: pcs,
      licenseKey: generated.licenseKey
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
      if (formData.planType === 'FREE_TRIAL') daysToAdd = 7;
      else if (formData.planType === 'MONTHLY') daysToAdd = 30;
      else if (formData.planType === 'HALF_YEARLY') daysToAdd = 180;
      else if (formData.planType === 'YEARLY') daysToAdd = 365;

      // Always calculate fresh expiry from Today when saving/updating plan
      let expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysToAdd);

      const primaryHwid = (formData.hwids && formData.hwids.length > 0 ? formData.hwids[0] : formData.hwid).trim().toUpperCase();

      const payload = {
        hwid: primaryHwid,
        hwids: formData.hwids && formData.hwids.length > 0 ? formData.hwids : [primaryHwid],
        allowedPcs: parseInt(formData.allowedPcs || 2),
        clientName: formData.clientName.trim(),
        ownerName: formData.ownerName.trim(),
        phone: formData.phone.trim(),
        planType: formData.planType,
        status: formData.status,
        licenseKey: formData.licenseKey,
        expiresAt: expiresAt.toISOString()
      };

      await saveClientToFirebase(payload);
      setIsModalOpen(false);
      showToast('success', 'Client Saved', `Client ${payload.clientName} saved successfully with ${payload.hwids.length} Whitelisted HWID(s)!`);
    } catch (err) {
      showToast('error', 'Error Saving Client', err.message);
    }
  };

  const handleToggleStatus = async (hwid, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'KILLED' : 'ACTIVE';
    try {
      await updateClientStatusOnFirebase(hwid, newStatus);
      showToast(
        newStatus === 'KILLED' ? 'error' : 'success', 
        'Status Changed', 
        `Client license status set to ${newStatus}`
      );
    } catch (err) {
      showToast('error', 'Update Failed', err.message);
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

      await saveClientToFirebase({
        ...client,
        hwid: newHwid,
        licenseKey: newKey
      });
      showToast('info', 'HWID Reset Complete', `Device lock reset for ${client.clientName}. Ready for formatted PC re-activation!`);
    } catch (err) {
      showToast('error', 'Reset Failed', err.message);
    }
  };

  const handleDeleteClient = async (hwid, clientName) => {
    if (!window.confirm(`Are you sure you want to delete client "${clientName}"?`)) return;
    try {
      await deleteClientFromFirebase(hwid);
      showToast('info', 'Client Deleted', `Client ${clientName} removed.`);
    } catch (err) {
      showToast('error', 'Delete Failed', err.message);
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

  // Stats Calculations
  const totalCount = clients.length;
  const activeCount = clients.filter(c => c.status === 'ACTIVE' && new Date(c.expiresAt) > new Date()).length;
  const expiredCount = clients.filter(c => new Date(c.expiresAt) <= new Date() || c.status === 'EXPIRED').length;
  const killedCount = clients.filter(c => c.status === 'KILLED' || c.status === 'INACTIVE').length;
  const pendingRequests = clients.filter(c => c.status === 'PENDING');
  const pendingCount = pendingRequests.length;

  // Filtered Clients
  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      (c.clientName && c.clientName.toLowerCase().includes(search.toLowerCase())) ||
      (c.ownerName && c.ownerName.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search)) ||
      (c.licenseKey && c.licenseKey.toLowerCase().includes(search.toLowerCase()));

    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'ACTIVE') return matchesSearch && c.status === 'ACTIVE' && new Date(c.expiresAt) > new Date();
    if (statusFilter === 'EXPIRED') return matchesSearch && (new Date(c.expiresAt) <= new Date() || c.status === 'EXPIRED');
    if (statusFilter === 'KILLED') return matchesSearch && (c.status === 'KILLED' || c.status === 'INACTIVE');
    if (statusFilter === 'PENDING') return matchesSearch && c.status === 'PENDING';
    return matchesSearch;
  });

  const calculateDaysLeft = (expiresAtStr) => {
    if (!expiresAtStr) return 0;
    const diffTime = new Date(expiresAtStr) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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
                  <span className="w-5 text-center text-sm font-bold">💎</span>
                  <span className="text-sm font-bold whitespace-nowrap">Plan Master</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">{plans.length}</span>
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
              <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Pending Requests Alert Section */}
          {pendingRequests.length > 0 && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg space-y-3 w-full">
              <div className="flex items-center gap-2 font-extrabold text-base">
                <Bell className="w-5 h-5 animate-bounce" />
                New Client Access Requests Pending Approval ({pendingRequests.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                {pendingRequests.map(req => (
                  <div key={req.id} className="bg-white/95 text-slate-800 p-4 rounded-xl shadow flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{req.clientName}</h4>
                      <p className="text-xs text-slate-500 font-mono">{req.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateClientStatusOnFirebase(req.hwid || req.id, 'ACTIVE')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => updateClientStatusOnFirebase(req.hwid || req.id, 'KILLED')}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 0: OVERVIEW DASHBOARD VIEW */}
          {(activeTab === 'dashboard' || activeTab === 'clients') && (
            <div className="space-y-4 w-full">
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
                                    <Clock className="w-3 h-3 text-violet-600" /> PENDING APPROVAL
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
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE ({daysLeft} Days Left)
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
                                    <button onClick={() => handleRenewLicense(client)} title="Renew License (+30 Days)" className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition shadow-sm"><RefreshCcw className="w-4 h-4" /></button>
                                    <button onClick={() => handleResetHWID(client)} title="Reset HWID (Support Formatted PC)" className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition shadow-sm"><Power className="w-4 h-4" /></button>
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
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                  Central License Keys & Device Fingerprint Master
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {clients.map(client => (
                    <div key={client.hwid || client.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{client.clientName}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">{client.planType}</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-blue-700 bg-white p-2 rounded border border-slate-200 break-all flex items-center justify-between">
                        <span>{client.licenseKey}</span>
                        <button onClick={() => handleCopyKey(client.licenseKey)} className="text-blue-500 hover:text-blue-800 ml-2">
                          {copiedKey === client.licenseKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>HWID: {client.hwid ? client.hwid.substring(0, 12) + '...' : 'LOCKED'}</span>
                        <button onClick={() => handleResetHWID(client)} className="text-sky-600 font-bold hover:underline">Reset HWID</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLAN MASTER VIEW */}
          {activeTab === 'plans' && (
            <div className="space-y-4 w-full">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  SaaS Subscription Pricing & Duration Plans Master
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {plans.map(p => (
                    <div key={p.id} className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-900 text-base">{p.name}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">{p.status}</span>
                      </div>
                      <div className="text-2xl font-black text-blue-700">₹{p.price} <span className="text-xs font-medium text-slate-500">/ {p.days} Days</span></div>
                      <p className="text-xs text-slate-500">Includes 1-Click Jharsewa Sync Bot & WhatsApp receipts.</p>
                    </div>
                  ))}
                </div>
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
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
                          Link Device (Scan QR)
                        </button>
                      )}
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

                    <button 
                      onClick={() => showToast('success', 'WhatsApp Gateway Saved', 'Automated message triggers & gateway settings updated!')}
                      className="w-full py-3 mt-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Save WhatsApp Automation Settings
                    </button>
                  </div>
                </div>
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
                  <input type="text" required value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="e.g. 9876543210" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono font-semibold disabled:bg-slate-100 disabled:text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 text-xs">Subscription Plan</label>
                  <select value={formData.planType} onChange={(e) => handlePlanTypeChange(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-bold disabled:bg-slate-100 disabled:text-slate-800">
                    <option value="FREE_TRIAL">Free Trial (7 Days)</option>
                    <option value="MONTHLY">Monthly (30 Days)</option>
                    <option value="HALF_YEARLY">Half-Yearly (180 Days)</option>
                    <option value="YEARLY">Yearly (365 Days)</option>
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md">Close Window</button>
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
    </div>
  );
}
