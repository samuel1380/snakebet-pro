import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Lock, ArrowRight, AlertCircle, ShieldAlert, Fingerprint, Server, Activity } from 'lucide-react';
import { api } from '../../services/api';

interface AdminLoginScreenProps {
  onAdminLogin: () => void;
  onBack?: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onAdminLogin, onBack }) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.adminLogin(adminPassword);
      if (!data?.token) {
        setError("Acesso Negado: Credenciais inválidas.");
        setLoading(false);
        return;
      }
      localStorage.setItem('snakebet_admin_token', data.token);
      onAdminLogin();
    } catch (err: any) {
      setError(err?.error || err?.message || "Acesso Negado: Tentativa registrada.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden bg-[#050505]">
      {/* High-End Security Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#050505] to-[#050505]"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>

      {/* Animated Radar/Scanner Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50 shadow-[0_0_15px_#10b981] animate-scanner"></div>

      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-green-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Network Status Indicator */}
      <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-black/50 border border-emerald-500/20 rounded-full backdrop-blur-md">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
        <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest flex items-center gap-1.5">
          <Activity size={10} /> Secure Connection
        </span>
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* Main Glass Panel */}
        <div className="bg-[#0a0a0c]/80 backdrop-blur-2xl rounded-3xl p-8 border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden group">

          {/* Internal Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-xl"></div>

          <div className="relative z-10">
            <div className="flex flex-col items-center mb-10 mt-4">
              <div className="relative mb-6">
                {/* Rotating Security Rings */}
                <div className="absolute -inset-4 border border-emerald-500/20 rounded-full animate-spin-slow"></div>
                <div className="absolute -inset-2 border-t border-r border-emerald-400/40 rounded-full animate-spin-reverse-slow"></div>

                <div className="relative p-5 bg-gradient-to-br from-[#111] to-black rounded-2xl border border-white/10 shadow-2xl overflow-hidden group-hover:border-emerald-500/50 transition-colors duration-500">
                  <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Server className="w-10 h-10 text-emerald-400 relative z-10" />
                </div>
              </div>

              <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                SYS<span className="text-emerald-500">ADMIN</span>
              </h1>
              <p className="text-gray-500 text-[10px] font-mono mt-2 tracking-[0.3em] uppercase opacity-70">
                Authorized Personnel Only
              </p>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-6">
              <div className="space-y-4">
                <Input
                  label="Master Key"
                  type="password"
                  placeholder="Insira a chave de criptografia"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  icon={<Fingerprint size={18} className="text-emerald-500" />}
                  disabled={loading}
                  className="font-mono tracking-widest bg-black/50 border-white/10 focus:border-emerald-500/50"
                />
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3 animate-in shake duration-300">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-bold uppercase text-[10px] tracking-wider opacity-80 mb-0.5">Violação de Acesso</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={loading}
                className="py-4 mt-2 group relative overflow-hidden bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-widest border-0 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300"
              >
                {loading ? (
                  <span className="flex items-center gap-3 justify-center w-full">
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    <span className="uppercase text-xs">Descriptografando...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-between w-full px-2">
                    <span className="uppercase text-xs">Unlock System</span>
                    <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform duration-300" />
                  </span>
                )}
              </Button>
            </form>

            {/* Footer Warning */}
            <div className="mt-8 border-t border-white/5 pt-6 flex flex-col items-center justify-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <Lock size={10} /> End-to-End Encrypted
              </div>
              <button onClick={onBack} className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2 group">
                <ArrowRight size={12} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                Retornar ao Lobby Público
              </button>
            </div>
          </div>
        </div>
      </div>
      );
};
