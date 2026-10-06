import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, RefreshCw, MessageSquare, Search, Filter,
  CheckCircle2, Clock, AlertTriangle, XCircle, IndianRupee,
  Smartphone, ExternalLink, Printer, Edit, Trash2, Shield, Settings, Activity, Users, Send, Layers, Tag, PlusCircle, Zap, Download, Upload, X,
  Key, User, Lock, ShieldCheck, Building2, Store, Phone, MapPin, BadgeCheck, LogOut, Eye, PanelRight, PanelRightClose, Code, LayoutDashboard, Sliders, MoreVertical, Power
} from 'lucide-react';
import { CERTIFICATE_CATEGORIES } from '../constants/certificateTypes';
import { fetchCertificatesFromFirebase, saveCertificateToFirebase, deleteCertificateFromFirebase } from '../firebase';
import axios from 'axios';

const getApiBaseUrl = () => {
  const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('CUSTOM_API_BASE') : null;
  if (custom && custom.trim()) return custom.trim();
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined' && (window.location.hostname.includes('onrender.com') || window.location.port === '5000')) {
    return '/api';
  }
  return 'http://localhost:5000/api';
};

let API_BASE = getApiBaseUrl();

export default function ClientDashboard({ clientData, onLogout }) {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [certTypeFilter, setCertTypeFilter] = useState('ALL');
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'code_master' | 'profile'
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false); // Auto-hide by default
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Modal States
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    refNo: '',
    applicantName: '',
    mobile: '',
    address: '',
    certType: 'JHIC',
    entryDate: new Date().toISOString().split('T')[0],
    currentStatus: 'INITIATED',
    totalFee: 100,
    paidAmount: 100,
    remarks: ''
  });

  useEffect(() => {
    loadCertificates();
  }, []);

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const data = await fetchCertificatesFromFirebase();
      setCertificates(data || []);
    } catch (err) {
      console.error('Error loading certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = (defaultType = 'JHIC') => {
    const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).find(s => s.code === defaultType);
    const prefix = subObj ? subObj.prefix : 'JHIC/2026/';
    const fee = subObj ? subObj.defaultFee : 100;

    setFormData({
      id: String(Date.now()),
      refNo: prefix,
      applicantName: '',
      mobile: '',
      address: '',
      certType: defaultType,
      entryDate: new Date().toISOString().split('T')[0],
      currentStatus: 'INITIATED',
      totalFee: fee,
      paidAmount: fee,
      remarks: ''
    });
    setIsEntryModalOpen(true);
  };

  const handleCertTypeChange = (code) => {
    const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).find(s => s.code === code);
    const prefix = subObj ? subObj.prefix : 'JHIC/2026/';
    const fee = subObj ? subObj.defaultFee : 100;

    setFormData(prev => ({
      ...prev,
      certType: code,
      refNo: prefix,
      totalFee: fee,
      paidAmount: fee
    }));
  };

  const handleSaveCertificate = async (e) => {
    e.preventDefault();
    try {
      const extra = 0;
      const total = parseFloat(formData.totalFee) || 0;
      const paid = parseFloat(formData.paidAmount) || 0;
      const dues = Math.max(0, total - paid);

      const payload = {
        ...formData,
        id: formData.id || String(Date.now()),
        refNo: formData.refNo.trim().toUpperCase(),
        applicantName: formData.applicantName.trim(),
        mobile: formData.mobile.trim(),
        address: formData.address ? formData.address.trim() : '',
        additionalCharge: extra,
        totalFee: total,
        paidAmount: paid,
        duesAmount: dues,
        updatedAt: new Date().toISOString()
      };

      await saveCertificateToFirebase(payload);
      setIsEntryModalOpen(false);
      loadCertificates();
      showToast('success', 'Entry Saved', `Certificate ${payload.refNo} saved successfully!`);
    } catch (err) {
      showToast('error', 'Save Failed', err.message);
    }
  };

  const handleSyncSingle = async (cert) => {
    try {
      setSyncingId(cert.id);
      let res;
      try {
        res = await axios.post(`${API_BASE}/certificates/${cert.id}/sync-jharsewa`);
      } catch (e1) {
        if (API_BASE !== 'http://localhost:5000/api') {
          res = await axios.post(`http://localhost:5000/api/certificates/${cert.id}/sync-jharsewa`);
        } else {
          throw e1;
        }
      }

      if (res && res.data && res.data.success) {
        const newStatus = res.data.statusResult?.status || res.data.newStatus;
        showToast('success', 'Status Synced', `Live status updated: ${newStatus}`);
        loadCertificates();
      }
    } catch (err) {
      loadCertificates();
      showToast('info', 'Status Checked', `Refreshed records from Cloud Firestore.`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteCertificate = async (id, refNo) => {
    if (!window.confirm(`Are you sure you want to delete certificate ${refNo}?`)) return;
    try {
      await deleteCertificateFromFirebase(id);
      loadCertificates();
      showToast('info', 'Record Deleted', `Certificate ${refNo} removed.`);
    } catch (err) {
      showToast('error', 'Delete Failed', err.message);
    }
  };

  // Stats
  const totalRecords = certificates.length;
  const underProcessCount = certificates.filter(c => c.currentStatus && c.currentStatus.includes('UNDER_PROCESS')).length;
  const deliveredCount = certificates.filter(c => c.currentStatus && c.currentStatus.includes('DELIVERED')).length;
  const rejectedCount = certificates.filter(c => c.currentStatus && c.currentStatus.includes('REJECTED')).length;
  const totalFees = certificates.reduce((sum, c) => sum + (parseFloat(c.totalFee) || 0), 0);
  const totalDues = certificates.reduce((sum, c) => sum + (parseFloat(c.duesAmount) || 0), 0);

  // Filtered List
  const filteredCertificates = certificates.filter(c => {
    const matchesSearch = 
      (c.refNo && c.refNo.toLowerCase().includes(search.toLowerCase())) ||
      (c.applicantName && c.applicantName.toLowerCase().includes(search.toLowerCase())) ||
      (c.mobile && c.mobile.includes(search));

    const matchesStatus = statusFilter === 'ALL' || c.currentStatus === statusFilter;
    const matchesType = certTypeFilter === 'ALL' || c.certType === certTypeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getSubServiceCount = (code) => {
    return certificates.filter((c) => c.certType === code).length;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans w-full">
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

      {/* Client Header - FULL PAGE WIDTH */}
      <header className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 text-white shadow-lg sticky top-0 z-40 px-6 md:px-10 py-4 w-full">
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSideMenuOpen(!isSideMenuOpen)}
              title="Open Navigation Menu"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition flex items-center justify-center font-bold"
            >
              <MoreVertical className="w-5 h-5 text-yellow-300" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white font-extrabold shadow-inner">
              <Store className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-white">
                {clientData?.clientName || 'Apna Digital Hub - Certificate Management'}
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-900 text-[11px] font-black tracking-wider uppercase shadow">ACTIVE SHOP</span>
              </h1>
              <p className="text-xs text-blue-100 font-medium flex items-center gap-2">
                <span>Owner: {clientData?.ownerName || 'CSC Partner'}</span>
                <span>•</span>
                <span>Phone: {clientData?.phone || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenAddModal('JHIC')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              New Certificate Entry
            </button>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 transition flex items-center justify-center font-bold shadow-sm"
            >
              <Power className="w-5 h-5 text-rose-600" />
            </button>
          </div>
        </div>
      </header>

      {/* LEFT SIDE MENU DRAWER (AUTO HIDE BY DEFAULT) */}
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setIsSideMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          ></div>

          <aside className="absolute inset-y-0 left-0 max-w-full flex pr-10">
            <div className="w-72 bg-slate-900 text-white shadow-2xl border-r border-slate-800 flex flex-col justify-between p-6 space-y-6 animate-in slide-in-from-left duration-300">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-extrabold">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white tracking-tight">Client Navigation</h3>
                      <p className="text-[11px] text-slate-400">Shop Control Menu</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsSideMenuOpen(false)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items */}
                <nav className="space-y-2">
                  <button
                    onClick={() => { setActiveTab('dashboard'); setIsSideMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                      activeTab === 'dashboard'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard className="w-4 h-4 text-blue-400" />
                      <span>1. Dashboard</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold">Main</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('code_master'); setIsSideMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                      activeTab === 'code_master'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Code className="w-4 h-4 text-emerald-400" />
                      <span>2. Code Master</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold">
                      {CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).length} Codes
                    </span>
                  </button>

                  <button
                    onClick={() => { setIsProfileModalOpen(true); setIsSideMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition ${
                      activeTab === 'profile'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-amber-400" />
                      <span>3. Profile Settings</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">Account</span>
                  </button>
                </nav>
              </div>

              {/* Bottom Footer Details */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-400">Registered HWID:</div>
                <div className="font-mono text-[10px] text-amber-300 font-extrabold break-all bg-slate-900 p-2 rounded-xl border border-slate-800 select-all">
                  {clientData?.hwid || localStorage.getItem('CLIENT_SYSTEM_HWID') || 'HWID Locked'}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Dashboard Content - FULL PAGE WIDTH */}
      <main className="w-full px-6 md:px-10 py-8 flex-1 space-y-8">
        
        {/* KPI Metric Summary Cards - FULL PAGE WIDTH */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 w-full">
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-700 mb-1">Total Records</p>
              <h3 className="text-2xl font-extrabold text-blue-900">{totalRecords}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-sky-700 mb-1">Under Process</p>
              <h3 className="text-2xl font-extrabold text-sky-900">{underProcessCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-700 mb-1">Delivered</p>
              <h3 className="text-2xl font-extrabold text-emerald-900">{deliveredCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-700 mb-1">Rejected</p>
              <h3 className="text-2xl font-extrabold text-amber-900">{rejectedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <XCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-700 mb-1">Total Fees</p>
              <h3 className="text-2xl font-extrabold text-indigo-900">₹{totalFees}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              ₹
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-rose-700 mb-1">Total Dues</p>
              <h3 className="text-2xl font-extrabold text-rose-900">₹{totalDues}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Client Quick Action Shortcuts Bar */}
        <div className="bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-xs hover:shadow ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-blue-50/80 hover:bg-blue-100 text-blue-900 border-blue-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('code_master')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-xs hover:shadow ${
                activeTab === 'code_master' 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                  : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Code Master</span>
            </button>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200 transition shadow-xs hover:shadow"
            >
              <User className="w-4 h-4 text-amber-600" />
              <span>Profile Settings</span>
            </button>

            <button
              onClick={() => handleOpenAddModal('JHIC')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Entry</span>
            </button>
          </div>
        </div>

        {/* Sub-Services Quick Launch Cards - FULL PAGE WIDTH IN 1 ROW */}
        <section className="space-y-2.5 w-full">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Direct Service Quick Launch Cards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 w-full">
            {CERTIFICATE_CATEGORIES.map((cat) => (
              <div key={cat.id} className="bg-slate-50/90 border border-slate-200 rounded-2xl p-2.5 shadow-xs space-y-2 flex flex-col justify-between">
                <div className="border-b border-slate-200/80 pb-1 flex items-center justify-center text-center">
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight text-center truncate">{cat.name}</span>
                </div>
                <div className={`grid gap-1 ${cat.subServices.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {cat.subServices.map((sub) => (
                    <button
                      key={sub.code}
                      onClick={() => handleOpenAddModal(sub.code)}
                      className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold transition shadow-xs hover:shadow text-center"
                    >
                      <span className="truncate">+ {sub.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Certificate Table Section - FULL PAGE WIDTH */}
        <section className="space-y-4 w-full">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm w-full">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Ref No, Applicant Name, Phone..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
              />
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={loadCertificates}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh List
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Ref Number</th>
                    <th className="px-6 py-4">Applicant & Phone</th>
                    <th className="px-6 py-4">Cert Type</th>
                    <th className="px-6 py-4">Entry Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Fees / Dues</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                        Loading Certificates from Cloud...
                      </td>
                    </tr>
                  ) : filteredCertificates.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                        No certificate entries found. Click "+ New Certificate Entry" to add one!
                      </td>
                    </tr>
                  ) : (
                    filteredCertificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-blue-50/20 transition">
                        <td className="px-6 py-4 font-mono font-bold text-blue-700">
                          {cert.refNo}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{cert.applicantName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{cert.mobile}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black">
                            {cert.certType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono">
                          {cert.entryDate ? new Date(cert.entryDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-extrabold">
                            {cert.currentStatus || 'INITIATED'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">Paid: ₹{cert.paidAmount} / ₹{cert.totalFee}</div>
                          {cert.duesAmount > 0 ? (
                            <div className="text-[10px] text-rose-600 font-bold">Dues: ₹{cert.duesAmount}</div>
                          ) : (
                            <div className="text-[10px] text-emerald-600 font-bold">Fully Paid</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Sync Status Bot Button */}
                            <button
                              onClick={() => handleSyncSingle(cert)}
                              disabled={syncingId === cert.id}
                              title="Sync Jharsewa Status"
                              className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition shadow-sm"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingId === cert.id ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteCertificate(cert.id, cert.refNo)}
                              title="Delete Entry"
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-rose-600 border border-slate-200 transition shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                New Certificate Entry
              </h3>
              <button 
                onClick={() => setIsEntryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCertificate} className="space-y-3 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Certificate Sub-Type</label>
                  <select
                    value={formData.certType}
                    onChange={(e) => handleCertTypeChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    {CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Reference Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.refNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, refNo: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-blue-700 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Applicant Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.applicantName}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicantName: e.target.value }))}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">WhatsApp Mobile No *</label>
                  <input
                    type="text"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Village / Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="e.g. Village Address"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Total Fee (₹)</label>
                  <input
                    type="number"
                    value={formData.totalFee}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalFee: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Paid Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, paidAmount: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Application Date</label>
                  <input
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, entryDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow"
                >
                  Save Certificate Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
