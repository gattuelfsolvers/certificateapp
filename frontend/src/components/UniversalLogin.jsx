import React, { useState } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, ArrowRight, UserPlus, Sparkles } from 'lucide-react';
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

    // 2. Check Client License Key or Mobile in Firebase Cloud
    try {
      const clients = await fetchClientsFromFirebase();
      const matchedClient = (clients || []).find(c => 
        (c.licenseKey && c.licenseKey.trim().toUpperCase() === cleanUser.toUpperCase()) ||
        (c.phone && c.phone.trim() === cleanUser) ||
        (c.hwid && c.hwid.trim().toUpperCase() === cleanUser.toUpperCase())
      );

      if (matchedClient) {
        if (matchedClient.status === 'KILLED' || matchedClient.status === 'INACTIVE') {
          setError('Your account license has been terminated or blocked. Please contact Admin.');
          setLoading(false);
          return;
        }

        const expiresAt = new Date(matchedClient.expiresAt);
        if (expiresAt <= new Date()) {
          setError('Your subscription license has expired. Please contact Admin to renew.');
          setLoading(false);
          return;
        }

        localStorage.setItem('AUTH_ROLE', 'CLIENT');
        localStorage.setItem('ACTIVE_CLIENT_DATA', JSON.stringify(matchedClient));
        onLoginSuccess('CLIENT', matchedClient);
      } else {
        setError('Invalid User ID, License Key or Password! Please check and try again.');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 text-slate-800 flex items-center justify-center p-6 relative font-sans">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-blue-400/20 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-400/20 blur-3xl rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur border border-slate-200/80 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Header Title Section */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-500/30">
            <Sparkles className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
            Welcome to Certificate Management Software
          </h1>
          <p className="text-xs font-bold text-blue-600 tracking-wide">
            Powered by - Apna Digital Hub
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Universal Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              User ID / License Key / Mobile
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter Admin ID or License Key"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Login to Portal
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Action Links */}
        <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <button 
            onClick={() => setIsRequestModalOpen(true)}
            className="text-blue-600 font-bold hover:underline flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Request New License
          </button>
          <span className="text-[11px] text-slate-400 font-medium">Protected SaaS System</span>
        </div>
      </div>

      {/* Request New License Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Request Software Access License
              </h3>
              <button 
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            {requestSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-center space-y-2">
                <h4 className="font-bold text-sm">Request Submitted Successfully!</h4>
                <p className="text-xs">Master Admin has been notified. Your account will be activated shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleRequestAccessSubmit} className="space-y-3 text-xs font-medium">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Shop / CSC Center Name *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.shopName}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, shopName: e.target.value }))}
                    placeholder="e.g. Rahul CSC Kendra"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.ownerName}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="e.g. Rahul Kumar"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">WhatsApp Mobile No *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.phone}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Center Address</label>
                  <input
                    type="text"
                    value={requestForm.address}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="e.g. Ranchi, Jharkhand"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow"
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
