import React, { useState, useEffect } from 'react';
import { CardEnhancementUploader } from '../components/CardEnhancementUploader';
import { Sparkles, ShieldCheck, UserCheck, Key, RefreshCw, Cpu, Layers } from 'lucide-react';

export const CardEnhancementSuite: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: string;
    entitlements: string[];
  }>({
    id: 'usr_collector_pro_01',
    name: 'Verified Pro Collector',
    role: 'pro_collector',
    entitlements: ['enhancement.ultimate_sd_upscale', 'enhancement.batch', 'enhancement.export_4k', 'enhancement.ai_restore']
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6">
      {/* Session / Better Auth Header Banner */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <UserCheck size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">{currentUser.name}</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                PRO ACTIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Better Auth Session ID: <span className="text-cyan-400">{currentUser.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck size={14} className="text-cyan-400" />
            <span>Non-S3 Pipeline: Protected Local Storage</span>
          </div>
        </div>
      </div>

      {/* Main Enhancement Suite Uploader */}
      <CardEnhancementUploader />
    </div>
  );
};

export default CardEnhancementSuite;
