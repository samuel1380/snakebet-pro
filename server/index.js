require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'snakebet',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function initDB() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('Connected to MySQL/MariaDB');
    } catch (err) {
        console.error('Database connection failed:', err);
    }
}

initDB();

// Helper: Query DB
async function query(sql, params) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

// API Routes

// AUTH: Register
app.post('/api/auth/register', async (req, res) => {
    const { username, password, email, phone, cpf, invitedBy } = req.body;
    
    try {
        // Check if user exists
        const existing = await query('SELECT * FROM users WHERE username = ? OR email = ? OR cpf = ?', [username, email, cpf]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Usuário, email ou CPF já cadastrados.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await query(
            'INSERT INTO users (username, password, email, phone, cpf, invitedBy, balance, bonusBalance) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
            [username, hashedPassword, email, phone, cpf, invitedBy || null]
        );

        const userId = result.insertId;

        // Create referral record if invited
        if (invitedBy) {
            const referrer = await query('SELECT id FROM users WHERE username = ?', [invitedBy]);
            if (referrer.length > 0) {
                await query(
                    'INSERT INTO referrals (referrer_id, referred_user_id, status) VALUES (?, ?, "PENDING")',
                    [referrer[0].id, userId]
                );
            }
        }

        const token = jwt.sign({ id: userId, username }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

        res.json({ token, user: { id: userId, username, balance: 0, bonusBalance: 0, email, phone, cpf, invitedBy } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao registrar usuário.' });
    }
});

// AUTH: Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const users = await query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

        // Get additional data if needed (e.g. affiliate earnings)
        // For simplicity, returning basic info
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                username: user.username, 
                balance: parseFloat(user.balance), 
                bonusBalance: parseFloat(user.bonusBalance),
                email: user.email,
                phone: user.phone,
                cpf: user.cpf,
                invitedBy: user.invitedBy,
                affiliateEarnings: {
                    cpa: parseFloat(user.cpa_earnings || 0),
                    revShare: parseFloat(user.revshare_earnings || 0)
                }
            } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao fazer login.' });
    }
});

// USER: Get Data
app.get('/api/user/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const users = await query('SELECT * FROM users WHERE id = ?', [decoded.id]);
        
        if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        
        const user = users[0];
        res.json({
            id: user.id,
            username: user.username,
            balance: parseFloat(user.balance),
            bonusBalance: parseFloat(user.bonusBalance),
            email: user.email,
            phone: user.phone,
            cpf: user.cpf,
            invitedBy: user.invitedBy,
            affiliateEarnings: {
                cpa: parseFloat(user.cpa_earnings || 0),
                revShare: parseFloat(user.revshare_earnings || 0)
            }
        });
    } catch (err) {
        res.status(401).json({ error: 'Token inválido.' });
    }
});

// WALLET: Sync Balance (From Game/Frontend)
app.post('/api/wallet/sync', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { balance, bonusBalance } = req.body;
        
        // Update user balance
        await query('UPDATE users SET balance = ?, bonusBalance = ? WHERE id = ?', [balance, bonusBalance, decoded.id]);
        
        res.json({ success: true });
    } catch (err) {
        console.error("Wallet Sync Error", err);
        res.status(500).json({ error: 'Erro ao sincronizar carteira.' });
    }
});

// TRANSACTION: Create/Log
app.post('/api/transaction/create', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { type, amount, status, details } = req.body;
        
        // Log transaction
        await query(
            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())', 
            [decoded.id, type, amount, status, JSON.stringify(details || {})]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error("Transaction Create Error", err);
        res.status(500).json({ error: 'Erro ao criar transação.' });
    }
});

// AFFILIATES: Get Stats
app.get('/api/affiliates/stats', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        
        // Get referrals count
        const referralsCount = await query('SELECT count(*) as count FROM referrals WHERE referrer_id = ?', [decoded.id]);
        
        // Get recent referrals
        const referralsList = await query(
            `SELECT u.username, r.created_at as date, 
            (SELECT SUM(amount) FROM transactions t WHERE t.user_id = r.referred_user_id AND t.type = 'DEPOSIT' AND t.status = 'COMPLETED') as depositAmount 
            FROM referrals r 
            JOIN users u ON r.referred_user_id = u.id 
            WHERE r.referrer_id = ? 
            ORDER BY r.created_at DESC LIMIT 10`, 
            [decoded.id]
        );

        // Get earnings
        const user = await query('SELECT cpa_earnings, revshare_earnings FROM users WHERE id = ?', [decoded.id]);
        
        // Get referral link (just username)
        const userData = await query('SELECT username FROM users WHERE id = ?', [decoded.id]);

        res.json({
            referralCount: referralsCount[0].count,
            recentReferrals: referralsList.map(r => ({
                username: r.username,
                date: r.date,
                depositAmount: parseFloat(r.depositAmount || 0)
            })),
            earnings: {
                cpa: parseFloat(user[0].cpa_earnings || 0),
                revShare: parseFloat(user[0].revshare_earnings || 0)
            },
            referralCode: userData[0].username
        });
    } catch (err) {
        console.error("Affiliate Stats Error", err);
        res.status(500).json({ error: 'Erro ao buscar dados de afiliados.' });
    }
});

