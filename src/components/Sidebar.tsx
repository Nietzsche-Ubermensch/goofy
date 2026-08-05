import React, { useState } from 'react';
import { Crop, Layers, Wand2, MessageSquare, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import SettingsModal from './SettingsModal';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: 'cropper' | 'batch' | 'generator' | 'chat') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navItems = [
    { id: 'cropper', label: 'Single Card Editor', icon: Crop, desc: 'Quad crop & GPU enhancement' },
    { id: 'batch', label: 'Batch Processor', icon: Layers, desc: 'Multi-card queue & ZIP export' },
    { id: 'generator', label: 'Card Art Generator', icon: Wand2, desc: 'Create custom card artwork' },
    { id: 'chat', label: 'Card Assistant', icon: MessageSquare, desc: 'Grading & damage analysis' },
  ];

  return (
    <aside className="w-64 bg-[#0f172a] border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-30 shadow-xl select-none">
      {/* Brand Header */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-800/80 bg-slate-900/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Sparkles size={20} className="fill-white/20" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            CardCrop Studio
          </h1>
          <span className="text-[11px] text-slate-400 font-medium block">Trading Card Suite</span>
        </div>
      </div>
      
      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 font-mono">
          WORKSPACES
        </div>
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as any)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex items-center gap-3 ${
                isActive 
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold leading-tight truncate">{item.label}</div>
                <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer Settings */}
      <div className="p-3 bg-slate-900/80 border-t border-slate-800">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-medium border border-slate-800"
        >
          <Settings size={15} className="text-slate-400" />
          <span>API & Model Settings</span>
        </button>

        <div className="mt-2 flex items-center justify-between px-2 py-1 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-400" />
            Local WebGL Engine
          </span>
          <span className="text-slate-400">v2.4</span>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </aside>
  );
};

export default Sidebar;