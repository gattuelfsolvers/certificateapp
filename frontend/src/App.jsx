import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import {
  FileText, Plus, RefreshCw, MessageSquare, Search, Filter,
  CheckCircle2, Clock, AlertTriangle, XCircle, IndianRupee,
  Smartphone, ExternalLink, Printer, Edit, Trash2, Shield, Settings, Activity, Users, Send, Layers, Tag, PlusCircle, Zap, Download, Upload, X,
  Key, User, Lock, ShieldCheck, Building2, Store, Phone, MapPin, BadgeCheck,
  Crown, ShieldAlert, KeyRound, Copy, Check, LogOut, Eye
} from 'lucide-react';

import { 
  fetchClientsFromFirebase, 
  subscribeClientsFromFirebase,
  fetchCertificatesFromFirebase,
  saveCertificateToFirebase,
  syncBulkCertificatesToFirebase,
  deleteCertificateFromFirebase,
  fetchMastersFromFirebase,
  saveMasterToFirebase
} from './firebase';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('jharsewa');
  const [stats, setStats] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [waStatus, setWaStatus] = useState({ isConnected: false, qrCodeData: null });
  
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [certTypeFilter, setCertTypeFilter] = useState('ALL');
  const [hasDuesFilter, setHasDuesFilter] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // License & Software Security State
  const [licenseStatus, setLicenseStatus] = useState({
    active: false,
    status: 'INACTIVE',
    hwid: '',
    planType: 'MONTHLY',
    expiresAt: null,
    tampered: false,
    reason: 'Login required'
  });
  const [checkingLicense, setCheckingLicense] = useState(false);
  const [inputLicenseKey, setInputLicenseKey] = useState('');
  const [activatingKey, setActivatingKey] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState(false);

  // Master Admin State
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [showMasterAuthModal, setShowMasterAuthModal] = useState(true);
  const [masterAuthData, setMasterAuthData] = useState({ email: 'gattu.elfsolvers@gmail.com', password: '' });
  const [loggingInMaster, setLoggingInMaster] = useState(false);

  // Master Admin Control Panel State
  const [clientList, setClientList] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientViewMode, setClientViewMode] = useState('ACTIVE'); // 'ACTIVE' or 'ARCHIVED'
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loadingPaymentRequests, setLoadingPaymentRequests] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState(null);
  const [genHwid, setGenHwid] = useState('');
  const [genPlan, setGenPlan] = useState('MONTHLY');
  const [genClientName, setGenClientName] = useState('');
  const [genPhone, setGenPhone] = useState('');
  const [generatedKeyResult, setGeneratedKeyResult] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);

  const fetchPaymentRequests = async () => {
    try {
      setLoadingPaymentRequests(true);
      const res = await axios.get(`${API_BASE}/license/payment-requests`);
      if (res.data.success) {
        setPaymentRequests(res.data.requests || []);
      }
    } catch (e) {
      console.error('Error fetching payment requests:', e);
    } finally {
      setLoadingPaymentRequests(false);
    }
  };

  const handleApprovePaymentRequest = async (reqId, shopName) => {
    if (!window.confirm(`Approve payment request for ${shopName} and auto-generate License Key?`)) return;
    try {
      setApprovingRequestId(reqId);
      const res = await axios.post(`${API_BASE}/license/payment-requests/${reqId}/approve`);
      if (res.data.success) {
        showToastNotification('success', 'Request Approved!', res.data.message);
        fetchPaymentRequests();
        fetchClients();
      }
    } catch (err) {
      showToastNotification('error', 'Approval Failed', err.response?.data?.error || err.message);
    } finally {
      setApprovingRequestId(null);
    }
  };

  const handleDeletePaymentRequest = async (reqId, shopName) => {
    if (!window.confirm(`Are you sure you want to delete payment request for ${shopName}?`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/license/payment-requests/${reqId}`);
      if (res.data.success) {
        showToastNotification('success', 'Request Deleted', 'Payment request deleted successfully!');
        fetchPaymentRequests();
      }
    } catch (err) {
      showToastNotification('error', 'Delete Failed', err.response?.data?.error || err.message);
    }
  };

  // Subscription Plan Master State
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    planKey: 'MONTHLY',
    title: 'Monthly Plan (30 Days)',
    subtitle: '30 Days Full Software Access',
    badgeText: 'Starter Plan',
    price: 149,
    durationDays: 30,
    isActive: true,
    isPopular: false,
    isBestValue: false,
    features: [
      { name: 'Auto Jharsewa Sync', included: true },
      { name: 'Auto Whatsapp Status Update', included: true },
      { name: 'Sync All Certificate', included: false },
      { name: 'Sync One Certificate', included: true },
      { name: 'Backup Download', included: true },
      { name: 'Customer Support', included: true }
    ]
  });

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      const res = await axios.get(`${API_BASE}/plans`);
      if (res.data.success) {
        setPlans(res.data.plans || res.data.data || []);
      }
    } catch (e) {
      console.error('Error fetching plans:', e);
    } finally {
      setLoadingPlans(false);
    }
  };

  const openAddPlanModal = () => {
    setEditingPlan(null);
    setPlanFormData({
      planKey: 'MONTHLY',
      title: 'Monthly Plan (30 Days)',
      subtitle: '30 Days Full Software Access',
      badgeText: 'Starter Plan',
      price: 149,
      durationDays: 30,
      isActive: true,
      isPopular: false,
      isBestValue: false,
      features: [
        { name: 'Auto Jharsewa Sync', included: true },
        { name: 'Auto Whatsapp Status Update', included: true },
        { name: 'Sync All Certificate', included: false },
        { name: 'Sync One Certificate', included: true },
        { name: 'Backup Download', included: true },
        { name: 'Customer Support', included: true }
      ]
    });
    setShowPlanModal(true);
  };

  const openEditPlanModal = (p) => {
    setEditingPlan(p);
    let parsedFeatures = p.features;
    if (typeof parsedFeatures === 'string') {
      try { parsedFeatures = JSON.parse(parsedFeatures); } catch (e) { parsedFeatures = []; }
    }
    setPlanFormData({
      planKey: p.planKey || 'MONTHLY',
      title: p.title || '',
      subtitle: p.subtitle || '',
      badgeText: p.badgeText || '',
      price: p.price || 0,
      durationDays: p.durationDays || 30,
      isActive: p.isActive !== false,
      isPopular: !!p.isPopular,
      isBestValue: !!p.isBestValue,
      features: Array.isArray(parsedFeatures) && parsedFeatures.length > 0 ? parsedFeatures : [
        { name: 'Auto Jharsewa Sync', included: true },
        { name: 'Auto Whatsapp Status Update', included: true },
        { name: 'Sync All Certificate', included: false },
        { name: 'Sync One Certificate', included: true },
        { name: 'Backup Download', included: true },
        { name: 'Customer Support', included: true }
      ]
    });
    setShowPlanModal(true);
  };

  const handleSavePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingPlan(true);
      if (editingPlan) {
        const res = await axios.put(`${API_BASE}/plans/${editingPlan.id}`, planFormData);
        if (res.data.success) {
          showToastNotification('success', 'Plan Updated', 'Subscription plan updated successfully!');
          setShowPlanModal(false);
          fetchPlans();
        }
      } else {
        const res = await axios.post(`${API_BASE}/plans/create`, planFormData);
        if (res.data.success) {
          showToastNotification('success', 'Plan Created', 'New subscription plan created successfully!');
          setShowPlanModal(false);
          fetchPlans();
        }
      }
    } catch (err) {
      showToastNotification('error', 'Save Failed', err.response?.data?.error || err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete plan "${title}"?`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/plans/${id}`);
      if (res.data.success) {
        showToastNotification('success', 'Plan Deleted', 'Subscription plan deleted successfully!');
        fetchPlans();
      }
    } catch (err) {
      showToastNotification('error', 'Delete Failed', err.response?.data?.error || err.message);
    }
  };

  const fetchClients = async (overrideMode = null) => {
    try {
      setLoadingClients(true);
      const targetMode = overrideMode || clientViewMode;
      try {
        const res = await axios.get(`${API_BASE}/license/clients`, {
          params: { includeArchived: targetMode === 'ARCHIVED' ? 'true' : 'false' }
        });
        if (res.data.success) {
          setClientList(res.data.clients || []);
          return;
        }
      } catch (err) {
        console.warn('Backend server offline, fetching clients directly from Firebase Cloud...');
      }
      
      const fbClients = await fetchClientsFromFirebase();
      setClientList(fbClients || []);
    } catch (e) {
      console.error('Error fetching clients:', e);
    } finally {
      setLoadingClients(false);
    }
  };

  // Modals & Notifications
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [editingMaster, setEditingMaster] = useState(null);
  const [updatedCertIds, setUpdatedCertIds] = useState([]);
  const [toast, setToast] = useState(null);

  // Bulk Upload State
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkParsedItems, setBulkParsedItems] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const handleParseBulkText = () => {
    if (!bulkInputText || !bulkInputText.trim()) {
      showToastNotification('warning', 'Notice', 'कृपया Excel data / Text paste करें!');
      return;
    }

    const lines = bulkInputText.trim().split(/\r?\n/);
    const parsed = [];

    lines.forEach((line, index) => {
      if (!line.trim()) return;
      // Skip header if present
      if (index === 0 && (line.toLowerCase().includes('ref') || line.toLowerCase().includes('applicant') || line.toLowerCase().includes('name'))) {
        return;
      }

      // Support tab-separated (from Excel) or comma-separated
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length >= 3) {
        const refNo = parts[0] ? parts[0].trim().replace(/^"/, '').replace(/"$/, '') : '';
        const applicantName = parts[1] ? parts[1].trim().replace(/^"/, '').replace(/"$/, '') : '';
        const mobile = parts[2] ? parts[2].trim().replace(/^"/, '').replace(/"$/, '') : '';
        const address = parts[3] ? parts[3].trim().replace(/^"/, '').replace(/"$/, '') : 'GUNGHASA';
        const certTypeRaw = parts[4] ? parts[4].trim().replace(/^"/, '').replace(/"$/, '') : '';

        // Auto detect certType from refNo prefix if not provided
        let certType = certTypeRaw;
        if (!certType) {
          const upperRef = refNo.toUpperCase();
          if (upperRef.startsWith('JHIC')) certType = 'Income Certificate (JHIC)';
          else if (upperRef.startsWith('JHLRCO')) certType = 'Residential Certificate CO (JHLRCO)';
          else if (upperRef.startsWith('JHRC') || upperRef.startsWith('JHLRSDO')) certType = 'Residential Certificate SDO (JHRC)';
          else if (upperRef.startsWith('JHCBC')) certType = 'Caste Certificate Normal (JHCBC)';
          else if (upperRef.startsWith('JHCOB')) certType = 'Caste Certificate OBC (JHCOB)';
          else if (upperRef.startsWith('JHCSC')) certType = 'Caste Certificate SC (JHCSC)';
          else if (upperRef.startsWith('JHCST')) certType = 'Caste Certificate ST (JHCST)';
          else if (upperRef.startsWith('JHEWS') || upperRef.startsWith('EWS')) certType = 'EWS Certificate (JHEWS)';
          else if (upperRef.startsWith('JHMGR')) certType = 'Marriage Certificate (JHMGR)';
          else certType = 'Caste Certificate Normal (JHCBC)';
        }

        if (refNo && applicantName && mobile) {
          parsed.push({
            id: Date.now() + Math.random(),
            refNo,
            applicantName,
            mobile,
            address,
            certType,
            entryDate: new Date().toISOString().split('T')[0],
            currentStatus: 'INITIATED',
            totalFee: 150,
            paidAmount: 150,
            additionalCharge: 0,
            remarks: 'Bulk Entry'
          });
        }
      }
    });

    setBulkParsedItems(parsed);
    if (parsed.length > 0) {
      showToastNotification('success', 'Excel Data Parsed', `${parsed.length} certificate entries successfully read & prepared!`);
    } else {
      showToastNotification('error', 'Parse Error', 'No valid rows found! Format: RefNo | Name | Mobile | Address');
    }
  };

  // Handle direct Excel / CSV file upload
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      if (text) {
        setBulkInputText(text);
        showToastNotification('success', 'File Uploaded', `File "${file.name}" successfully read! Click "Parse & Preview" to confirm.`);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleSubmitBulkUpload = async () => {
    if (bulkParsedItems.length === 0) {
      showToastNotification('warning', 'Notice', 'No entries to upload!');
      return;
    }

    try {
      setBulkUploading(true);
      const res = await axios.post(`${API_BASE}/certificates`, { certificates: bulkParsedItems });
      if (res.data.success) {
        showToastNotification('success', 'Bulk Upload Success', `${bulkParsedItems.length} certificates successfully added in bulk!`);
        setBulkInputText('');
        setBulkParsedItems([]);
        fetchCertificates();
        fetchStats();
        setActiveTab('jharsewa');
      }
    } catch (err) {
      showToastNotification('error', 'Bulk Upload Failed', err.response?.data?.error || err.message);
    } finally {
      setBulkUploading(false);
    }
  };
  const [showWaTemplateModal, setShowWaTemplateModal] = useState(false);
  const [waTemplates, setWaTemplates] = useState([]);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState(null);
  const [waTemplateText, setWaTemplateText] = useState('');
  const [savingWaTemplate, setSavingWaTemplate] = useState(false);
  const [testMobile, setTestMobile] = useState('');
  const [sendingTestMsg, setSendingTestMsg] = useState(false);

  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (certTypeFilter && certTypeFilter !== 'ALL') params.append('certType', certTypeFilter);
      if (hasDuesFilter) params.append('hasDues', 'true');

      const response = await axios.get(`${API_BASE}/certificates/export-csv?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Certificate_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToastNotification('success', 'Report Exported', 'Certificate report downloaded successfully in CSV/Excel format!');
    } catch (err) {
      showToastNotification('error', 'Export Failed', err.response?.data?.error || err.message);
    } finally {
      setExportingCsv(false);
    }
  };

  const showToastNotification = (type, title, message, details = null) => {
    setToast({ type, title, message, details });
  };

  const showPaymentConfirmationModal = () => {
    setToast({
      type: 'success',
      title: '🎉 Payment Submitted Successfully!',
      message: `Thanks for choosing our service. Your software activation process is on the way. Please be patient and make sure you have paid your subscription fee. Thanks.\n\nFor help please contact 7781931880`
    });
  };

  const fetchWaTemplates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/whatsapp-templates`);
      if (res.data.success) {
        setWaTemplates(res.data.data);
        if (res.data.data.length > 0) {
          const first = res.data.data[0];
          setSelectedWaTemplate(first);
          setWaTemplateText(first.messageText);
        }
      }
    } catch (e) {
      console.error('Error fetching WhatsApp templates:', e);
    }
  };

  const handleSaveWaTemplate = async () => {
    if (!selectedWaTemplate) return;
    try {
      setSavingWaTemplate(true);
      const res = await axios.put(`${API_BASE}/whatsapp-templates/${selectedWaTemplate.templateKey}`, {
        messageText: waTemplateText
      });
      if (res.data.success) {
        showToastNotification('success', 'Template Saved', `Template "${selectedWaTemplate.title}" updated successfully!`);
        const updatedItem = res.data.data;
        setWaTemplates(prev => prev.map(t => t.templateKey === updatedItem.templateKey ? updatedItem : t));
        setSelectedWaTemplate(updatedItem);
      }
    } catch (err) {
      showToastNotification('error', 'Save Failed', err.response?.data?.error || err.message);
    } finally {
      setSavingWaTemplate(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testMobile || testMobile.trim().length < 10) {
      showToastNotification('warning', 'Mobile Number Required', 'Please enter a valid 10-digit mobile number for test message!');
      return;
    }

    try {
      setSendingTestMsg(true);
      const res = await axios.post(`${API_BASE}/whatsapp-templates/send-test`, {
        mobile: testMobile.trim(),
        messageText: waTemplateText
      });
      if (res.data.success) {
        showToastNotification('success', 'Test Message Sent!', `Live preview message successfully sent to WhatsApp: ${testMobile}`);
      }
    } catch (err) {
      showToastNotification('error', 'Test Send Failed', err.response?.data?.error || err.message);
    } finally {
      setSendingTestMsg(false);
    }
  };

  const [jharsewaCreds, setJharsewaCreds] = useState({ username: '', password: '' });
  const [savingJharsewaCreds, setSavingJharsewaCreds] = useState(false);
  const [showJharsewaPass, setShowJharsewaPass] = useState(false);

  const fetchJharsewaCreds = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings/jharsewa-credentials`);
      if (res.data.success) {
        setJharsewaCreds({ username: res.data.username || '', password: res.data.password || '' });
      }
    } catch (e) {
      console.error('Error fetching Jharsewa credentials:', e);
    }
  };

  const handleSaveJharsewaCreds = async (e) => {
    e.preventDefault();
    if (!jharsewaCreds.username || !jharsewaCreds.password) {
      showToastNotification('warning', 'Fields Required', 'Please enter both Username and Password for Jharsewa Portal!');
      return;
    }
    try {
      setSavingJharsewaCreds(true);
      const res = await axios.post(`${API_BASE}/settings/jharsewa-credentials`, jharsewaCreds);
      if (res.data.success) {
        showToastNotification('success', 'Credentials Saved!', 'Jharsewa Portal Login ID & Password updated successfully!');
      }
    } catch (err) {
      showToastNotification('error', 'Save Failed', err.response?.data?.error || err.message);
    } finally {
      setSavingJharsewaCreds(false);
    }
  };

  const [shopProfile, setShopProfile] = useState({ shopName: '', ownerName: '', shopPhone: '', shopAddress: '' });
  const [savingShopProfile, setSavingShopProfile] = useState(false);

  const fetchShopProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings/shop-profile`);
      if (res.data.success) {
        setShopProfile({
          shopName: res.data.shopName || '',
          ownerName: res.data.ownerName || '',
          shopPhone: res.data.shopPhone || '',
          shopAddress: res.data.shopAddress || ''
        });
      }
    } catch (e) {
      console.error('Error fetching shop profile:', e);
    }
  };

  useEffect(() => {
    fetchShopProfile();
  }, []);

  const handleSaveShopProfile = async (e) => {
    e.preventDefault();
    if (!shopProfile.shopName || !shopProfile.shopName.trim()) {
      showToastNotification('warning', 'Shop Name Required', 'Please enter your Shop / Center Name!');
      return;
    }
    try {
      setSavingShopProfile(true);
      const res = await axios.post(`${API_BASE}/settings/shop-profile`, shopProfile);
      if (res.data.success) {
        showToastNotification('success', 'Shop Profile Saved!', 'Shop & Branding details updated successfully!');
      }
    } catch (err) {
      showToastNotification('error', 'Save Failed', err.response?.data?.error || err.message);
    } finally {
      setSavingShopProfile(false);
    }
  };

  // Master Form State
  const [masterFormData, setMasterFormData] = useState({
    name: '',
    subCategory: '',
    prefix: '',
    price: 150,
  });

  // Common Applicant Info for New Entry Modal
  const currentYear = new Date().getFullYear();
  const [applicantInfo, setApplicantInfo] = useState({
    applicantName: '',
    mobile: '',
    address: '',
    entryDate: new Date().toISOString().split('T')[0],
  });

  // Queue of Certificates for same Applicant
  const [certItems, setCertItems] = useState([]);

  // Helper to build a default cert item
  const buildDefaultCertItem = (masterList) => {
    const defaultMaster = (masterList && masterList.length > 0) ? masterList[0] : null;
    const prefixCode = defaultMaster ? (defaultMaster.prefix || defaultMaster.subCategory || 'JHCBC') : 'JHCBC';
    const label = defaultMaster ? (defaultMaster.subCategory ? `${defaultMaster.name} (${defaultMaster.subCategory})` : defaultMaster.name) : 'Caste Certificate (JHCBC)';
    const price = defaultMaster ? defaultMaster.price : 150;
    const isNoPrefix = !prefixCode || prefixCode.toUpperCase() === 'NONE' || prefixCode.toUpperCase().startsWith('PAN');
    const lockedPrefix = isNoPrefix ? '' : `${prefixCode.toUpperCase()}/${currentYear}/`;

    return {
      id: Date.now() + Math.random(),
      masterId: defaultMaster ? defaultMaster.id : '',
      certType: label,
      refPrefix: lockedPrefix,
      refSuffix: '',
      basePrice: price,
      additionalCharge: 0,
      paidAmount: price,
    };
  };

  // Input form state for current active certificate entry before adding to list
  const [currentCertInput, setCurrentCertInput] = useState({
    masterId: '',
    certType: '',
    refPrefix: `JHCBC/${currentYear}/`,
    refSuffix: '',
    basePrice: 150,
    additionalCharge: 0,
    paidAmount: 150,
  });

  const resetForm = () => {
    setApplicantInfo({
      applicantName: '',
      mobile: '',
      address: '',
      entryDate: new Date().toISOString().split('T')[0],
    });
    setCertItems([]);
    if (masters && masters.length > 0) {
      setCurrentCertInput(buildDefaultCertItem(masters));
    }
  };

  const handleCurrentMasterChange = (masterId) => {
    const selectedMaster = masters.find(m => m.id === masterId);
    if (!selectedMaster) return;

    const prefixCode = selectedMaster.prefix || selectedMaster.subCategory || 'JH';
    const label = selectedMaster.subCategory 
      ? `${selectedMaster.name} (${selectedMaster.subCategory})` 
      : selectedMaster.name;

    const isNoPrefix = !prefixCode || prefixCode.toUpperCase() === 'NONE' || prefixCode.toUpperCase().startsWith('PAN');
    const lockedPrefix = isNoPrefix ? '' : `${prefixCode.toUpperCase()}/${currentYear}/`;
    const price = selectedMaster.price || 0;

    setCurrentCertInput({
      masterId,
      certType: label,
      refPrefix: lockedPrefix,
      refSuffix: '',
      basePrice: price,
      additionalCharge: 0,
      paidAmount: price,
    });
  };

  const openEntryFormForSubCategory = (code) => {
    resetForm();
    const targetMaster = masters.find(
      (m) =>
        (m.subCategory && m.subCategory.toUpperCase() === code.toUpperCase()) ||
        (m.prefix && m.prefix.toUpperCase() === code.toUpperCase())
    );

    if (targetMaster) {
      handleCurrentMasterChange(targetMaster.id);
    } else {
      const isNoPrefix = code.toUpperCase().startsWith('PAN');
      const lockedPrefix = isNoPrefix ? '' : `${code.toUpperCase()}/${currentYear}/`;
      setCurrentCertInput({
        masterId: '',
        certType: `${code} Certificate`,
        refPrefix: lockedPrefix,
        refSuffix: '',
        basePrice: 150,
        additionalCharge: 0,
        paidAmount: 150,
      });
    }

    setShowAddModal(true);
  };

  const handleCurrentAddFeeChange = (val) => {
    const extra = parseFloat(val) || 0;
    const newTotal = (parseFloat(currentCertInput.basePrice) || 0) + extra;
    setCurrentCertInput(prev => ({
      ...prev,
      additionalCharge: extra,
      paidAmount: newTotal,
    }));
  };

  const handleAddToList = () => {
    if (!currentCertInput.refSuffix || !currentCertInput.refSuffix.trim()) {
      showToastNotification('warning', 'Reference Number Required', 'कृपया Reference / Acknowledgement Number टाइप करें!');
      return;
    }

    // Find corresponding master to ensure label and refPrefix are set 100%
    const selectedMaster = masters.find(m => m.id === currentCertInput.masterId) || masters[0];
    const label = selectedMaster ? (selectedMaster.subCategory ? `${selectedMaster.name} (${selectedMaster.subCategory})` : selectedMaster.name) : (currentCertInput.certType || 'Caste Certificate (JHCBC)');

    const newItem = {
      ...currentCertInput,
      id: Date.now() + Math.random(),
      masterId: selectedMaster ? selectedMaster.id : currentCertInput.masterId,
      certType: label,
      refPrefix: currentCertInput.refPrefix || '',
      refSuffix: currentCertInput.refSuffix.trim(),
    };

    setCertItems(prev => [...prev, newItem]);

    // Reset input form for next certificate
    setCurrentCertInput(buildDefaultCertItem(masters));
  };

  const removeCertItemFromQueue = (index) => {
    setCertItems(prev => prev.filter((_, i) => i !== index));
  };

  // Load Data & Check License Security
  useEffect(() => {
    checkLicenseStatus();
    fetchStats();
    fetchCertificates();
    fetchMasters();
    fetchWaStatus();
    fetchClients();
    fetchPlans();
    fetchPaymentRequests();

    // Periodic WhatsApp status, Payment Requests and License Activation check
    const interval = setInterval(() => {
      fetchWaStatus();
      fetchPaymentRequests();
      checkLicenseStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkLicenseStatus = async () => {
    try {
      setCheckingLicense(true);
      const res = await axios.get(`${API_BASE}/license/status`);
      if (res.data.success) {
        setLicenseStatus({
          active: res.data.active,
          status: res.data.status,
          hwid: res.data.hwid || '',
          planType: res.data.planType || 'INACTIVE',
          expiresAt: res.data.expiresAt || null,
          tampered: res.data.tampered || false,
          reason: res.data.reason || ''
        });
      }
    } catch (e) {
      console.error('Error checking license status:', e);
    } finally {
      setCheckingLicense(false);
    }
  };

  const handleActivateLicense = async (e) => {
    e.preventDefault();
    if (!inputLicenseKey || !inputLicenseKey.trim()) {
      showToastNotification('warning', 'Key Required', 'Please enter your License Key!');
      return;
    }
    try {
      setActivatingKey(true);
      const res = await axios.post(`${API_BASE}/license/activate`, { licenseKey: inputLicenseKey.trim() });
      if (res.data.success) {
        showToastNotification('success', 'License Activated!', res.data.message);
        setInputLicenseKey('');
        checkLicenseStatus();
      }
    } catch (err) {
      showToastNotification('error', 'Activation Failed', err.response?.data?.error || err.message);
    } finally {
      setActivatingKey(false);
    }
  };

  const handleGoogleOAuthSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse || !credentialResponse.credential) {
        showToastNotification('error', 'Google Login Failed', 'No credential token received from Google!');
        return;
      }
      const decoded = jwtDecode(credentialResponse.credential);
      const userEmail = (decoded.email || '').toLowerCase().trim();

      if (userEmail !== 'gattu.elfsolvers@gmail.com') {
        showToastNotification('error', 'Access Denied 🚫', `Email "${userEmail}" is NOT authorized!\nOnly Master Admin (gattu.elfsolvers@gmail.com) can access this dashboard.`);
        return;
      }

      await handleMasterLogin(null, true, userEmail);
    } catch (err) {
      console.error('Google Auth Error:', err);
      showToastNotification('error', 'Google Login Error', err.message || 'Failed to verify Google Account.');
    }
  };

  const handleMasterLogin = async (e, isGoogle = false, customEmail = null) => {
    if (e) e.preventDefault();
    try {
      setLoggingInMaster(true);
      const emailToUse = (customEmail || masterAuthData.email || '').toLowerCase().trim();
      
      if (isGoogle || emailToUse === 'gattu.elfsolvers@gmail.com') {
        localStorage.setItem('MASTER_SUPER_ADMIN_SESSION', 'ACTIVE');
        setIsMasterAdmin(true);
        setShowMasterAuthModal(false);
        setLicenseStatus(prev => ({ ...prev, active: true, status: 'ACTIVE' }));
        setActiveTab('jharsewa');
        fetchClients();
        showToastNotification(
          'success',
          '👑 Welcome Back Gattu Ji!',
          '🎉 Master Super Admin System Unlocked Successfully!\nAuthorized Master Account: gattu.elfsolvers@gmail.com'
        );
        return;
      }

      const payload = { ...masterAuthData, email: emailToUse };
      const res = await axios.post(`${API_BASE}/license/master-login`, payload);
      if (res.data.success) {
        localStorage.setItem('MASTER_SUPER_ADMIN_SESSION', 'ACTIVE');
        setIsMasterAdmin(true);
        setShowMasterAuthModal(false);
        setLicenseStatus(prev => ({ ...prev, active: true, status: 'ACTIVE' }));
        setActiveTab('jharsewa');
        fetchClients();
        showToastNotification(
          'success',
          '👑 Welcome Back Gattu Ji!',
          '🎉 Master Super Admin System Unlocked Successfully!\nAuthorized Master Account: gattu.elfsolvers@gmail.com'
        );
      }
    } catch (err) {
      showToastNotification(
        'error',
        'Access Denied',
        err.response?.data?.error || '❌ You are not authorized for this! Access Denied.'
      );
    } finally {
      setLoggingInMaster(false);
    }
  };

  const handleMasterLogout = () => {
    localStorage.removeItem('MASTER_SUPER_ADMIN_SESSION');
    setIsMasterAdmin(false);
    showToastNotification('warning', 'Logged Out', 'Master Admin Session ended successfully!');
  };

  // Client Master Modal & CRUD State
  const [showClientModal, setShowClientModal] = useState(false);
  const [showClientDetailsModal, setShowClientDetailsModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingClient, setRenewingClient] = useState(null);
  const [renewPlan, setRenewPlan] = useState('YEARLY');
  const [renewingSubmit, setRenewingSubmit] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState(null);

  const handleRenewClientSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!renewingClient) return;

    try {
      setRenewingSubmit(true);
      const res = await axios.post(`${API_BASE}/license/generate-key`, {
        hwid: renewingClient.hwid,
        planType: renewPlan,
        clientName: renewingClient.clientName,
        ownerName: renewingClient.ownerName,
        phone: renewingClient.phone
      });

      if (res.data.success) {
        showToastNotification(
          'success',
          '🎉 License Renewed Successfully!',
          `New Key Generated: ${res.data.licenseKey}\nClient license reactivated with ${renewPlan} plan.`
        );
        setShowRenewModal(false);
        fetchClients();
      }
    } catch (err) {
      showToastNotification('error', 'Renewal Failed', err.response?.data?.error || err.message);
    } finally {
      setRenewingSubmit(false);
    }
  };
  const [clientFormData, setClientFormData] = useState({
    clientName: '',
    ownerName: '',
    phone: '',
    hwid: '',
    planType: 'MONTHLY',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [savingClient, setSavingClient] = useState(false);

  const resetClientForm = () => {
    setEditingClient(null);
    setClientFormData({
      clientName: '',
      ownerName: '',
      phone: '',
      hwid: '',
      planType: 'MONTHLY',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  };

  const openAddClientModal = () => {
    resetClientForm();
    setShowClientModal(true);
  };

  const openEditClientModal = (cl) => {
    setEditingClient(cl);
    setClientFormData({
      clientName: cl.clientName || '',
      ownerName: cl.ownerName || '',
      phone: cl.phone || '',
      hwid: cl.hwid || '',
      planType: cl.planType || 'MONTHLY',
      status: cl.status || 'ACTIVE',
      expiresAt: cl.expiresAt ? new Date(cl.expiresAt).toISOString().split('T')[0] : ''
    });
    setShowClientModal(true);
  };

  const handleSaveClientSubmit = async (e) => {
    e.preventDefault();
    if (!clientFormData.hwid || !clientFormData.hwid.trim()) {
      showToastNotification('warning', 'HWID Required', 'Please enter Hardware ID (HWID)!');
      return;
    }
    try {
      setSavingClient(true);
      if (editingClient) {
        const res = await axios.put(`${API_BASE}/license/clients/${editingClient.id}`, clientFormData);
        if (res.data.success) {
          showToastNotification('success', 'Client Updated!', res.data.message);
          setShowClientModal(false);
          fetchClients();
        }
      } else {
        const res = await axios.post(`${API_BASE}/license/clients/create`, clientFormData);
        if (res.data.success) {
          showToastNotification('success', 'Client Created!', res.data.message);
          setShowClientModal(false);
          fetchClients();
        }
      }
    } catch (err) {
      showToastNotification('error', 'Save Failed', err.response?.data?.error || err.message);
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = async (id, name) => {
    if (!window.confirm(`Are you sure you want to move client "${name}" to Deleted History Archive?\nTheir Serial Key & Hardware ID details will be preserved.`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/license/clients/${id}`);
      if (res.data.success) {
        showToastNotification('success', 'Client Archived', res.data.message);
        fetchClients();
      }
    } catch (err) {
      showToastNotification('error', 'Archive Failed', err.response?.data?.error || err.message);
    }
  };

  const handleRestoreClient = async (id, name) => {
    if (!window.confirm(`Restore client "${name}" back to Active Clients list?`)) return;
    try {
      const res = await axios.post(`${API_BASE}/license/clients/${id}/restore`);
      if (res.data.success) {
        showToastNotification('success', 'Client Restored', res.data.message);
        fetchClients();
      }
    } catch (err) {
      showToastNotification('error', 'Restore Failed', err.response?.data?.error || err.message);
    }
  };

  const handlePermanentDeleteClient = async (id, name) => {
    if (!window.confirm(`⚠️ PERMANENT DELETE WARNING: Are you sure you want to PERMANENTLY erase client "${name}" from database?\nThis action CANNOT be undone.`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/license/clients/${id}/permanent`);
      if (res.data.success) {
        showToastNotification('success', 'Permanently Deleted', res.data.message);
        fetchClients();
      }
    } catch (err) {
      showToastNotification('error', 'Permanent Delete Failed', err.response?.data?.error || err.message);
    }
  };

  const handleUpdateStatusDirect = async (hwid, newStatus) => {
    try {
      const res = await axios.post(`${API_BASE}/license/toggle-client-status`, { hwid, status: newStatus });
      if (res.data.success) {
        showToastNotification('success', 'Status Updated', `Client status changed to ${newStatus}`);
        fetchClients();
        checkLicenseStatus();
      }
    } catch (err) {
      showToastNotification('error', 'Update Failed', err.response?.data?.error || err.message);
    }
  };

  const handleGenerateKeySubmit = async (e) => {
    e.preventDefault();
    if (!genHwid || !genHwid.trim()) {
      showToastNotification('warning', 'HWID Required', 'Please enter Client Hardware ID (HWID)!');
      return;
    }
    try {
      setGeneratingKey(true);
      const res = await axios.post(`${API_BASE}/license/generate-key`, {
        hwid: genHwid.trim(),
        planType: genPlan,
        clientName: genClientName,
        phone: genPhone
      });
      if (res.data.success) {
        setGeneratedKeyResult(res.data.licenseKey);
        showToastNotification('success', 'License Key Generated!', `Key created for ${genClientName || 'Client'}`);
        fetchClients();
      }
    } catch (err) {
      showToastNotification('error', 'Key Generation Failed', err.response?.data?.error || err.message);
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleToggleClientStatus = async (hwid, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'KILLED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to change client status to ${nextStatus}?`)) return;
    try {
      const res = await axios.post(`${API_BASE}/license/toggle-client-status`, { hwid, status: nextStatus });
      if (res.data.success) {
        showToastNotification('success', 'Client Status Updated', res.data.message);
        fetchClients();
        checkLicenseStatus();
      }
    } catch (err) {
      showToastNotification('error', 'Status Update Failed', err.response?.data?.error || err.message);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [search, statusFilter, certTypeFilter, hasDuesFilter]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/dashboard/stats`);
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      // Primary: Fetch directly from Firebase Cloud Database
      const fbCerts = await fetchCertificatesFromFirebase();
      if (fbCerts && fbCerts.length > 0) {
        let filtered = fbCerts;
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter(c => 
            (c.refSuffix && String(c.refSuffix).toLowerCase().includes(s)) ||
            (c.applicantName && String(c.applicantName).toLowerCase().includes(s)) ||
            (c.mobile && String(c.mobile).toLowerCase().includes(s)) ||
            (c.refNo && String(c.refNo).toLowerCase().includes(s))
          );
        }
        if (statusFilter !== 'ALL') {
          filtered = filtered.filter(c => (c.status || c.currentStatus) === statusFilter);
        }
        if (certTypeFilter !== 'ALL') {
          filtered = filtered.filter(c => c.certType === certTypeFilter);
        }
        if (hasDuesFilter) {
          filtered = filtered.filter(c => (parseFloat(c.paidAmount) || 0) < ((parseFloat(c.basePrice) || 0) + (parseFloat(c.additionalCharge) || 0)));
        }
        setCertificates(filtered);
        return;
      }

      // Local API Fallback
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (certTypeFilter !== 'ALL') params.certType = certTypeFilter;
      if (hasDuesFilter) params.hasDues = 'true';

      const res = await axios.get(`${API_BASE}/certificates`, { params });
      if (res.data.success) {
        setCertificates(res.data.data);
      }
    } catch (e) {
      console.error('Error fetching certificates:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const fbMasters = await fetchMastersFromFirebase();
      if (fbMasters && fbMasters.length > 0) {
        setMasters(fbMasters);
        setCurrentCertInput(buildDefaultCertItem(fbMasters));
        return;
      }

      const res = await axios.get(`${API_BASE}/masters`);
      if (res.data.success) {
        setMasters(res.data.data);
        if (res.data.data && res.data.data.length > 0) {
          setCurrentCertInput(buildDefaultCertItem(res.data.data));
        }
      }
    } catch (e) {
      console.error('Error fetching masters:', e);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/whatsapp/status`);
      if (res.data.success) {
        setWaStatus({
          isConnected: res.data.isConnected,
          qrCodeData: res.data.qrCodeData,
        });
      }
    } catch (e) {}
  };

  const handleMasterSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: masterFormData.name,
        subCategory: masterFormData.subCategory,
        prefix: masterFormData.prefix || masterFormData.subCategory,
        price: masterFormData.price,
      };

      if (editingMaster) {
        const res = await axios.put(`${API_BASE}/masters/${editingMaster.id}`, payload);
        if (res.data.success) {
          alert('✅ Master Entry Updated!');
          setShowMasterModal(false);
          setEditingMaster(null);
          fetchMasters();
        }
      } else {
        const res = await axios.post(`${API_BASE}/masters`, payload);
        if (res.data.success) {
          alert('✅ Master Entry Added!');
          setShowMasterModal(false);
          resetMasterForm();
          fetchMasters();
        }
      }
    } catch (err) {
      alert(`❌ Master error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteMaster = async (id, name) => {
    if (!window.confirm(`Delete master category ${name}?`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/masters/${id}`);
      if (res.data.success) {
        alert('✅ Master Entry Deleted!');
        fetchMasters();
      }
    } catch (err) {
      alert(`❌ Error deleting master: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!applicantInfo.applicantName || !applicantInfo.applicantName.trim()) {
      alert('⚠️ कृपया आवेदक का नाम (Applicant Name) भरें!');
      return;
    }
    if (!applicantInfo.mobile || !applicantInfo.mobile.trim()) {
      alert('⚠️ कृपया व्हाट्सएप मोबाइल नंबर (Mobile Number) भरें!');
      return;
    }

    let finalItemsToSave = [];

    if (certItems.length > 0) {
      // If list has 1 or more certificates, use ONLY the items in the list! Ignore upper input form.
      finalItemsToSave = [...certItems];
    } else {
      // If list is 0, check upper form input
      if (currentCertInput.refSuffix && currentCertInput.refSuffix.trim()) {
        finalItemsToSave.push({
          ...currentCertInput,
          id: Date.now() + Math.random(),
          refSuffix: currentCertInput.refSuffix.trim(),
        });
      }
    }

    if (finalItemsToSave.length === 0) {
      alert('⚠️ कृपया Certificate का Reference Number भरें या "+ Add Certificate to List" बटन पर क्लिक करें!');
      return;
    }

    // Validate ref numbers for all items in queue
    for (let i = 0; i < finalItemsToSave.length; i++) {
      if (!finalItemsToSave[i].refSuffix || !finalItemsToSave[i].refSuffix.trim()) {
        alert(`⚠️ कृपया Certificate #${i + 1} का Reference Number टाइप करें!`);
        return;
      }
    }

    // Format payload for backend bulk or single
    const payloadCertificates = finalItemsToSave.map(item => {
      const fullRefNo = `${item.refPrefix}${item.refSuffix.trim()}`;
      const totalFee = (parseFloat(item.basePrice) || 0) + (parseFloat(item.additionalCharge) || 0);
      const paid = parseFloat(item.paidAmount) || 0;
      return {
        applicantName: applicantInfo.applicantName.trim(),
        mobile: applicantInfo.mobile.trim(),
        address: applicantInfo.address ? applicantInfo.address.trim() : null,
        entryDate: applicantInfo.entryDate,
        certType: item.certType,
        refNo: fullRefNo,
        additionalCharge: parseFloat(item.additionalCharge) || 0,
        totalFee: totalFee,
        paidAmount: paid,
        currentStatus: 'INITIATED',
      };
    });

    try {
      const res = await axios.post(`${API_BASE}/certificates`, { certificates: payloadCertificates });
      if (res.data.success) {
        alert(`✅ ${payloadCertificates.length} Certificate Entry/Entries Created!\n\n${res.data.whatsAppSent ? `📱 Automatic WhatsApp Receipt sent for ${payloadCertificates.length} certificate(s)!` : '⚠️ WhatsApp message skipped (Engine not connected or invalid number).'}`);
        setShowAddModal(false);
        resetForm();
        fetchCertificates();
        fetchStats();
      }
    } catch (err) {
      alert(`❌ Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const [editFormData, setEditFormData] = useState({});
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCert) return;
    try {
      const res = await axios.put(`${API_BASE}/certificates/${selectedCert.id}`, editFormData);
      if (res.data.success) {
        alert('✅ Record updated successfully!');
        setShowEditModal(false);
        fetchCertificates();
        fetchStats();
      }
    } catch (err) {
      alert(`❌ Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDelete = async (id, refNo) => {
    if (!window.confirm(`Are you sure you want to delete certificate ${refNo}?`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/certificates/${id}`);
      if (res.data.success) {
        showToastNotification('success', 'Certificate Deleted', `Certificate ${refNo} deleted successfully!`);
        fetchCertificates();
        fetchStats();
      }
    } catch (err) {
      showToastNotification('error', 'Delete Failed', err.response?.data?.error || err.message);
    }
  };

  const handleSyncSingle = async (id, refNo) => {
    try {
      setSyncSingleId(id);
      const res = await axios.post(`${API_BASE}/certificates/${id}/sync-jharsewa`);
      if (res.data.success) {
        const certObj = certificates.find((c) => c.id === id);
        const newStatus = res.data.statusResult?.status || res.data.newStatus;
        const oldStatus = certObj?.currentStatus;
        const statusChanged = res.data.statusChanged !== undefined
          ? res.data.statusChanged
          : Boolean(oldStatus && newStatus && oldStatus !== newStatus);

        showToastNotification('success', 'Jharsewa Status Sync Complete', statusChanged ? `Status updated to ${newStatus}` : `Status checked: No change (${newStatus})`, {
          refNo,
          applicantName: certObj?.applicantName || 'N/A',
          mobile: certObj?.mobile || 'N/A',
          certType: certObj?.certType || 'Certificate',
          status: newStatus,
          certObj: certObj ? { ...certObj, currentStatus: newStatus } : null
        });

        if (statusChanged) {
          setUpdatedCertIds(prev => [...new Set([...prev, id])]);
        } else {
          setUpdatedCertIds(prev => prev.filter(item => item !== id));
        }
        fetchCertificates();
        fetchStats();
      }
    } catch (err) {
      const serverErr = err.response?.data?.error || err.response?.data?.details || err.message;
      showToastNotification('error', 'Sync Notice', serverErr);
    } finally {
      setSyncSingleId(null);
    }
  };

  const [syncSingleId, setSyncSingleId] = useState(null);
  const [sendingPdfId, setSendingPdfId] = useState(null);

  const handleSendPdf = async (cert) => {
    const isDelivered = cert.currentStatus === 'DELIVERED' || cert.currentStatus === 'CO_DELIVERED' || cert.currentStatus === 'SDO_DELIVERED';
    if (!isDelivered) {
      showToastNotification('warning', 'Notice', 'यह प्रमाणपत्र अभी Delivered नहीं हुआ है!');
      return;
    }

    if (!cert.mobile) {
      showToastNotification('warning', 'Notice', 'इस प्रमाणपत्र के साथ कोई मोबाइल नंबर दर्ज नहीं है!');
      return;
    }

    try {
      setSendingPdfId(cert.id);
      const res = await axios.post(`${API_BASE}/certificates/${cert.id}/send-pdf`, { customMobile: cert.mobile });
      if (res.data.success) {
        showToastNotification('success', 'WhatsApp Delivery Success', `PDF Certificate successfully sent to WhatsApp: ${cert.mobile}`);
      }
    } catch (err) {
      showToastNotification('error', 'PDF Send Failed', err.response?.data?.error || err.message);
    } finally {
      setSendingPdfId(null);
    }
  };

  const [resendingReceiptId, setResendingReceiptId] = useState(null);

  const handleResendReceipt = async (cert) => {
    if (!cert.mobile) {
      showToastNotification('warning', 'Notice', 'इस प्रमाणपत्र के साथ कोई मोबाइल नंबर दर्ज नहीं है!');
      return;
    }

    try {
      setResendingReceiptId(cert.id);
      const res = await axios.post(`${API_BASE}/certificates/${cert.id}/resend-receipt`);
      if (res.data.success) {
        showToastNotification('success', 'Receipt Resent', `WhatsApp Receipt successfully resent to: ${cert.mobile}`);
      }
    } catch (err) {
      showToastNotification('error', 'Resend Failed', err.response?.data?.error || err.message);
    } finally {
      setResendingReceiptId(null);
    }
  };

  const [syncingFiltered, setSyncingFiltered] = useState(false);

  const handleSyncFiltered = async () => {
    try {
      setSyncingFiltered(true);
      const payload = {
        status: statusFilter,
        certType: certTypeFilter,
        search: search,
        hasDues: hasDuesFilter
      };
      const res = await axios.post(`${API_BASE}/certificates/sync-filtered`, payload, { timeout: 600000 });
      if (res.data.success) {
        showToastNotification('success', 'Filtered Sync Complete', res.data.message);
        const resultsArray = res.data.results || res.data.syncResults || [];
        if (Array.isArray(resultsArray)) {
          const changedIds = resultsArray.filter(r => r.oldStatus && r.newStatus && r.oldStatus !== r.newStatus).map(r => r.certId || r.id).filter(Boolean);
          setUpdatedCertIds(prev => [...new Set([...prev, ...changedIds])]);
        }
        fetchCertificates();
        fetchStats();
      }
    } catch (err) {
      showToastNotification('error', 'Filtered Sync Failed', err.response?.data?.error || err.message);
    } finally {
      setSyncingFiltered(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      const res = await axios.post(`${API_BASE}/certificates/sync-all-jharsewa`, {}, { timeout: 600000 });
      if (res.data.success) {
        showToastNotification('success', 'Bulk Sync Complete', res.data.message);
        const resultsArray = res.data.results || res.data.syncResults || [];
        if (Array.isArray(resultsArray)) {
          const changedIds = resultsArray.filter(r => r.oldStatus && r.newStatus && r.oldStatus !== r.newStatus).map(r => r.certId || r.id).filter(Boolean);
          setUpdatedCertIds(prev => [...new Set([...prev, ...changedIds])]);
        }
        fetchCertificates();
        fetchStats();
      }
    } catch (err) {
      showToastNotification('error', 'Bulk Sync Failed', err.response?.data?.error || err.message);
    } finally {
      setSyncing(false);
    }
  };

  const resetMasterForm = () => {
    setMasterFormData({
      name: '',
      subCategory: '',
      prefix: '',
      price: 150,
    });
    setEditingMaster(null);
  };

  const openEditMasterModal = (m) => {
    setEditingMaster(m);
    setMasterFormData({
      name: m.name,
      subCategory: m.subCategory || '',
      prefix: m.prefix || m.subCategory || '',
      price: m.price,
    });
    setShowMasterModal(true);
  };

  const openEditModal = (cert) => {
    setSelectedCert(cert);
    setEditFormData({
      refNo: cert.refNo,
      applicantName: cert.applicantName,
      mobile: cert.mobile,
      address: cert.address || '',
      certType: cert.certType,
      entryDate: cert.entryDate ? new Date(cert.entryDate).toISOString().split('T')[0] : '',
      currentStatus: cert.currentStatus,
      totalFee: cert.totalFee,
      remarks: cert.remarks || '',
    });
    setShowEditModal(true);
  };

  const getCertPrefix = (certType) => {
    if (!certType) return '';
    const match = certType.match(/\(([^)]+)\)/);
    return match ? match[1] : certType;
  };

  const getStatusBadge = (status, isNewUpdate = false) => {
    let badgeContent = null;
    switch (status) {
      case 'INITIATED':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300"><Clock className="w-3.5 h-3.5 text-slate-600" /> Initiated</span>;
        break;
      case 'WAITING':
      case 'CI_WAITING':
      case 'CO_WAITING':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Waiting For Response (Pending)</span>;
        break;
      case 'UNDER_PROCESS':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><Clock className="w-3.5 h-3.5 text-blue-600" /> Under Process</span>;
        break;
      case 'CI_UNDER_PROCESS':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300"><Clock className="w-3.5 h-3.5 text-sky-600" /> CI Under Process</span>;
        break;
      case 'CO_UNDER_PROCESS':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><Clock className="w-3.5 h-3.5 text-blue-600" /> CO Under Process</span>;
        break;
      case 'SDO_UNDER_PROCESS':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300"><Clock className="w-3.5 h-3.5 text-indigo-600" /> SDO Under Process</span>;
        break;
      case 'CO_DELIVERED':
      case 'SDO_DELIVERED':
      case 'DELIVERED':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Delivered</span>;
        break;
      case 'HOLD':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300"><AlertTriangle className="w-3.5 h-3.5 text-purple-600" /> Hold</span>;
        break;
      case 'PAN_OBJECTION':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Under Objection</span>;
        break;
      case 'PAN_GENERATED':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-300"><CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> Pan Generated</span>;
        break;
      case 'REJECTED':
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300"><XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected</span>;
        break;
      default:
        badgeContent = <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><Clock className="w-3.5 h-3.5 text-blue-600" /> Under Process</span>;
        break;
    }

    return (
      <div className="inline-flex items-center gap-1.5">
        {badgeContent}
        {isNewUpdate && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white animate-pulse shadow-xs border border-rose-700 uppercase tracking-tighter" title="Status updated in latest sync!">
            NEW
          </span>
        )}
      </div>
    );
  };

  // Grand totals calculation for modal summary
  const grandTotalFees = certItems.reduce((acc, item) => acc + ((parseFloat(item.basePrice) || 0) + (parseFloat(item.additionalCharge) || 0)), 0);
  const grandTotalPaid = certItems.reduce((acc, item) => acc + (parseFloat(item.paidAmount) || 0), 0);
  // Filter logic for Jharsewa vs PAN Card tabs
  const isPanCard = (c) => {
    const type = (c.certType || '').toUpperCase();
    const ref = (c.refNo || '').toUpperCase();
    return type.includes('PAN') || ref.startsWith('PAN');
  };

  const jharsewaCertificates = certificates.filter((c) => !isPanCard(c));
  const panCertificates = certificates.filter((c) => isPanCard(c));
  const incomeCertificates = certificates.filter(c => getCertPrefix(c.certType) === 'JHIC');
  const casteCertificates = certificates.filter(c => ['JHCBC', 'JHNBC', 'JHCSC', 'JHCST'].includes(getCertPrefix(c.certType)));
  const residentialCertificates = certificates.filter(c => ['JHLRCO', 'JHRC'].includes(getCertPrefix(c.certType)));
  const obcCertificates = certificates.filter(c => ['JHCOB', 'JHOBCH'].includes(getCertPrefix(c.certType)));
  const ewsCertificates = certificates.filter(c => ['JHEWS', 'JHEWSH'].includes(getCertPrefix(c.certType)));
  const marriageCertificates = certificates.filter(c => getCertPrefix(c.certType) === 'JHMGR');

  const currentTabList = (() => {
    switch (activeTab) {
      case 'income': return incomeCertificates;
      case 'caste': return casteCertificates;
      case 'residential': return residentialCertificates;
      case 'obc': return obcCertificates;
      case 'ews': return ewsCertificates;
      case 'marriage': return marriageCertificates;
      case 'pancard': return panCertificates;
      default: return jharsewaCertificates;
    }
  })();

  const filteredCertificates = currentTabList.filter((c) => {
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      c.refNo?.toLowerCase().includes(query) ||
      c.applicantName?.toLowerCase().includes(query) ||
      c.mobile?.includes(query);

    let matchesStatus = false;
    if (statusFilter === 'ALL') {
      matchesStatus = true;
    } else if (statusFilter === 'WAITING') {
      matchesStatus = ['WAITING', 'CI_WAITING', 'CO_WAITING'].includes(c.currentStatus);
    } else if (statusFilter === 'UNDER_PROCESS') {
      matchesStatus = ['UNDER_PROCESS', 'CI_UNDER_PROCESS', 'CO_UNDER_PROCESS', 'SDO_UNDER_PROCESS'].includes(c.currentStatus);
    } else if (statusFilter === 'DELIVERED') {
      matchesStatus = ['DELIVERED', 'CO_DELIVERED', 'SDO_DELIVERED'].includes(c.currentStatus);
    } else {
      matchesStatus = c.currentStatus === statusFilter;
    }

    const matchesDues = !hasDuesFilter || (c.duesAmount && c.duesAmount > 0);

    return matchesSearch && matchesStatus && matchesDues;
  });

  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* Subtle Background Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl space-y-7 animate-in zoom-in-95 duration-200 z-10">
          {/* Header Branding */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-sky-500 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20 border border-white/10">
              <Crown className="w-9 h-9 text-white" />
            </div>
            
            <div className="space-y-1.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                Welcome to Certificate Entry Management System
              </h1>
              <p className="text-xs font-semibold text-amber-400/90 tracking-wide uppercase">
                Powered By: Apna Digital Hub, Gomoh, Dhanbad
              </p>
            </div>
          </div>

          {/* OFFICIAL GOOGLE LOGIN API COMPONENT WITH 1-CLICK UNLOCK */}
          <div className="flex flex-col items-center justify-center w-full space-y-4 pt-2">
            <div className="w-full flex justify-center scale-110 py-2">
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  try {
                    const decoded = jwtDecode(credentialResponse.credential);
                    if (decoded && decoded.email) {
                      handleMasterLogin(null, true, decoded.email);
                    }
                  } catch (e) {
                    showToastNotification('error', 'Google Auth Error', 'Failed to decode Google Token!');
                  }
                }}
                onError={() => {
                  showToastNotification('error', 'Google Auth Failed', 'Google Sign In failed or popup blocked!');
                }}
                useOneTap={false}
                shape="pill"
                size="large"
                text="signin_with"
              />
            </div>
          </div>

          {/* Contact Line Footer */}
          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-xs font-semibold text-slate-400 flex items-center justify-center gap-2">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>Contact : <strong className="text-slate-200 font-mono">7781931880</strong></span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {shopProfile.shopName && shopProfile.shopName.trim() ? shopProfile.shopName.trim() : 'अपना डिजिटल हब'} - Certificate Management
            </h1>
            <p className="text-xs text-slate-500">Jharsewa Portal Certificate Tracking & Instant WhatsApp Automation</p>
          </div>
        </div>

        {/* TOP CONTROLS & STATUS */}
        <div className="flex items-center gap-4">
          {/* WhatsApp Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            waStatus.isConnected 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-amber-50 text-amber-700 border-amber-300'
          }`}>
            <Smartphone className="w-4 h-4" />
            <span>WhatsApp: {waStatus.isConnected ? 'Connected' : 'Scan QR'}</span>
          </div>

          {/* Sync All Button */}
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition duration-150 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Jharsewa...' : 'Sync All Status'}</span>
          </button>

          {/* Payment & License Requests Bell Notification Button */}
          <button
            onClick={() => {
              fetchPaymentRequests();
              setActiveTab('payment-requests');
            }}
            className="relative p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition cursor-pointer flex items-center justify-center shadow-xs"
            title="Payment & Activation Requests"
          >
            <Crown className="w-5 h-5 text-amber-600" />
            {paymentRequests.filter(r => r.status === 'PENDING').length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-md border-2 border-white">
                {paymentRequests.filter(r => r.status === 'PENDING').length}
              </span>
            )}
          </button>

          {/* Add New Certificate Button */}
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>New Certificate Entry</span>
          </button>

          {/* Settings Gear Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`p-2 rounded-xl border transition-all duration-150 flex items-center justify-center cursor-pointer ${
                showSettingsMenu || activeTab === 'masters' || activeTab === 'whatsapp'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="Settings & System Configurations"
            >
              <Settings className={`w-5 h-5 ${showSettingsMenu ? 'rotate-45' : ''} transition-transform duration-200`} />
            </button>

            {/* Dropdown Menu */}
            {showSettingsMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowSettingsMenu(false)} 
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Settings</p>
                  </div>

                  <button
                    onClick={() => {
                      fetchShopProfile();
                      setActiveTab('shop-profile');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-sky-50 transition cursor-pointer ${
                      activeTab === 'shop-profile' ? 'text-sky-600 font-bold bg-sky-50/50' : 'text-slate-700'
                    }`}
                  >
                    <Store className="w-4 h-4 text-sky-600" />
                    <span>Shop & Branding Master</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('masters');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-slate-50 transition cursor-pointer ${
                      activeTab === 'masters' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-700'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Category & Prefix Master</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('whatsapp');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-slate-50 transition cursor-pointer ${
                      activeTab === 'whatsapp' ? 'text-emerald-600 font-bold bg-emerald-50/50' : 'text-slate-700'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp QR & Logs</span>
                  </button>

                  <button
                    onClick={() => {
                      fetchWaTemplates();
                      setActiveTab('wa-templates');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-purple-50 transition cursor-pointer ${
                      activeTab === 'wa-templates' ? 'text-purple-600 font-bold bg-purple-50/50' : 'text-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span>WhatsApp Message Master</span>
                  </button>

                  <button
                    onClick={() => {
                      fetchJharsewaCreds();
                      setActiveTab('jharsewa-creds');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-amber-50 transition cursor-pointer ${
                      activeTab === 'jharsewa-creds' ? 'text-amber-600 font-bold bg-amber-50/50' : 'text-slate-700'
                    }`}
                  >
                    <Key className="w-4 h-4 text-amber-600" />
                    <span>Jharsewa Portal Credentials</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('bulk-upload');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-blue-50 transition cursor-pointer border-t border-slate-100 ${
                      activeTab === 'bulk-upload' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Bulk Certificate Upload</span>
                  </button>

                  <button
                    onClick={() => {
                      fetchClients();
                      setActiveTab('client-master');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-teal-50 transition cursor-pointer border-t border-slate-100 ${
                      activeTab === 'client-master' ? 'text-teal-600 font-bold bg-teal-50/50' : 'text-slate-700'
                    }`}
                  >
                    <Users className="w-4 h-4 text-teal-600" />
                    <span>Client List Master</span>
                  </button>

                  <button
                    onClick={() => {
                      fetchPlans();
                      setActiveTab('plan-master');
                      setShowSettingsMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-amber-50 transition cursor-pointer border-t border-slate-100 ${
                      activeTab === 'plan-master' ? 'text-amber-600 font-bold bg-amber-50/50' : 'text-slate-700'
                    }`}
                  >
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-amber-700">Subscription Plan Master</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      if (isMasterAdmin) {
                        setActiveTab('master-control');
                        fetchClients();
                      } else {
                        setShowMasterAuthModal(true);
                      }
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 hover:bg-amber-50 transition cursor-pointer border-t border-slate-100 ${
                      activeTab === 'master-control' ? 'text-amber-600 font-bold bg-amber-50/50' : 'text-slate-800'
                    }`}
                  >
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-slate-900">CLIENTS & LICENSE MASTER</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      handleMasterLogout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer border-t border-slate-100"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Master Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* DASHBOARD QUICK STATS BAR */}
      {stats && (
        <div className="bg-white border-b border-slate-200 px-6 py-4 grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col">
            <span className="text-xs text-slate-500 font-medium">Total Records</span>
            <span className="text-xl font-bold text-slate-900">{stats.totalEntries}</span>
          </div>
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3 flex flex-col">
            <span className="text-xs text-blue-700 font-medium">Under Process</span>
            <span className="text-xl font-bold text-blue-700">{stats.underProcessCount}</span>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 flex flex-col">
            <span className="text-xs text-emerald-700 font-medium">Delivered</span>
            <span className="text-xl font-bold text-emerald-700">{stats.deliveredCount}</span>
          </div>
          <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-3 flex flex-col">
            <span className="text-xs text-rose-700 font-medium">Rejected</span>
            <span className="text-xl font-bold text-rose-700">{stats.rejectedCount}</span>
          </div>
          <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-3 flex flex-col">
            <span className="text-xs text-teal-700 font-medium">Total Fees</span>
            <span className="text-xl font-bold text-teal-700">₹{stats.totalFees.toLocaleString()}</span>
          </div>
          <div className="bg-amber-50/50 border border-amber-300 rounded-xl p-3 flex flex-col">
            <span className="text-xs text-amber-800 font-medium">Total Dues</span>
            <span className="text-xl font-bold text-amber-800">₹{stats.totalDues.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* DIRECT SERVICE QUICK LAUNCH CARDS */}
      <div className="bg-slate-50/70 border-b border-slate-200 px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>DIRECT SERVICE QUICK LAUNCH CARDS</span>
          </div>
          <span className="text-xs text-slate-400">Click any sub-service button to open entry form instantly</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-stretch w-full">
          {/* 1. INCOME */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 flex flex-col justify-between min-h-[115px] h-full shadow-xs w-full min-w-0">
            <div 
              onClick={() => setActiveTab('income')}
              className="flex items-center justify-between cursor-pointer group"
              title="Click to view Income Certificates Table"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 group-hover:text-emerald-700 transition truncate">
                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">INCOME</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-emerald-700 font-bold text-[11px] flex items-center justify-center border border-emerald-200 shadow-2xs shrink-0 ml-1">
                {incomeCertificates.length}
              </span>
            </div>
            <div className="my-auto flex items-center justify-center min-h-[56px]">
              <button
                onClick={() => openEntryFormForSubCategory('JHIC')}
                className="w-full flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-1.5 px-2 rounded-full transition shadow-sm active:scale-95 cursor-pointer truncate"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">JHIC</span>
              </button>
            </div>
          </div>

          {/* 2. CASTE */}
          <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3 flex flex-col justify-between min-h-[115px] h-full shadow-xs w-full min-w-0">
            <div 
              onClick={() => setActiveTab('caste')}
              className="flex items-center justify-between cursor-pointer group"
              title="Click to view Caste Certificates Table"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950 group-hover:text-purple-700 transition truncate">
                <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">CASTE</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-purple-700 font-bold text-[11px] flex items-center justify-center border border-purple-200 shadow-2xs shrink-0 ml-1">
                {casteCertificates.length}
              </span>
            </div>
            <div className="my-auto grid grid-cols-2 gap-1 min-h-[56px] items-center">
              {['JHCBC', 'JHNBC', 'JHCSC', 'JHCST'].map(code => (
                <button
                  key={code}
                  onClick={() => openEntryFormForSubCategory(code)}
                  className="flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-1.5 px-2 rounded-full transition shadow-sm active:scale-95 cursor-pointer truncate"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. RESIDENTIAL */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 flex flex-col justify-between min-h-[115px] h-full shadow-xs w-full min-w-0">
            <div 
              onClick={() => setActiveTab('residential')}
              className="flex items-center justify-between cursor-pointer group"
              title="Click to view Residential Certificates Table"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 group-hover:text-blue-700 transition truncate">
                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">RESIDENTIAL</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-blue-700 font-bold text-[11px] flex items-center justify-center border border-blue-200 shadow-2xs shrink-0 ml-1">
                {residentialCertificates.length}
              </span>
            </div>
            <div className="my-auto grid grid-cols-1 gap-1.5 min-h-[56px] items-center">
              {['JHLRCO', 'JHRC'].map(code => (
                <button
                  key={code}
                  onClick={() => openEntryFormForSubCategory(code)}
                  className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-1 px-2 rounded-full transition shadow-sm active:scale-95 cursor-pointer truncate"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. OBC */}
          <div className="bg-fuchsia-50/80 border border-fuchsia-200 rounded-2xl p-3 flex flex-col justify-between min-h-[115px] h-full shadow-xs w-full min-w-0">
            <div 
              onClick={() => setActiveTab('obc')}
              className="flex items-center justify-between cursor-pointer group"
              title="Click to view OBC Certificates Table"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-950 group-hover:text-fuchsia-700 transition truncate">
                <FileText className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
                <span className="truncate">OBC</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-fuchsia-700 font-bold text-[11px] flex items-center justify-center border border-fuchsia-200 shadow-2xs shrink-0 ml-1">
                {obcCertificates.length}
              </span>
            </div>
            <div className="my-auto grid grid-cols-1 gap-1.5 min-h-[56px] items-center">
              {['JHCOB', 'JHOBCH'].map(code => (
                <button
                  key={code}
                  onClick={() => openEntryFormForSubCategory(code)}
                  className="w-full flex items-center justify-center gap-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold text-xs py-1 px-2 rounded-full transition shadow-sm active:scale-95 cursor-pointer truncate"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. EWS */}
          <div className="bg-cyan-50/80 border border-cyan-200 rounded-2xl p-3 flex flex-col justify-between min-h-[115px] h-full shadow-xs w-full min-w-0">
            <div 
              onClick={() => setActiveTab('ews')}
              className="flex items-center justify-between cursor-pointer group"
              title="Click to view EWS Certificates Table"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-950 group-hover:text-teal-700 transition truncate">
                <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">EWS</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-teal-700 font-bold text-[11px] flex items-center justify-center border border-teal-200 shadow-2xs shrink-0 ml-1">
                {ewsCertificates.length}
              </span>
            </div>
            <div className="my-auto grid grid-cols-1 gap-1.5 min-h-[56px] items-center">
              {['JHEWS', 'JHEWSH'].map(code => (
                <button
                  key={code}
                  onClick={() => openEntryFormForSubCategory(code)}
                  className="w-full flex items-center justify-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2 rounded-full transition shadow-sm active:scale-95 cursor-pointer truncate"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 6. MARRIAGE */}
          <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-3 flex flex-col justify-between min-h-[115px] h-full shadow-xs w-full min-w-0">
            <div 
              onClick={() => setActiveTab('marriage')}
              className="flex items-center justify-between cursor-pointer group"
              title="Click to view Marriage Certificates Table"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-950 group-hover:text-rose-700 transition truncate">
                <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate">MARRIAGE</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-rose-700 font-bold text-[11px] flex items-center justify-center border border-rose-200 shadow-2xs shrink-0 ml-1">
                {marriageCertificates.length}
              </span>
            </div>
            <div className="my-auto flex items-center justify-center min-h-[56px]">
              <button
                onClick={() => openEntryFormForSubCategory('JHMGR')}
                className="w-full flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-1.5 px-2 rounded-full transition shadow-sm active:scale-95 cursor-pointer truncate"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">JHMGR</span>
              </button>
            </div>
          </div>

          {/* 7. PAN CARD */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 flex flex-col justify-between min-h-[115px] h-full shadow-xs w-full min-w-0">
            <div 
              onClick={() => setActiveTab('pancard')}
              className="flex items-center justify-between cursor-pointer group"
              title="Click to view PAN Card Applications Table"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 group-hover:text-amber-700 transition truncate">
                <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">PAN CARD</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-white text-amber-700 font-bold text-[11px] flex items-center justify-center border border-amber-200 shadow-2xs shrink-0 ml-1">
                {panCertificates.length}
              </span>
            </div>
            <div className="my-auto grid grid-cols-1 gap-1.5 min-h-[56px] items-center">
              {['PANNEW', 'PANUPD'].map(code => (
                <button
                  key={code}
                  onClick={() => openEntryFormForSubCategory(code)}
                  className="w-full flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-1 px-2 rounded-full transition shadow-sm active:scale-95 cursor-pointer truncate"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS FOR ALL SECTIONS (100% EQUAL FIXED WIDTH TABS FOR ALL 8 CATEGORIES) */}
      <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('jharsewa')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'jharsewa'
              ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <FileText className={`w-3.5 h-3.5 ${activeTab === 'jharsewa' ? 'text-white' : 'text-sky-600'}`} /> All Jharsewa
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'jharsewa' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {jharsewaCertificates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('income')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'income'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${activeTab === 'income' ? 'bg-white' : 'bg-emerald-500'}`}></span> Income
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'income' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {incomeCertificates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('caste')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'caste'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${activeTab === 'caste' ? 'bg-white' : 'bg-purple-500'}`}></span> Caste
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'caste' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
          }`}>
            {casteCertificates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('residential')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'residential'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${activeTab === 'residential' ? 'bg-white' : 'bg-blue-500'}`}></span> Residential
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'residential' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
          }`}>
            {residentialCertificates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('obc')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'obc'
              ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${activeTab === 'obc' ? 'bg-white' : 'bg-fuchsia-500'}`}></span> OBC
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'obc' ? 'bg-white/20 text-white' : 'bg-fuchsia-100 text-fuchsia-800'
          }`}>
            {obcCertificates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ews')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'ews'
              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${activeTab === 'ews' ? 'bg-white' : 'bg-teal-500'}`}></span> EWS
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'ews' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
          }`}>
            {ewsCertificates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('marriage')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'marriage'
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${activeTab === 'marriage' ? 'bg-white' : 'bg-rose-500'}`}></span> Marriage
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'marriage' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
          }`}>
            {marriageCertificates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pancard')}
          className={`w-40 justify-center py-2 px-3 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
            activeTab === 'pancard'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200/60'
          }`}
        >
          <Tag className={`w-3.5 h-3.5 ${activeTab === 'pancard' ? 'text-white' : 'text-amber-600'}`} /> PAN Card
          <span className={`ml-1 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
            activeTab === 'pancard' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            {panCertificates.length}
          </span>
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 space-y-6">
        {/* JHARSEWA (ALL) CERTIFICATES TAB */}
        {activeTab === 'jharsewa' && (
          <div className="space-y-4">
            {/* SEARCH & FILTER CONTROLS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between shadow-sm">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search All Jharsewa by Ref No, Applicant Name, Phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-56 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="INITIATED">Initiated</option>
                  <option value="WAITING">Waiting For Response (Pending)</option>
                  <option value="CI_UNDER_PROCESS">CI Under Process</option>
                  <option value="CO_UNDER_PROCESS">CO Under Process</option>
                  <option value="SDO_UNDER_PROCESS">SDO Under Process</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="HOLD">Hold</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <button
                  onClick={handleSyncFiltered}
                  disabled={syncingFiltered || syncing}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Sync Jharsewa status ONLY for current filtered list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingFiltered ? 'animate-spin' : ''}`} />
                  {syncingFiltered ? 'Syncing Filtered...' : 'Sync Filtered List'}
                </button>

                <button
                  onClick={() => setHasDuesFilter(!hasDuesFilter)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border flex items-center gap-1.5 transition ${
                    hasDuesFilter
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-slate-50 text-slate-600 border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <IndianRupee className="w-3.5 h-3.5" /> Dues Only
                </button>

                <button
                  onClick={handleExportCsv}
                  disabled={exportingCsv}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Export Report to CSV / Excel"
                >
                  <Download className="w-4 h-4" />
                  {exportingCsv ? 'Exporting...' : 'Export Report'}
                </button>
              </div>
            </div>

            {/* JHARSEWA CERTIFICATES TABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100/80 text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap w-52">Ref Number</th>
                      <th className="px-5 py-4 whitespace-nowrap w-64">Applicant & Phone</th>
                      <th className="px-5 py-4 whitespace-nowrap w-28">Cert Type</th>
                      <th className="px-5 py-4 whitespace-nowrap w-32">Entry Date</th>
                      <th className="px-5 py-4 whitespace-nowrap w-44">Status</th>
                      <th className="px-5 py-4 whitespace-nowrap w-40">Fees / Dues</th>
                      <th className="px-5 py-4 text-right whitespace-nowrap min-w-[200px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-8 text-center text-slate-500">Loading records...</td>
                      </tr>
                    ) : filteredCertificates.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                          No Jharsewa Certificate entries found. Click "New Certificate Entry" to add one!
                        </td>
                      </tr>
                    ) : (
                      filteredCertificates.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-5 py-4 font-mono font-semibold text-sky-700 whitespace-nowrap">{c.refNo}</td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900 whitespace-nowrap">{c.applicantName}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                              <Smartphone className="w-3 h-3" /> {c.mobile}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-700 border border-slate-200 font-medium" title={c.certType}>
                              {getCertPrefix(c.certType)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                            {(() => {
                              if (!c.entryDate) return '-';
                              const d = new Date(c.entryDate);
                              const day = String(d.getDate()).padStart(2, '0');
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              return `${day}/${month}/${d.getFullYear()}`;
                            })()}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">{getStatusBadge(c.currentStatus, updatedCertIds.includes(c.id))}</td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="text-xs">
                              <span className="text-slate-800">Paid: ₹{c.paidAmount}</span> / <span className="text-slate-500">₹{c.totalFee}</span>
                            </div>
                            {c.duesAmount > 0 ? (
                              <div className="text-xs font-bold text-amber-700 mt-0.5">Dues: ₹{c.duesAmount}</div>
                            ) : (
                              <div className="text-[10px] text-emerald-700 font-semibold">Fully Paid</div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {(c.currentStatus === 'DELIVERED' || c.currentStatus === 'CO_DELIVERED' || c.currentStatus === 'SDO_DELIVERED') && (
                                <button
                                  onClick={() => handleSendPdf(c)}
                                  disabled={sendingPdfId === c.id}
                                  title="Send Certificate PDF on WhatsApp"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                                >
                                  <Send className={`w-3.5 h-3.5 ${sendingPdfId === c.id ? 'animate-bounce' : ''}`} />
                                  <span>{sendingPdfId === c.id ? 'Sending...' : 'SEND PDF'}</span>
                                </button>
                              )}
                              <button onClick={() => handleSyncSingle(c.id, c.refNo)} disabled={syncSingleId === c.id} title="Check Jharsewa Status" className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition disabled:opacity-50">
                                <RefreshCw className={`w-4 h-4 ${syncSingleId === c.id ? 'animate-spin' : ''}`} />
                              </button>
                              <button onClick={() => { setSelectedCert(c); setShowReceiptModal(true); }} title="Print/View Receipt" className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                                <Printer className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditModal(c)} title="Edit Record" className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(c.id, c.refNo)} title="Delete" className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition">
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
          </div>
        )}

        {/* SECTION SPECIFIC TABLES (INCOME, CASTE, RESIDENTIAL, OBC, EWS, MARRIAGE) */}
        {['income', 'caste', 'residential', 'obc', 'ews', 'marriage'].includes(activeTab) && (
          <div className="space-y-4">
            {/* SEARCH & FILTER CONTROLS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between shadow-sm">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab.toUpperCase()} records by Ref No, Applicant Name, Phone...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-56 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="INITIATED">Initiated</option>
                  <option value="WAITING">Waiting For Response (Pending)</option>
                  <option value="CI_UNDER_PROCESS">CI Under Process</option>
                  <option value="CO_UNDER_PROCESS">CO Under Process</option>
                  <option value="SDO_UNDER_PROCESS">SDO Under Process</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="HOLD">Hold</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <button
                  onClick={() => setHasDuesFilter(!hasDuesFilter)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border flex items-center gap-1.5 transition ${
                    hasDuesFilter ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <IndianRupee className="w-3.5 h-3.5" /> Dues Only
                </button>
              </div>
            </div>

            {/* DEDICATED SECTION TABLE */}
            <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${
              activeTab === 'income' ? 'border-emerald-200' :
              activeTab === 'caste' ? 'border-purple-200' :
              activeTab === 'residential' ? 'border-sky-200' :
              activeTab === 'obc' ? 'border-fuchsia-200' :
              activeTab === 'ews' ? 'border-teal-200' :
              'border-rose-200'
            }`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className={`text-xs uppercase tracking-wider border-b ${
                    activeTab === 'income' ? 'bg-emerald-50/90 text-emerald-950 border-emerald-200' :
                    activeTab === 'caste' ? 'bg-purple-50/90 text-purple-950 border-purple-200' :
                    activeTab === 'residential' ? 'bg-sky-50/90 text-sky-950 border-sky-200' :
                    activeTab === 'obc' ? 'bg-fuchsia-50/90 text-fuchsia-950 border-fuchsia-200' :
                    activeTab === 'ews' ? 'bg-teal-50/90 text-teal-950 border-teal-200' :
                    'bg-rose-50/90 text-rose-950 border-rose-200'
                  }`}>
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap w-52">Ref Number</th>
                      <th className="px-5 py-4 whitespace-nowrap w-64">Applicant & Phone</th>
                      <th className="px-5 py-4 whitespace-nowrap w-28">Cert Type</th>
                      <th className="px-5 py-4 whitespace-nowrap w-32">Entry Date</th>
                      <th className="px-5 py-4 whitespace-nowrap w-44">Status</th>
                      <th className="px-5 py-4 whitespace-nowrap w-40">Fees / Dues</th>
                      <th className="px-5 py-4 text-right whitespace-nowrap min-w-[200px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-8 text-center text-slate-500">Loading records...</td>
                      </tr>
                    ) : filteredCertificates.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                          No {activeTab.toUpperCase()} Certificate entries found. Click direct launch card to add one!
                        </td>
                      </tr>
                    ) : (
                      filteredCertificates.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition">
                          <td className={`px-5 py-4 font-mono font-semibold whitespace-nowrap ${
                            activeTab === 'income' ? 'text-emerald-700' :
                            activeTab === 'caste' ? 'text-purple-700' :
                            activeTab === 'residential' ? 'text-blue-700' :
                            activeTab === 'obc' ? 'text-fuchsia-700' :
                            activeTab === 'ews' ? 'text-teal-700' :
                            'text-rose-700'
                          }`}>
                            {c.refNo}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900 whitespace-nowrap">{c.applicantName}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                              <Smartphone className="w-3 h-3" /> {c.mobile}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              activeTab === 'income' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                              activeTab === 'caste' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                              activeTab === 'residential' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                              activeTab === 'obc' ? 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' :
                              activeTab === 'ews' ? 'bg-teal-100 text-teal-800 border-teal-300' :
                              'bg-rose-100 text-rose-800 border-rose-300'
                            }`} title={c.certType}>
                              {getCertPrefix(c.certType)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                            {(() => {
                              if (!c.entryDate) return '-';
                              const d = new Date(c.entryDate);
                              const day = String(d.getDate()).padStart(2, '0');
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              return `${day}/${month}/${d.getFullYear()}`;
                            })()}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">{getStatusBadge(c.currentStatus, updatedCertIds.includes(c.id))}</td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="text-xs">
                              <span className="text-slate-800">Paid: ₹{c.paidAmount}</span> / <span className="text-slate-500">₹{c.totalFee}</span>
                            </div>
                            {c.duesAmount > 0 ? (
                              <div className="text-xs font-bold text-amber-700 mt-0.5">Dues: ₹{c.duesAmount}</div>
                            ) : (
                              <div className="text-[10px] text-emerald-700 font-semibold">Fully Paid</div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {(c.currentStatus === 'DELIVERED' || c.currentStatus === 'CO_DELIVERED' || c.currentStatus === 'SDO_DELIVERED') && (
                                <button
                                  onClick={() => handleSendPdf(c)}
                                  disabled={sendingPdfId === c.id}
                                  title="Send Certificate PDF on WhatsApp"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                                >
                                  <Send className={`w-3.5 h-3.5 ${sendingPdfId === c.id ? 'animate-bounce' : ''}`} />
                                  <span>{sendingPdfId === c.id ? 'Sending...' : 'SEND PDF'}</span>
                                </button>
                              )}
                              <button onClick={() => handleSyncSingle(c.id, c.refNo)} disabled={syncSingleId === c.id} title="Check Jharsewa Status" className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition disabled:opacity-50">
                                <RefreshCw className={`w-4 h-4 ${syncSingleId === c.id ? 'animate-spin' : ''}`} />
                              </button>
                              <button onClick={() => { setSelectedCert(c); setShowReceiptModal(true); }} title="Print/View Receipt" className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                                <Printer className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditModal(c)} title="Edit Record" className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(c.id, c.refNo)} title="Delete" className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition">
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
          </div>
        )}

        {/* PAN CARD APPLICATIONS TAB */}
        {activeTab === 'pancard' && (
          <div className="space-y-4">
            {/* SEARCH & FILTER CONTROLS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between shadow-sm">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search PAN Applications by Ack No, Applicant Name, Phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-56 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="INITIATED">Initiated</option>
                  <option value="PAN_OBJECTION">Under Objection</option>
                  <option value="PAN_GENERATED">Pan Generated</option>
                  <option value="DELIVERED">Pan Delivered</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                {/* Has Dues Toggle */}
                <button
                  onClick={() => setHasDuesFilter(!hasDuesFilter)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border flex items-center gap-1.5 transition ${
                    hasDuesFilter
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-slate-50 text-slate-600 border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <IndianRupee className="w-3.5 h-3.5" /> Dues Only
                </button>
              </div>
            </div>

            {/* PAN CARD APPLICATIONS TABLE */}
            <div className="bg-white border border-amber-200/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-amber-50/70 text-xs uppercase tracking-wider text-amber-950 border-b border-amber-200">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap w-52">Ack / Ref Number</th>
                      <th className="px-5 py-4 whitespace-nowrap w-64">Applicant & Phone</th>
                      <th className="px-5 py-4 whitespace-nowrap w-28">PAN Type</th>
                      <th className="px-5 py-4 whitespace-nowrap w-32">Application Date</th>
                      <th className="px-5 py-4 whitespace-nowrap w-44">Status</th>
                      <th className="px-5 py-4 whitespace-nowrap w-40">Fees / Dues</th>
                      <th className="px-5 py-4 text-right whitespace-nowrap min-w-[200px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                          Loading records...
                        </td>
                      </tr>
                    ) : filteredCertificates.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                          No PAN Card Application entries found. Click "PANNEW" or "PANUPD" cards to add one!
                        </td>
                      </tr>
                    ) : (
                      filteredCertificates.map((c) => (
                        <tr key={c.id} className="hover:bg-amber-50/30 transition">
                          <td className="px-5 py-4 font-mono font-semibold text-amber-700 whitespace-nowrap">
                            {c.refNo}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900 whitespace-nowrap">{c.applicantName}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                              <Smartphone className="w-3 h-3" /> {c.mobile}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span 
                              className="px-2.5 py-1 rounded-lg text-xs bg-amber-100 text-amber-800 border border-amber-300 font-medium"
                              title={c.certType}
                            >
                              {getCertPrefix(c.certType)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                            {(() => {
                              if (!c.entryDate) return '-';
                              const d = new Date(c.entryDate);
                              const day = String(d.getDate()).padStart(2, '0');
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              return `${day}/${month}/${d.getFullYear()}`;
                            })()}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {getStatusBadge(c.currentStatus, updatedCertIds.includes(c.id))}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="text-xs">
                              <span className="text-slate-800">Paid: ₹{c.paidAmount}</span> / <span className="text-slate-500">₹{c.totalFee}</span>
                            </div>
                            {c.duesAmount > 0 ? (
                              <div className="text-xs font-bold text-amber-700 mt-0.5">
                                Dues: ₹{c.duesAmount}
                              </div>
                            ) : (
                              <div className="text-[10px] text-emerald-700 font-semibold">Fully Paid</div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {/* View Receipt */}
                              <button
                                onClick={() => { setSelectedCert(c); setShowReceiptModal(true); }}
                                title="Print/View Receipt"
                                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => openEditModal(c)}
                                title="Edit Record"
                                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(c.id, c.refNo)}
                                title="Delete"
                                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
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
          </div>
        )}

        {/* MASTER CATEGORY ENTRY TAB */}
        {activeTab === 'masters' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" /> Certificate Category & Ref Prefix Master
                </h2>
                <p className="text-xs text-slate-500">Manage certificate types, Sub Category codes (e.g. JHCBC, JHNBC, JHCSC, JHCST), Ref No Prefixes, and Fees.</p>
              </div>

              <button
                onClick={() => { resetMasterForm(); setShowMasterModal(true); }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" /> Add Master Category
              </button>
            </div>

            {/* MASTER TABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100/80 text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4">Certificate Type</th>
                      <th className="px-5 py-4">Sub Category Code</th>
                      <th className="px-5 py-4">Ref No Prefix</th>
                      <th className="px-5 py-4">Default Price (Fee)</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {masters.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-5 py-8 text-center text-slate-500">
                          No master category entries found. Click "Add Master Category" to create one!
                        </td>
                      </tr>
                    ) : (
                      masters.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {m.name}
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-bold">
                              {m.subCategory || 'DEFAULT'}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold text-sky-700">
                            {(m.prefix || m.subCategory || 'JH')}/{currentYear}/
                          </td>
                          <td className="px-5 py-4 font-bold text-emerald-700">
                            ₹{m.price}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditMasterModal(m)}
                                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                                title="Edit Master Entry"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteMaster(m.id, m.name)}
                                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                                title="Delete Master Entry"
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
          </div>
        )}

        {/* WHATSAPP TAB */}
        {activeTab === 'whatsapp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* QR Connection Status Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <Smartphone className="w-5 h-5 text-emerald-600" /> WhatsApp Engine Connection
              </h2>
              <p className="text-sm text-slate-600">
                Scan QR Code from WhatsApp (Linked Devices) to enable automatic instant messaging on certificate entries.
              </p>

              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl min-h-[300px]">
                {waStatus.isConnected ? (
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-bold text-emerald-700">WhatsApp Connected!</h3>
                    <p className="text-xs text-slate-600">Automatic messages are ready to dispatch.</p>
                  </div>
                ) : waStatus.qrCodeData ? (
                  <div className="text-center space-y-3">
                    <img src={waStatus.qrCodeData} alt="WhatsApp QR Code" className="w-64 h-64 rounded-xl border-4 border-slate-300 mx-auto shadow-md" />
                    <p className="text-xs text-slate-600 animate-pulse">Open WhatsApp &gt; Linked Devices &gt; Scan Code</p>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 space-y-2">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                    <p className="text-sm">Initializing WhatsApp Session Engine...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Information Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <Send className="w-5 h-5 text-sky-600" /> WhatsApp Automated Messages
              </h2>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Entry Receipt Message:</strong>
                    <p className="text-xs text-slate-600 mt-1">Dispatched automatically as soon as a new certificate entry is saved.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Status Change Alerts:</strong>
                    <p className="text-xs text-slate-600 mt-1">Sent when Jharsewa status changes to Delivered or Rejected.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* WHATSAPP MESSAGE MASTER PAGE TAB */}
        {activeTab === 'wa-templates' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[650px]">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">WhatsApp Message Master</h3>
                  <p className="text-xs text-purple-100">Customize WhatsApp message wording and dynamic tags for all customer alerts</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('jharsewa')}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[550px]">
              
              {/* Left Sidebar: List of Templates */}
              <div className="md:col-span-4 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-3">Select Message Template ({waTemplates.length})</p>
                {waTemplates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading templates...</div>
                ) : (
                  waTemplates.map((tpl) => {
                    const isSelected = selectedWaTemplate?.templateKey === tpl.templateKey;
                    return (
                      <button
                        key={tpl.templateKey}
                        onClick={() => {
                          setSelectedWaTemplate(tpl);
                          setWaTemplateText(tpl.messageText);
                        }}
                        className={`w-full text-left p-3 rounded-2xl border text-xs transition cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-700 shadow-md font-semibold'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{tpl.title}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {tpl.category}
                          </span>
                        </div>
                        <span className={`text-[10px] truncate max-w-full font-mono ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                          {tpl.templateKey}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Right Panel: Template Editor & Actions */}
              <div className="md:col-span-8 p-6 flex flex-col overflow-y-auto bg-white">
                {selectedWaTemplate ? (
                  <div className="flex flex-col h-full space-y-4">
                    
                    {/* Selected Template Header Info */}
                    <div className="bg-purple-50/60 border border-purple-200/60 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-purple-950">{selectedWaTemplate.title}</h4>
                        <p className="text-xs text-purple-700 font-mono">Key: {selectedWaTemplate.templateKey}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold uppercase">
                        {selectedWaTemplate.category}
                      </span>
                    </div>

                    {/* Dynamic Tags Helper Buttons */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2">
                        Quick Dynamic Placeholders (Click to insert):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          '{applicantName}',
                          '{refNo}',
                          '{certType}',
                          '{entryDate}',
                          '{currentStatus}',
                          '{duesLine}',
                          '{totalCount}'
                        ].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setWaTemplateText(prev => prev + ' ' + tag)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 border border-slate-300 hover:border-purple-300 rounded-lg text-xs font-mono font-medium transition cursor-pointer active:scale-95"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text Area Editor */}
                    <div className="flex-1 flex flex-col">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        WhatsApp Message Text Template:
                      </label>
                      <textarea
                        rows={12}
                        value={waTemplateText}
                        onChange={(e) => setWaTemplateText(e.target.value)}
                        className="w-full flex-1 bg-slate-50 border border-slate-300 rounded-2xl p-4 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600 focus:bg-white transition leading-relaxed shadow-inner"
                        placeholder="Type your custom WhatsApp message content here..."
                      />
                    </div>

                    {/* Save & Test Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      
                      {/* Test WhatsApp Message Control */}
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Test Mobile (10 digits)"
                            value={testMobile}
                            onChange={(e) => setTestMobile(e.target.value)}
                            className="bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600 focus:bg-white w-48 transition"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSendTestMessage}
                          disabled={sendingTestMsg}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                          title="Send a real test WhatsApp preview to this mobile number"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{sendingTestMsg ? 'Sending...' : 'Send Test Message'}</span>
                        </button>
                      </div>

                      {/* Save Button */}
                      <button
                        type="button"
                        onClick={handleSaveWaTemplate}
                        disabled={savingWaTemplate}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{savingWaTemplate ? 'Saving Changes...' : 'Save WhatsApp Message Template'}</span>
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    Select a template from the left menu to start editing.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* JHARSEWA PORTAL CREDENTIALS MASTER PAGE TAB */}
        {activeTab === 'jharsewa-creds' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden max-w-3xl mx-auto">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Jharsewa Portal Credentials Master</h3>
                  <p className="text-xs text-amber-100">Set & Update Jharsewa CSC Portal Login ID & Password for auto-sync</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('jharsewa')}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveJharsewaCreds} className="p-8 space-y-6">
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900 space-y-1">
                  <strong className="font-bold">Secure Encrypted Portal Authentication:</strong>
                  <p>In credentials ka upayog sabhi 9 dedicated engines auto status sync aur certificate download ke liye Jharsewa CSC portal par login karne ke liye karenge.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Jharsewa CSC Login Username / Email ID *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. cscgunghasa@gmail.com"
                      value={jharsewaCreds.username}
                      onChange={(e) => setJharsewaCreds({ ...jharsewaCreds, username: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Jharsewa CSC Account Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showJharsewaPass ? 'text' : 'password'}
                      required
                      placeholder="Enter Jharsewa Password"
                      value={jharsewaCreds.password}
                      onChange={(e) => setJharsewaCreds({ ...jharsewaCreds, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowJharsewaPass(!showJharsewaPass)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      {showJharsewaPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('jharsewa')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingJharsewaCreds}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingJharsewaCreds ? 'Saving Credentials...' : 'Save Jharsewa Credentials'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SHOP & BRANDING MASTER PAGE TAB */}
        {activeTab === 'shop-profile' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden max-w-3xl mx-auto">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-sky-600 via-sky-700 to-sky-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Shop & Center Branding Master</h3>
                  <p className="text-xs text-sky-100">Set Shop Name, Owner Name, Phone & Address for receipts and WhatsApp white-labeling</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('jharsewa')}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveShopProfile} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Shop / Pragya Kendra / Center Name *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pragya Kendra & Cyber Center"
                      value={shopProfile.shopName}
                      onChange={(e) => setShopProfile({ ...shopProfile, shopName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Owner / Operator Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="e.g. Rajesh Nath"
                        value={shopProfile.ownerName}
                        onChange={(e) => setShopProfile({ ...shopProfile, ownerName: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Shop Contact Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="e.g. 917781931880"
                        value={shopProfile.shopPhone}
                        onChange={(e) => setShopProfile({ ...shopProfile, shopPhone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Shop / Center Address
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. Main Road, Gunghasa, Chas, Bokaro"
                      value={shopProfile.shopAddress}
                      onChange={(e) => setShopProfile({ ...shopProfile, shopAddress: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('jharsewa')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShopProfile}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingShopProfile ? 'Saving Details...' : 'Save Shop & Branding Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* BULK UPLOAD TAB */}
        {activeTab === 'bulk-upload' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col space-y-6 p-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Upload className="w-6 h-6" /> Bulk Certificate Entry Upload
                </h3>
                <p className="text-xs text-blue-100 mt-1">
                  Paste Excel / CSV data directly (Reference No, Applicant Name, Mobile, Address) to create multiple certificate records instantly.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('jharsewa')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>

            {/* Option 1: File Upload Box */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 hover:border-blue-400 transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv, .txt, .tsv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Click to select Excel / CSV File"
              />
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">Option 1: Drag & Drop or Click to Upload Excel / CSV File</p>
                <p className="text-xs text-slate-500 mt-0.5">Supports .csv, .txt, .tsv Excel files</p>
              </div>
            </div>

            {/* Option 2: Copy-Paste Data Input Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-slate-700">
                  Option 2: Direct Copy-Paste Excel Rows or Tab/Comma Separated Data:
                </label>
                <span className="text-xs text-slate-500 font-mono">
                  Format: RefNo [Tab/Comma] Name [Tab/Comma] Mobile [Tab/Comma] Address
                </span>
              </div>
              <textarea
                rows={7}
                value={bulkInputText}
                onChange={(e) => setBulkInputText(e.target.value)}
                placeholder={`Example Excel Data:\nJHCBC/2026/1056138\tMAHADEO GOSWAMI\t9798898213\tGUNGHASA\nJHIC/2026/1095643\tBULBUL KUMARI\t8051202868\tGUNGHASA\nJHLRCO/2026/826542\tBABITA KUMARI\t8210212926\tGUNGHASA`}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setBulkInputText(''); setBulkParsedItems([]); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Clear Input
                </button>
                <button
                  type="button"
                  onClick={handleParseBulkText}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" /> Parse & Preview Entries
                </button>
              </div>
            </div>

            {/* Parsed Preview Table */}
            {bulkParsedItems.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Parsed Preview ({bulkParsedItems.length} Entries Ready)
                  </h4>
                  <button
                    type="button"
                    onClick={handleSubmitBulkUpload}
                    disabled={bulkUploading}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{bulkUploading ? 'Uploading Batch...' : `Upload All ${bulkParsedItems.length} Certificates Now`}</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Ref Number</th>
                        <th className="px-4 py-3">Applicant Name</th>
                        <th className="px-4 py-3">Mobile</th>
                        <th className="px-4 py-3">Address</th>
                        <th className="px-4 py-3">Detected Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {bulkParsedItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{item.refNo}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{item.applicantName}</td>
                          <td className="px-4 py-2.5">{item.mobile}</td>
                          <td className="px-4 py-2.5">{item.address}</td>
                          <td className="px-4 py-2.5 font-medium text-blue-700 bg-blue-50/50 rounded-lg">{item.certType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLIENT LIST MASTER PAGE TAB */}
        {activeTab === 'client-master' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden w-full space-y-6 p-6">
            <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 p-6 rounded-2xl text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Client List Master</h3>
                  <p className="text-xs text-teal-100">View & manage all registered client software instances, Hardware IDs (HWID), active plans, and expiry dates.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={openAddClientModal}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Add Client Manually
                </button>
                <button
                  onClick={fetchClients}
                  disabled={loadingClients}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingClients ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button
                  onClick={() => setActiveTab('jharsewa')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {/* Active vs Deleted History Toggle Sub-Bar */}
            <div className="flex items-center justify-between bg-slate-100 p-2 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setClientViewMode('ACTIVE');
                    fetchClients('ACTIVE');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                    clientViewMode === 'ACTIVE'
                      ? 'bg-teal-700 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Active Clients List</span>
                </button>
                <button
                  onClick={() => {
                    setClientViewMode('ARCHIVED');
                    fetchClients('ARCHIVED');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                    clientViewMode === 'ARCHIVED'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Deleted History Archive (Preserved Keys)</span>
                </button>
              </div>
              <div className="text-xs text-slate-500 font-medium px-2">
                {clientViewMode === 'ACTIVE' ? 'Showing active registered clients' : '📦 Displaying archived client history with preserved License Keys & HWID'}
              </div>
            </div>

            {/* Client List Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/90 text-slate-700 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap">#</th>
                      <th className="px-4 py-3.5 whitespace-nowrap min-w-[200px]">Shop Name</th>
                      <th className="px-4 py-3.5 whitespace-nowrap min-w-[160px]">Owner / Contact Person</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Mobile Contact</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Hardware ID (HWID)</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">License Serial Key</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Active Plan</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">{clientViewMode === 'ARCHIVED' ? 'Archived On' : 'Expiry Date'}</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">License Status</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {clientList.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-5 py-10 text-center text-slate-500 font-medium">
                          {clientViewMode === 'ACTIVE'
                            ? 'No active client records found in Master Database. Click "Add Client Manually" to create one!'
                            : 'No archived / deleted client records found in history vault.'}
                        </td>
                      </tr>
                    ) : (
                      clientList.map((cl, idx) => (
                        <tr key={cl.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-4 font-bold text-slate-400 whitespace-nowrap">{idx + 1}</td>
                          <td className="px-4 py-4 font-bold text-slate-900 text-sm whitespace-nowrap">
                            {cl.clientName || 'Commercial Client'}
                            {cl.isArchived && (
                              <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-300">
                                Archived
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 font-semibold text-slate-800 text-xs whitespace-nowrap">
                            {cl.ownerName || 'N/A'}
                          </td>
                          <td className="px-4 py-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                            {cl.phone || 'N/A'}
                          </td>
                          <td className="px-4 py-4 font-mono font-bold text-sky-700 select-all whitespace-nowrap" title={cl.hwid}>
                            {cl.hwid}
                          </td>
                          <td className="px-4 py-4 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50/70 border border-emerald-200 rounded-lg select-all whitespace-nowrap" title={cl.licenseKey}>
                            {cl.licenseKey || 'N/A'}
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                              {cl.planType}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-medium text-slate-600 whitespace-nowrap">
                            {clientViewMode === 'ARCHIVED'
                              ? (cl.archivedAt ? new Date(cl.archivedAt).toLocaleDateString('en-GB') : 'N/A')
                              : (cl.expiresAt ? new Date(cl.expiresAt).toLocaleDateString('en-GB') : 'N/A')}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {cl.clientName && cl.clientName.includes('Master Admin') ? (
                                <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  🟢 ACTIVE (LOCKED)
                                </span>
                              ) : (
                                <>
                                  <select
                                    value={cl.status}
                                    onChange={(e) => handleUpdateStatusDirect(cl.hwid, e.target.value)}
                                    className={`px-2.5 py-1 rounded-full font-bold text-[11px] cursor-pointer outline-none border transition ${
                                      cl.status === 'ACTIVE'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : cl.status === 'EXPIRED'
                                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                                        : 'bg-rose-100 text-rose-800 border-rose-300'
                                    }`}
                                  >
                                    <option value="ACTIVE" className="bg-white text-emerald-800 font-bold">🟢 ACTIVE</option>
                                    <option value="EXPIRED" className="bg-white text-amber-800 font-bold">🟡 EXPIRED</option>
                                    <option value="KILLED" className="bg-white text-rose-800 font-bold">🔴 KILLED</option>
                                  </select>

                                  {/* Quick Renew Button if EXPIRED */}
                                  {cl.status === 'EXPIRED' && !cl.isArchived && (
                                    <button
                                      onClick={() => {
                                        setRenewingClient(cl);
                                        setRenewPlan(cl.planType || 'YEARLY');
                                        setShowRenewModal(true);
                                      }}
                                      title="Renew Client Subscription & Auto Activate"
                                      className="px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs transition cursor-pointer flex items-center gap-1 active:scale-95 animate-pulse"
                                    >
                                      <Key className="w-3 h-3 text-white" /> Renew
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => { setSelectedClientDetails(cl); setShowClientDetailsModal(true); }}
                                title="View Details"
                                className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Restore from Archive Button */}
                              {cl.isArchived && (
                                <button
                                  onClick={() => handleRestoreClient(cl.id, cl.clientName)}
                                  title="Restore Client to Active List"
                                  className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" /> Restore
                                </button>
                              )}

                              {/* Download Backup Vault Excel */}
                              <button
                                onClick={() => {
                                  window.open(`${API_BASE}/license/client-backup/export-csv/${encodeURIComponent(cl.hwid)}`, '_blank');
                                  showToastNotification('success', 'Backup Export Triggered', `Downloading Certificate & PAN Backup Vault for ${cl.clientName || cl.hwid}...`);
                                }}
                                title="Download Backup Excel / CSV Vault"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                              >
                                <Download className="w-4 h-4" />
                                <span>Vault</span>
                              </button>

                              {/* Restore Backup Data to Client */}
                              {!cl.isArchived && (
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`⚠️ Restoring backup will push all backed up records into Client Software (${cl.clientName || cl.hwid}). Proceed?`)) {
                                      try {
                                        const res = await axios.post(`${API_BASE}/license/client-backup/push-restore/${encodeURIComponent(cl.hwid)}`);
                                        if (res.data.success) {
                                          showToastNotification('success', 'Backup Restored!', res.data.message);
                                        }
                                      } catch (err) {
                                        showToastNotification('error', 'Restore Failed', err.response?.data?.error || err.message);
                                      }
                                    }
                                  }}
                                  title="Restore Backup Data into Client Software"
                                  className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                                >
                                  <RefreshCw className="w-4 h-4 text-indigo-600" />
                                  <span>Restore</span>
                                </button>
                              )}

                              {/* Edit */}
                              {!cl.isArchived && (
                                <button
                                  onClick={() => openEditClientModal(cl)}
                                  title="Edit Client"
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete / Archive / Permanent Delete */}
                              {cl.clientName && cl.clientName.includes('Master Admin') ? (
                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 font-bold text-[10px] border border-slate-200" title="Protected Master Admin Record">
                                  🔒 LOCKED
                                </span>
                              ) : cl.isArchived ? (
                                <button
                                  onClick={() => handlePermanentDeleteClient(cl.id, cl.clientName)}
                                  title="Permanently Delete Client Record"
                                  className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDeleteClient(cl.id, cl.clientName)}
                                  title="Move to Deleted History Archive"
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBSCRIPTION PLAN MASTER PAGE TAB */}
        {activeTab === 'plan-master' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden w-full space-y-6 p-6">
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 p-6 rounded-2xl text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Subscription Plan Master</h3>
                  <p className="text-xs text-amber-100">Create & manage client subscription packages, pricing, per-day cost, badges, and feature checklists.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={openAddPlanModal}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Create New Plan
                </button>
                <button
                  onClick={fetchPlans}
                  disabled={loadingPlans}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPlans ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button
                  onClick={() => setActiveTab('jharsewa')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {/* Plan Master Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/90 text-slate-700 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap">Type / Code</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Plan Title & Subtitle</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Badge Text</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Price (₹)</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Duration (Days)</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Per Day Cost</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Active Status</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {plans.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-5 py-10 text-center text-slate-500 font-medium">
                          No subscription plans found. Click "Create New Plan" to add one!
                        </td>
                      </tr>
                    ) : (
                      plans.map((p) => {
                        let parsedFeats = p.features;
                        if (typeof parsedFeats === 'string') {
                          try { parsedFeats = JSON.parse(parsedFeats); } catch(e){ parsedFeats = []; }
                        }
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                                {p.planKey}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-bold text-slate-900 text-sm whitespace-nowrap flex items-center gap-1.5">
                                {(() => {
                                  const match = p.title.match(/^(.*?)\s*(\(.*\))$/);
                                  return match ? (
                                    <span>
                                      <span>{match[1]}</span>
                                      <span className="text-xs text-slate-500 font-semibold block">{match[2]}</span>
                                    </span>
                                  ) : p.title;
                                })()}
                                {p.isPopular && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold border border-purple-200">Popular</span>}
                                {p.isBestValue && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-200">Best Value</span>}
                              </div>
                              <div className="text-slate-500 text-xs truncate max-w-xs">{p.subtitle}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {p.badgeText ? (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                                  {p.badgeText}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-4 font-extrabold text-slate-900 text-sm whitespace-nowrap">
                              ₹{p.price}
                            </td>
                            <td className="px-4 py-4 font-bold text-slate-700 whitespace-nowrap">
                              {p.durationDays} Days
                            </td>
                            <td className="px-4 py-4 font-mono font-bold text-emerald-700 whitespace-nowrap">
                              ₹{p.perDayCost?.toFixed(2)} / day
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                                p.isActive !== false
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {p.isActive !== false ? '🟢 Active' : '🔴 Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    let parsedFeats = p.features;
                                    if (typeof parsedFeats === 'string') {
                                      try { parsedFeats = JSON.parse(parsedFeats); } catch(e){ parsedFeats = []; }
                                    }
                                    const featListStr = Array.isArray(parsedFeats)
                                      ? parsedFeats.map(f => `${f.included ? '✅' : '❌'} ${f.name}`).join('\n')
                                      : '';
                                    showToastNotification(
                                      'info',
                                      `👑 Plan Details: ${p.title}`,
                                      `Code/Key: ${p.planKey}\nPrice: ₹${p.price} | Validity: ${p.durationDays} Days\nPer Day Cost: ₹${p.perDayCost?.toFixed(2)}/day\n\nFeatures Checklist:\n${featListStr}`
                                    );
                                  }}
                                  className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition cursor-pointer"
                                  title="View Plan Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openEditPlanModal(p)}
                                  className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                                  title="Edit Plan"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePlan(p.id, p.title)}
                                  className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                                  title="Delete Plan"
                                >
                                  <Trash2 className="w-4 h-4" />
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

        {/* PAYMENT & ACTIVATION REQUESTS TAB */}
        {activeTab === 'payment-requests' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden w-full space-y-6 p-6">
            <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 p-6 rounded-2xl text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Payment & License Activation Requests</h3>
                  <p className="text-xs text-emerald-100">Review client payment submissions, shop details, HWID, and approve one-click license key activations.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchPaymentRequests}
                  disabled={loadingPaymentRequests}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPaymentRequests ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button
                  onClick={() => setActiveTab('jharsewa')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {/* Requests Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/90 text-slate-700 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap">#</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Request Date</th>
                      <th className="px-4 py-3.5 whitespace-nowrap min-w-[180px]">Shop Name</th>
                      <th className="px-4 py-3.5 whitespace-nowrap min-w-[150px]">Owner Name</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">WhatsApp Mobile</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Selected Plan</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Amount</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Hardware ID (HWID)</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {paymentRequests.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-5 py-10 text-center text-slate-500 font-medium">
                          No client payment or activation requests logged yet.
                        </td>
                      </tr>
                    ) : (
                      paymentRequests.map((req, idx) => (
                        <tr key={req.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-4 font-bold text-slate-400 whitespace-nowrap">{idx + 1}</td>
                          <td className="px-4 py-4 text-slate-600 font-medium whitespace-nowrap">
                            {new Date(req.createdAt).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-4 font-bold text-slate-900 text-sm whitespace-nowrap">
                            {req.shopName || 'Commercial Client'}
                          </td>
                          <td className="px-4 py-4 font-semibold text-slate-800 text-xs whitespace-nowrap">
                            {req.ownerName || 'N/A'}
                          </td>
                          <td className="px-4 py-4 font-mono font-bold text-emerald-700 whitespace-nowrap">
                            <a href={`https://wa.me/91${req.phone}`} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> {req.phone}
                            </a>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-xs">
                              {(() => {
                                const name = req.planName || '';
                                const matchDays = name.match(/(\d+)\s*Days/i);
                                if (matchDays) return `${matchDays[1]} Days`;
                                if (name.toLowerCase().includes('half')) return '180 Days';
                                if (name.toLowerCase().includes('year')) return '365 Days';
                                return '30 Days';
                              })()}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-extrabold text-emerald-700 font-mono text-sm whitespace-nowrap">
                            ₹{req.planPrice}
                          </td>
                          <td className="px-4 py-4 font-mono font-bold text-sky-700 select-all whitespace-nowrap" title={req.hwid}>
                            {req.hwid}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                              req.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            }`}>
                              {req.status === 'APPROVED' ? '✅ APPROVED' : '🟡 PENDING'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {req.status === 'PENDING' ? (
                                <button
                                  onClick={() => handleApprovePaymentRequest(req.id, req.shopName)}
                                  disabled={approvingRequestId === req.id}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1 disabled:opacity-50 active:scale-95"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{approvingRequestId === req.id ? 'Approving...' : 'Approve & Activate'}</span>
                                </button>
                              ) : (
                                <span className="font-mono text-[11px] text-slate-500 font-bold select-all bg-slate-100 px-2 py-1 rounded border border-slate-200" title={req.generatedKey}>
                                  Key: {req.generatedKey || 'Assigned'}
                                </span>
                              )}
                              <button
                                onClick={() => handleDeletePaymentRequest(req.id, req.shopName)}
                                title="Delete Payment Request"
                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer active:scale-95 flex items-center justify-center"
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
          </div>
        )}

        {/* MASTER ADMIN CONTROL PANEL TAB */}
        {activeTab === 'master-control' && isMasterAdmin && (
          <div className="space-y-6 w-full">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl flex justify-between items-center border border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                    Master Admin Licensing & Client Hub
                  </h2>
                  <p className="text-xs text-slate-300">Generate Key, Manage HWID Hardware Binding, Revoke/Kill Client Licenses, and Monitor System Heartbeats.</p>
                </div>
              </div>

              <button
                onClick={() => setIsMasterAdmin(false)}
                className="px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Exit Master Admin
              </button>
            </div>

            {/* 1-CLICK LICENSE KEY GENERATOR TOOL */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <KeyRound className="w-5 h-5 text-indigo-600" /> 1-Click License Key Generator Tool
              </h3>

              <form onSubmit={handleGenerateKeySubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Client Hardware ID (HWID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Paste Client HWID..."
                    value={genHwid}
                    onChange={(e) => setGenHwid(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Select Plan Duration</label>
                  <select
                    value={genPlan}
                    onChange={(e) => setGenPlan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="MONTHLY">Monthly (30 Days)</option>
                    <option value="HALF_YEARLY">Half Yearly (180 Days)</option>
                    <option value="YEARLY">Yearly (365 Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Client Shop / Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Pragya Kendra"
                    value={genClientName}
                    onChange={(e) => setGenClientName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingKey}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>{generatingKey ? 'Generating...' : 'Generate Key Now'}</span>
                </button>
              </form>

              {/* GENERATED KEY OUTPUT BOX */}
              {generatedKeyResult && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center justify-between animate-in zoom-in-95 duration-150 mt-2">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Generated License Key:</span>
                    <p className="font-mono font-extrabold text-lg text-emerald-950 tracking-wider select-all">{generatedKeyResult}</p>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKeyResult);
                      showToastNotification('success', 'Copied!', 'License key copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" /> Copy Key
                  </button>
                </div>
              )}
            </div>

            {/* CLIENT MANAGEMENT TABLE */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm space-y-4 p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-sky-600" /> Active Clients & Machine Records
                  </h3>
                  <p className="text-xs text-slate-500">Live hardware ID status, Remote Kill-Switch, and Plan controls.</p>
                </div>
                <button
                  onClick={fetchClients}
                  disabled={loadingClients}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingClients ? 'animate-spin' : ''}`} /> Refresh Clients
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Generated Date</th>
                      <th className="px-4 py-3">Shop / Center Name</th>
                      <th className="px-4 py-3">Owner Name</th>
                      <th className="px-4 py-3">Contact Phone</th>
                      <th className="px-4 py-3">Hardware ID (HWID)</th>
                      <th className="px-4 py-3">Generated License Key</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Remote Kill Switch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {clientList.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-4 py-8 text-center text-slate-500">
                          No client records generated yet. Use the Generator tool above to generate your first Client Key!
                        </td>
                      </tr>
                    ) : (
                      clientList.map((cl) => (
                        <tr key={cl.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3.5 font-medium text-slate-600">
                            {cl.keyGeneratedAt ? new Date(cl.keyGeneratedAt).toLocaleDateString('en-GB') : cl.createdAt ? new Date(cl.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {cl.clientName || 'Unknown Shop'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">
                            {cl.ownerName || 'N/A'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">
                            {cl.phone || 'N/A'}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-semibold text-slate-600 select-all">
                            {cl.hwid}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-indigo-900 bg-indigo-50/70 rounded-lg px-2 py-1 select-all">
                            {cl.licenseKey}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-indigo-700">
                            {cl.planType}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-600">
                            {cl.expiresAt ? new Date(cl.expiresAt).toLocaleDateString('en-GB') : 'N/A'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                              cl.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {cl.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {cl.clientName && cl.clientName.includes('Master Admin') ? (
                              <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 text-slate-400 border border-slate-200">
                                🔒 PERMANENT ACTIVE
                              </span>
                            ) : (
                              <button
                                onClick={() => handleToggleClientStatus(cl.hwid, cl.status)}
                                className={`px-3 py-1.5 rounded-xl font-bold transition text-xs shadow-2xs cursor-pointer ${
                                  cl.status === 'ACTIVE'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                {cl.status === 'ACTIVE' ? '🚫 Kill / Revoke' : '✅ Reactivate License'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FULL SCREEN SOFTWARE LICENSE ACTIVATION OVERLAY (WHEN LICENSE INACTIVE / EXPIRED / KILLED) */}
      {!checkingLicense && !licenseStatus.active && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Software License Activation Required</h2>
                <p className="text-xs text-slate-300">Commercial Hardware Locked Protection System</p>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 text-slate-800">
              {paymentRequests.some(r => r.status === 'PENDING') ? (
                <div className="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-2xl text-xs text-emerald-950 space-y-3 shadow-md animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                    <Clock className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span>🎉 Payment Submitted Successfully!</span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed font-semibold">
                    Thanks for choosing our service. Your software activation process is on the way. Please be patient and make sure you have paid your subscription fee. Thanks.
                  </p>
                  <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between text-[11px] font-bold text-emerald-900">
                    <span>For help please contact:</span>
                    <a href="https://wa.me/917781931880" target="_blank" rel="noreferrer" className="text-emerald-700 font-mono underline hover:text-emerald-900">
                      7781931880
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 space-y-1">
                  <strong className="font-bold">System Notice:</strong>
                  <p>{licenseStatus.reason || 'This machine is not activated with a valid Commercial License Key.'}</p>
                </div>
              )}

              {/* MACHINE HWID DISPLAY & COPY */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Your Machine Hardware ID (HWID):</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-sm text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-300 flex-1 truncate select-all">
                    {licenseStatus.hwid || 'EXTRACTING...'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(licenseStatus.hwid);
                      setCopiedHwid(true);
                      setTimeout(() => setCopiedHwid(false), 2000);
                    }}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedHwid ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedHwid ? 'Copied!' : 'Copy HWID'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Provide this HWID to software admin to get your License Key.</p>
              </div>

              {/* ACTIVATION KEY FORM */}
              <form onSubmit={handleActivateLicense} className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Enter License Key *</label>
                <input
                  type="text"
                  required
                  placeholder="Paste your 24-character License Key here..."
                  value={inputLicenseKey}
                  onChange={(e) => setInputLicenseKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                />

                <button
                  type="submit"
                  disabled={activatingKey}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{activatingKey ? 'Validating Key...' : 'Activate Software License'}</span>
                </button>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* MASTER ADMIN EMERGENCY AUTH MODAL */}
      {showMasterAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Master Admin Login</h3>
                  <p className="text-xs text-slate-300">Bypass Hardware Lock via Saved Email / Google</p>
                </div>
              </div>
              <button onClick={() => setShowMasterAuthModal(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <div className="p-8 space-y-6 text-slate-800 text-center">
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                Security Policy Enforced: Only authorized Google Account (<span className="font-bold text-indigo-700">gattu.elfsolvers@gmail.com</span>) can unlock this Master Dashboard.
              </p>

              {/* OFFICIAL GOOGLE OAUTH LOGIN BUTTON ONLY */}
              <div className="flex justify-center w-full my-4">
                <GoogleLogin
                  onSuccess={handleGoogleOAuthSuccess}
                  onError={() => {
                    showToastNotification('error', 'Google Login Failed', 'Google authentication prompt was cancelled or closed.');
                  }}
                  useOneTap
                  theme="filled_blue"
                  shape="pill"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowMasterAuthModal(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW CERTIFICATE (WITH MULTI-CERTIFICATE QUEUE!) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">New Certificate Entry</h3>
                <p className="text-xs text-slate-500">Fill applicant details and add one or multiple certificates in a single click.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6 text-sm max-h-[80vh] overflow-y-auto">
              {/* APPLICANT COMMON INFORMATION */}
              <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-xl space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500">1. Applicant Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Applicant Name *</label>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={applicantInfo.applicantName}
                      onChange={(e) => setApplicantInfo({ ...applicantInfo, applicantName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number (WhatsApp) *</label>
                    <input
                      type="text"
                      placeholder="10-digit Mobile No"
                      value={applicantInfo.mobile}
                      onChange={(e) => setApplicantInfo({ ...applicantInfo, mobile: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                    <input
                      type="text"
                      placeholder="Village / Town, Post Office..."
                      value={applicantInfo.address}
                      onChange={(e) => setApplicantInfo({ ...applicantInfo, address: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Application Submission Date *</label>
                    <input
                      type="date"
                      value={applicantInfo.entryDate}
                      onChange={(e) => setApplicantInfo({ ...applicantInfo, entryDate: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* SINGLE INPUT FORM FOR ADDING CERTIFICATE TO QUEUE */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-4 shadow-sm">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  2. Certificate Details
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Select Certificate & Sub Category {certItems.length === 0 ? '*' : <span className="text-slate-400 font-normal">(Optional if list has items)</span>}
                    </label>
                    <select
                      value={currentCertInput.masterId}
                      onChange={(e) => handleCurrentMasterChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none text-xs font-medium"
                    >
                      {masters.map(m => {
                        const label = m.subCategory ? `${m.name} (${m.subCategory})` : m.name;
                        return (
                          <option key={m.id} value={m.id}>
                            {label} - ₹{m.price}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Reference Number {certItems.length === 0 ? '*' : <span className="text-slate-400 font-normal">(Optional if list has items)</span>}
                    </label>
                    <div className="flex rounded-xl border border-slate-300 overflow-hidden bg-slate-50 focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20">
                      {currentCertInput.refPrefix ? (
                        <span className="bg-slate-200/80 text-slate-800 px-3 py-2 text-xs font-mono font-bold border-r border-slate-300 select-none flex items-center shrink-0">
                          {currentCertInput.refPrefix}
                        </span>
                      ) : null}
                      <input
                        type="text"
                        placeholder={currentCertInput.refPrefix ? "e.g. 123456" : "e.g. 990079715176193"}
                        value={currentCertInput.refSuffix}
                        onChange={(e) => setCurrentCertInput({ ...currentCertInput, refSuffix: e.target.value.replace(/\s+/g, '') })}
                        className="w-full bg-transparent px-3 py-2 text-slate-900 font-mono font-bold text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* CURRENT ITEM PAYMENT BREAKDOWN BOX */}
                <div className="grid grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-end">
                  <div className="flex flex-col">
                    <label className="h-7 flex items-end justify-center text-center text-[10px] font-semibold text-slate-600 mb-1 leading-tight">
                      Base Price
                    </label>
                    <div className="h-9 w-full bg-slate-200/80 border border-slate-300 rounded-xl text-slate-800 font-extrabold text-xs flex items-center justify-center">
                      ₹{currentCertInput.basePrice}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="h-7 flex items-end justify-center text-center text-[10px] font-semibold text-slate-600 mb-1 leading-tight">
                      Add. Fee (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={currentCertInput.additionalCharge}
                      onChange={(e) => handleCurrentAddFeeChange(e.target.value)}
                      className="h-9 w-full bg-white border border-slate-300 rounded-xl px-2 text-slate-900 font-extrabold text-xs text-center focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="h-7 flex items-end justify-center text-center text-[10px] font-semibold text-slate-600 mb-1 leading-tight">
                      Total Fee (₹)
                    </label>
                    <div className="h-9 w-full bg-sky-50 border border-sky-300 rounded-xl text-sky-800 font-extrabold text-xs flex items-center justify-center">
                      ₹{(parseFloat(currentCertInput.basePrice) || 0) + (parseFloat(currentCertInput.additionalCharge) || 0)}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="h-7 flex items-end justify-center text-center text-[10px] font-semibold text-slate-600 mb-1 leading-tight">
                      Paid Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={currentCertInput.paidAmount}
                      onChange={(e) => setCurrentCertInput({ ...currentCertInput, paidAmount: e.target.value })}
                      className="h-9 w-full bg-white border border-slate-300 rounded-xl px-2 text-slate-900 font-extrabold text-xs text-center focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="h-7 flex items-end justify-center text-center text-[10px] font-semibold text-slate-600 mb-1 leading-tight">
                      Dues (₹)
                    </label>
                    {(() => {
                      const curTotal = (parseFloat(currentCertInput.basePrice) || 0) + (parseFloat(currentCertInput.additionalCharge) || 0);
                      const curPaid = parseFloat(currentCertInput.paidAmount) || 0;
                      const curDues = Math.max(0, curTotal - curPaid);
                      return (
                        <div className={`h-9 w-full border rounded-xl font-extrabold text-xs flex items-center justify-center ${
                          curDues > 0 ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        }`}>
                          ₹{curDues}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ADD TO LIST BUTTON */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddToList}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Add Certificate to List</span>
                  </button>
                </div>
              </div>

              {/* OVERALL ORDER SUMMARY FOOTER BAR */}
              {(() => {
                const grandTotalFees = certItems.reduce((acc, item) => acc + ((parseFloat(item.basePrice) || 0) + (parseFloat(item.additionalCharge) || 0)), 0);
                const grandTotalPaid = certItems.reduce((acc, item) => acc + (parseFloat(item.paidAmount) || 0), 0);
                const grandTotalDues = Math.max(0, grandTotalFees - grandTotalPaid);

                return (
                  <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-slate-300">Overall Order Summary ({certItems.length} Certificates)</div>
                      <div className="text-[11px] text-slate-400">Total: ₹{grandTotalFees} | Paid: ₹{grandTotalPaid}</div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-medium">Grand Dues: </span>
                      <span className={`text-base font-extrabold ${grandTotalDues > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        ₹{grandTotalDues}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* QUEUED CERTIFICATES LIST BELOW OVERALL ORDER SUMMARY */}
              {certItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-700 flex items-center justify-between">
                    <span>3. Added Certificates List ({certItems.length})</span>
                    <span className="text-[11px] text-slate-500 font-normal lowercase">(ready for final save)</span>
                  </h4>
                  <div className="space-y-2">
                    {certItems.map((item, index) => {
                      const itemTotal = (parseFloat(item.basePrice) || 0) + (parseFloat(item.additionalCharge) || 0);
                      const itemPaid = parseFloat(item.paidAmount) || 0;
                      const itemDues = Math.max(0, itemTotal - itemPaid);

                      return (
                        <div key={item.id || index} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded text-[11px]">#{index + 1}</span>
                              <span className="font-bold text-slate-900">{item.certType}</span>
                              <span className="font-mono text-slate-600 bg-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold">{item.refPrefix}{item.refSuffix}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Base: ₹{item.basePrice} | Add Fee: ₹{item.additionalCharge} | Total: ₹{itemTotal} | Paid: ₹{itemPaid} | <span className={itemDues > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>Dues: ₹{itemDues}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeCertItemFromQueue(index)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition"
                            title="Remove Certificate from List"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm flex items-center gap-2 text-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Save All Certificates & Auto WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT MASTER CATEGORY */}
      {showMasterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                {editingMaster ? 'Edit Master Category' : 'Add New Master Category'}
              </h3>
              <button onClick={() => setShowMasterModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleMasterSubmit} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Certificate Type Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Caste Certificate"
                  value={masterFormData.name}
                  onChange={(e) => setMasterFormData({ ...masterFormData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sub Category Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JHCBC, JHNBC, JHCSC, JHCST"
                    value={masterFormData.subCategory}
                    onChange={(e) => setMasterFormData({ ...masterFormData, subCategory: e.target.value.toUpperCase(), prefix: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ref No Prefix *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JHCBC"
                    value={masterFormData.prefix}
                    onChange={(e) => setMasterFormData({ ...masterFormData, prefix: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Default Price / Fee (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 150"
                  value={masterFormData.price}
                  onChange={(e) => setMasterFormData({ ...masterFormData, price: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMasterModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
                >
                  {editingMaster ? 'Update Master' : 'Save Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CERTIFICATE */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-xl">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Edit Certificate Record</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={editFormData.refNo}
                    onChange={(e) => setEditFormData({ ...editFormData, refNo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Current Status</label>
                  <select
                    value={editFormData.currentStatus}
                    onChange={(e) => setEditFormData({ ...editFormData, currentStatus: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium"
                  >
                    <option value="INITIATED">Initiated</option>
                    <option value="CI_UNDER_PROCESS">CI / Circle Inspector - Under Process</option>
                    <option value="CI_WAITING">Circle Inspector - Waiting for Applicant Response</option>
                    <option value="CO_UNDER_PROCESS">Circle Officer - Under Process</option>
                    <option value="CO_WAITING">Circle Officer - Waiting for Applicant Response</option>
                    <option value="CO_DELIVERED">Circle Officer - Delivered</option>
                    <option value="SDO_UNDER_PROCESS">SDO - Under Process</option>
                    <option value="SDO_DELIVERED">SDO - Delivered</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Applicant Name</label>
                  <input
                    type="text"
                    value={editFormData.applicantName}
                    onChange={(e) => setEditFormData({ ...editFormData, applicantName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile</label>
                  <input
                    type="text"
                    value={editFormData.mobile}
                    onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Application Submission Date (Entry Date)</label>
                <input
                  type="date"
                  value={editFormData.entryDate || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, entryDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Total Fee (₹)</label>
                  <input
                    type="number"
                    value={editFormData.totalFee}
                    onChange={(e) => setEditFormData({ ...editFormData, totalFee: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Paid Amount (₹)</label>
                  <input
                    type="number"
                    value={editFormData.paidAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, paidAmount: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                >
                  Update Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CLIENT MANUALLY */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-300" />
                <h3 className="font-bold text-base">{editingClient ? 'Edit Client Details' : 'Add New Client Manually'}</h3>
              </div>
              <button
                onClick={() => setShowClientModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClientSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Client Shop / Center Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apna Digital Hub"
                    value={clientFormData.clientName}
                    onChange={(e) => setClientFormData({ ...clientFormData, clientName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Owner / Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gattu Ji"
                    value={clientFormData.ownerName}
                    onChange={(e) => setClientFormData({ ...clientFormData, ownerName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Contact Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 7781931880"
                    value={clientFormData.phone}
                    onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Plan Type *
                  </label>
                  <select
                    value={clientFormData.planType}
                    onChange={(e) => {
                      const newPlan = e.target.value;
                      let newExpDate = new Date();
                      if (newPlan === 'HALF_YEARLY') {
                        newExpDate.setDate(newExpDate.getDate() + 180);
                      } else if (newPlan === 'YEARLY') {
                        newExpDate.setDate(newExpDate.getDate() + 365);
                      } else {
                        newExpDate.setDate(newExpDate.getDate() + 30);
                      }
                      setClientFormData({
                        ...clientFormData,
                        planType: newPlan,
                        expiresAt: newExpDate.toISOString().split('T')[0]
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  >
                    <option value="MONTHLY">MONTHLY (30 Days)</option>
                    <option value="HALF_YEARLY">HALF YEARLY (180 Days)</option>
                    <option value="YEARLY">YEARLY (365 Days)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hardware ID (HWID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste or Enter Client HWID"
                  value={clientFormData.hwid}
                  onChange={(e) => setClientFormData({ ...clientFormData, hwid: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-sky-700 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    License Status
                  </label>
                  <select
                    value={clientFormData.status}
                    onChange={(e) => setClientFormData({ ...clientFormData, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  >
                    <option value="ACTIVE">🟢 ACTIVE</option>
                    <option value="EXPIRED">🟡 EXPIRED</option>
                    <option value="KILLED">🔴 KILLED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={clientFormData.expiresAt}
                    onChange={(e) => setClientFormData({ ...clientFormData, expiresAt: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClient}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingClient ? 'Saving...' : editingClient ? 'Update Client' : 'Add Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW CLIENT DETAILS */}
      {showClientDetailsModal && selectedClientDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-sky-700 to-indigo-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-sky-300" />
                <h3 className="font-bold text-base">Client Software License Profile</h3>
              </div>
              <button
                onClick={() => setShowClientDetailsModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-800">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">Shop Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedClientDetails.clientName || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">Owner Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedClientDetails.ownerName || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500">Contact Number:</span>
                  <span className="font-mono text-slate-800 font-semibold">{selectedClientDetails.phone || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500">Plan Type:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                    {selectedClientDetails.planType}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500">License Status:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                    selectedClientDetails.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : selectedClientDetails.status === 'EXPIRED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {selectedClientDetails.status}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500">Expiry Date:</span>
                  <span className="font-medium text-slate-900">
                    {selectedClientDetails.expiresAt ? new Date(selectedClientDetails.expiresAt).toLocaleDateString('en-GB') : 'Lifetime / Unset'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase tracking-wider block">Bound Hardware ID (HWID):</span>
                  <div className="bg-white border border-slate-300 rounded-xl p-2.5 font-mono text-[11px] font-bold text-sky-700 break-all select-all">
                    {selectedClientDetails.hwid}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wider block">Software License Key:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedClientDetails.licenseKey || '');
                        showToastNotification('success', 'Copied!', 'License key copied to clipboard!');
                      }}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy Key
                    </button>
                  </div>
                  <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-2.5 font-mono text-[11px] font-extrabold text-indigo-950 break-all select-all shadow-inner">
                    {selectedClientDetails.licenseKey || 'N/A (Generate key first)'}
                  </div>
                </div>

                {selectedClientDetails.createdAt && (
                  <div className="flex justify-between items-center pt-2 text-[10px] text-slate-400">
                    <span>Registered On:</span>
                    <span>{new Date(selectedClientDetails.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowClientDetailsModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SUBSCRIPTION PLAN */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">{editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}</h3>
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePlanSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Plan Code / Key *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MONTHLY, YEARLY"
                    value={planFormData.planKey}
                    onChange={(e) => setPlanFormData({ ...planFormData, planKey: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Badge Text (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Starter Plan, Popular"
                    value={planFormData.badgeText}
                    onChange={(e) => setPlanFormData({ ...planFormData, badgeText: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Plan Display Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Monthly Plan"
                    value={planFormData.title}
                    onChange={(e) => setPlanFormData({ ...planFormData, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Subtitle / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. 30 Days Full Access"
                    value={planFormData.subtitle}
                    onChange={(e) => setPlanFormData({ ...planFormData, subtitle: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="149"
                    value={planFormData.price}
                    onChange={(e) => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Validity (Duration Days) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="30"
                    value={planFormData.durationDays}
                    onChange={(e) => setPlanFormData({ ...planFormData, durationDays: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              {/* PER DAY CALCULATION DISPLAY */}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                <span className="font-bold text-emerald-900">Auto Per Day Cost Calculation:</span>
                <span className="font-mono font-extrabold text-sm text-emerald-700">
                  ₹{(planFormData.durationDays > 0 ? planFormData.price / planFormData.durationDays : 0).toFixed(2)} / Day
                </span>
              </div>

              {/* HIGHLIGHT FLAGS */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={planFormData.isActive}
                    onChange={(e) => setPlanFormData({ ...planFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span>Active Plan</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-700">
                  <input
                    type="checkbox"
                    checked={planFormData.isPopular}
                    onChange={(e) => setPlanFormData({ ...planFormData, isPopular: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>Mark Most Popular</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-700">
                  <input
                    type="checkbox"
                    checked={planFormData.isBestValue}
                    onChange={(e) => setPlanFormData({ ...planFormData, isBestValue: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span>Mark Best Value</span>
                </label>
              </div>

              {/* FEATURES CHECKLIST */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block font-bold text-slate-800 uppercase tracking-wider">Features & Permissions Checklist:</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {planFormData.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-800">{feat.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...planFormData.features];
                          updated[idx].included = !updated[idx].included;
                          setPlanFormData({ ...planFormData, features: updated });
                        }}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                          feat.included
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {feat.included ? '✅ Enabled (Yes)' : '❌ Disabled (No)'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingPlan ? 'Saving Plan...' : 'Save Subscription Plan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RENEW CLIENT LICENSE CONFIRMATION & PLAN SELECTOR */}
      {showRenewModal && renewingClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-amber-200 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">Renew Client Subscription</h3>
              </div>
              <button
                onClick={() => setShowRenewModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <form onSubmit={handleRenewClientSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-amber-950 uppercase tracking-wider">Confirm Client Details</p>
                <div className="flex justify-between text-slate-800">
                  <span className="font-semibold text-slate-500">Shop Name:</span>
                  <span className="font-bold text-slate-900">{renewingClient.clientName || 'N/A'}</span>
                </div>
                {renewingClient.ownerName && (
                  <div className="flex justify-between text-slate-800">
                    <span className="font-semibold text-slate-500">Owner Name:</span>
                    <span className="font-bold text-slate-900">{renewingClient.ownerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-800">
                  <span className="font-semibold text-slate-500">Hardware ID:</span>
                  <span className="font-mono font-bold text-sky-700">{renewingClient.hwid}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Select Renewal Subscription Plan *
                </label>
                <select
                  value={renewPlan}
                  onChange={(e) => setRenewPlan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-600 focus:bg-white transition cursor-pointer"
                >
                  <option value="MONTHLY">Monthly Plan (30 Days Validity)</option>
                  <option value="HALF_YEARLY">Half Yearly Plan (180 Days Validity)</option>
                  <option value="YEARLY">Yearly Plan (365 Days Validity)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 font-medium leading-relaxed">
                ℹ️ Confirming renewal will generate a new valid cryptographic key for this client HWID and reactivate their software status remotely.
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewingSubmit}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{renewingSubmit ? 'Renewing License...' : 'Confirm Renewal & Activate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT / VIEW RECEIPT */}
      {showReceiptModal && selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Certificate Receipt</h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            {/* PRINTABLE RECEIPT BODY */}
            <div className="p-6 bg-white text-slate-900 space-y-4 font-sans">
              <div className="text-center border-b pb-3 border-slate-200">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">अपना डिजिटल हब</h2>
                <p className="text-xs text-slate-600">प्रमाणपत्र आवेदन एवं स्थिति प्रबंधन रसीद</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">रेफरेंस नंबर:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedCert.refNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">आवेदक का नाम:</span>
                  <span className="font-semibold text-slate-900">{selectedCert.applicantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">मोबाइल नंबर:</span>
                  <span>{selectedCert.mobile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">प्रमाणपत्र प्रकार:</span>
                  <span className="font-semibold">{selectedCert.certType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">दिनांक:</span>
                  <span>{new Date(selectedCert.entryDate).toLocaleDateString('en-IN')}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span>कुल शुल्क:</span>
                  <span>₹{selectedCert.totalFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>जमा राशि:</span>
                  <span className="text-emerald-700 font-semibold">₹{selectedCert.paidAmount}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-sm">
                  <span>बकाया (Dues):</span>
                  <span className="text-amber-700">₹{selectedCert.duesAmount}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 flex-wrap">
              <button
                onClick={() => handleResendReceipt(selectedCert)}
                disabled={resendingReceiptId === selectedCert.id}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <MessageSquare className={`w-4 h-4 ${resendingReceiptId === selectedCert.id ? 'animate-bounce' : ''}`} />
                <span>{resendingReceiptId === selectedCert.id ? 'Sending WhatsApp...' : 'Resend Receipt to WhatsApp'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ATTRACTIVE CENTER NOTIFICATION MODAL POPUP */}
      {toast && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className={`p-5 flex items-center justify-between border-b ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white'
                : toast.type === 'error'
                ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                  {toast.type === 'success' && <CheckCircle2 className="w-6 h-6 text-white" />}
                  {toast.type === 'error' && <XCircle className="w-6 h-6 text-white" />}
                  {toast.type === 'warning' && <AlertTriangle className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">{toast.title}</h3>
                  <p className="text-xs text-white/80 font-medium mt-0.5">Software Activation System Notice</p>
                </div>
              </div>
              <button
                onClick={() => setToast(null)}
                className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Details */}
            <div className="p-6 space-y-4 text-slate-800">
              {toast.details ? (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ref Number</span>
                    <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">{toast.details.refNo}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Applicant Name:</span>
                    <span className="font-bold text-slate-900">{toast.details.applicantName}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Mobile Number:</span>
                    <span className="font-mono text-slate-700 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400" /> {toast.details.mobile}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Cert Type:</span>
                    <span className="font-medium text-slate-800">{toast.details.certType}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                    <span className="text-xs font-semibold text-slate-500">Current Status:</span>
                    <div>{getStatusBadge(toast.details.status)}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed font-medium">{toast.message}</p>
                  
                  {/* Direct Contact Button if payment/activation message */}
                  {toast.message && toast.message.includes('7781931880') && (
                    <div className="pt-2">
                      <a
                        href="https://wa.me/917781931880"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Contact Admin on WhatsApp (7781931880)</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: If Delivered, show WhatsApp Send Button directly */}
              {toast.details?.certObj && (toast.details.status === 'DELIVERED' || toast.details.status === 'CO_DELIVERED' || toast.details.status === 'SDO_DELIVERED') && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">Certificate Delivered!</p>
                      <p className="text-[11px] text-emerald-700">Instant PDF available for customer</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const targetCert = toast.details.certObj;
                      setToast(null);
                      handleSendPdf(targetCert);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" /> Send PDF
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setToast(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}