// AFFILIATES: Claim Earnings
app.post('/api/affiliates/claim', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        
        const user = (await query('SELECT cpa_earnings, revshare_earnings, balance FROM users WHERE id = ?', [decoded.id]))[0];
        
        const totalEarnings = parseFloat(user.cpa_earnings || 0) + parseFloat(user.revshare_earnings || 0);
        
        if (totalEarnings <= 0) {
            return res.status(400).json({ error: 'Sem saldo de afiliados para resgatar.' });
        }
        
        // Update User: Zero out earnings, add to main balance
        await query(
            'UPDATE users SET balance = balance + ?, cpa_earnings = 0, revshare_earnings = 0 WHERE id = ?',
            [totalEarnings, decoded.id]
        );
        
        // Log Transaction
        await query(
            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "AFFILIATE_CLAIM", ?, "COMPLETED", ?, NOW())',
            [decoded.id, totalEarnings, JSON.stringify({ source: 'CPA + RevShare' })]
        );
        
        res.json({ success: true, newBalance: parseFloat(user.balance) + totalEarnings, claimedAmount: totalEarnings });
    } catch (err) {
        console.error("Affiliate Claim Error", err);
        res.status(500).json({ error: 'Erro ao resgatar saldo.' });
    }
});

// GAME: Process Result (Win/Loss + RevShare)
app.post('/api/game/result', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { betAmount, winAmount, source } = req.body;
        
        const user = (await query('SELECT * FROM users WHERE id = ?', [decoded.id]))[0];
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        // Update Balance
        let newBalance = parseFloat(user.balance);
        let newBonus = parseFloat(user.bonusBalance);
        
        if (source === 'REAL') {
            newBalance = newBalance - betAmount + winAmount;
        } else {
            newBonus = newBonus - betAmount + winAmount;
        }
        
        await query('UPDATE users SET balance = ?, bonusBalance = ? WHERE id = ?', [newBalance, newBonus, decoded.id]);
        
        // Log Transactions
        // BET
        await query(
            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "BET", ?, "COMPLETED", ?, NOW())',
            [decoded.id, betAmount, JSON.stringify({ source, winAmount })]
        );
        
        // WIN (if any)
        if (winAmount > 0) {
            await query(
                'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "WIN", ?, "COMPLETED", ?, NOW())',
                [decoded.id, winAmount, JSON.stringify({ source, betAmount })]
            );
        } else if (source === 'REAL' && user.invitedBy) {
            // REVSHARE LOGIC (Loss)
            // Get settings
            const settings = await query('SELECT * FROM settings');
            const config = {};
            settings.forEach(s => config[s.setting_key] = s.setting_value);
            
            const revSharePct = parseFloat(config.revshare_real || 20);
            const commission = betAmount * (revSharePct / 100);
            
            if (commission > 0) {
                const referrer = await query('SELECT id FROM users WHERE username = ?', [user.invitedBy]);
                if (referrer.length > 0) {
                    await query(
                        'UPDATE users SET revshare_earnings = revshare_earnings + ? WHERE id = ?',
                        [commission, referrer[0].id]
                    );
                    
                    // Log for Referrer (Optional, or just update balance)
                    // We might want a separate table for affiliate logs, but for now just updating the field is enough as per request
                }
            }
        }
        
        res.json({ success: true, balance: newBalance, bonusBalance: newBonus });
    } catch (err) {
        console.error("Game Result Error", err);
        res.status(500).json({ error: 'Erro ao processar jogo.' });
    }
});

