import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, ShieldAlert, KeyRound, Plus, Search, Filter, 
  RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, LogOut, 
  Copy, Check, Download, Upload, Trash2, Edit, Smartphone, Store,
  Building2, Calendar, Shield, Activity, Power, RefreshCcw, Bell
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
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
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
      newExpiry.setDate(newExpiry.getDate() + 30); // Add 30 days renewal

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 max-w-md animate-bounce ${
          toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' :
          toast.type === 'info' ? 'bg-sky-950/90 border-sky-500/40 text-sky-200' :
          'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
        }`}>
          <div className="font-bold text-sm">{toast.title}: <span className="font-normal text-xs">{toast.message}</span></div>
        </div>
      )}

      {/* Admin Navigation Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Master Admin Portal
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono">PRO</span>
              </h1>
              <p className="text-xs text-slate-400">Multi-Tenant SaaS Licensing & Client Control Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              Add New Client
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 text-sm font-medium transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Dashboard */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 space-y-8">
        
        {/* KPI Metric Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Total Clients</p>
              <h3 className="text-2xl font-extrabold text-white">{totalCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Active Subscriptions</p>
              <h3 className="text-2xl font-extrabold text-emerald-400">{activeCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Expired Accounts</p>
              <h3 className="text-2xl font-extrabold text-amber-400">{expiredCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Killed / Blocked</p>
              <h3 className="text-2xl font-extrabold text-rose-400">{killedCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Pending Requests Alert Section */}
        {pendingRequests.length > 0 && (
          <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Bell className="w-4 h-4 animate-bounce" />
              New Client Access Requests Pending Approval ({pendingRequests.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingRequests.map(req => (
                <div key={req.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{req.clientName}</h4>
                    <p className="text-xs text-slate-400">{req.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => updateClientStatusOnFirebase(req.hwid || req.id, 'ACTIVE')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => updateClientStatusOnFirebase(req.hwid || req.id, 'KILLED')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by shop name, owner, phone, key..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses ({totalCount})</option>
              <option value="ACTIVE">Active Only ({activeCount})</option>
              <option value="EXPIRED">Expired Only ({expiredCount})</option>
              <option value="KILLED">Killed / Blocked ({killedCount})</option>
              <option value="PENDING">Pending Approval ({pendingRequests.length})</option>
            </select>
          </div>
        </div>

        {/* Client Management Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Shop & Owner Details</th>
                  <th className="px-6 py-4">Contact Phone</th>
                  <th className="px-6 py-4">License Key</th>
                  <th className="px-6 py-4">Subscription Plan</th>
                  <th className="px-6 py-4">Status & Days Left</th>
                  <th className="px-6 py-4 text-right">Actions Suite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                        Loading Client Licenses from Firebase Cloud...
                      </div>
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      No clients found matching your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const daysLeft = calculateDaysLeft(client.expiresAt);
                    const isExpired = daysLeft <= 0;
                    const isKilled = client.status === 'KILLED' || client.status === 'INACTIVE';

                    return (
                      <tr key={client.hwid || client.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white text-sm">{client.clientName || 'Unnamed Shop'}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Store className="w-3 h-3 text-slate-500" />
                            {client.ownerName || 'Owner N/A'}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-300 font-mono">
                          {client.phone || 'N/A'}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-blue-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 max-w-xs truncate">
                            <span className="truncate">{client.licenseKey || 'NO-KEY'}</span>
                            <button
                              onClick={() => handleCopyKey(client.licenseKey)}
                              title="Copy License Key"
                              className="text-slate-400 hover:text-white shrink-0"
                            >
                              {copiedKey === client.licenseKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase">
                            {client.planType || 'MONTHLY'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {isKilled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              <ShieldAlert className="w-3 h-3" /> KILLED / BLOCKED
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                              <Clock className="w-3 h-3" /> EXPIRED (0 Days)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" /> ACTIVE ({daysLeft} Days Left)
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Renew License (+30 Days) */}
                            <button
                              onClick={() => handleRenewLicense(client)}
                              title="Renew License (+30 Days)"
                              className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/60 transition"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                            </button>

                            {/* Reset HWID Device Lock */}
                            <button
                              onClick={() => handleResetHWID(client)}
                              title="Reset HWID (Support Formatted PC)"
                              className="p-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900 text-sky-400 border border-sky-800/60 transition"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Kill Switch Toggle */}
                            <button
                              onClick={() => handleToggleStatus(client.hwid || client.id, client.status)}
                              title={isKilled ? "Unblock Client" : "Kill / Terminate Client"}
                              className={`p-1.5 rounded-lg border transition ${
                                isKilled 
                                  ? 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-400 border-emerald-800/60' 
                                  : 'bg-rose-950/60 hover:bg-rose-900 text-rose-400 border-rose-800/60'
                              }`}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Client */}
                            <button
                              onClick={() => handleOpenEditModal(client)}
                              title="Edit Client Info"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Backup Client Data */}
                            <button
                              onClick={() => handleBackupClientData(client)}
                              title="Download Client Data Backup"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Client */}
                            <button
                              onClick={() => handleDeleteClient(client.hwid || client.id, client.clientName)}
                              title="Delete Client"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 border border-slate-700 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      </main>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-400" />
                {editingClient ? 'Edit Client Account' : 'Add New Client & Generate License'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Shop / CSC Center Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="e.g. Gattu Jan Seva Kendra"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.ownerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="e.g. Nitish Nath"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">WhatsApp Mobile No *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Subscription Plan</label>
                  <select
                    value={formData.planType}
                    onChange={(e) => handlePlanTypeChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="FREE_TRIAL">Free Trial (7 Days)</option>
                    <option value="MONTHLY">Monthly (30 Days)</option>
                    <option value="HALF_YEARLY">Half-Yearly (180 Days)</option>
                    <option value="YEARLY">Yearly (365 Days)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Generated License Key</span>
                  <button 
                    type="button" 
                    onClick={handleGenerateNewKey}
                    className="text-blue-400 hover:underline text-[10px]"
                  >
                    Generate Fresh Key
                  </button>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.licenseKey}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-blue-400 font-mono text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Account Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="KILLED">KILLED / BLOCKED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Days to Add (+)</label>
                  <input
                    type="number"
                    value={formData.customDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, customDays: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/20"
                >
                  Save Client License
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
