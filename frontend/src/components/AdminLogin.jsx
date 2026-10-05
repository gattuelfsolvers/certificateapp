import React, { useState } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle } from 'lucide-react';

export default function AdminLogin({ onLoginSuccess }) {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (adminId.trim() === 'Admingattu' && password.trim() === 'Gattu@1994#') {
        localStorage.setItem('IS_ADMIN_LOGGED_IN', 'true');
        onLoginSuccess();
      } else {
        setError('Invalid Admin ID or Password! Please check your credentials.');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 text-slate-800 flex items-center justify-center p-6 relative font-sans">
      {/* Background Decor Shapes */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-blue-400/20 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-violet-400/20 blur-3xl rounded-full pointer-events-none"></div>

      <div className="max-w-md w-full bg-white/90 backdrop-blur border border-slate-200/80 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Master Admin Portal
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Apna Digital Hub - Central License & Client Management
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Admin User ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="Enter Admin ID (e.g. Admingattu)"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Admin Password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Login to Master Admin Portal
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium">
            Protected Multi-Tenant Admin Control System
          </p>
        </div>
      </div>
    </div>
  );
}
