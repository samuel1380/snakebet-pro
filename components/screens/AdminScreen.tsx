import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { User } from '../../types';
import { 
  Users, DollarSign, Crown, Trash2, Edit, Save, X, LogOut, 
  Search, Settings, BarChart3, LayoutDashboard, 
  Menu, Bell, ChevronDown, ArrowUpRight, ArrowDownRight, Wallet, History, CreditCard,
  ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, ShoppingBag, Banknote
} from 'lucide-react';
import { getAppConfig, saveAppConfig, AppConfig } from '../../utils/config';

interface AdminScreenProps {
  onLogout: () => void;
}

const SidebarItem = ({ icon, label, active, isOpen, onClick }: { icon: React.ReactNode, label: string, active?: boolean, isOpen?: boolean, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`
      flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group
      ${active 
        ? 'bg-red-600/10 text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.15)]' 
        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
      }
      ${!isOpen && 'justify-center'}
    `}
  >
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    {isOpen && (
      <span className={`font-medium text-sm whitespace-nowrap transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
        {label}
      </span>
    )}
    {isOpen && active && (
      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]"></div>
    )}
  </div>
);

const StatCard = ({ title, value, icon, trend, trendUp, color = "blue" }: { title: string, value: string, icon: React.ReactNode, trend?: string, trendUp?: boolean, color?: "blue" | "emerald" | "purple" | "amber" | "red" }) => {
  const colorMap = {
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", glow: "bg-blue-500/5", hoverGlow: "group-hover:bg-blue-500/10", iconBg: "bg-blue-500/10", iconBorder: "border-blue-500/20" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "bg-emerald-500/5", hoverGlow: "group-hover:bg-emerald-500/10", iconBg: "bg-emerald-500/10", iconBorder: "border-emerald-500/20" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", glow: "bg-purple-500/5", hoverGlow: "group-hover:bg-purple-500/10", iconBg: "bg-purple-500/10", iconBorder: "border-purple-500/20" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "bg-amber-500/5", hoverGlow: "group-hover:bg-amber-500/10", iconBg: "bg-amber-500/10", iconBorder: "border-amber-500/20" },
    red: { bg: "bg-red-500/10", border: "border-red-500/20", glow: "bg-red-500/5", hoverGlow: "group-hover:bg-red-500/10", iconBg: "bg-red-500/10", iconBorder: "border-red-500/20" }
  };
  
  const colors = colorMap[color as keyof typeof colorMap] || colorMap.blue;

  return (
    <div className="bg-[#111113] border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-colors shadow-lg shadow-black/40">
       <div className={`absolute top-0 right-0 p-24 ${colors.glow} rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 ${colors.hoverGlow} transition-colors duration-500`}></div>
       
       <div className="flex justify-between items-start mb-4 relative z-10">
          <div className={`p-2.5 ${colors.iconBg} rounded-xl border ${colors.iconBorder}`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${trendUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
               {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
               {trend}
            </div>
          )}
       </div>
       
       <div className="relative z-10">
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
          <p className="text-2xl font-mono font-bold text-white tracking-tight">{value}</p>
       </div>
    </div>
  );
};

export const AdminScreen: React.FC<AdminScreenProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'deposits' | 'withdrawals' | 'history' | 'settings'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Config State
  const [config, setConfig] = useState<AppConfig>(getAppConfig());
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);
  
  // Dashboard Metrics
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalVips, setTotalVips] = useState(0);

  useEffect(() => {
    loadUsers();
    // Load config initially
    setConfig(getAppConfig());
  }, []);

  const handleSaveConfig = () => {
    setSavingConfig(true);
    // Simulate slight delay for UX
    setTimeout(() => {
        saveAppConfig(config);
        setSavingConfig(false);
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
    }, 800);
  };


  const loadUsers = () => {
    const loadedUsers: User[] = [];
    let deposited = 0;
    let balance = 0;
    let vips = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('snakebet_data_')) {
        try {
          const userData = JSON.parse(localStorage.getItem(key) || '{}');
          if (!userData.username) {
              userData.username = key.replace('snakebet_data_', '');
          }
          loadedUsers.push(userData);
          deposited += (userData.totalDeposited || 0);
          balance += (userData.balance || 0);
          if (userData.isVip) vips++;
        } catch (e) {
          console.error("Error loading user data", key, e);
        }
      }
    }
    
    setUsers(loadedUsers);
    setTotalUsers(loadedUsers.length);
    setTotalDeposited(deposited);
    setTotalBalance(balance);
    setTotalVips(vips);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    localStorage.setItem(`snakebet_data_${editingUser.username}`, JSON.stringify(editingUser));
    loadUsers();
    setEditingUser(null);
  };

  const handleDeleteUser = (username: string) => {
    localStorage.removeItem(`snakebet_data_${username}`);
    localStorage.removeItem(`snakebet_user_${username}`);
    localStorage.removeItem(`snakebet_balance_${username}`);
    loadUsers();
    setShowDeleteConfirm(null);
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allTransactions = users.flatMap(user => 
    (user.transactions || []).map(t => ({ ...t, username: user.username }))
  ).sort((a, b) => b.timestamp - a.timestamp);

  const depositsList = allTransactions.filter(t => t.type === 'DEPOSIT');
  const withdrawalsList = allTransactions.filter(t => t.type === 'WITHDRAW');

  const handleUpdateTransactionStatus = (username: string, transactionId: string, newStatus: 'COMPLETED' | 'REJECTED') => {
      const updatedUsers = users.map(u => {
          if (u.username === username) {
              // Find the transaction first to get amount for refund if needed
              const transaction = u.transactions.find(t => t.id === transactionId);
              let newBalance = u.balance;

              if (newStatus === 'REJECTED' && transaction) {
                  // Refund the amount
                  newBalance += transaction.amount;
              }

              const updatedTransactions = u.transactions.map(t => {
                  if (t.id === transactionId) {
                      return { ...t, status: newStatus };
                  }
                  return t;
              });
              
              const updatedUser = { ...u, transactions: updatedTransactions, balance: newBalance };
              
              // Save to individual user storage key
              if (typeof window !== 'undefined') {
                  localStorage.setItem(`snakebet_data_${username}`, JSON.stringify(updatedUser));
                  // Dispatch event for real-time updates if needed
                  window.dispatchEvent(new Event('storage'));
              }
              
              return updatedUser;
          }
          return u;
      });
      
      setUsers(updatedUsers);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden font-sans">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#111113] border-r border-white/5 flex flex-col transition-all duration-300 z-20`}>
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                {sidebarOpen ? (
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/40 border border-red-500/20">
                            <ShieldCheck size={18} className="text-white" />
                         </div>
                         <span className="font-bold text-lg tracking-tight text-white drop-shadow-sm">SNAKE<span className="text-red-500">BET</span></span>
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-lg shadow-red-900/40 border border-red-500/20">
                        <ShieldCheck size={18} className="text-white" />
                    </div>
                )}
            </div>

            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                <SidebarItem 
                    icon={<LayoutDashboard size={20} />} 
                    label="Dashboard" 
                    active={activeTab === 'dashboard'} 
                    isOpen={sidebarOpen} 
                    onClick={() => setActiveTab('dashboard')}
                />
                <SidebarItem 
                    icon={<Users size={20} />} 
                    label="Jogadores" 
                    active={activeTab === 'users'} 
                    isOpen={sidebarOpen} 
                    onClick={() => setActiveTab('users')}
                />
                <SidebarItem 
                    icon={<Wallet size={20} />} 
                    label="Depósitos" 
                    active={activeTab === 'deposits'} 
                    isOpen={sidebarOpen} 
                    onClick={() => setActiveTab('deposits')}
                />
                <SidebarItem 
                    icon={<ArrowUpRight size={20} />} 
                    label="Saques" 
                    active={activeTab === 'withdrawals'} 
                    isOpen={sidebarOpen} 
                    onClick={() => setActiveTab('withdrawals')}
                />
                <SidebarItem 
                    icon={<History size={20} />} 
                    label="Histórico" 
                    active={activeTab === 'history'} 
                    isOpen={sidebarOpen} 
                    onClick={() => setActiveTab('history')}
                />
                <div className="pt-6 pb-2">
                    <div className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {sidebarOpen && 'Sistema'}
                    </div>
                    <SidebarItem 
                        icon={<Settings size={20} />} 
                        label="Configurações" 
                        active={activeTab === 'settings'} 
                        isOpen={sidebarOpen} 
                        onClick={() => setActiveTab('settings')}
                    />
                </div>
            </div>

            <div className="p-4 border-t border-white/5">
                <button 
                    onClick={onLogout}
                    className={`flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors ${!sidebarOpen && 'justify-center'}`}
                >
                    <LogOut size={20} />
                    {sidebarOpen && <span className="font-medium">Sair do Sistema</span>}
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
            {/* Top Bar */}
            <header className="h-16 bg-[#111113]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <Menu size={20} />
                    </button>
                    <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
                        <span>Painel</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-white font-medium">Dashboard</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            className="bg-[#1a1a1c] border border-white/5 rounded-full py-1.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-red-500/50 w-64 transition-all"
                        />
                    </div>
                    
                    <button className="relative p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
                        <Bell size={20} />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#111113]"></span>
                    </button>
                    
                    <div className="flex items-center gap-3 pl-4 border-l border-white/5">
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-bold text-white">Administrador</div>
                            <div className="text-xs text-gray-500">Super Admin</div>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 border border-white/10 flex items-center justify-center text-sm font-bold shadow-lg">
                            AD
                        </div>
                    </div>
                </div>
            </header>

            {/* Content Scrollable Area */}
            <main className="flex-1 overflow-y-auto p-6 space-y-6 relative bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
                 {/* Background Glow */}
                 <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-red-900/10 via-black/0 to-transparent"></div>
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/3"></div>
                 </div>

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-300">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard 
                                title="GGR Total" 
                                value={`R$ ${totalDeposited.toFixed(2)}`} 
                                icon={<Wallet className="text-emerald-500" />} 
                                trend="+12.5%" 
                                trendUp 
                                color="emerald"
                            />
                            <StatCard 
                                title="Saldo Circulante" 
                                value={`R$ ${totalBalance.toFixed(2)}`} 
                                icon={<CreditCard className="text-blue-500" />} 
                                trend="+5.2%" 
                                trendUp 
                                color="blue"
                            />
                            <StatCard 
                                title="Jogadores Ativos" 
                                value={totalUsers.toString()} 
                                icon={<Users className="text-purple-500" />} 
                                trend="+8" 
                                trendUp 
                                color="purple"
                            />
                            <StatCard 
                                title="Membros VIP" 
                                value={totalVips.toString()} 
                                icon={<Crown className="text-amber-500" />} 
                                trend="Estável" 
                                color="amber"
                            />
                        </div>

                        {/* Welcome Banner */}
                        <div className="bg-gradient-to-r from-red-900/20 to-black/40 border border-white/5 rounded-2xl p-8 text-center relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <h2 className="text-3xl font-bold text-white mb-2 relative z-10">Bem-vindo ao SnakeBet Admin</h2>
                            <p className="text-gray-400 max-w-lg mx-auto relative z-10 mb-6">Painel de controle centralizado. Utilize o menu lateral para gerenciar usuários, transações e configurações do sistema.</p>
                            
                            <div className="flex justify-center gap-4 relative z-10">
                                <button onClick={() => setActiveTab('users')} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold text-white border border-white/10 transition-colors flex items-center gap-2">
                                    <Users size={16} /> Gerenciar Jogadores
                                </button>
                                <button onClick={() => setActiveTab('settings')} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold text-white border border-white/10 transition-colors flex items-center gap-2">
                                    <Settings size={16} /> Configurações
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-[#111113] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-white mb-1">Base de Jogadores</h2>
                                <p className="text-sm text-gray-500">Gerencie contas, saldos e permissões.</p>
                            </div>
                            
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Filtrar por usuário..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-red-900/10 to-transparent text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-red-500/10">
                                        <th className="p-4 pl-6">Usuário</th>
                                        <th className="p-4">Carteira Real</th>
                                        <th className="p-4">Bônus</th>
                                        <th className="p-4">Depósitos</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right pr-6">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredUsers.map(user => (
                                        <tr key={user.username} className="hover:bg-red-500/[0.02] transition-colors group border-b border-white/5 last:border-0">
                                            <td className="p-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[#1a1a1c] flex items-center justify-center border border-white/10 text-sm font-bold text-gray-300">
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white text-sm">{user.username}</div>
                                                        <div className="text-xs text-gray-600">ID: #{Math.floor(Math.random() * 10000)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono text-emerald-400 font-medium text-sm">R$ {user.balance.toFixed(2)}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono text-blue-400 font-medium text-sm">R$ {user.bonusBalance.toFixed(2)}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono text-gray-400 text-sm">R$ {user.totalDeposited?.toFixed(2) || '0.00'}</div>
                                            </td>
                                            <td className="p-4">
                                                {user.isVip ? (
                                                    <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-500/20 uppercase tracking-wide">
                                                        <Crown size={10} fill="currentColor" /> VIP
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 bg-gray-800 text-gray-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-700 uppercase tracking-wide">
                                                        Normal
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => setEditingUser(user)}
                                                        className="p-2 hover:bg-blue-500/10 text-gray-400 hover:text-blue-400 rounded-lg transition-colors"
                                                        title="Editar Detalhes"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setShowDeleteConfirm(user.username)}
                                                        className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                                        title="Excluir Conta"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-12 text-center">
                                                    <div className="flex flex-col items-center justify-center text-gray-500">
                                                        <Search size={48} className="mb-4 opacity-20" />
                                                        <p className="text-sm font-medium">Nenhum usuário encontrado</p>
                                                        <p className="text-xs mt-1">Tente buscar por outro termo</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="p-4 border-t border-white/5 bg-[#161618] flex items-center justify-between text-xs text-gray-500">
                                <span>Mostrando {filteredUsers.length} de {totalUsers} registros</span>
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 bg-white/5 rounded hover:bg-white/10 disabled:opacity-50" disabled>Anterior</button>
                                    <button className="px-3 py-1 bg-white/5 rounded hover:bg-white/10 disabled:opacity-50" disabled>Próximo</button>
                                </div>
                            </div>
                        </div>
                )}

                {activeTab === 'deposits' && (
                    <div className="bg-[#111113] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-white mb-1">Depósitos Recentes</h2>
                                <p className="text-sm text-gray-500">Histórico de entradas de valor via PIX.</p>
                            </div>
                            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
                                <DollarSign size={20} />
                            </div>
                        </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-emerald-900/10 to-transparent text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-emerald-500/10">
                                        <th className="p-4 pl-6">Data</th>
                                        <th className="p-4">Usuário</th>
                                        <th className="p-4">Valor</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {depositsList.map((t, i) => (
                                        <tr key={i} className="hover:bg-emerald-500/[0.02] transition-colors border-b border-white/5 last:border-0">
                                            <td className="p-4 pl-6 text-sm text-gray-400">
                                                {new Date(t.timestamp).toLocaleString()}
                                            </td>
                                            <td className="p-4 font-bold text-white text-sm">
                                                {t.username}
                                            </td>
                                            <td className="p-4 font-mono text-emerald-400 text-sm">
                                                R$ {t.amount.toFixed(2)}
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wide">
                                                    Concluído
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {depositsList.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-12 text-center text-gray-500">
                                                Nenhum depósito registrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'withdrawals' && (
                    <div className="bg-[#111113] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-white mb-1">Solicitações de Saque</h2>
                                <p className="text-sm text-gray-500">Gerencie as saídas de valor e pagamentos.</p>
                            </div>
                            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-500">
                                <ArrowUpRight size={20} />
                            </div>
                        </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-red-900/10 to-transparent text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-red-500/10">
                                        <th className="p-4 pl-6">Data</th>
                                        <th className="p-4">Usuário</th>
                                        <th className="p-4">Valor</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Chave PIX</th>
                                        <th className="p-4 text-right pr-6">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {withdrawalsList.map((t, i) => (
                                        <tr key={i} className="hover:bg-red-500/[0.02] transition-colors border-b border-white/5 last:border-0">
                                            <td className="p-4 pl-6 text-sm text-gray-400">
                                                {new Date(t.timestamp).toLocaleString()}
                                            </td>
                                            <td className="p-4 font-bold text-white text-sm">
                                                {t.username}
                                            </td>
                                            <td className="p-4 font-mono text-red-400 text-sm">
                                                R$ {t.amount.toFixed(2)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide
                                                    ${t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                                      t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                      'bg-red-500/10 text-red-500 border-red-500/20'
                                                    }
                                                `}>
                                                    {t.status === 'COMPLETED' ? 'Pago' : t.status === 'PENDING' ? 'Pendente' : 'Rejeitado'}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-gray-500">
                                                {t.pixKey || 'N/A'}
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                {t.status === 'PENDING' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleUpdateTransactionStatus(t.username, t.id, 'COMPLETED')}
                                                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                                                            title="Aprovar Saque"
                                                        >
                                                            <CheckCircle size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleUpdateTransactionStatus(t.username, t.id, 'REJECTED')}
                                                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
                                                            title="Rejeitar Saque"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {withdrawalsList.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-gray-500">
                                                Nenhum saque registrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-[#111113] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-white mb-1">Histórico de Transações</h2>
                                <p className="text-sm text-gray-500">Todas as movimentações financeiras (Depósitos e Saques).</p>
                            </div>
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-500">
                                <History size={20} />
                            </div>
                        </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-blue-900/10 to-transparent text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-blue-500/10">
                                        <th className="p-4 pl-6">Data</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Usuário</th>
                                        <th className="p-4">Valor</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {allTransactions.map((t, i) => (
                                        <tr key={i} className="hover:bg-blue-500/[0.02] transition-colors border-b border-white/5 last:border-0">
                                            <td className="p-4 pl-6 text-sm text-gray-400">
                                                {new Date(t.timestamp).toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                {t.type === 'DEPOSIT' ? (
                                                     <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                                                        <ArrowDownRight size={14} /> DEPÓSITO
                                                     </span>
                                                ) : (
                                                     <span className="text-red-400 font-bold text-xs flex items-center gap-1">
                                                        <ArrowUpRight size={14} /> SAQUE
                                                     </span>
                                                )}
                                            </td>
                                            <td className="p-4 font-bold text-white text-sm">
                                                {t.username}
                                            </td>
                                            <td className="p-4 font-mono text-white text-sm">
                                                R$ {t.amount.toFixed(2)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide
                                                    ${t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                                      t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                      'bg-red-500/10 text-red-500 border-red-500/20'
                                                    }
                                                `}>
                                                    {t.status === 'COMPLETED' ? 'Concluído' : t.status === 'PENDING' ? 'Pendente' : 'Rejeitado'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {allTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-gray-500">
                                                Nenhuma transação registrada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-4xl mx-auto space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">Configurações do Sistema</h2>
                                <p className="text-gray-500 text-sm">Gerencie limites financeiros e preços da loja.</p>
                            </div>
                            <button 
                                onClick={handleSaveConfig}
                                disabled={savingConfig}
                                className={`
                                    flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg
                                    ${configSuccess 
                                        ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                                    }
                                    ${savingConfig && 'opacity-70 cursor-wait'}
                                `}
                            >
                                {configSuccess ? (
                                    <>
                                        <CheckCircle size={18} />
                                        Salvo com Sucesso!
                                    </>
                                ) : (
                                    <>
                                        {savingConfig ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                        {savingConfig ? 'Salvando...' : 'Salvar Alterações'}
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Finance Settings */}
                            <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-16 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <div className="flex items-center gap-3 mb-6 relative z-10">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
                                        <DollarSign size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Financeiro</h3>
                                </div>
                                
                                <div className="space-y-4 relative z-10">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Depósito Mínimo (R$)</label>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold group-focus-within:text-emerald-400 transition-colors">R$</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={config.minDeposit}
                                                onChange={(e) => setConfig({...config, minDeposit: parseFloat(e.target.value) || 0})}
                                                className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white font-mono focus:outline-none focus:border-emerald-500/50 focus:bg-[#09090b] transition-all"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Valor mínimo permitido para novos depósitos via PIX.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Saque Mínimo (R$)</label>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 font-bold group-focus-within:text-blue-400 transition-colors">R$</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={config.minWithdraw}
                                                onChange={(e) => setConfig({...config, minWithdraw: parseFloat(e.target.value) || 0})}
                                                className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white font-mono focus:outline-none focus:border-blue-500/50 focus:bg-[#09090b] transition-all"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Valor mínimo para solicitações de saque.</p>
                                    </div>

                                    {/* Auto Withdraw Section */}
                                    <div className="pt-4 border-t border-white/5 mt-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Saque Automático</label>
                                            <div 
                                                onClick={() => setConfig({...config, autoWithdrawEnabled: !config.autoWithdrawEnabled})}
                                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${config.autoWithdrawEnabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${config.autoWithdrawEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </div>
                                        </div>

                                        {config.autoWithdrawEnabled && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Limite Automático (R$)</label>
                                                <div className="relative group">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold group-focus-within:text-emerald-400 transition-colors">R$</span>
                                                    <input 
                                                        type="number"
                                                        step="0.01"
                                                        value={config.autoWithdrawLimit}
                                                        onChange={(e) => setConfig({...config, autoWithdrawLimit: parseFloat(e.target.value) || 0})}
                                                        className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white font-mono focus:outline-none focus:border-emerald-500/50 focus:bg-[#09090b] transition-all"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Saques abaixo deste valor serão aprovados automaticamente.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Store Settings */}
                            <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-16 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <div className="flex items-center gap-3 mb-6 relative z-10">
                                    <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-500">
                                        <ShoppingBag size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Preços da Loja</h3>
                                </div>
                                
                                <div className="space-y-4 relative z-10">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Escudo</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-bold text-xs">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={config.prices.SHIELD}
                                                    onChange={(e) => setConfig({...config, prices: {...config.prices, SHIELD: parseFloat(e.target.value) || 0}})}
                                                    className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ímã</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-bold text-xs">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={config.prices.MAGNET}
                                                    onChange={(e) => setConfig({...config, prices: {...config.prices, MAGNET: parseFloat(e.target.value) || 0}})}
                                                    className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vida Extra</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-bold text-xs">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={config.prices.EXTRA_LIFE}
                                                    onChange={(e) => setConfig({...config, prices: {...config.prices, EXTRA_LIFE: parseFloat(e.target.value) || 0}})}
                                                    className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Caixa Misteriosa</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-bold text-xs">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={config.prices.MYSTERY_BOX}
                                                    onChange={(e) => setConfig({...config, prices: {...config.prices, MYSTERY_BOX: parseFloat(e.target.value) || 0}})}
                                                    className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-white/5 mt-2">
                                        <label className="block text-xs font-bold text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Crown size={12} /> Assinatura VIP (30 dias)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-bold">R$</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={config.prices.VIP}
                                                onChange={(e) => setConfig({...config, prices: {...config.prices, VIP: parseFloat(e.target.value) || 0}})}
                                                className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white font-mono focus:outline-none focus:border-amber-500/50 focus:bg-[#09090b] transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Affiliate Settings */}
                            <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-16 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                            <Users className="text-blue-500" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Sistema de Afiliados</h3>
                                            <p className="text-gray-500 text-xs">Configure as comissões de CPA e RevShare.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                                        {/* CPA Value */}
                                        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-blue-500/30 transition-all group flex flex-col h-full">
                                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">CPA (Valor)</label>
                                            <div className="relative mb-3">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 text-xl font-bold">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={config.cpaValue}
                                                    onChange={(e) => setConfig({...config, cpaValue: parseFloat(e.target.value) || 0})}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-14 pr-4 text-white font-mono text-2xl font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-auto">Valor fixo pago ao afiliado.</p>
                                        </div>

                                        {/* CPA Min Deposit */}
                                        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-blue-500/30 transition-all group flex flex-col h-full">
                                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Depósito Mínimo CPA</label>
                                            <div className="relative mb-3">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 text-xl font-bold">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={config.cpaMinDeposit}
                                                    onChange={(e) => setConfig({...config, cpaMinDeposit: parseFloat(e.target.value) || 0})}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-14 pr-4 text-white font-mono text-2xl font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-auto">Valor mínimo para ativar o CPA.</p>
                                        </div>

                                        {/* Real RevShare */}
                                        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-green-500/30 transition-all group flex flex-col h-full">
                                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">RevShare Real (%)</label>
                                            <div className="relative mb-3">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 text-xl font-bold">%</span>
                                                <input 
                                                    type="number"
                                                    step="1"
                                                    max="100"
                                                    value={config.realRevShare}
                                                    onChange={(e) => setConfig({...config, realRevShare: parseFloat(e.target.value) || 0})}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-14 pr-4 text-white font-mono text-2xl font-bold focus:outline-none focus:border-green-500/50 transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-auto">Porcentagem real paga sobre as perdas.</p>
                                        </div>

                                        {/* Fake RevShare */}
                                        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:border-purple-500/30 transition-all group flex flex-col h-full">
                                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">RevShare Visual (%)</label>
                                            <div className="relative mb-3">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500 text-xl font-bold">%</span>
                                                <input 
                                                    type="number"
                                                    step="1"
                                                    max="100"
                                                    value={config.fakeRevShare}
                                                    onChange={(e) => setConfig({...config, fakeRevShare: parseFloat(e.target.value) || 0})}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-14 pr-4 text-white font-mono text-2xl font-bold focus:outline-none focus:border-purple-500/50 transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-auto">Porcentagem exibida para o usuário.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Integration Settings */}
                            <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-16 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                                            <Banknote className="text-green-500" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Integração PagVIVA</h3>
                                            <p className="text-gray-500 text-xs">Credenciais para processamento de pagamentos PIX.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {/* Token */}
                                        <div className="flex flex-col h-full">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Token</label>
                                            <div className="relative group flex-1">
                                                <input 
                                                    type="password"
                                                    value={config.pagViva?.token || ''}
                                                    onChange={(e) => setConfig({
                                                        ...config, 
                                                        pagViva: { ...config.pagViva, token: e.target.value }
                                                    })}
                                                    placeholder="Token..."
                                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 px-4 text-white font-mono focus:outline-none focus:border-green-500/50 focus:bg-[#09090b] transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Secret */}
                                        <div className="flex flex-col h-full">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Secret</label>
                                            <div className="relative group flex-1">
                                                <input 
                                                    type="password"
                                                    value={config.pagViva?.secret || ''}
                                                    onChange={(e) => setConfig({
                                                        ...config, 
                                                        pagViva: { ...config.pagViva, secret: e.target.value }
                                                    })}
                                                    placeholder="Secret..."
                                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 px-4 text-white font-mono focus:outline-none focus:border-green-500/50 focus:bg-[#09090b] transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* API Key */}
                                        <div className="flex flex-col h-full">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">API Key</label>
                                            <div className="relative group flex-1">
                                                <input 
                                                    type="password"
                                                    value={config.pagViva?.apiKey || ''}
                                                    onChange={(e) => setConfig({
                                                        ...config, 
                                                        pagViva: { ...config.pagViva, apiKey: e.target.value }
                                                    })}
                                                    placeholder="X-API-KEY..."
                                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 px-4 text-white font-mono focus:outline-none focus:border-green-500/50 focus:bg-[#09090b] transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>

        {/* Edit Modal */}
        {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#161618]">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                Editar Jogador
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">ID: {editingUser.username}</p>
                        </div>
                        <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-white/5 pb-2">Financeiro</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Saldo Real (BRL)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">R$</span>
                                        <input 
                                            type="number" 
                                            value={editingUser.balance}
                                            onChange={(e) => setEditingUser({...editingUser, balance: parseFloat(e.target.value)})}
                                            className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 pl-10 pr-3 text-white font-mono text-sm focus:border-emerald-500/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Saldo Bônus (BRL)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-bold">R$</span>
                                        <input 
                                            type="number" 
                                            value={editingUser.bonusBalance}
                                            onChange={(e) => setEditingUser({...editingUser, bonusBalance: parseFloat(e.target.value)})}
                                            className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 pl-10 pr-3 text-white font-mono text-sm focus:border-blue-500/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Histórico de Depósitos</label>
                                    <input 
                                        type="number" 
                                        value={editingUser.totalDeposited || 0}
                                        onChange={(e) => setEditingUser({...editingUser, totalDeposited: parseFloat(e.target.value)})}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 px-3 text-white font-mono text-sm focus:border-gray-500/50 focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-white/5 pb-2">Conta & VIP</h4>
                            
                            <div className="p-4 bg-[#09090b] rounded-xl border border-white/5 cursor-pointer hover:border-amber-500/30 transition-colors"
                                 onClick={() => setEditingUser({...editingUser, isVip: !editingUser.isVip})}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-white flex items-center gap-2">
                                        <Crown size={16} className={editingUser.isVip ? "text-amber-500" : "text-gray-600"} />
                                        Status VIP
                                    </span>
                                    <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${editingUser.isVip ? 'bg-amber-500' : 'bg-gray-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingUser.isVip ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {editingUser.isVip ? 'Usuário possui benefícios exclusivos e taxas reduzidas.' : 'Usuário padrão sem benefícios VIP.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Rollover Atual</label>
                                    <input 
                                        type="number" 
                                        value={editingUser.rollover?.current || 0}
                                        onChange={(e) => setEditingUser({
                                            ...editingUser, 
                                            rollover: { ...editingUser.rollover, current: parseFloat(e.target.value) }
                                        })}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 px-3 text-white font-mono text-sm focus:border-purple-500/50 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">Rollover Meta</label>
                                    <input 
                                        type="number" 
                                        value={editingUser.rollover?.target || 0}
                                        onChange={(e) => setEditingUser({
                                            ...editingUser, 
                                            rollover: { ...editingUser.rollover, target: parseFloat(e.target.value) }
                                        })}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-lg py-2.5 px-3 text-white font-mono text-sm focus:border-purple-500/50 focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-white/10 bg-[#161618] flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveUser} className="bg-blue-600 hover:bg-blue-700 border-none text-white shadow-lg shadow-blue-900/20">
                            <Save size={18} className="mr-2" />
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-[#111113] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Excluir Conta?</h3>
                    <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                        Esta ação removerá permanentemente o usuário <span className="text-white font-bold bg-white/10 px-1 rounded">{showDeleteConfirm}</span> e todos os dados financeiros associados.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)} className="flex-1 border-white/10">Cancelar</Button>
                        <Button 
                            variant="primary" 
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-900/20"
                            onClick={() => handleDeleteUser(showDeleteConfirm)}
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