// TRANSACTION: Confirm Deposit (CPA Logic)
app.post('/api/transaction/confirm', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });
    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { txId, amount } = req.body;
        
        // Update transaction status
        // Check if already completed to avoid double CPA
        const existing = await query('SELECT status FROM transactions WHERE details LIKE ?', [`%${txId}%`]);
        if (existing.length > 0 && existing[0].status === 'COMPLETED') {
             return res.json({ success: true, message: 'Already processed' });
        }

        // Update User Balance
        await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, decoded.id]);
        
        // Update Transaction
        // We might need to find the exact transaction ID if it was created via /create
        // Or just insert a new one if it's confirmed externally
        // Assuming we are confirming a pending one or inserting a new completed one
        
        // For simplicity, let's insert a COMPLETED DEPOSIT record
        await query(
            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "DEPOSIT", ?, "COMPLETED", ?, NOW())',
            [decoded.id, amount, JSON.stringify({ txId })]
        );

        // CPA LOGIC
        const user = (await query('SELECT * FROM users WHERE id = ?', [decoded.id]))[0];
        
        // Calculate total deposited (including this one)
        const deposits = await query('SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "DEPOSIT" AND status = "COMPLETED"', [decoded.id]);
        const totalDeposited = parseFloat(deposits[0].total || 0);
        
        if (user.invitedBy) {
            const settings = await query('SELECT * FROM settings');
            const config = {};
            settings.forEach(s => config[s.setting_key] = s.setting_value);
            
            const cpaMin = parseFloat(config.cpa_min_deposit || 20);
            const cpaValue = parseFloat(config.cpa_value || 10);
            
            // Check if CPA already paid for this user
            const referral = await query(
                'SELECT * FROM referrals WHERE referred_user_id = ? AND cpa_paid = 1',
                [decoded.id]
            );
            
            // If not paid yet, and total deposits meet the baseline requirement
            if (referral.length === 0 && totalDeposited >= cpaMin) {
                const referrer = await query('SELECT id FROM users WHERE username = ?', [user.invitedBy]);
                if (referrer.length > 0) {
                    // Pay CPA
                    await query(
                        'UPDATE users SET cpa_earnings = cpa_earnings + ? WHERE id = ?',
                        [cpaValue, referrer[0].id]
                    );
                    
                    // Update Referral Status
                    await query(
                        'UPDATE referrals SET status = "QUALIFIED", cpa_paid = 1 WHERE referred_user_id = ?',
                        [decoded.id]
                    );
                }
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error("Transaction Confirm Error", err);
        res.status(500).json({ error: 'Erro ao confirmar transação.' });
    }
});

// PAGVIVA PROXY
app.post('/api/pagviva/deposit', async (req, res) => {
    // In production, configure PAGVIVA_TOKEN and PAGVIVA_SECRET in .env
    // Here we use credentials passed from frontend or environment
    const { token, secret, apiKey, ...data } = req.body;
    
    // Prioritize environment variables for security
    const apiToken = process.env.PAGVIVA_TOKEN || token;
    const apiSecret = process.env.PAGVIVA_SECRET || secret;
    const apiApiKey = process.env.PAGVIVA_API_KEY || apiKey;

    if (!apiToken || !apiSecret || !apiApiKey) {
        return res.status(400).json({ error: 'Credenciais PagVIVA ausentes.' });
    }

    try {
        const authString = btoa(`${apiToken}:${apiSecret}`);
        const response = await fetch('https://pagviva.com/api/transaction/deposit', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${authString}`,
                "X-API-KEY": apiApiKey
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(result);
        }

        // Log transaction in our DB
        // const { userId, amount } = data; // Assuming userId is passed
        // await query('INSERT INTO transactions ...');

        res.json(result);
    } catch (err) {
        console.error('PagViva Proxy Error:', err);
        res.status(500).json({ error: 'Erro ao comunicar com PagVIVA.' });
    }
});

app.get('/api/pagviva/status/:id', async (req, res) => {
    const { id } = req.params;
    const { token, secret, apiKey } = req.query;

    const apiToken = process.env.PAGVIVA_TOKEN || token;
    const apiSecret = process.env.PAGVIVA_SECRET || secret;
    const apiApiKey = process.env.PAGVIVA_API_KEY || apiKey;

    if (!apiToken) return res.status(400).json({ error: 'Credenciais ausentes.' });

    try {
        const authString = btoa(`${apiToken}:${apiSecret}`);
        const response = await fetch(`https://pagviva.com/api/transaction/${id}`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${authString}`,
                "X-API-KEY": apiApiKey
            }
        });

        const result = await response.json();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao verificar status.' });
    }
});

// Serve Static Frontend (Production)
// If dist exists, serve it. If not, just send API status.
const distPath = path.join(__dirname, '../dist');
const fs = require('fs');

if (fs.existsSync(distPath)) {        
    app.use(express.static(distPath));    
    app.get('*', (req, res) => {      
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // Fallback for when build is missing
    app.get('*', (req, res) => {      
        res.status(200).send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #111; color: #fff;">
                    <h1>SnakeBet API is running</h1>
                    <p>But the Frontend (visual part) was not found.</p>
                    <div style="background: #222; padding: 20px; border-radius: 8px; display: inline-block; text-align: left;">
                        <p style="color: #fbbf24; margin: 0 0 10px 0;"><strong>⚠️ Fix Required in Render:</strong></p>
                        <p style="margin: 5px 0;">1. Go to <strong>Settings</strong></p>
                        <p style="margin: 5px 0;">2. Scroll to <strong>Build & Deploy</strong></p>
                        <p style="margin: 5px 0;">3. Set <strong>Build Command</strong> to: <code>npm install && npm run build</code></p>
                        <p style="margin: 5px 0;">4. Set <strong>Start Command</strong> to: <code>npm run server</code></p>
                        <p style="margin: 5px 0;">5. Click <strong>Save Changes</strong> (or Manual Deploy)</p>
                    </div>
                </body>
            </html>
        `);
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
