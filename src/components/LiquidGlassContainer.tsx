import React from 'react';

interface LiquidGlassContainerProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

export const LiquidGlassContainer: React.FC<LiquidGlassContainerProps> = ({
  children,
  className = '',
  onClick,
  active = false
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden transition-all duration-300 rounded-2xl border ${
        active
          ? 'border-cyan-400/50 shadow-[0_0_25px_rgba(0,243,255,0.25)]'
          : 'border-white/12 hover:border-white/25 shadow-2xl'
      } ${className}`}
      style={{
        backdropFilter: 'blur(25px) saturate(180%)',
        WebkitBackdropFilter: 'blur(25px) saturate(180%)',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        boxShadow: active
          ? 'inset 0 0 1px 1px rgba(255, 255, 255, 0.2), 0 0 25px rgba(0, 243, 255, 0.2)'
          : 'inset 0 0 1px 1px rgba(255, 255, 255, 0.12), 0 20px 40px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Light Refraction Glint Overlay on Hover / Active */}
      <div className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transform transition-transform duration-1000" />
      {children}
    </div>
  );
};
