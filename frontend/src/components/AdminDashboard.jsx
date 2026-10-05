import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, ShieldAlert, KeyRound, Plus, Search, Filter, 
  RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, LogOut, 
  Copy, Check, Download, Upload, Trash2, Edit, Smartphone, Store,
  Building2, Calendar, Shield, Activity, Power, RefreshCcw, Bell,
  ChevronRight, Layers, DollarSign, LayoutDashboard, Settings, Menu, PanelLeftClose, PanelLeft, UserCheck
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
  
  // Plans Master State
  const [plans, setPlans] = useState([
    { id: 'FREE_TRIAL', name: 'Free Trial', days: 7, price: 0, status: 'ACTIVE' },
    { id: 'MONTHLY', name: 'Monthly Plan', days: 30, price: 299, status: 'ACTIVE' },
    { id: 'HALF_YEARLY', name: 'Half-Yearly Plan', days: 180, price: 1499, status: 'ACTIVE' },
    { id: 'YEARLY', name: 'Yearly Plan', days: 365, price: 2499, status: 'ACTIVE' }
  ]);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    hwid: '',
    clientName: '',
    ownerName: '',
    phone: '',
    planType: 'MONTHLY',
    customDays: 30,
    licenseKey: '',
    status: 'ACTIVE'
  });

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
    const defaultHwid = `HWID-SHOP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const generated = generateLicenseKey(defaultHwid, 'MONTHLY');
    setEditingClient(null);
    setFormData({
      hwid: defaultHwid,
      clientName: '',
      ownerName: '',
      phone: '',
      planType: 'MONTHLY',
      customDays: 30,
      licenseKey: generated.licenseKey,
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setFormData({
      hwid: client.hwid || client.id,
      clientName: client.clientName || '',
      ownerName: client.ownerName || '',
      phone: client.phone || '',
      planType: client.planType || 'MONTHLY',
      customDays: 30,
      licenseKey: client.licenseKey || '',
      status: client.status || 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handlePlanTypeChange = (plan) => {
    let days = 30;
    if (plan === 'FREE_TRIAL') days = 7;
    if (plan === 'HALF_YEARLY') days = 180;
    if (plan === 'YEARLY') days = 365;

    const generated = generateLicenseKey(formData.hwid || 'DEFAULT', plan);
    setFormData(prev => ({
      ...prev,
      planType: plan,
      customDays: days,
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
      let expiresAt = new Date();
      if (editingClient && editingClient.expiresAt) {
        expiresAt = new Date(editingClient.expiresAt);
      }
      expiresAt.setDate(expiresAt.getDate() + parseInt(formData.customDays || 30));

      const payload = {
        hwid: formData.hwid.trim().toUpperCase(),
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
      showToast('success', 'Client Saved', `Client ${payload.clientName} updated successfully!`);
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg">
                  <ShieldCheck className="w-6 h-6 text-yellow-300" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white tracking-tight">Master Admin</h2>
                  <p className="text-[11px] text-slate-400 font-medium">Apna Digital Hub</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Hide Sidebar"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
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
                  <LayoutDashboard className="w-4 h-4 text-yellow-400" />
                  <span>📊 Dashboard</span>
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
                  <Users className="w-4 h-4" />
                  <span>👥 Client Master</span>
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
                  <KeyRound className="w-4 h-4" />
                  <span>🔑 License Master</span>
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
                  <DollarSign className="w-4 h-4" />
                  <span>💎 Plan Master</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">{plans.length}</span>
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
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => handleRenewLicense(client)} title="Renew License (+30 Days)" className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition shadow-sm"><RefreshCcw className="w-4 h-4" /></button>
                                  <button onClick={() => handleResetHWID(client)} title="Reset HWID (Support Formatted PC)" className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition shadow-sm"><Power className="w-4 h-4" /></button>
                                  <button onClick={() => handleToggleStatus(client.hwid || client.id, client.status)} title={isKilled ? "Unblock Client" : "Kill / Terminate Client"} className={`p-2 rounded-xl border transition shadow-sm ${isKilled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}><ShieldAlert className="w-4 h-4" /></button>
                                  <button onClick={() => handleOpenEditModal(client)} title="Edit Client" className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200"><Edit className="w-4 h-4" /></button>
                                  <button onClick={() => handleBackupClientData(client)} title="Download Backup" className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200"><Download className="w-4 h-4" /></button>
                                  <button onClick={() => handleDeleteClient(client.hwid || client.id, client.clientName)} title="Delete Client" className="p-2 rounded-xl bg-slate-100 text-rose-600 border border-slate-200"><Trash2 className="w-4 h-4" /></button>
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

        </main>
      </div>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                {editingClient ? 'Edit Client Account' : 'Add New Client & Generate License'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Shop / CSC Center Name *</label>
                  <input type="text" required value={formData.clientName} onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))} placeholder="e.g. Gattu Jan Seva Kendra" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Owner Name *</label>
                  <input type="text" required value={formData.ownerName} onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))} placeholder="e.g. Nitish Nath" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">WhatsApp Mobile No *</label>
                  <input type="text" required value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="e.g. 9876543210" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-semibold" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Subscription Plan</label>
                  <select value={formData.planType} onChange={(e) => handlePlanTypeChange(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold">
                    <option value="FREE_TRIAL">Free Trial (7 Days)</option>
                    <option value="MONTHLY">Monthly (30 Days)</option>
                    <option value="HALF_YEARLY">Half-Yearly (180 Days)</option>
                    <option value="YEARLY">Yearly (365 Days)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                  <span>Generated License Key</span>
                  <button type="button" onClick={handleGenerateNewKey} className="text-blue-600 hover:underline text-[10px] font-bold">Generate Fresh Key</button>
                </label>
                <input type="text" readOnly value={formData.licenseKey} className="w-full bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-blue-800 font-mono text-xs font-black" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Account Status</label>
                  <select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="KILLED">KILLED / BLOCKED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Days to Add (+)</label>
                  <input type="number" value={formData.customDays} onChange={(e) => setFormData(prev => ({ ...prev, customDays: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md">Save Client License</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
