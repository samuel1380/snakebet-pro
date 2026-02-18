import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <label className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-neon-green transition-colors z-10">
            {icon}
          </div>
        )}
        <input 
          className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/50 focus:bg-black/60 outline-none transition-all duration-300 font-medium ${icon ? 'pl-12' : ''} ${className}`}
          {...props}
        />
        {/* Glow effect on focus */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon-green/20 to-neon-blue/20 opacity-0 group-focus-within:opacity-10 pointer-events-none transition-opacity duration-300" />
      </div>
      {error && <span className="text-red-400 text-xs font-medium ml-1 flex items-center gap-1">⚠️ {error}</span>}
    </div>
  );
};