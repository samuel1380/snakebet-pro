import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
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
              setError("Falha ao autenticar administrador.");
              setLoading(false);
              return;
          }
          localStorage.setItem('snakebet_admin_token', data.token);
          onAdminLogin();
      } catch (err: any) {
          setError(err?.error || err?.message || "Falha ao autenticar administrador.");
          setLoading(false);
      }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-x-hidden bg-black">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      <div className="absolute top-0 -left-4 w-72 h-72 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      
      <div className="w-full max-w-md glass-panel p-1 rounded-3xl relative z-10 shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="bg-gray-900/90 rounded-[22px] p-8 backdrop-blur-xl border border-red-900/30">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-red-600 blur-xl opacity-20 rounded-full animate-pulse-fast"></div>
              <div className="relative p-4 bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-red-500/30 shadow-inner">
                <Lock className="w-10 h-10 text-red-500" />
              </div>
            </div>
            
            <h1 className="text-3xl font-display font-black text-white mb-1 tracking-tight">
              ADMIN<span className="text-red-600">PANEL</span>
            </h1>
            <p className="text-gray-500 text-xs font-bold tracking-widest uppercase">
              Área Restrita
            </p>
          </div>

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div className="space-y-4">
                <Input 
                  label="Senha de Acesso" 
                  type="password"
                  placeholder="Senha do sistema" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  icon={<Lock size={18} />}
                  disabled={loading}
                />
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2 animate-pulse">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            <Button 
              type="submit" 
              variant="primary" 
              fullWidth 
              disabled={loading}
              className="mt-4 py-3 group relative overflow-hidden bg-red-700 hover:bg-red-800 border-red-900 text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  Verificando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                    <Lock size={18} />
                    ACESSAR SISTEMA
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
             <button onClick={onBack} className="text-xs text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
                Voltar para o site
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
