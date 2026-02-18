import React from 'react';
import { Button } from '../ui/Button';
import { Trophy, Frown, RefreshCw, Home, Sparkles, Wallet } from 'lucide-react';

interface GameOverScreenProps {
  winAmount: number;
  betAmount: number; 
  balance: number;
  onRestart: () => void;
  onHome: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winAmount, betAmount, balance, onRestart, onHome }) => {
  const isWin = winAmount > 0;
  
  return (
    <div className="min-h-screen bg-neon-dark flex items-center justify-center p-6 relative overflow-hidden">
        {/* Intense Background Effects */}
        {isWin ? (
             <div className="absolute inset-0">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-green/20 rounded-full blur-[120px] animate-pulse"></div>
                 <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neon-green/10 via-transparent to-transparent"></div>
             </div>
        ) : (
            <div className="absolute inset-0">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/20 rounded-full blur-[120px]"></div>
            </div>
        )}

        {/* Balance Status HUD */}
        <div className="absolute top-6 right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-700 delay-200">
            <div className="glass-panel px-5 py-3 rounded-2xl border border-white/10 flex flex-col items-end shadow-2xl backdrop-blur-xl">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Wallet size={12} className="text-neon-green" /> Saldo Atual
                </span>
                <span className="font-display font-black text-2xl text-white text-glow">
                    R$ {balance.toFixed(2)}
                </span>
            </div>
        </div>

        <div className="relative z-10 w-full max-w-sm glass-panel p-1 rounded-[32px] shadow-2xl animate-in zoom-in duration-500 border border-white/10">
            <div className="bg-black/60 backdrop-blur-xl rounded-[28px] p-8 text-center overflow-hidden relative">
                
                {/* Shine effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                <div className="flex justify-center mb-6 relative">
                    {isWin && <div className="absolute inset-0 bg-neon-green/30 blur-2xl rounded-full"></div>}
                    <div className={`relative p-6 rounded-full border-4 ${isWin ? 'bg-neon-green/10 border-neon-green text-neon-green' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                        {isWin ? <Trophy size={48} fill="currentColor" className="animate-bounce" /> : <Frown size={48} />}
                    </div>
                </div>

                <h1 className={`text-4xl font-black font-display mb-2 uppercase italic tracking-tighter ${isWin ? 'text-white text-glow-green' : 'text-red-500'}`}>
                    {isWin ? 'Big Win!' : 'Crashed!'}
                </h1>
                
                <p className="text-gray-400 mb-8 font-medium">
                    {isWin 
                        ? `Parabéns! Você garantiu seu lucro.` 
                        : `Que azar! Tente novamente para recuperar.`}
                </p>

                <div className="bg-white/5 rounded-2xl p-6 mb-8 border border-white/5 relative overflow-hidden">
                    {isWin && <Sparkles className="absolute top-2 right-2 text-yellow-300 animate-spin-slow opacity-50" size={16} />}
                    
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Aposta</span>
                        <span className="text-gray-300 font-mono">R$ {betAmount.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-px bg-white/10 my-3"></div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{isWin ? 'Retorno' : 'Prejuízo'}</span>
                        <span className={`font-mono font-black text-3xl leading-none ${isWin ? 'text-neon-green' : 'text-red-500'}`}>
                           {isWin ? `+${winAmount.toFixed(2)}` : `-${betAmount.toFixed(2)}`}
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Button onClick={onRestart} variant={isWin ? 'neon' : 'primary'} fullWidth className="py-4 text-lg">
                        <RefreshCw size={20} className={!isWin ? 'animate-spin-once' : ''} />
                        JOGAR NOVAMENTE
                    </Button>
                    <Button onClick={onHome} variant="glass" fullWidth>
                        <Home size={18} />
                        MENU PRINCIPAL
                    </Button>
                </div>
            </div>

        </div>
    </div>
  );
};