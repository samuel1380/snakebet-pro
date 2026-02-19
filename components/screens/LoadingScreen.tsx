import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="relative">
        <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
        <Loader2 className="w-16 h-16 text-green-500 animate-spin relative z-10" />
      </div>
      <h2 className="mt-6 text-xl font-bold text-green-500 animate-pulse tracking-wider">
        CARREGANDO...
      </h2>
      <p className="mt-2 text-zinc-500 text-sm">
        Preparando sua sessão
      </p>
    </div>
  );
};
