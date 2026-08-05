import React, { useState } from 'react';
import { TelemetryPayload } from '../types';
import { Terminal, Copy, Check, X, Cpu, AlertTriangle, Activity, Zap, Code } from 'lucide-react';
import { LiquidGlassContainer } from './LiquidGlassContainer';

interface TelemetryAuditModalProps {
  payload: TelemetryPayload;
  isOpen: boolean;
  onClose: () => void;
}

export const TelemetryAuditModal: React.FC<TelemetryAuditModalProps> = ({
  payload,
  isOpen,
  onClose
}) => {
  const [copiedAudit, setCopiedAudit] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen) return null;

  const jsonString = JSON.stringify(payload, null, 2);

  const fullAuditCommand = `You are an elite LLM Code Auditor. Review this consolidated codebase and error telemetry payload. Identify the root cause of the flagged performance metrics and runtime exceptions, and output optimized, drop-in replacement code blocks.\n\n### UNIFIED TELEMETRY AUDIT LOG (JSON):\n\`\`\`json\n${jsonString}\n\`\`\``;

  const handleCopyAudit = () => {
    navigator.clipboard.writeText(fullAuditCommand);
    setCopiedAudit(true);
    setTimeout(() => setCopiedAudit(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#070d19] border border-cyan-400/40 shadow-[0_0_50px_rgba(0,243,255,0.25)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-cyan-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Single-Pass Telemetry & Error Audit System
                <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-400/30">Ctrl+Shift+A</span>
              </h2>
              <p className="text-xs text-slate-400">Live JSON Payload Builder & LLM Code Audit Prompt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
          {/* Key Metrics Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <LiquidGlassContainer className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Render Rate</span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400">{payload.metrics.fps} FPS</div>
              <div className="text-[10px] text-slate-500">{payload.metrics.frameTimeMs} ms frame time</div>
            </LiquidGlassContainer>

            <LiquidGlassContainer className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>Edge Detection</span>
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400">{payload.metrics.edgeDetectTimeMs} ms</div>
              <div className="text-[10px] text-slate-500">Hybrid Sobel/Ray pass</div>
            </LiquidGlassContainer>

            <LiquidGlassContainer className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>Shader Compile</span>
              </div>
              <div className="text-2xl font-bold font-mono text-purple-400">{payload.metrics.shaderCompileTimeMs} ms</div>
              <div className="text-[10px] text-slate-500">GLSL 3.0 ES shaders</div>
            </LiquidGlassContainer>

            <LiquidGlassContainer className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Caught Errors</span>
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400">{payload.errors.length}</div>
              <div className="text-[10px] text-slate-500">{payload.metrics.webglStateDrops} WebGL state drops</div>
            </LiquidGlassContainer>
          </div>

          {/* Device & Hardware Telemetry */}
          <LiquidGlassContainer className="p-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">GPU & Runtime Context</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-400">
              <div><strong className="text-slate-200">State:</strong> {payload.appState}</div>
              <div><strong className="text-slate-200">Active Card:</strong> {payload.activeCardName}</div>
              <div><strong className="text-slate-200">Resolution:</strong> {payload.resolution}</div>
              <div><strong className="text-slate-200">Renderer:</strong> {payload.webglRenderer}</div>
              <div><strong className="text-slate-200">Memory JS Heap:</strong> {payload.memoryUsage || 'N/A'}</div>
              <div><strong className="text-slate-200">Last Hotkey:</strong> {payload.metrics.lastKeystroke}</div>
            </div>
          </LiquidGlassContainer>

          {/* Raw Live JSON Log Window */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                Live JSON Payload String
              </h4>
              <button
                onClick={handleCopyJson}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'Copied JSON!' : 'Copy Raw JSON'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-black/70 border border-white/10 text-cyan-300 font-mono text-xs overflow-x-auto max-h-48 leading-relaxed">
              {jsonString}
            </pre>
          </div>
        </div>

        {/* Footer Audit Trigger Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-white/10 bg-white/5 backdrop-blur-md">
          <p className="text-xs text-slate-400">
            Clicking below dumps the consolidated codebase & JSON payload formatted for an LLM Code Auditor.
          </p>
          <button
            onClick={handleCopyAudit}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:shadow-[0_0_30px_rgba(0,243,255,0.6)] transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {copiedAudit ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAudit ? 'Copied Audit Command!' : 'Copy One-Click Audit Trigger'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
