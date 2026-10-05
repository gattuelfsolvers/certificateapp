import React, { useState, useEffect } from 'react';
import { CERTIFICATE_CATEGORIES } from './constants/certificateTypes';
import { fetchCertificatesFromFirebase } from './firebase';
import { FileText, Plus, RefreshCw, Search, Filter, Layers, CheckCircle2, Clock, XCircle, ChevronRight, Award, Home, Shield, CreditCard, Heart } from 'lucide-react';

export default function App() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSubService, setSelectedSubService] = useState(null);

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

  const getSubServiceCount = (code) => {
    return certificates.filter((c) => c.certType === code || c.subService === code).length;
  };

  const getCategoryCount = (subServices) => {
    const codes = subServices.map((s) => s.code);
    return certificates.filter((c) => codes.includes(c.certType) || codes.includes(c.subService)).length;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-blue-500/20">
              📜
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                अपना डिजिटल हब - Certificate Management
              </h1>
              <p className="text-xs text-slate-400">
                Jharsewa Portal Certificate Tracking & Instant Automation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 transition">
              <Plus className="w-4 h-4" />
              New Certificate Entry
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 space-y-8">
        
        {/* Category Launch Cards Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                Certificate Service Categories & Sub-Services
              </h2>
              <p className="text-xs text-slate-400">Click any sub-service to open instant entry form</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Total Categories: {CERTIFICATE_CATEGORIES.length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CERTIFICATE_CATEGORIES.map((cat) => {
              const catTotal = getCategoryCount(cat.subServices);
              return (
                <div 
                  key={cat.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition space-y-4 flex flex-col justify-between shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-xs uppercase tracking-wider border border-blue-500/20">
                        {cat.name}
                      </span>
                    </div>
                    <span className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center border border-slate-700">
                      {catTotal}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">{cat.title}</h3>
                    <p className="text-xs text-slate-400">{cat.subServices.length} Sub-service types available</p>
                  </div>

                  {/* Sub Service Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    {cat.subServices.map((sub) => {
                      const subCount = getSubServiceCount(sub.code);
                      return (
                        <button
                          key={sub.code}
                          onClick={() => setSelectedSubService(sub.code)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-blue-600/20 text-slate-200 hover:text-blue-400 border border-slate-700/60 hover:border-blue-500/40 text-xs font-semibold transition group"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-mono text-[10px]">+</span>
                            {sub.code}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 group-hover:bg-blue-500/30 group-hover:text-blue-300 text-[10px]">
                            {subCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Selected Sub-Service Status Modal / Notification */}
        {selectedSubService && (
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-blue-300 text-sm">
            <span>Selected Sub-Service Code: <strong>{selectedSubService}</strong></span>
            <button 
              onClick={() => setSelectedSubService(null)} 
              className="px-3 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-xs font-medium"
            >
              Clear Selection
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
