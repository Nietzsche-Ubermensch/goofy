import React from 'react';
import { Settings, X, Shield, Server } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-[#00f3ff] holo-text">
      <div className="w-full max-w-md bg-black/60 holo-panel rounded-sm relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,243,255,0.2)] bg-black/40">
          <div className="flex items-center gap-2">
            <Settings className="text-[#00f3ff]" size={18} />
            <h2 className="text-sm font-semibold text-[#00f3ff] font-mono">System Configuration</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[rgba(0,243,255,0.5)] hover:text-[#00f3ff] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3 bg-[rgba(0,243,255,0.1)] border border-[rgba(0,243,255,0.3)] rounded-sm holo-border">
            <Shield className="text-[#00f3ff] shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-[rgba(0,243,255,0.8)] leading-relaxed font-mono">
              For enhanced security, API keys are no longer managed in the client application.
            </p>
          </div>

          <div className="flex items-start gap-4 p-4 bg-black/40 border border-[rgba(0,243,255,0.2)] rounded-sm">
             <div className="p-2 border border-[rgba(0,243,255,0.3)] rounded-sm bg-[rgba(0,243,255,0.1)]">
                 <Server size={20} className="text-[#00f3ff]" />
             </div>
             <div>
                 <h3 className="text-sm font-bold text-[#00f3ff] mb-1 font-mono uppercase tracking-widest">Server-Side Storage</h3>
                 <p className="text-xs text-[rgba(0,243,255,0.6)] leading-relaxed font-mono">
                   Please configure your API keys dynamically using the <b>.env</b> file located at the root of the project repository.
                   <br/><br/>
                   Required specific environment variables:
                   <ul className="list-disc pl-4 mt-2">
                      <li>GEMINI_API_KEY</li>
                      <li>OPENROUTER_API_KEY</li>
                      <li>VENICE_API_KEY</li>
                      <li>OPENAI_API_KEY</li>
                      <li>XAI_API_KEY</li>
                   </ul>
                 </p>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(0,243,255,0.2)] bg-black/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-sm text-xs font-medium holo-button flex items-center gap-1.5 transition-colors font-mono uppercase"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
