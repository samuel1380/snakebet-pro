
export interface Referral {
  username: string;
  depositAmount: number;
  date: number;
}

export interface TransactionRecord {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  timestamp: number;
  status: 'COMPLETED' | 'PENDING' | 'REJECTED';
  pixKey?: string;
}

export interface User {
  id?: number; // Database ID (optional for local/legacy)
  username: string;
  balance: number; // Carteira Real
  bonusBalance: number; // Carteira de Bônus
  isVip: boolean; // Status VIP
  vipExpiry?: number; // Data de expiração do VIP
  dailyBonusClaims: number; // Quantas vezes pegou o bônus hoje
  
  // Mystery Box Logic
  boxTracker: {
    count: number; // 0, 1, 2
    totalSpent: number; // Acumulado das últimas tentativas
  };

  transactions: TransactionRecord[]; // Histórico financeiro

  rollover: {
    current: number; // Quanto já ganhou com bônus
    target: number;  // Meta para liberar (3x o valor ganho)
  };
  lastDailyBonus: number; // Timestamp do último resgate
  consecutiveFreeClaims: number; // Quantos bônus pegou sem depositar
  totalDeposited: number; // Total depositado na vida
  inventory: {
    shields: number;
    magnets: number;
    extraLives: number; // Novo item
  };
  referrals: Referral[];
  invitedBy?: string; // Username of referrer
  affiliateEarnings?: {
    cpa: number;
    revShare: number;
  };
}

export interface BetRecord {
  id: string;
  timestamp: number;
  betAmount: number;
  winAmount: number;
  profit: number;
  outcome: 'WIN' | 'LOSS';
  source: 'REAL' | 'BONUS';
}

export enum AppScreen {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  GAME = 'GAME',
  GAME_OVER = 'GAME_OVER',
  ADMIN = 'ADMIN',
  ADMIN_LOGIN = 'ADMIN_LOGIN'
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const DIFFICULTY_CONFIG = {
  EASY: { 
    id: 'EASY', 
    label: 'Fácil', 
    multiplier: 0.2, 
    botCount: 3, 
    baseSpeed: 110, 
    color: 'text-neon-green', 
    bg: 'bg-neon-green/10 border-neon-green/30' 
  },
  MEDIUM: { 
    id: 'MEDIUM', 
    label: 'Normal', 
    multiplier: 0.5, 
    botCount: 5, 
    baseSpeed: 85, 
    color: 'text-neon-blue', 
    bg: 'bg-neon-blue/10 border-neon-blue/30' 
  },
  HARD: { 
    id: 'HARD', 
    label: 'Difícil', 
    multiplier: 1.5, 
    botCount: 5, 
    baseSpeed: 80, 
    color: 'text-red-500', 
    bg: 'bg-red-500/10 border-red-500/30' 
  }
};

export interface Point {
  x: number;
  y: number;
}

export enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT
}

export interface GameConfig {
  betAmount: number;
  potentialWin: number;
  multiplier: number;
  applesEaten: number;
  difficulty: Difficulty;
}

export const GRID_SIZE = 25;
export const SPEED_INITIAL = 150;

export const ITEM_PRICES = {
    SHIELD: 5.00,
    MAGNET: 10.00,
    EXTRA_LIFE: 15.00, // Item mais caro
    VIP: 49.90, 
    MYSTERY_BOX: 4.90
};