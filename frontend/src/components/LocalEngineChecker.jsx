import React from 'react';
import { ShieldAlert, Download, RefreshCw, Cpu, CheckCircle2 } from 'lucide-react';

export default function LocalEngineChecker({ engineStatus, onRetry, isChecking, API_BASE = '/api' }) {
  if (engineStatus === 'ONLINE') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-6 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-emerald-400">LOCAL ENGINE READY</span>
              <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded-full font-mono border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> ACTIVE (Port 5000)
              </span>
            </div>
            <p className="text-xs text-slate-400">Auto Captcha Decryption & WhatsApp QR Sync Services Active on this Machine</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-rose-950/40 border-2 border-rose-500/50 rounded-2xl p-6 mb-8 backdrop-blur-xl shadow-2xl shadow-rose-950/50">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-1 md:mt-0">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold text-rose-200">LOCAL ENGINE NOT DETECTED</h3>
              <span className="px-2.5 py-0.5 text-xs bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/30 font-mono">
                SYSTEM NOT READY
              </span>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Required local helper background engine is not running on port 5000 of this PC. Auto Jharsewa Captcha Decryption & WhatsApp QR Sync require Local Host Setup.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={onRetry}
            disabled={isChecking}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Check Again'}
          </button>
          
          <a
            href="https://drive.google.com/uc?export=download&id=1uCwW0U--DJ0il6TmgORoghC2NOsNThn6"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-none px-5 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 border border-rose-400/30"
          >
            <Download className="w-4 h-4" />
            Download Engine Setup
          </a>
        </div>
      </div>
    </div>
  );
}
