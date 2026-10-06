import React, { useState } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, ArrowRight, UserPlus, Sparkles, Shield, Cpu } from 'lucide-react';
import { fetchClientsFromFirebase, saveClientToFirebase } from '../firebase';

export default function UniversalLogin({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Request Access Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    shopName: '',
    ownerName: '',
    phone: '',
    address: ''
  });
  const [requestSuccess, setRequestSuccess] = useState(false);

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
          const isWhitelisted = whitelistedHwids.includes(cleanCurrentHwid);

          if (!isWhitelisted && whitelistedHwids.length >= maxPcs) {
            setError(`Login Blocked: This System Hardware ID (${cleanCurrentHwid}) is not Whitelisted! Plan allows maximum ${maxPcs} PC(s). Please contact Admin.`);
            setLoading(false);
            return;
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
            Request New License Key
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

      {/* Request New License Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Request Software Access License
              </h3>
              <button 
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            {requestSuccess ? (
              <div className="p-4 bg-emerald-950/60 text-emerald-300 rounded-2xl border border-emerald-500/30 text-center space-y-2">
                <h4 className="font-bold text-sm">Request Submitted Successfully!</h4>
                <p className="text-xs text-slate-300">Master Admin has been notified. Your account will be activated shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleRequestAccessSubmit} className="space-y-3 text-xs font-medium">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Shop / CSC Center Name *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.shopName}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, shopName: e.target.value }))}
                    placeholder="e.g. Rahul CSC Kendra"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.ownerName}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="e.g. Rahul Kumar"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">WhatsApp Mobile No *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.phone}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Center Address</label>
                  <input
                    type="text"
                    value={requestForm.address}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="e.g. Ranchi, Jharkhand"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow"
                  >
                    Submit Access Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
