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

    async getAdminConfig() {
        const token = localStorage.getItem('snakebet_token');
        if (!token) throw new Error("No token");

        const res = await fetch(`${API_URL}/admin/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async saveAdminConfig(config: any) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) throw new Error("No token");

        const res = await fetch(`${API_URL}/admin/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(config)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async createDeposit(amount: number, cpf?: string) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) throw new Error("No token");

        const res = await fetch(`${API_URL}/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount, cpf })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async checkDepositStatus(txId: string) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) return 'PENDING';

        const res = await fetch(`${API_URL}/deposit/status/${txId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return 'PENDING';

        const data = await res.json();
        return (data.status || data.transactionStatus || 'PENDING').toUpperCase();
    },

    async confirmDeposit(txId: string, amount: number) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) throw new Error("No token");

        const res = await fetch(`${API_URL}/deposit/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ txId, amount })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async requestWithdraw(amount: number, pixKey: string, pixKeyType: string) {
        const token = localStorage.getItem('snakebet_token');
        if (!token) throw new Error("No token");

        const res = await fetch(`${API_URL}/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount, pixKey, pixKeyType })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async getPublicConfig() {
        const res = await fetch(`${API_URL}/config`);
        if (!res.ok) throw await res.json();
        return res.json();
    }
};
