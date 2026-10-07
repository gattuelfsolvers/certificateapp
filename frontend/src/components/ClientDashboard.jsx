import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, RefreshCw, MessageSquare, Search, Filter,
  CheckCircle2, Clock, AlertTriangle, XCircle, IndianRupee,
  Smartphone, ExternalLink, Printer, Edit, Trash2, Shield, Settings, Activity, Users, Send, Layers, Tag, PlusCircle, Zap, Download, Upload, X,
  Key, User, Lock, ShieldCheck, Building2, Store, Phone, MapPin, BadgeCheck, LogOut, Eye, PanelRight, PanelRightClose, Code, LayoutDashboard, Sliders, MoreVertical, Power
} from 'lucide-react';
import { CERTIFICATE_CATEGORIES as DEFAULT_CATEGORIES } from '../constants/certificateTypes';
import { fetchCertificatesFromFirebase, saveCertificateToFirebase, deleteCertificateFromFirebase } from '../firebase';
import CodeMasterView from './CodeMasterView';
import ProfileSettingsView from './ProfileSettingsView';
import LocalEngineChecker from './LocalEngineChecker';
import axios from 'axios';

const getActiveCategories = () => {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('CUSTOM_CERT_CATEGORIES') : null;
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return DEFAULT_CATEGORIES;
};

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

const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return 'N/A';
  
  const str = String(dateStr).trim();
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year.length === 4) {
        const dd = day.padStart(2, '0');
        const mm = month.padStart(2, '0');
        return `${dd}-${mm}-${year}`;
      }
    }
  }

  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return 'N/A';

  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const getStatusBadgeStyle = (status) => {
  const s = String(status || 'INITIATED').toUpperCase();

  if (s.includes('DELIVERED')) {
    return 'bg-emerald-600 text-white border border-emerald-700 font-extrabold shadow-2xs';
  }
  if (s.includes('REJECTED')) {
    return 'bg-rose-600 text-white border border-rose-700 font-extrabold shadow-2xs';
  }
  if (s.includes('HOLD')) {
    return 'bg-amber-400 text-slate-950 border border-amber-500 font-black';
  }
  if (s.includes('WAITING') || s.includes('WAIT')) {
    return 'bg-yellow-100 text-yellow-900 border border-yellow-300 font-extrabold';
  }
  if (s.includes('PROCESS') || s.includes('UNDER_PROCESS')) {
    return 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold';
  }
  if (s.includes('INITIATED')) {
    return 'bg-sky-100 text-sky-900 border border-sky-300 font-extrabold';
  }

  return 'bg-slate-100 text-slate-800 border border-slate-300 font-extrabold';
};

const CATEGORY_COLOR_STYLES = {
  income: {
    cardBg: 'bg-emerald-50/80 border-emerald-200/90',
    titleText: 'text-emerald-900',
    borderDivider: 'border-emerald-200/60',
    btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white'
  },
  caste: {
    cardBg: 'bg-purple-50/80 border-purple-200/90',
    titleText: 'text-purple-900',
    borderDivider: 'border-purple-200/60',
    btnBg: 'bg-purple-600 hover:bg-purple-700 text-white'
  },
  residential: {
    cardBg: 'bg-blue-50/80 border-blue-200/90',
    titleText: 'text-blue-900',
    borderDivider: 'border-blue-200/60',
    btnBg: 'bg-blue-600 hover:bg-blue-700 text-white'
  },
  obc: {
    cardBg: 'bg-fuchsia-50/80 border-fuchsia-200/90',
    titleText: 'text-fuchsia-900',
    borderDivider: 'border-fuchsia-200/60',
    btnBg: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white'
  },
  ews: {
    cardBg: 'bg-teal-50/80 border-teal-200/90',
    titleText: 'text-teal-900',
    borderDivider: 'border-teal-200/60',
    btnBg: 'bg-teal-600 hover:bg-teal-700 text-white'
  },
  marriage: {
    cardBg: 'bg-rose-50/80 border-rose-200/90',
    titleText: 'text-rose-900',
    borderDivider: 'border-rose-200/60',
    btnBg: 'bg-rose-600 hover:bg-rose-700 text-white'
  },
  pancard: {
    cardBg: 'bg-amber-50/80 border-amber-200/90',
    titleText: 'text-amber-950',
    borderDivider: 'border-amber-200/60',
    btnBg: 'bg-amber-600 hover:bg-amber-700 text-white'
  }
};

