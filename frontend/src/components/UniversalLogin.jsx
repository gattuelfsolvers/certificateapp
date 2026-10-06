import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, ArrowRight, UserPlus, Sparkles, Shield, Cpu } from 'lucide-react';
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
  const [submittingReg, setSubmittingReg] = useState(false);
  const [registeredAccountInfo, setRegisteredAccountInfo] = useState(null);

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

  // State for Registration Duplicate Mobile Check Popup Modal
  const [duplicateModalData, setDuplicateModalData] = useState(null); // { isOpen: boolean, phone: string, status: string, isReactivation: boolean, message: string }

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

    // Check duplicate mobile registration across all clients from Firebase Firestore
    try {
      const clients = await fetchClientsFromFirebase();
      const existingClient = (clients || []).find(c => c.phone && c.phone.trim() === cleanPhone);

      if (existingClient) {
        const clientStatus = existingClient.status || 'ACTIVE';
        const isReactivationNeeded = clientStatus === 'EXPIRED' || clientStatus === 'KILLED' || clientStatus === 'INACTIVE' || clientStatus === 'DELETED';

        let customMsg = '';
        if (isReactivationNeeded) {
          customMsg = `Your number (${cleanPhone}) is already registered with us and it is in "${clientStatus}" status. Please contact the Admin at 7781931880 for reactivating your account.`;
        } else {
          customMsg = `Your number (${cleanPhone}) is already registered with us and it is in "${clientStatus}" status. Please login with your user ID and password.`;
        }

        setDuplicateModalData({
          isOpen: true,
          phone: cleanPhone,
          status: clientStatus,
          isReactivation: isReactivationNeeded,
          message: customMsg
        });
        return;
      }
    } catch (err) {
      console.error("Duplicate mobile check error:", err);
    }

    setRegStep(2);
  };

  const handleRegistrationSubmit = async () => {
    setSubmittingReg(true);
    try {
      const cleanPhone = requestForm.phone.trim();
      
      // Auto fetch current system HWID from local device
      let currentSystemHwid = localStorage.getItem('CLIENT_SYSTEM_HWID');
      if (!currentSystemHwid) {
        currentSystemHwid = 'HWID-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('CLIENT_SYSTEM_HWID', currentSystemHwid);
      }
      const cleanHwid = currentSystemHwid.toUpperCase();

      // Default Active Free Trial (7 Days / 5 Demo entries) for ALL accounts initially
      const freeTrialDays = 7;
      const expiresAt = new Date(Date.now() + freeTrialDays * 86400000).toISOString();

      const isFreeTrial = selectedPlanId === 'FREE_TRIAL';

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
        expiresAt: expiresAt,
        createdAt: new Date().toISOString()
      };

      await saveClientToFirebase(newClientPayload);

      // Construct Grammatically Correct Messages
      let messageText = '';
      if (isFreeTrial) {
        messageText = `Thanks for registering with our service!\n\nYour Login ID is: ${cleanPhone}\nYour Password is: ${cleanPhone}\n\nYour account is currently PENDING approval from Admin for 5 demo entries. You will receive a confirmation message once Admin approves your access.`;
      } else {
        messageText = `Thanks for choosing our service!\n\nYour Login ID is: ${cleanPhone}\nYour Password is: ${cleanPhone}\n\nYour account is currently PENDING approval. Please wait for Admin to confirm your payment for the ${selectedPlanId.replace('_', ' ')} plan. Once confirmed by Admin, your account will be activated. Make sure you have paid your subscription fee for a smooth software experience.`;
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
        isFree: selectedPlanId === 'FREE_TRIAL',
        message: messageText
      });

      setRegStep(3);
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

        // Account Status Check
        if (matchedClient.status === 'KILLED' || matchedClient.status === 'INACTIVE') {
          setError('Your account license has been terminated or blocked by Admin.');
          setLoading(false);
          return;
        }

        if (matchedClient.status === 'PENDING') {
          setError('Your account registration is currently PENDING approval from Admin.');
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

        // Multi-HWID Whitelisting Verification
        const whitelistedHwids = Array.isArray(matchedClient.hwids) && matchedClient.hwids.length > 0 
          ? matchedClient.hwids.map(h => h.toUpperCase())
          : [(matchedClient.hwid || '').toUpperCase()];
          
        const maxPcs = matchedClient.allowedPcs || 1;

        if (currentSystemHwid) {
          const cleanCurrentHwid = currentSystemHwid.toUpperCase();
          if (!isWhitelisted && whitelistedHwids.length < maxPcs) {
            // Auto-bind / Whitelist current real System HWID to Client account
            const updatedHwids = [...whitelistedHwids, cleanCurrentHwid];
            matchedClient.hwid = cleanCurrentHwid;
            matchedClient.hwids = updatedHwids;
            saveClientToFirebase(matchedClient).catch(() => {});
          } else if (!isWhitelisted && whitelistedHwids.length >= maxPcs) {
            // Replace placeholder if single PC and contains generic REQ / HWID placeholder
            const hasPlaceholder = whitelistedHwids.some(h => h.startsWith('REQ-') || h.startsWith('LIC-'));
            if (hasPlaceholder) {
              matchedClient.hwid = cleanCurrentHwid;
              matchedClient.hwids = [cleanCurrentHwid];
              saveClientToFirebase(matchedClient).catch(() => {});
            } else {
              setError(`Login Blocked: This System Hardware ID (${cleanCurrentHwid}) is not Whitelisted! Plan allows maximum ${maxPcs} PC(s). Please contact Admin.`);
              setLoading(false);
              return;
            }
          }
        }

        localStorage.setItem('AUTH_ROLE', 'CLIENT');
        localStorage.setItem('ACTIVE_CLIENT_DATA', JSON.stringify(matchedClient));
        onLoginSuccess('CLIENT', matchedClient);
      } else {
        setError('Mobile Number / User ID not registered! Please check or Request Access.');
      }
    } catch (err) {
      setError('Connection error: Unable to verify credentials with Firebase Cloud.');
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
              <h3 className="text-xl font-black text-white tracking-tight">
                Mobile Number Already Registered
              </h3>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium leading-relaxed space-y-2 text-left">
                <p>
                  Your number <span className="font-mono font-bold text-amber-300">({duplicateModalData.phone})</span> is already registered with us and it is in <span className="font-extrabold uppercase text-emerald-400">"{duplicateModalData.status}"</span> status.
                </p>

                {duplicateModalData.isReactivation ? (
                  <p className="text-rose-300 font-semibold border-t border-slate-800 pt-2">
                    Please contact the Admin at <span className="font-bold font-mono text-white select-all">7781931880</span> for reactivating your account.
                  </p>
                ) : (
                  <p className="text-blue-300 font-semibold border-t border-slate-800 pt-2">
                    Please login with your user ID and password. If you forgot your user ID and password, you can reset it using your mobile number.
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
                    Login to Account
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 md:p-8 overflow-y-auto">
          <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full shadow-2xl space-y-6 transition-all duration-300 ${regStep === 2 ? 'max-w-6xl' : 'max-w-2xl'}`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Register for New Account
                  </h3>
                  <p className="text-xs text-slate-400">
                    {regStep === 1 && 'Step 1 of 2: Enter Shop & Owner Details'}
                    {regStep === 2 && 'Step 2 of 2: Select Your Preferred Subscription Plan'}
                    {regStep === 3 && 'Registration Completed Successfully!'}
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
                      onClick={handleRegistrationSubmit}
                      className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/40 transition flex items-center gap-2"
                    >
                      {submittingReg ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        selectedPlanId === 'FREE_TRIAL' ? 'Submit Demo Registration' : 'Proceed to Payment & Submit'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS RESULT POPUP */}
            {regStep === 3 && registeredAccountInfo && (
              <div className="space-y-6 text-center py-2">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-xl">
                  <Sparkles className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xl font-black text-white">Registration Successful!</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    {registeredAccountInfo.isFree ? (
                      <>
                        Thanks for choosing our service! Please log in and use your <strong className="text-emerald-400">5 demo entries</strong>.
                      </>
                    ) : (
                      <>
                        Thanks for choosing our service! Please wait for Admin payment confirmation to enjoy full features.
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
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Default Password:</span>
                    <span className="font-bold text-emerald-400 text-sm select-all">{registeredAccountInfo.password}</span>
                  </div>
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
      )}
    </div>
  );
}
