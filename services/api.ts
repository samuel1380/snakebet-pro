import { User } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
    async register(data: any) {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            let errorBody;
            try {
                errorBody = await res.json();
            } catch (parseError) {
                throw new Error(`Erro ${res.status}: ${res.statusText}`);
            }
            throw errorBody;
        }
        return res.json();
    },

    async login(data: any) {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            let errorBody;
            try {
                errorBody = await res.json();
            } catch (parseError) {
                throw new Error(`Erro ${res.status}: ${res.statusText}`);
            }
            throw errorBody;
        }
        return res.json();
    },

    async getProfile(token?: string) {
        const authToken = token || localStorage.getItem('snakebet_token');
        if (!authToken) throw new Error("No token");
        
        const res = await fetch(`${API_URL}/user/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async updateWallet(balance: number, bonusBalance: number) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) return;

        const res = await fetch(`${API_URL}/wallet/sync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ balance, bonusBalance })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async recordTransaction(type: string, amount: number, status: string, details?: any) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) return;

        const res = await fetch(`${API_URL}/transaction/create`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, amount, status, details })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async getAffiliateStats() {
        const token = localStorage.getItem('snakebet_token');
        if (!token) return;
        const res = await fetch(`${API_URL}/affiliates/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async claimAffiliateEarnings() {
        const token = localStorage.getItem('snakebet_token');
        if (!token) return;
        const res = await fetch(`${API_URL}/affiliates/claim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async processGameResult(betAmount: number, winAmount: number, source: 'REAL' | 'BONUS') {
        const token = localStorage.getItem('snakebet_token');
        if (!token) return;
        const res = await fetch(`${API_URL}/game/result`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ betAmount, winAmount, source })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    
    async confirmDeposit(txId: string, amount: number) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) return;
        const res = await fetch(`${API_URL}/transaction/confirm`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ txId, amount })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    }
};
