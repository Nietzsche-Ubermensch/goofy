import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

export const GpuPerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState({ compileTime: 1.2, memoryUsage: 14.5 });

  useEffect(() => {
    // Simulate real-time GPU telemetry updates
    const interval = setInterval(() => {
      setStats({
        compileTime: +(Math.random() * 0.8 + 1.2).toFixed(2), // 1.2ms - 2.0ms
        memoryUsage: +(Math.random() * 2.5 + 14.0).toFixed(1) // 14.0MB - 16.5MB
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 px-3 py-2 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 text-[10px] text-slate-400 font-mono shadow-2xl">
      <Cpu className="w-4 h-4 text-emerald-400" />
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between gap-4">
          <span>SHADER_COMP:</span>
          <span className="text-emerald-300 font-bold">{stats.compileTime}ms</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>VRAM_ALLOC:</span>
          <span className="text-cyan-300 font-bold">{stats.memoryUsage}MB</span>
        </div>
      </div>
    </div>
  );
};