export default function ClientDashboard({ clientData, onLogout }) {
  const [categories, setCategories] = useState(() => getActiveCategories());
  const CERTIFICATE_CATEGORIES = categories;

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [certTypeFilter, setCertTypeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'code_master' | 'profile'
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false); // Auto-hide by default
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Modal States & Multi-Item Draft List
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Form States
  const [applicantInfo, setApplicantInfo] = useState({
    applicantName: '',
    mobile: '',
    address: ''
  });

  const [itemForm, setItemForm] = useState({
    certType: 'JHIC',
    refNo: 'JHIC/2026/',
    entryDate: new Date().toISOString().split('T')[0],
    totalFee: 100
  });

  const [draftList, setDraftList] = useState([]);
  const [paidAmountInput, setPaidAmountInput] = useState(100);

  // View & Edit Modal States
  const [viewingCert, setViewingCert] = useState(null);
  const [editingCert, setEditingCert] = useState(null);
  const [editFormData, setEditFormData] = useState({
    id: '',
    refNo: '',
    applicantName: '',
    mobile: '',
    address: '',
    certType: 'JHIC',
    entryDate: '',
    currentStatus: 'INITIATED',
    totalFee: 100,
    paidAmount: 100
  });

  const [engineStatus, setEngineStatus] = useState('CHECKING'); // 'ONLINE' | 'OFFLINE' | 'CHECKING'
  const [isCheckingEngine, setIsCheckingEngine] = useState(false);

  useEffect(() => {
    loadCertificates();
    checkLocalEngine();
  }, []);

  const checkLocalEngine = async () => {
    setIsCheckingEngine(true);
    try {
      // Ping local agent helper port 5000 /api/health
      const res = await fetch('http://localhost:5000/api/health', { method: 'GET', mode: 'cors' });
      if (res.ok) {
        setEngineStatus('ONLINE');
      } else {
        setEngineStatus('OFFLINE');
      }
    } catch (err) {
      setEngineStatus('OFFLINE');
    } finally {
      setIsCheckingEngine(false);
    }
  };

  useEffect(() => {
    setCategories(getActiveCategories());
  }, [activeTab]);

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

    setApplicantInfo({ applicantName: '', mobile: '', address: '' });
    setItemForm({
      certType: defaultType,
      refNo: prefix,
      entryDate: new Date().toISOString().split('T')[0],
      totalFee: fee
    });
    setDraftList([]);
    setPaidAmountInput(fee);
    setIsEntryModalOpen(true);
  };

  const handleItemCertTypeChange = (code) => {
    const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).find(s => s.code === code);
    const prefix = subObj ? subObj.prefix : 'JHIC/2026/';
    const fee = subObj ? subObj.defaultFee : 100;

    setItemForm(prev => ({
      ...prev,
      certType: code,
      refNo: prefix,
      totalFee: fee
    }));
  };

  const handleAddToList = () => {
    if (!itemForm.refNo || !itemForm.refNo.trim()) {
      showToast('error', 'Reference Number Required', 'Please enter Reference Number before adding to list');
      return;
    }

    const fee = parseFloat(itemForm.totalFee) || 0;
    const newItem = {
      id: String(Date.now() + Math.random()),
      certType: itemForm.certType,
      refNo: itemForm.refNo.trim().toUpperCase(),
      entryDate: itemForm.entryDate,
      totalFee: fee
    };

    const newDrafts = [...draftList, newItem];
    setDraftList(newDrafts);

    const grandTotal = newDrafts.reduce((sum, item) => sum + item.totalFee, 0);
    setPaidAmountInput(grandTotal);

    const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).find(s => s.code === itemForm.certType);
    setItemForm(prev => ({
      ...prev,
      refNo: subObj ? subObj.prefix : 'JHIC/2026/'
    }));
  };

  const handleRemoveFromList = (id) => {
    const newDrafts = draftList.filter(item => item.id !== id);
    setDraftList(newDrafts);
    const grandTotal = newDrafts.reduce((sum, item) => sum + item.totalFee, 0);
    setPaidAmountInput(grandTotal);
  };

  const handleResetForm = () => {
    const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).find(s => s.code === 'JHIC');
    setApplicantInfo({ applicantName: '', mobile: '', address: '' });
    setItemForm({
      certType: 'JHIC',
      refNo: subObj ? subObj.prefix : 'JHIC/2026/',
      entryDate: new Date().toISOString().split('T')[0],
      totalFee: 100
    });
    setDraftList([]);
    setPaidAmountInput(100);
  };

  const handleSaveCertificate = async (e) => {
    e.preventDefault();

    if (!applicantInfo.applicantName.trim()) {
      showToast('error', 'Applicant Name Required', 'Please enter Applicant Name');
      return;
    }
    if (!applicantInfo.mobile.trim()) {
      showToast('error', 'Mobile Required', 'Please enter WhatsApp Mobile Number');
      return;
    }

    let itemsToSave = [...draftList];

    if (itemsToSave.length === 0) {
      if (itemForm.refNo && itemForm.refNo.trim()) {
        itemsToSave.push({
          id: String(Date.now()),
          certType: itemForm.certType,
          refNo: itemForm.refNo.trim().toUpperCase(),
          entryDate: itemForm.entryDate,
          totalFee: parseFloat(itemForm.totalFee) || 0
        });
      } else {
        showToast('error', 'No Certificates Added', 'Please add at least one certificate item to list');
        return;
      }
    }

    try {
      const grandTotalFee = itemsToSave.reduce((sum, item) => sum + (parseFloat(item.totalFee) || 0), 0);
      const totalPaid = parseFloat(paidAmountInput) || 0;

      for (let i = 0; i < itemsToSave.length; i++) {
        const item = itemsToSave[i];
        const itemPaid = itemsToSave.length === 1 
          ? totalPaid 
          : Math.round((item.totalFee / (grandTotalFee || 1)) * totalPaid);
        const itemDues = Math.max(0, item.totalFee - itemPaid);

        const payload = {
          id: item.id || String(Date.now() + i),
          refNo: item.refNo.trim().toUpperCase(),
          applicantName: applicantInfo.applicantName.trim(),
          mobile: applicantInfo.mobile.trim(),
          address: applicantInfo.address ? applicantInfo.address.trim() : '',
          certType: item.certType,
          entryDate: item.entryDate,
          currentStatus: 'INITIATED',
          additionalCharge: 0,
          totalFee: item.totalFee,
          paidAmount: itemPaid,
          duesAmount: itemDues,
          updatedAt: new Date().toISOString()
        };

        await saveCertificateToFirebase(payload);
      }

      setIsEntryModalOpen(false);
      loadCertificates();
      showToast('success', 'Records Saved', `${itemsToSave.length} Certificate record(s) saved successfully!`);
    } catch (err) {
      showToast('error', 'Save Failed', err.message);
    }
  };

  const handleOpenViewModal = (cert) => {
    setViewingCert(cert);
  };

  const handleOpenEditModal = (cert) => {
    setEditingCert(cert);
    setEditFormData({
      id: cert.id,
      refNo: cert.refNo || '',
      applicantName: cert.applicantName || '',
      mobile: cert.mobile || '',
      address: cert.address || '',
      certType: cert.certType || 'JHIC',
      entryDate: cert.entryDate || new Date().toISOString().split('T')[0],
      currentStatus: cert.currentStatus || 'INITIATED',
      totalFee: cert.totalFee || 100,
      paidAmount: cert.paidAmount || 100
    });
  };

  const handleSaveEditCertificate = async (e) => {
    e.preventDefault();
    try {
      const total = parseFloat(editFormData.totalFee) || 0;
      const paid = parseFloat(editFormData.paidAmount) || 0;
      const dues = Math.max(0, total - paid);

      const payload = {
        ...editFormData,
        refNo: editFormData.refNo.trim().toUpperCase(),
        applicantName: editFormData.applicantName.trim(),
        mobile: editFormData.mobile.trim(),
        address: editFormData.address ? editFormData.address.trim() : '',
        totalFee: total,
        paidAmount: paid,
        duesAmount: dues,
        updatedAt: new Date().toISOString()
      };

      await saveCertificateToFirebase(payload);
      setEditingCert(null);
      loadCertificates();
      showToast('success', 'Entry Updated', `Certificate ${payload.refNo} updated successfully!`);
    } catch (err) {
      showToast('error', 'Update Failed', err.message);
    }
  };

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleExportCSV = () => {
    if (filteredCertificates.length === 0) {
      showToast('info', 'No Data', 'No certificate records to export');
      return;
    }

    const headers = ['Ref No', 'Applicant Name', 'Mobile', 'Address', 'Cert Type', 'Entry Date', 'Status', 'Total Fee', 'Paid Amount', 'Dues Amount'];
    const rows = filteredCertificates.map(c => [
      `"${c.refNo || ''}"`,
      `"${c.applicantName || ''}"`,
      `"${c.mobile || ''}"`,
      `"${c.address || ''}"`,
      `"${c.certType || ''}"`,
      `"${formatDateDDMMYYYY(c.entryDate)}"`,
      `"${c.currentStatus || 'INITIATED'}"`,
      c.totalFee || 0,
      c.paidAmount || 0,
      c.duesAmount || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `certificates_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('success', 'Data Downloaded', `${filteredCertificates.length} certificate record(s) exported to CSV!`);
  };

  const handleSyncAll = async () => {
    const toSync = certificates.filter(c => !c.currentStatus || (!c.currentStatus.includes('DELIVERED') && !c.currentStatus.includes('REJECTED')));
    if (toSync.length === 0) {
      showToast('info', 'Nothing to Sync', 'All certificate records are already delivered or finalized.');
      return;
    }

    setIsSyncingAll(true);
    showToast('info', 'Sync Started', `Syncing live status for ${toSync.length} certificate(s)...`);

    let count = 0;
    for (const cert of toSync) {
      try {
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
        if (res && res.data && res.data.success) count++;
      } catch (err) {
        console.error('Sync failed for cert:', cert.id, err);
      }
    }

    setIsSyncingAll(false);
    loadCertificates();
    showToast('success', 'Sync Completed', `Synced status for ${count} of ${toSync.length} certificate records.`);
  };

  const handleSyncSingle = async (cert) => {
    try {
      setSyncingId(cert.id);
      let res;
      try {
        if (engineStatus === 'ONLINE') {
          res = await axios.post(`http://localhost:5000/api/certificates/${cert.id}/sync-jharsewa`);
        } else {
          res = await axios.post(`${API_BASE}/certificates/${cert.id}/sync-jharsewa`);
        }
      } catch (e1) {
        res = await axios.post(`${API_BASE}/certificates/${cert.id}/sync-jharsewa`);
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
  const deliveredCount = certificates.filter(c => c.currentStatus && c.currentStatus.includes('DELIVERED')).length;
  const rejectedCount = certificates.filter(c => c.currentStatus && c.currentStatus.includes('REJECTED')).length;
  const underProcessCount = Math.max(0, totalRecords - deliveredCount - rejectedCount);
  const totalFees = certificates.reduce((sum, c) => sum + (parseFloat(c.totalFee) || 0), 0);
  const totalDues = certificates.reduce((sum, c) => sum + (parseFloat(c.duesAmount) || 0), 0);

  const getCategoryRecordCount = (catId) => {
    if (catId === 'ALL') return certificates.length;
    const catObj = CERTIFICATE_CATEGORIES.find(cat => cat.id === catId);
    if (!catObj) return 0;
    const subCodes = catObj.subServices.map(s => s.code);
    return certificates.filter(c => subCodes.includes(c.certType)).length;
  };

  // Filtered & Sorted List (Newest Entry First / Date Wise Descending)
  const filteredCertificates = certificates
    .filter(c => {
      const matchesSearch = 
        (c.refNo && c.refNo.toLowerCase().includes(search.toLowerCase())) ||
        (c.applicantName && c.applicantName.toLowerCase().includes(search.toLowerCase())) ||
        (c.mobile && c.mobile.includes(search));

      const matchesStatus = statusFilter === 'ALL' || (c.currentStatus && c.currentStatus.includes(statusFilter));
      
      let matchesCategory = true;
      if (categoryFilter !== 'ALL') {
        const catObj = CERTIFICATE_CATEGORIES.find(cat => cat.id === categoryFilter);
        if (catObj) {
          const subCodes = catObj.subServices.map(s => s.code);
          matchesCategory = subCodes.includes(c.certType);
        }
      }

      const matchesType = certTypeFilter === 'ALL' || c.certType === certTypeFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesType;
    })
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;

      const dateA = a.entryDate ? new Date(a.entryDate).getTime() : 0;
      const dateB = b.entryDate ? new Date(b.entryDate).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      return String(b.id || '').localeCompare(String(a.id || ''));
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
        
        {/* Local Engine Requirement Health Gatekeeper Banner */}
        <LocalEngineChecker 
          engineStatus={engineStatus} 
          onRetry={checkLocalEngine} 
          isChecking={isCheckingEngine} 
          API_BASE={API_BASE}
        />

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
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-xs hover:shadow ${
                activeTab === 'profile' 
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                  : 'bg-amber-50/80 hover:bg-amber-100 text-amber-900 border-amber-200'
              }`}
            >
              <User className="w-4 h-4" />
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

        {activeTab === 'code_master' ? (
          <CodeMasterView showToast={showToast} />
        ) : activeTab === 'profile' ? (
          <ProfileSettingsView clientData={clientData} showToast={showToast} />
        ) : (
          <>
            {/* Sub-Services Quick Launch Cards - FULL PAGE WIDTH IN 1 ROW */}
            <section className="space-y-2.5 w-full">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Direct Service Quick Launch Cards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 w-full">
            {CERTIFICATE_CATEGORIES.map((cat) => {
              const styles = CATEGORY_COLOR_STYLES[cat.id] || {
                cardBg: 'bg-slate-50/90 border-slate-200',
                titleText: 'text-slate-900',
                borderDivider: 'border-slate-200/80',
                btnBg: 'bg-blue-600 hover:bg-blue-700 text-white'
              };

              return (
                <div key={cat.id} className={`${styles.cardBg} border rounded-2xl p-2.5 shadow-xs flex flex-col justify-between h-full`}>
                  <div className={`border-b ${styles.borderDivider} pb-1 mb-1.5 flex items-center justify-center text-center`}>
                    <span className={`text-[11px] font-black uppercase tracking-tight text-center truncate ${styles.titleText}`}>{cat.name}</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center w-full">
                    <div className={`grid gap-1 ${cat.subServices.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {cat.subServices.map((sub) => (
                        <button
                          key={sub.code}
                          onClick={() => handleOpenAddModal(sub.code)}
                          className={`flex items-center justify-center px-2 py-1.5 rounded-xl ${styles.btnBg} text-[11px] font-extrabold transition shadow-xs hover:shadow text-center`}
                        >
                          <span className="truncate">{sub.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Category Quick Filter Bar with Certificate Counts */}
        <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 shadow-xs w-full">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 w-full">
            {/* ALL Category */}
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-extrabold transition border ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span>ALL</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                categoryFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {certificates.length}
              </span>
            </button>

            {/* Category Buttons with Custom Vibrant Themes */}
            {[
              { id: 'income', label: 'JHIC', activeBg: 'bg-emerald-600 text-white border-emerald-600', inactiveBg: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200', badgeActive: 'bg-white/20 text-white', badgeInactive: 'bg-emerald-200/80 text-emerald-900' },
              { id: 'caste', label: 'CST', activeBg: 'bg-purple-600 text-white border-purple-600', inactiveBg: 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200', badgeActive: 'bg-white/20 text-white', badgeInactive: 'bg-purple-200/80 text-purple-900' },
              { id: 'residential', label: 'RES', activeBg: 'bg-blue-600 text-white border-blue-600', inactiveBg: 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200', badgeActive: 'bg-white/20 text-white', badgeInactive: 'bg-blue-200/80 text-blue-900' },
              { id: 'obc', label: 'OBC', activeBg: 'bg-fuchsia-600 text-white border-fuchsia-600', inactiveBg: 'bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200', badgeActive: 'bg-white/20 text-white', badgeInactive: 'bg-fuchsia-200/80 text-fuchsia-900' },
              { id: 'ews', label: 'EWS', activeBg: 'bg-teal-600 text-white border-teal-600', inactiveBg: 'bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-200', badgeActive: 'bg-white/20 text-white', badgeInactive: 'bg-teal-200/80 text-teal-900' },
              { id: 'marriage', label: 'MRG', activeBg: 'bg-rose-600 text-white border-rose-600', inactiveBg: 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200', badgeActive: 'bg-white/20 text-white', badgeInactive: 'bg-rose-200/80 text-rose-900' },
              { id: 'pancard', label: 'PAN CARD', activeBg: 'bg-amber-600 text-white border-amber-600', inactiveBg: 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200', badgeActive: 'bg-white/20 text-white', badgeInactive: 'bg-amber-200/80 text-amber-900' }
            ].map((catItem) => {
              const count = getCategoryRecordCount(catItem.id);
              const isActive = categoryFilter === catItem.id;
              
              return (
                <button
                  key={catItem.id}
                  onClick={() => setCategoryFilter(isActive ? 'ALL' : catItem.id)}
                  className={`w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-extrabold transition border ${
                    isActive ? catItem.activeBg : catItem.inactiveBg
                  }`}
                >
                  <span>{catItem.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? catItem.badgeActive : catItem.badgeInactive
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Certificate Table Section - FULL PAGE WIDTH */}
        <section className="space-y-4 w-full">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm w-full">
            {/* Search Box - EXPANSD TO FILL ALL REMAINING BLANK AREA */}
            <div className="relative flex-1 min-w-[240px] w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Ref No, Name, Phone..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium shadow-2xs"
              />
            </div>

            {/* Toolbar Action Controls in requested order: 1. Status Dropdown, 2. Sync List, 3. Sync All, 4. Download */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
              {/* 1. Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="ALL">All Status ({certificates.length})</option>
                <option value="INITIATED">Initiated (Submitted)</option>
                <option value="CI_UNDER_PROCESS">CI Under Process</option>
                <option value="CO_UNDER_PROCESS">CO Under Process</option>
                <option value="SDO_UNDER_PROCESS">SDO / DC Under Process</option>
                <option value="DELIVERED">Delivered (Issued)</option>
                <option value="REJECTED">Rejected</option>
                <option value="CO_WAITING">Waiting (Objection)</option>
              </select>

              {/* 2. Sync List / Refresh List Button */}
              <button 
                onClick={loadCertificates}
                title="Refresh Records List"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-extrabold transition shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 text-cyan-600 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync List</span>
              </button>

              {/* 3. Sync All Button */}
              <button
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                title="Sync All Active Certificates"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition shadow-xs disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? 'Syncing All...' : 'Sync All'}</span>
              </button>

              {/* 4. Download Data Button */}
              <button
                onClick={handleExportCSV}
                title="Download / Export Data (CSV)"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition shadow-xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4 text-center">Ref Number</th>
                    <th className="px-6 py-4 text-center">Applicant & Phone</th>
                    <th className="px-6 py-4 text-center">Cert Type</th>
                    <th className="px-6 py-4 text-center">Entry Date</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Fees / Dues</th>
                    <th className="px-6 py-4 text-center">Actions</th>
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
                        <td className="px-6 py-4 font-mono font-bold text-blue-700 text-center">
                          {cert.refNo}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="font-bold text-slate-900">{cert.applicantName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{cert.mobile}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black inline-block">
                            {cert.certType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono font-semibold text-center">
                          {formatDateDDMMYYYY(cert.entryDate)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-black inline-block tracking-tight ${getStatusBadgeStyle(cert.currentStatus)}`}>
                            {cert.currentStatus || 'INITIATED'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="font-bold text-slate-900">Paid: ₹{cert.paidAmount} / ₹{cert.totalFee}</div>
                          {cert.duesAmount > 0 ? (
                            <div className="text-[10px] text-rose-600 font-bold">Dues: ₹{cert.duesAmount}</div>
                          ) : (
                            <div className="text-[10px] text-emerald-600 font-bold">Fully Paid</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 1. Sync Status Bot */}
                            <button
                              onClick={() => handleSyncSingle(cert)}
                              disabled={syncingId === cert.id}
                              title="Sync Jharsewa Status"
                              className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition shadow-xs"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingId === cert.id ? 'animate-spin' : ''}`} />
                            </button>

                            {/* 2. View Entry */}
                            <button
                              onClick={() => handleOpenViewModal(cert)}
                              title="View Details"
                              className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition shadow-xs"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* 3. Edit Entry */}
                            <button
                              onClick={() => handleOpenEditModal(cert)}
                              title="Edit Entry"
                              className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition shadow-xs"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* 4. Delete Entry */}
                            <button
                              onClick={() => handleDeleteCertificate(cert.id, cert.refNo)}
                              title="Delete Entry"
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition shadow-xs"
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
      </>
    )}
  </main>

      {/* Entry Modal - ENHANCED BATCH & MULTI-ITEM LIST MODAL (MAX-W-4XL) */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-extrabold shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">New Certificate Entry</h3>
                  <p className="text-xs text-slate-500 font-medium">Add applicant & certificate entries to list before saving</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEntryModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCertificate} className="space-y-6 text-xs font-medium">
              
              {/* 1. Applicant Details */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Applicant Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Applicant Name *</label>
                    <input
                      type="text"
                      required
                      value={applicantInfo.applicantName}
                      onChange={(e) => setApplicantInfo(prev => ({ ...prev, applicantName: e.target.value }))}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">WhatsApp Mobile No *</label>
                    <input
                      type="text"
                      required
                      value={applicantInfo.mobile}
                      onChange={(e) => setApplicantInfo(prev => ({ ...prev, mobile: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-semibold focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Village / Address</label>
                    <input
                      type="text"
                      value={applicantInfo.address}
                      onChange={(e) => setApplicantInfo(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="e.g. Village Address"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Certificate Details Entry & Add to List */}
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-600" />
                    Certificate Details
                  </h4>
                  <span className="text-[11px] text-blue-600 font-bold">Add item to list</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Certificate Sub-Type</label>
                    <select
                      value={itemForm.certType}
                      onChange={(e) => handleItemCertTypeChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                    >
                      {CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).map(s => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Reference Number *</label>
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20">
                      <span className="px-3 py-2 bg-slate-100 text-blue-800 font-mono font-black border-r border-slate-300 text-xs select-none whitespace-nowrap">
                        {(() => {
                          const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices || []).find(s => s.code === itemForm.certType);
                          return subObj ? subObj.prefix : `${itemForm.certType || 'JHIC'}/2026/`;
                        })()}
                      </span>
                      <input
                        type="text"
                        value={(() => {
                          const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices || []).find(s => s.code === itemForm.certType);
                          const prefix = subObj ? subObj.prefix : `${itemForm.certType || 'JHIC'}/2026/`;
                          const currentVal = itemForm.refNo || '';
                          return currentVal.startsWith(prefix) ? currentVal.slice(prefix.length) : currentVal;
                        })()}
                        onChange={(e) => {
                          const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices || []).find(s => s.code === itemForm.certType);
                          const prefix = subObj ? subObj.prefix : `${itemForm.certType || 'JHIC'}/2026/`;
                          const serialOnly = (e.target.value || '').replace(/[^a-zA-Z0-9]/g, '');
                          setItemForm(prev => ({ ...prev, refNo: prefix + serialOnly }));
                        }}
                        placeholder="123456"
                        className="w-full bg-transparent px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Application Date</label>
                    <input
                      type="date"
                      value={itemForm.entryDate}
                      onChange={(e) => setItemForm(prev => ({ ...prev, entryDate: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleAddToList}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm transition"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Add to List
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Certificate Added List Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-2 p-3">
                <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Certificate Added List ({draftList.length > 0 ? draftList.length : (itemForm.refNo ? 1 : 0)})
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">Items ready to be saved</span>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-x-auto max-h-48">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Sub-Type</th>
                        <th className="px-3 py-2">Reference Number</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Fee (₹)</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {draftList.length === 0 ? (
                        itemForm.refNo ? (
                          <tr className="bg-blue-50/30">
                            <td className="px-3 py-2 text-slate-400">1</td>
                            <td className="px-3 py-2 font-bold text-blue-700">{itemForm.certType}</td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{itemForm.refNo}</td>
                            <td className="px-3 py-2 text-slate-600">{formatDateDDMMYYYY(itemForm.entryDate)}</td>
                            <td className="px-3 py-2 font-bold text-slate-900">₹{itemForm.totalFee}</td>
                            <td className="px-3 py-2 text-right text-slate-400 italic">Form Entry</td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan="6" className="px-4 py-4 text-center text-slate-400 font-medium italic">
                              No certificates added yet. Fill details above and click "+ Add to List".
                            </td>
                          </tr>
                        )
                      ) : (
                        draftList.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500 font-bold">{idx + 1}</td>
                            <td className="px-3 py-2 font-bold text-blue-700">{item.certType}</td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{item.refNo}</td>
                            <td className="px-3 py-2 text-slate-600">{formatDateDDMMYYYY(item.entryDate)}</td>
                            <td className="px-3 py-2 font-bold text-slate-900">₹{item.totalFee}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveFromList(item.id)}
                                className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Payment & Totals Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Total Fee Count / Sum (₹)</label>
                  <div className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-extrabold text-sm flex items-center justify-between">
                    <span>₹{draftList.length > 0 ? draftList.reduce((sum, item) => sum + item.totalFee, 0) : (parseFloat(itemForm.totalFee) || 0)}</span>
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                      {draftList.length > 0 ? draftList.length : 1} Item(s)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Paid Amount (₹) *</label>
                  <input
                    type="number"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-emerald-800 font-extrabold text-sm focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Calculated Dues (₹)</label>
                  {(() => {
                    const totalSum = draftList.length > 0 ? draftList.reduce((sum, item) => sum + item.totalFee, 0) : (parseFloat(itemForm.totalFee) || 0);
                    const dues = Math.max(0, totalSum - (parseFloat(paidAmountInput) || 0));
                    return (
                      <div className={`w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-extrabold text-sm ${dues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        ₹{dues}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 5. Footer Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEntryModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                  >
                    Close
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Save Certificate Record(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW CERTIFICATE MODAL */}
      {viewingCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-extrabold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Certificate Details</h3>
                  <p className="text-xs text-blue-600 font-mono font-bold">{viewingCert.refNo}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingCert(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-slate-400 font-bold mb-0.5">Applicant Name</p>
                  <p className="text-sm font-bold text-slate-900">{viewingCert.applicantName}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold mb-0.5">WhatsApp Mobile</p>
                  <p className="text-sm font-mono font-bold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    {viewingCert.mobile}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold mb-0.5">Village / Address</p>
                  <p className="text-slate-800">{viewingCert.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold mb-0.5">Application Date</p>
                  <p className="text-slate-800 font-mono font-bold">{formatDateDDMMYYYY(viewingCert.entryDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div>
                  <p className="text-slate-500 font-bold mb-0.5">Cert Sub-Type</p>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-[10px]">
                    {viewingCert.certType}
                  </span>
                </div>
                <div>
                  <p className="text-slate-500 font-bold mb-0.5">Status</p>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-black inline-block tracking-tight ${getStatusBadgeStyle(viewingCert.currentStatus)}`}>
                    {viewingCert.currentStatus || 'INITIATED'}
                  </span>
                </div>
                <div>
                  <p className="text-slate-500 font-bold mb-0.5">Fees & Dues</p>
                  <p className="text-slate-900 font-bold">Paid: ₹{viewingCert.paidAmount} / ₹{viewingCert.totalFee}</p>
                  {viewingCert.duesAmount > 0 ? (
                    <p className="text-rose-600 font-bold text-[11px]">Dues: ₹{viewingCert.duesAmount}</p>
                  ) : (
                    <p className="text-emerald-600 font-bold text-[11px]">Fully Paid</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewingCert(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const target = viewingCert;
                  setViewingCert(null);
                  handleOpenEditModal(target);
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Edit className="w-4 h-4" />
                Edit Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CERTIFICATE MODAL */}
      {editingCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-600" />
                Edit Certificate Entry
              </h3>
              <button 
                onClick={() => setEditingCert(null)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditCertificate} className="space-y-3 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Certificate Sub-Type</label>
                  <select
                    value={editFormData.certType}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, certType: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    {CERTIFICATE_CATEGORIES.flatMap(c => c.subServices).map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Reference Number *</label>
                  <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20">
                    <span className="px-3 py-2 bg-slate-200/80 text-blue-900 font-mono font-black border-r border-slate-300 text-xs select-none whitespace-nowrap">
                      {(() => {
                        const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices || []).find(s => s.code === editFormData.certType);
                        return subObj ? subObj.prefix : `${editFormData.certType || 'JHIC'}/2026/`;
                      })()}
                    </span>
                    <input
                      type="text"
                      required
                      value={(() => {
                        const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices || []).find(s => s.code === editFormData.certType);
                        const prefix = subObj ? subObj.prefix : `${editFormData.certType || 'JHIC'}/2026/`;
                        const currentVal = editFormData.refNo || '';
                        return currentVal.startsWith(prefix) ? currentVal.slice(prefix.length) : currentVal;
                      })()}
                      onChange={(e) => {
                        const subObj = CERTIFICATE_CATEGORIES.flatMap(c => c.subServices || []).find(s => s.code === editFormData.certType);
                        const prefix = subObj ? subObj.prefix : `${editFormData.certType || 'JHIC'}/2026/`;
                        const serialOnly = (e.target.value || '').replace(/[^a-zA-Z0-9]/g, '');
                        setEditFormData(prev => ({ ...prev, refNo: prefix + serialOnly }));
                      }}
                      placeholder="123456"
                      className="w-full bg-transparent px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Applicant Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.applicantName}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, applicantName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">WhatsApp Mobile No *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.mobile}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Village / Address</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Total Fee (₹)</label>
                  <input
                    type="number"
                    value={editFormData.totalFee}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, totalFee: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Paid Amount (₹)</label>
                  <input
                    type="number"
                    value={editFormData.paidAmount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, paidAmount: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Application Status</label>
                  <select
                    value={editFormData.currentStatus}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, currentStatus: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold text-xs"
                  >
                    <option value="INITIATED">INITIATED (Submitted)</option>
                    <option value="CI_UNDER_PROCESS">CI UNDER PROCESS (Circle Inspector)</option>
                    <option value="CO_UNDER_PROCESS">CO UNDER PROCESS (Circle Officer)</option>
                    <option value="SDO_UNDER_PROCESS">SDO UNDER PROCESS (SDO / DC Level)</option>
                    <option value="DELIVERED">DELIVERED (Issued)</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="CO_WAITING">CO WAITING (Applicant Objection)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCert(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow"
                >
                  Update Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
