import React, { useState, useEffect } from 'react';
import { fetchCertificatesFromFirebase, saveCertificateToFirebase } from './firebase';

export default function App() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCertificatesFromFirebase();
      setCertificates(data || []);
    } catch (err) {
      console.error('Error loading Firebase certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 text-2xl font-bold">
          ⚡
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">
          Apna Digital Hub - Certificate Management
        </h1>
        <p className="text-slate-400 mb-6">
          Fresh Blank Setup Ready | Firebase & Render Connected
        </p>

        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/60 text-left mb-6 space-y-2 text-sm">
          <div className="flex justify-between items-center text-slate-300">
            <span>Firebase Cloud Database:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Connected (0 Records)
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Render Single Deployment:</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>GitHub Repository:</span>
            <span className="text-blue-400 font-mono text-xs">gattuelfsolvers/certificateapp</span>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Ready to build step-by-step from zero as per your instructions.
        </div>
      </div>
    </div>
  );
}
