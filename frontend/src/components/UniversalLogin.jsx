import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, ArrowRight, UserPlus, Sparkles, Shield, Cpu, Laptop, Smartphone } from 'lucide-react';
import { fetchClientsFromFirebase, saveClientToFirebase, subscribePlansFromFirebase } from '../firebase';

export default function UniversalLogin({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Request Access Multi-Step Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [regStep, setRegStep] = useState(1); // Step 1: Details, Step 2: Choose Plan, Step 3: Success Result
  const [requestForm, setRequestForm] = useState({
    shopName: '',
    ownerName: '',
    phone: '',
    address: ''
  });
  const [selectedPlanId, setSelectedPlanId] = useState('HALF_YEARLY'); // Default Selected Plan
  const [utrNumber, setUtrNumber] = useState('');
  const [utrError, setUtrError] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);
  const [registeredAccountInfo, setRegisteredAccountInfo] = useState(null);
  const [duplicateModalData, setDuplicateModalData] = useState(null); // { isOpen: boolean, phone: string, status: string, isReactivation: boolean, message: string }

  // Dynamic Registration Plans List (Excludes LIFETIME)
  const [registrationPlans, setRegistrationPlans] = useState([
    {
      id: 'FREE_TRIAL',
      name: 'Free Trial',
      badge: 'Demo',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      originalPrice: null,
      price: '₹0',
      duration: '5 Demo Entries',
      pcs: '1 PC Allowed',
      features: ['5 Certificate Entries', 'WhatsApp Integration', 'Basic Auto Backup', 'Standard Access'],
      highlight: false
    },
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
      highlight: false
    },
    {
      id: 'HALF_YEARLY',
      name: 'Half-Yearly Plan',
      badge: 'Top Selling',
      badgeColor: 'bg-amber-500/30 text-amber-300 border-amber-500/50',
      originalPrice: '₹699',
      price: '₹349',
      duration: '180 Days Validity',
      pcs: '3 PCs Allowed',
      features: ['Upto 1000 Entries', 'Multi-PC Sync (3 PCs)', 'Priority Cloud Backup', 'WhatsApp Integration', 'Full Customer Support'],
      highlight: true
    },
    {
      id: 'YEARLY',
      name: 'Yearly Plan',
      badge: 'Value for Money',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      originalPrice: '₹999',
      price: '₹599',
      duration: '365 Days Validity',
      pcs: '5 PCs Allowed',
      features: ['Unlimited Entries', 'Multi-PC Sync (5 PCs)', 'VIP Priority Backup', 'WhatsApp Integration', '24/7 Priority Support'],
      highlight: false
    }
  ]);

  // Subscribe to Dynamic Cloud Plans on Component Mount
  useEffect(() => {
    const unsubscribe = subscribePlansFromFirebase((cloudPlans) => {
      if (cloudPlans && cloudPlans.length > 0) {
        setRegistrationPlans(prev => {
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

  // Helper to consistently get or generate System Hardware ID (HWID)
  const getOrCreateSystemHwid = () => {
    let storedHwid = localStorage.getItem('CLIENT_SYSTEM_HWID');
    if (!storedHwid) {
      const userAgent = navigator.userAgent;
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const platform = navigator.platform || 'Win32';
      const rawString = `${userAgent}-${screenRes}-${platform}`;
      
      let hash = 0;
      for (let i = 0; i < rawString.length; i++) {
        const char = rawString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
      storedHwid = `HWID-${platform.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3)}-${hexHash.slice(0, 4)}-${hexHash.slice(4, 8)}`;
      localStorage.setItem('CLIENT_SYSTEM_HWID', storedHwid);
    }
    return storedHwid.toUpperCase();
  };

  const handleNextStep1 = async (e) => {
    e.preventDefault();
    const cleanPhone = requestForm.phone.trim();
    if (!requestForm.shopName.trim() || !requestForm.ownerName.trim() || !cleanPhone) {
      alert('Please fill in all mandatory fields (*)');
      return;
    }
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      alert('Please enter a valid 10-digit mobile number!');
      return;
    }

    const currentSystemHwid = getOrCreateSystemHwid();

    // Check duplicate mobile registration & HWID registration across all clients from Firebase Firestore
    try {
      const clients = await fetchClientsFromFirebase();
      
      // 1. Check Duplicate Mobile Number
      const existingPhoneClient = (clients || []).find(c => c.phone && c.phone.trim() === cleanPhone);

      if (existingPhoneClient) {
        const clientStatus = existingPhoneClient.status || 'ACTIVE';
        const isReactivationNeeded = clientStatus === 'EXPIRED' || clientStatus === 'KILLED' || clientStatus === 'INACTIVE' || clientStatus === 'DELETED';

        let customMsg = `Your mobile number (${cleanPhone}) is already registered with us (${existingPhoneClient.clientName || 'Account'}) and it is in "${clientStatus}" status.`;

        setDuplicateModalData({
          isOpen: true,
          duplicateType: 'MOBILE',
          phone: cleanPhone,
          shopName: existingPhoneClient.clientName || 'Account',
          status: clientStatus,
          isReactivation: isReactivationNeeded,
          message: customMsg
        });
        return;
      }

      // 2. Check Duplicate Hardware ID (HWID)
      const existingHwidClient = (clients || []).find(c => {
        const hwidList = Array.isArray(c.hwids) && c.hwids.length > 0 
          ? c.hwids.map(h => h.toUpperCase())
          : [(c.hwid || '').toUpperCase()];
        return hwidList.includes(currentSystemHwid);
      });

      if (existingHwidClient) {
        const clientStatus = existingHwidClient.status || 'ACTIVE';
        const isReactivationNeeded = clientStatus === 'EXPIRED' || clientStatus === 'KILLED' || clientStatus === 'INACTIVE' || clientStatus === 'DELETED';

        let customMsg = `Is computer / device me ek registration mobile number (${existingHwidClient.phone || 'Unknown'}) se pehle se darj hai (${existingHwidClient.clientName || 'Account'}) aur wo "${clientStatus}" status me hai.`;

        setDuplicateModalData({
          isOpen: true,
          duplicateType: 'HWID',
          phone: existingHwidClient.phone || cleanPhone,
          attemptedPhone: cleanPhone,
          shopName: existingHwidClient.clientName || 'Account',
          hwid: currentSystemHwid,
          status: clientStatus,
          isReactivation: isReactivationNeeded,
          message: customMsg
        });
        return;
      }
    } catch (err) {
      console.error("Duplicate mobile/HWID check error:", err);
    }

    setRegStep(2);
  };

  const handleProceedFromPlan = () => {
    // If Free Trial is selected, proceed directly to submit
    if (selectedPlanId === 'FREE_TRIAL') {
      handleRegistrationSubmit();
    } else {
      // For Paid plans, proceed to Step 3: Payment QR & UTR Submission Screen
      setUtrNumber('');
      setUtrError('');
      setRegStep(3);
    }
  };

  const handleRegistrationSubmit = async () => {
    const isFreeTrial = selectedPlanId === 'FREE_TRIAL';

    // Validate UTR Number for Paid Plans
    if (!isFreeTrial) {
      const cleanUtr = utrNumber.trim();
      if (!cleanUtr) {
        setUtrError('कृपया पेमेंट करने के बाद 12 अंकों का UTR / UPI Ref Number अवश्य दर्ज करें!');
        return;
      }
      if (cleanUtr.length < 6) {
        setUtrError('कृपया वैध UTR / Transaction Reference Number दर्ज करें (कम से कम 6 अंक/अक्षर)!');
        return;
      }
    }

    setSubmittingReg(true);
    setUtrError('');

    try {
      const cleanPhone = requestForm.phone.trim();
      const cleanHwid = getOrCreateSystemHwid();
      const cleanUtr = utrNumber.trim().toUpperCase();

      // Default Active Free Trial (7 Days / 5 Demo entries) for ALL accounts initially
      const freeTrialDays = 7;
      const expiresAt = new Date(Date.now() + freeTrialDays * 86400000).toISOString();

      const newClientPayload = {
        hwid: cleanHwid,
        hwids: [cleanHwid],
        allowedPcs: 1, // Default 1 PC for initial registration
        clientName: requestForm.shopName.trim(),
        ownerName: requestForm.ownerName.trim(),
        phone: cleanPhone,
        address: requestForm.address.trim(),
        planType: 'FREE_TRIAL', // Initial 5 Demo entries allocation
        requestedPlan: selectedPlanId, // Track requested paid/demo plan
        status: 'PENDING', // All registrations are PENDING approval from Master Admin
        password: cleanPhone, // Mobile number as default password
        licenseKey: `LIC-REQ-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        utrNumber: cleanUtr || 'N/A_FREE_TRIAL',
        paymentStatus: isFreeTrial ? 'FREE_TRIAL' : 'PAYMENT_SUBMITTED',
        paidAt: isFreeTrial ? null : new Date().toISOString(),
        expiresAt: expiresAt,
        createdAt: new Date().toISOString()
      };

      await saveClientToFirebase(newClientPayload);

      // Construct Grammatically Correct Messages
      let messageText = '';
      if (isFreeTrial) {
        messageText = `Thanks for registering with our service!\n\nYour Login ID is: ${cleanPhone}\nYour Password is: ${cleanPhone}\n\nYour account is currently PENDING approval from Admin for 5 demo entries. You will receive a confirmation message once Admin approves your access.`;
      } else {
        messageText = `Thanks for choosing our service!\n\nYour Login ID is: ${cleanPhone}\nYour Password is: ${cleanPhone}\nPlan: ${selectedPlanId.replace('_', ' ')}\nPayment UTR: ${cleanUtr}\n\nYour payment details and UTR have been successfully submitted to Admin. Your account will be activated once verified by Admin. Thank you!`;
      }

      // Send WhatsApp Notification to Client
      try {
        const notifBody = JSON.stringify({
          client: newClientPayload,
          eventType: 'NEW_REGISTRATION',
          customMessage: messageText
        });

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

      setRegisteredAccountInfo({
        phone: cleanPhone,
        password: cleanPhone,
        isFree: isFreeTrial,
        utrNumber: cleanUtr,
        message: messageText
      });

      // Move to Step 4: Success Result Screen
      setRegStep(4);
    } catch (err) {
      alert('Registration submission failed: ' + err.message);
    } finally {
      setSubmittingReg(false);
    }
  };

  const resetModalState = () => {
    setIsRequestModalOpen(false);
    setRegStep(1);
    setRequestForm({ shopName: '', ownerName: '', phone: '', address: '' });
    setSelectedPlanId('HALF_YEARLY');
    setUtrNumber('');
    setUtrError('');
    setRegisteredAccountInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUser = userId.trim();
    const cleanPass = password.trim();

    // 1. Check Master Admin Credentials
    if (cleanUser === 'Admingattu' && cleanPass === 'Gattu@1994#') {
      setTimeout(() => {
        localStorage.setItem('AUTH_ROLE', 'ADMIN');
        localStorage.setItem('IS_ADMIN_LOGGED_IN', 'true');
        localStorage.setItem('LOGIN_TIMESTAMP', Date.now().toString());
        onLoginSuccess('ADMIN', { name: 'Master Admin' });
        setLoading(false);
      }, 500);
      return;
    }

    // 2. Check Client Mobile Number / License Key in Firebase Cloud with Password & HWID Whitelisting
    try {
      const clients = await fetchClientsFromFirebase();
      const currentSystemHwid = localStorage.getItem('CLIENT_SYSTEM_HWID') || '';
      
      const matchedClient = (clients || []).find(c => {
        const phoneMatch = c.phone && c.phone.trim() === cleanUser;
        const keyMatch = c.licenseKey && c.licenseKey.trim().toUpperCase() === cleanUser.toUpperCase();
        return phoneMatch || keyMatch;
      });

      if (matchedClient) {
        // Password Check: Default password is phone number or client.password or master fallback if set
        const validPassword = matchedClient.password ? matchedClient.password.trim() : (matchedClient.phone ? matchedClient.phone.trim() : cleanUser);
        
        if (cleanPass !== validPassword && cleanPass !== matchedClient.licenseKey) {
          setError('Invalid Password! Please enter the correct password for your account.');
          setLoading(false);
          return;
        }

        // Account Status Check (KILLED / BLOCKED check)
        if (matchedClient.status === 'KILLED' || matchedClient.status === 'INACTIVE') {
          setError('Your account license has been terminated or blocked by Admin.');
          setLoading(false);
          return;
        }

        // Expiry Date Check
        const daysLeft = Math.ceil((new Date(matchedClient.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0 && matchedClient.planType !== 'LIFETIME') {
          setError('Your subscription license has EXPIRED. Please contact Admin to renew.');
          setLoading(false);
          return;
        }

        // Strict Multi-HWID Whitelisting Verification
        const whitelistedHwids = Array.isArray(matchedClient.hwids) && matchedClient.hwids.length > 0 
          ? matchedClient.hwids.map(h => h.toUpperCase())
          : [(matchedClient.hwid || '').toUpperCase()];
          
        const maxPcs = matchedClient.allowedPcs || 1;

        if (currentSystemHwid) {
          const cleanCurrentHwid = currentSystemHwid.toUpperCase();
          const isWhitelisted = whitelistedHwids.includes(cleanCurrentHwid);

          if (!isWhitelisted) {
            // Check if current whitelisted list contains unassigned placeholder REQ- keys from fresh web registrations
            const isFreshRegistrationPlaceholder = whitelistedHwids.length === 1 && (whitelistedHwids[0].startsWith('REQ-') || whitelistedHwids[0].startsWith('LIC-REQ-'));
            
            if (isFreshRegistrationPlaceholder) {
              // Bind first real PC HWID for fresh web registration account
              matchedClient.hwid = cleanCurrentHwid;
              matchedClient.hwids = [cleanCurrentHwid];
              saveClientToFirebase(matchedClient).catch(() => {});
            } else {
              // Strictly Block login on any unregistered/un-whitelisted PC
              setError(`Login Blocked: This PC Hardware ID (${cleanCurrentHwid}) is NOT whitelisted for this account! Your plan limit is ${maxPcs} PC(s). Please contact Admin (7781931880) to add this PC or reset device lock.`);
              setLoading(false);
              return;
            }
          }
        }

        localStorage.setItem('AUTH_ROLE', 'CLIENT');
        localStorage.setItem('ACTIVE_CLIENT_DATA', JSON.stringify(matchedClient));
        localStorage.setItem('LOGIN_TIMESTAMP', Date.now().toString());
        onLoginSuccess('CLIENT', matchedClient);
      } else {
        setError('Mobile Number / User ID not registered! Please check or Request Access.');
      }
    } catch (err) {
      console.error("Login verification error:", err);
      setError('Connection error: Unable to verify credentials with Firebase Cloud (' + (err.message || 'Error') + ')');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccessSubmit = async (e) => {
    e.preventDefault();
    try {
      const reqHwid = `REQ-${Date.now()}`;
      await saveClientToFirebase({
        hwid: reqHwid,
        clientName: requestForm.shopName,
        ownerName: requestForm.ownerName,
        phone: requestForm.phone,
        address: requestForm.address,
        planType: 'FREE_TRIAL',
        status: 'PENDING',
        licenseKey: `PENDING-APPROVAL-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
      });
      setRequestSuccess(true);
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setRequestSuccess(false);
        setRequestForm({ shopName: '', ownerName: '', phone: '', address: '' });
      }, 2500);
    } catch (err) {
      alert('Failed to submit request: ' + err.message);
    }
  };

  // HWID Modal State
  const [isHwidModalOpen, setIsHwidModalOpen] = useState(false);
  const [currentHwid, setCurrentHwid] = useState('');

  const handleGetHwid = () => {
    let storedHwid = localStorage.getItem('CLIENT_SYSTEM_HWID');
    if (!storedHwid) {
      const userAgent = navigator.userAgent;
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const platform = navigator.platform || 'Win32';
      const rawString = `${userAgent}-${screenRes}-${platform}`;
      
      let hash = 0;
      for (let i = 0; i < rawString.length; i++) {
        const char = rawString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
      storedHwid = `HWID-${platform.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3)}-${hexHash.slice(0, 4)}-${hexHash.slice(4, 8)}`;
      localStorage.setItem('CLIENT_SYSTEM_HWID', storedHwid);
    }
    setCurrentHwid(storedHwid);
    setIsHwidModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Hi-Tech Glowing Ambient Background & Mesh Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.25),rgba(255,255,255,0))] pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Hi-Tech Grid Lines Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>

      {/* Extra Wide Card Container (max-w-2xl) to fit Title on ONE Single Line */}
      <div className="max-w-2xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-10 shadow-[0_0_50px_rgba(37,99,235,0.15)] relative z-10 space-y-8">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30 border border-blue-400/30">
              <Cpu className="w-8 h-8 text-white animate-pulse" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
            </span>
          </div>

          <div className="space-y-1">
            {/* Line 1: WELCOME TO */}
            <p className="text-sm font-black uppercase tracking-widest text-blue-400">
              WELCOME TO
            </p>
            {/* Line 2: Certificate Management Software (STRICTLY ONE SINGLE LINE) */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight whitespace-nowrap">
              Certificate Management Software
            </h1>
            {/* Line 3: Powered by - Apna Digital Hub */}
            <p className="text-xs font-semibold text-slate-400 pt-1 flex items-center justify-center gap-1">
              <span>Powered by -</span>
              <span className="text-blue-400 font-bold">Apna Digital Hub</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Universal Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 tracking-wide uppercase">
              User ID / License Key / Mobile
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter Admin ID or License Key"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 tracking-wide uppercase">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-extrabold text-base shadow-xl shadow-blue-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-4 active:scale-[0.99]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                Login to Portal
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="text-center pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
          <button 
            onClick={() => setIsRequestModalOpen(true)}
            className="text-blue-400 font-bold hover:text-blue-300 transition flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Register for New User
          </button>

          {/* GET HARDWARE ID BUTTON */}
          <button
            type="button"
            onClick={handleGetHwid}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold transition flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            Get Hardware ID
          </button>

          <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Encrypted SaaS Portal
          </span>
        </div>
      </div>

      {/* HARDWARE ID POPUP MODAL */}
      {isHwidModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center relative animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
              <Cpu className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">System Hardware ID</h3>
              <p className="text-xs text-slate-300 font-medium">
                your system's hwid is -
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-black text-amber-300 tracking-wider break-all select-all">
                "{currentHwid}"
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentHwid);
                  alert('Hardware ID copied to clipboard!');
                }}
                className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-400 shrink-0"
              >
                Copy
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsHwidModalOpen(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE MOBILE NUMBER REGISTRATION WARNING MODAL */}
      {duplicateModalData && duplicateModalData.isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center relative animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                {duplicateModalData.duplicateType === 'HWID' ? (
                  <>
                    <Laptop className="w-6 h-6 text-amber-400 inline" />
                    <span>Computer / Device Already Registered</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-6 h-6 text-amber-400 inline" />
                    <span>Mobile Number Already Registered</span>
                  </>
                )}
              </h3>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium leading-relaxed space-y-2.5 text-left">
                {duplicateModalData.duplicateType === 'HWID' ? (
                  <>
                    <p>
                      Aapke is <span className="font-bold text-white">Computer / Device (PC)</span> me pehle se ek registration mobile number <span className="font-mono font-bold text-amber-300">({duplicateModalData.phone})</span> - <span className="font-bold text-emerald-300">{duplicateModalData.shopName}</span> ke naam se darj hai aur wo <span className="font-extrabold uppercase text-emerald-400">"{duplicateModalData.status}"</span> status me hai.
                    </p>
                    <p className="text-slate-400 text-[11px] bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                      ℹ️ Ek computer par ek hi account allow hota hai. Agar aap <span className="font-mono text-amber-200">{duplicateModalData.attemptedPhone}</span> ke liye naya registration karna chahte hain, to kripya Admin se iss PC ka HWID link hatwane ke liye sampark karein ya purane account se login karein.
                    </p>
                  </>
                ) : (
                  <p>
                    Aapka mobile number <span className="font-mono font-bold text-amber-300">({duplicateModalData.phone})</span> pehle se hamare paas registered hai aur yeh <span className="font-extrabold uppercase text-emerald-400">"{duplicateModalData.status}"</span> status me hai.
                  </p>
                )}

                {duplicateModalData.isReactivation ? (
                  <p className="text-rose-300 font-semibold border-t border-slate-800 pt-2">
                    Kripya account reactivate karwane ke liye Admin se <span className="font-bold font-mono text-white select-all">7781931880</span> par contact karein.
                  </p>
                ) : (
                  <p className="text-blue-300 font-semibold border-t border-slate-800 pt-2">
                    {duplicateModalData.duplicateType === 'HWID' 
                      ? `Aap registered account (${duplicateModalData.phone}) se direct login kar sakte hain ya password reset kar sakte hain:`
                      : `Kripya apne user ID aur password se login karein. Agar aap bhool gaye hain to mobile number se reset kar sakte hain:`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {!duplicateModalData.isReactivation ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setUserId(duplicateModalData.phone);
                      setPassword(duplicateModalData.phone);
                      setDuplicateModalData(null);
                      setIsRequestModalOpen(false);
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition"
                  >
                    Login with ({duplicateModalData.phone})
                  </button>
                  <button
                    onClick={() => {
                      setUserId(duplicateModalData.phone);
                      setPassword('');
                      setDuplicateModalData(null);
                      setIsRequestModalOpen(false);
                      alert(`Password Reset Guide:\n\nDefault Password for your mobile (${duplicateModalData.phone}) is set to your Mobile Number: ${duplicateModalData.phone}.\n\nPlease try logging in with User ID: ${duplicateModalData.phone} and Password: ${duplicateModalData.phone}. If you need further help, call Admin 7781931880.`);
                    }}
                    className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-extrabold text-xs rounded-xl transition"
                  >
                    Click Here to Reset
                  </button>
                </div>
              ) : (
                <a
                  href="tel:7781931880"
                  className="block w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition text-center"
                >
                  📞 Call Admin (7781931880)
                </a>
              )}

              <button
                onClick={() => setDuplicateModalData(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-STEP REGISTER FOR NEW USER MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 md:p-7 w-full shadow-2xl space-y-5 transition-all duration-300 max-h-[92vh] flex flex-col my-auto ${
            regStep === 2 ? 'max-w-6xl' : regStep === 3 ? 'max-w-4xl' : 'max-w-2xl'
          }`}>
            
            {/* Modal Header (Fixed at top) */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Register for New Account
                  </h3>
                  <p className="text-xs text-slate-400">
                    {regStep === 1 && 'Step 1 of 3: Enter Shop & Owner Details'}
                    {regStep === 2 && 'Step 2 of 3: Select Your Preferred Subscription Plan'}
                    {regStep === 3 && 'Step 3 of 3: QR Code Payment & Enter UTR Number'}
                    {regStep === 4 && 'Registration Completed Successfully!'}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={resetModalState}
                className="text-slate-400 hover:text-white text-2xl font-bold p-1 rounded-lg transition"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">

            {/* STEP 1: SHOP DETAILS FORM */}
            {regStep === 1 && (
              <form onSubmit={handleNextStep1} className="space-y-4 text-xs font-medium">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">Shop / CSC Center Name *</label>
                    <input
                      type="text"
                      required
                      value={requestForm.shopName}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, shopName: e.target.value }))}
                      placeholder="e.g. Rahul CSC Kendra"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">Owner Name *</label>
                    <input
                      type="text"
                      required
                      value={requestForm.ownerName}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, ownerName: e.target.value }))}
                      placeholder="e.g. Rahul Kumar"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">WhatsApp Mobile No *</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={requestForm.phone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setRequestForm(prev => ({ ...prev, phone: digitsOnly }));
                      }}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-mono focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">Center Address</label>
                    <input
                      type="text"
                      value={requestForm.address}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="e.g. Ranchi, Jharkhand"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={resetModalState}
                    className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-7 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/30 transition flex items-center gap-2"
                  >
                    Next Step
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: CHOOSE CHATGPT STYLE PLANS */}
            {regStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch pt-3 pb-4">
                  {registrationPlans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`relative rounded-3xl p-5 border transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-slate-950 border-blue-500 ring-4 ring-blue-500/30 shadow-2xl shadow-blue-500/20 scale-105 -translate-y-2 z-10'
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
                              <div className="w-6 h-6 rounded-full bg-blue-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-lg animate-in zoom-in-50 duration-200">
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
                                <span className="text-blue-400 font-bold">✓</span>
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
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {isSelected ? 'Selected Plan' : 'Choose Plan'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                  >
                    Back to Details
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetModalState}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      disabled={submittingReg}
                      onClick={handleProceedFromPlan}
                      className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/40 transition flex items-center gap-2"
                    >
                      {submittingReg ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        selectedPlanId === 'FREE_TRIAL' ? 'Submit Demo Registration' : 'Proceed to Payment (क्यूआर कोड)'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT QR CODE & UTR INPUT SCREEN */}
            {regStep === 3 && (
              <div className="space-y-4 py-1 animate-in fade-in">
                {(() => {
                  const currentPlan = registrationPlans.find(p => p.id === selectedPlanId) || {
                    name: 'Subscription Plan',
                    price: '₹349',
                    duration: 'Validity'
                  };

                  return (
                    <>
                      {/* Top Plan Name & Rate Header Bar */}
                      <div className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-lg text-blue-400 font-black shrink-0">
                            💳
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">चयनित प्लान (Selected Plan)</div>
                            <h3 className="text-sm sm:text-base font-black text-white">{currentPlan.name}</h3>
                            <p className="text-[11px] text-blue-300 font-semibold">{currentPlan.duration} • {currentPlan.pcs || 'Multi-PC Sync'}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 bg-slate-950/90 px-3.5 py-1.5 rounded-xl border border-blue-500/20">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">भुगतान राशि</div>
                          <div className="text-xl font-black text-emerald-400 font-mono">{currentPlan.price}</div>
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

                          <div className="p-2.5 bg-white rounded-xl shadow-inner inline-block mx-auto border border-emerald-500/40">
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
                            <p className="text-[11px] text-slate-300 font-medium mt-1">
                              पेमेंट वेरिफाई होते ही आपका अकाउंट तुरंत एक्टिवेट हो जाएगा।
                            </p>
                          </div>

                          {/* Mandatory UTR / UPI Ref Number Input Field */}
                          <div className="space-y-1.5">
                            <label className="block text-xs font-black text-slate-200 uppercase tracking-wide">
                              UTR / UPI Reference Number <span className="text-rose-500">* (अनिवार्य)</span>
                            </label>
                            <input
                              type="text"
                              value={utrNumber}
                              onChange={(e) => {
                                setUtrNumber(e.target.value);
                                setUtrError('');
                              }}
                              placeholder="e.g. 4289XXXXXXXX (12 अंकों का UTR नंबर)"
                              className="w-full bg-slate-950 border-2 border-blue-500/50 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs sm:text-sm tracking-wider font-bold shadow-inner placeholder-slate-600 focus:outline-none transition"
                            />

                            {utrError && (
                              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold animate-shake">
                                ⚠️ {utrError}
                              </div>
                            )}
                          </div>

                          {/* Quick Help Tip */}
                          <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                            💡 <strong>UTR कहाँ मिलेगा?</strong> PhonePe/GPay में पेमेंट सफलता स्क्रीन के नीचे <code className="text-amber-300 font-mono">UTR / UPI Ref ID</code> लिखा होता है।
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions (Always visible & accessible) */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setRegStep(2)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                        >
                          ← प्लान बदलें (Back)
                        </button>

                        <button
                          type="button"
                          disabled={submittingReg}
                          onClick={handleRegistrationSubmit}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 transition flex items-center gap-2 transform active:scale-95"
                        >
                          {submittingReg ? (
                            <span className="flex items-center gap-2">
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              सबमिट हो रहा है...
                            </span>
                          ) : (
                            <span>✓ UTR सबमिट करें (Submit Payment)</span>
                          )}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* STEP 4: SUCCESS RESULT POPUP */}
            {regStep === 4 && registeredAccountInfo && (
              <div className="space-y-6 text-center py-2 animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-xl">
                  <Sparkles className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xl font-black text-white">Registration & Payment Submitted!</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    {registeredAccountInfo.isFree ? (
                      <>
                        Thanks for choosing our service! Please log in and use your <strong className="text-emerald-400">5 demo entries</strong>.
                      </>
                    ) : (
                      <>
                        आपका रजिस्ट्रेशन और UTR नंबर (<strong className="text-amber-300 font-mono">{registeredAccountInfo.utrNumber}</strong>) सफलतापूर्वक एडमिन को भेज दिया गया है। एडमिन द्वारा पेमेंट वेरिफाई होते ही आपका अकाउंट तुरंत एक्टिवेट हो जाएगा।
                      </>
                    )}
                  </p>
                </div>

                {/* Credentials Display Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-left max-w-md mx-auto space-y-3 shadow-inner font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-medium">User Login ID:</span>
                    <span className="font-bold text-amber-300 text-sm select-all">{registeredAccountInfo.phone}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-medium">Default Password:</span>
                    <span className="font-bold text-emerald-400 text-sm select-all">{registeredAccountInfo.password}</span>
                  </div>
                  {!registeredAccountInfo.isFree && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400 font-medium">Submitted UTR No:</span>
                      <span className="font-bold text-blue-400 text-xs select-all">{registeredAccountInfo.utrNumber}</span>
                    </div>
                  )}
                </div>

                <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-200 text-left max-w-md mx-auto leading-relaxed">
                  <p className="font-semibold text-blue-400 mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    WhatsApp Confirmation Sent
                  </p>
                  <p className="text-[11px] text-slate-300">
                    A confirmation message with your credentials and subscription details has been sent to your WhatsApp number (<span className="font-mono text-amber-300">{registeredAccountInfo.phone}</span>).
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUserId(registeredAccountInfo.phone);
                      setPassword(registeredAccountInfo.password);
                      resetModalState();
                    }}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition"
                  >
                    Proceed to Login
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
