import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { User } from '../../types';
import { Gamepad2, User as UserIcon, Lock, ArrowRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Additional fields for MySQL Register
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (username.length < 3) {
      setError("O usuário deve ter pelo menos 3 caracteres.");
      return;
    }

    if (isRegister) {
        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }
        if (!email || !cpf || !phone) {
             setError("Preencha todos os campos (Email, CPF, Telefone).");
             return;
        }
    }

    setLoading(true);

    try {
        let response;
        if (isRegister) {
            const invitedBy = localStorage.getItem('snakebet_referrer');
            response = await api.register({
                username, 
                password,
                email,
                cpf,
                phone,
                invitedBy
            });
        } else {
            response = await api.login({ username, password });
        }

        if (response.token) {
            localStorage.setItem('snakebet_token', response.token);
            localStorage.setItem('snakebet_last_user', response.user.username);
            
            // Build full User object merging API data with local defaults if needed
            // For now, we trust the API or fall back to defaults
            const apiUser = response.user;
            
            const userObj: User = { 
                username: apiUser.username, 
                balance: apiUser.balance || 0,
                bonusBalance: apiUser.bonusBalance || 0,
                isVip: apiUser.is_vip || false,
                vipExpiry: apiUser.vip_expiry || 0,
                dailyBonusClaims: 0, // Load from API later
                boxTracker: { count: 0, totalSpent: 0 },
                transactions: [],
                rollover: { current: 0, target: 0 },
                lastDailyBonus: 0,
                consecutiveFreeClaims: 0,
                totalDeposited: 0,
                inventory: { shields: 0, magnets: 0, extraLives: 0 },
                referrals: [],
                invitedBy: apiUser.invitedBy,
                affiliateEarnings: apiUser.affiliateEarnings
            };
            
            onLogin(userObj);
        }
    } catch (err: any) {
        console.error("Auth Error", err);
        // Fallback to LocalStorage Logic if API fails (e.g. Local Mode)
        // This ensures the user can still test locally without running the backend
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('404') || err.message.includes('502') || err.message.includes('503') || err.message.includes('504'))) {
            console.warn("Backend offline, using local fallback");
            
            // Simulate successful login/register locally
            const localUser: User = {
                username: username,
                balance: 0,
                bonusBalance: 0,
                isVip: false,
                vipExpiry: 0,
                dailyBonusClaims: 0,
                boxTracker: { count: 0, totalSpent: 0 },
                transactions: [],
                rollover: { current: 0, target: 0 },
                lastDailyBonus: 0,
                consecutiveFreeClaims: 0,
                totalDeposited: 0,
                inventory: { shields: 0, magnets: 0, extraLives: 0 },
                referrals: [],
                invitedBy: undefined,
                affiliateEarnings: { cpa: 0, revShare: 0 }
            };

            // Check if user already exists in local storage to preserve balance
            const existingData = localStorage.getItem(`snakebet_data_${username}`);
            if (existingData) {
                const parsed = JSON.parse(existingData);
                localUser.balance = parsed.balance || 0;
                localUser.bonusBalance = parsed.bonusBalance || 0;
                // ... restore other fields if needed
            }

            localStorage.setItem('snakebet_token', 'local_token_' + Date.now());
            localStorage.setItem('snakebet_last_user', username);
            onLogin(localUser);
            return;
        }
        
        // Handle actual API errors (e.g. 401, 403)
        {
             // Try to extract the most meaningful error message
             const errorMessage = err.error || err.message || err.msg || "Erro ao autenticar. Verifique seus dados.";
             setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
             setLoading(false);
        }
    }
  };

  const handleLocalAuth = () => {
    // Simulate API delay
    setTimeout(() => {
      const userKey = `snakebet_user_${username.toLowerCase()}`;
      const userExists = localStorage.getItem(userKey);

      if (isRegister) {
        if (userExists) {
            setError("Este nome de usuário já está em uso (Local).");
            setLoading(false);
            return;
        }
        // Register new user
        const newUser = { 
            id: Date.now(), // Generate a persistent local ID
            username, 
            password 
        };
        localStorage.setItem(userKey, JSON.stringify(newUser));
        
        // Handle Referral
        const invitedBy = localStorage.getItem('snakebet_referrer');
        const validReferrer = (invitedBy && invitedBy !== username) ? invitedBy : undefined;

        // Create initial user object
        const userObj: User = { 
            username, 
            balance: 0,
            bonusBalance: 0,
            isVip: false,
            vipExpiry: 0,
            dailyBonusClaims: 0,
            boxTracker: { count: 0, totalSpent: 0 },
            transactions: [],
            rollover: { current: 0, target: 0 },
            lastDailyBonus: 0,
            consecutiveFreeClaims: 0,
            totalDeposited: 0,
            inventory: { shields: 0, magnets: 0, extraLives: 0 },
            referrals: [],
            invitedBy: validReferrer
        };

        if (validReferrer) {
            try {
                const referrerKey = `snakebet_data_${validReferrer}`;
                const referrerDataStr = localStorage.getItem(referrerKey);
                if (referrerDataStr) {
                    const referrerData = JSON.parse(referrerDataStr);
                    if (!referrerData.referrals) referrerData.referrals = [];
                    // Check if already referred (shouldn't happen on fresh register but good for safety)
                    if (!referrerData.referrals.some((r: any) => r.username === username)) {
                        referrerData.referrals.push({
                            username: username,
                            date: new Date().toISOString(),
                            totalDeposited: 0,
                            totalWagered: 0
                        });
                        localStorage.setItem(referrerKey, JSON.stringify(referrerData));
                    }
                }
            } catch (e) {
                console.error("Error updating referrer", e);
            }
        }

        localStorage.setItem(`snakebet_balance_${username}`, '0'); // Start with 0 balance
        onLogin(userObj);
      } else {
        if (!userExists) {
            setError("Usuário não encontrado. Verifique ou cadastre-se (Local).");
            setLoading(false);
            return;
        }
        
        try {
            const userData = JSON.parse(userExists);
            if (userData.password !== password) {
                setError("Senha incorreta (Local).");
                setLoading(false);
                return;
            }
            
            // Try to load full user data first (for inventory, referrals, etc.)
            const fullDataKey = `snakebet_data_${username}`;
            const fullDataStr = localStorage.getItem(fullDataKey);
            
            if (fullDataStr) {
                try {
                    const fullData = JSON.parse(fullDataStr);
                    onLogin({
                        ...fullData,
                        username // Ensure username matches login
                    });
                    return;
                } catch (e) {
                    console.error("Error parsing full user data", e);
                }
            }

            // Fallback for legacy data (only balance)
            const savedBalance = localStorage.getItem(`snakebet_balance_${username}`);
            const balance = savedBalance ? parseFloat(savedBalance) : 0;
            onLogin({ 
                username, 
                balance,
                bonusBalance: 0,
                isVip: false,
                vipExpiry: 0,
                dailyBonusClaims: 0,
                boxTracker: { count: 0, totalSpent: 0 },
                transactions: [],
                rollover: { current: 0, target: 0 },
                lastDailyBonus: 0,
                consecutiveFreeClaims: 0,
                totalDeposited: 0,
                inventory: { shields: 0, magnets: 0, extraLives: 0 },
                referrals: []
            });
        } catch (e) {
            setError("Erro ao ler dados do usuário (Local).");
            setLoading(false);
        }
      }
    }, 1500);
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-x-hidden bg-neon-dark">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      <div className="absolute top-0 -left-4 w-72 h-72 bg-neon-purple rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-neon-blue rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-neon-green rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md glass-panel p-1 rounded-3xl relative z-10 shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="bg-black/60 rounded-[22px] p-8 backdrop-blur-xl border border-white/5">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4 group cursor-pointer hover:scale-105 transition-transform">
              <div className="absolute inset-0 bg-neon-green blur-xl opacity-40 rounded-full animate-pulse-fast group-hover:opacity-60"></div>
              <div className="relative p-4 bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-neon-green/30 shadow-inner">
                <Gamepad2 className="w-10 h-10 text-neon-green" />
              </div>
            </div>
            
            <h1 className="text-3xl font-display font-black text-white mb-1 tracking-tight text-glow">
              SNAKE<span className="text-neon-green">BET</span>
            </h1>
            <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">
              {isRegister ? 'Crie sua conta' : 'Acesse sua conta'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
                <Input 
                  label="Usuário" 
                  placeholder="Seu nome de jogador" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={15}
                  icon={<UserIcon size={18} />}
                  disabled={loading}
                />
                
                <Input 
                  label="Senha" 
                  type="password"
                  placeholder="Sua senha secreta" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={18} />}
                  disabled={loading}
                />

                {isRegister && (
                    <div className="animate-in slide-in-from-top-2 fade-in duration-300 space-y-4">
                        <Input 
                        label="Confirmar Senha" 
                        type="password"
                        placeholder="Repita sua senha" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        icon={<Lock size={18} />}
                        disabled={loading}
                        />

                        <Input 
                        label="Email" 
                        type="email"
                        placeholder="seu@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        icon={<UserIcon size={18} />}
                        disabled={loading}
                        />

                        <Input 
                        label="CPF" 
                        placeholder="000.000.000-00" 
                        value={cpf}
                        onChange={(e) => setCpf(e.target.value)}
                        maxLength={14}
                        icon={<UserIcon size={18} />}
                        disabled={loading}
                        />

                        <Input 
                        label="Telefone" 
                        placeholder="(00) 00000-0000" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={15}
                        icon={<UserIcon size={18} />}
                        disabled={loading}
                        />
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2 animate-pulse">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            <Button 
              type="submit" 
              variant="neon" 
              fullWidth 
              disabled={loading}
              className="mt-4 py-3 group relative overflow-hidden"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                  Processando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                    {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
                    {isRegister ? 'CRIAR CONTA' : 'ENTRAR'}
                    {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <button 
                type="button"
                onClick={toggleMode}
                className="text-gray-400 text-sm hover:text-white transition-colors flex items-center justify-center gap-2 w-full py-2 rounded-lg hover:bg-white/5"
            >
                {isRegister ? 'Já tem uma conta? Fazer Login' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};