import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.set('trust proxy', 1);
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

async function createTables() {
    try {
        // Users Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                phone VARCHAR(20),
                cpf VARCHAR(14) UNIQUE,
                invitedBy VARCHAR(255),
                balance DECIMAL(10, 2) DEFAULT 0.00,
                bonusBalance DECIMAL(10, 2) DEFAULT 0.00,
                cpa_earnings DECIMAL(10, 2) DEFAULT 0.00,
                revshare_earnings DECIMAL(10, 2) DEFAULT 0.00,
                totalDeposited DECIMAL(10, 2) DEFAULT 0.00,
                isVip BOOLEAN DEFAULT FALSE,
                vipExpiry BIGINT DEFAULT 0,
                inventory TEXT,
                dailyBonus TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check for totalDeposited column (migration)
        try {
            await pool.query('SELECT totalDeposited FROM users LIMIT 1');
        } catch (e) {
            console.log("Migrating users table: Adding totalDeposited column");
            await pool.query('ALTER TABLE users ADD COLUMN totalDeposited DECIMAL(10, 2) DEFAULT 0.00');
        }

        // Referrals Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referrals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                referrer_id INT NOT NULL,
                referred_user_id INT NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                cpa_paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (referrer_id) REFERENCES users(id),
                FOREIGN KEY (referred_user_id) REFERENCES users(id)
            )
        `);

        // Transactions Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                details JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Game Sessions Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id VARCHAR(50) PRIMARY KEY,
                user_id INT NOT NULL,
                bet_amount DECIMAL(10, 2) NOT NULL,
                multiplier DECIMAL(10, 2) DEFAULT 0.00,
                win_amount DECIMAL(10, 2) DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Settings Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(255) NOT NULL UNIQUE,
                setting_value TEXT
            )
        `);

        // Insert Default Settings if empty
        const [settings] = await pool.query('SELECT count(*) as count FROM settings');
        if (settings[0].count === 0) {
            await pool.query(`
                INSERT INTO settings (setting_key, setting_value) VALUES 
                ('cpaValue', '10'),
                ('cpaMinDeposit', '20'),
                ('realRevShare', '20'),
                ('fakeRevShare', '50'),
                ('minDeposit', '10'),
                ('minWithdraw', '50')
            `);
        }

        console.log('Tables created/verified successfully');
    } catch (err) {
        console.error('Error creating tables:', err);
    }
}

async function initDB() {
    try {
        console.log("Testing Database Connection...");
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        console.log('Database Connected Successfully.');
        await createTables();
    } catch (err) {
        console.error('FATAL: Database Connection Failed!', err);
        process.exit(1);
    }
}


// Helper: Query DB
async function query(sql, params) {
    if (!pool) throw new Error('Database not initialized');
    const [rows] = await pool.query(sql, params);
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
            totalDeposited: parseFloat(user.totalDeposited || 0),
            isVip: Boolean(user.isVip),
            vipExpiry: user.vipExpiry ? new Date(user.vipExpiry).getTime() : 0,
            inventory: typeof user.inventory === 'string' ? JSON.parse(user.inventory) : (user.inventory || { shields: 0, magnets: 0, extraLives: 0 }),
            affiliateEarnings: {
                cpa: parseFloat(user.cpa_earnings || 0),
                revShare: parseFloat(user.revshare_earnings || 0)
            }
        });
    } catch (err) {
        res.status(401).json({ error: 'Token inválido.' });
    }
});

// GAME: Start Game
app.post('/api/game/start', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { betAmount } = req.body;

        if (!betAmount || betAmount <= 0) {
            return res.status(400).json({ error: 'Valor da aposta inválido.' });
        }

        // Get user and check balance
        const users = await query('SELECT * FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const user = users[0];
        const balance = parseFloat(user.balance);

        if (balance < betAmount) {
            return res.status(400).json({ error: 'Saldo insuficiente.' });
        }

        // Generate Game ID
        const gameId = `GAME-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Debit Balance
        await query('UPDATE users SET balance = balance - ? WHERE id = ?', [betAmount, decoded.id]);

        // Create Game Session
        await query(
            'INSERT INTO game_sessions (id, user_id, bet_amount, status) VALUES (?, ?, ?, "ACTIVE")',
            [gameId, decoded.id, betAmount]
        );

        // Log Transaction (Bet)
        await query(
            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "BET", ?, "COMPLETED", ?, NOW())',
            [decoded.id, betAmount, JSON.stringify({ gameId })]
        );

        res.json({ success: true, gameId, newBalance: balance - betAmount });
    } catch (err) {
        console.error("Game Start Error", err);
        res.status(500).json({ error: 'Erro ao iniciar jogo.' });
    }
});

// GAME: End Game
app.post('/api/game/end', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { gameId, multiplier } = req.body;

        if (!gameId) return res.status(400).json({ error: 'ID do jogo não fornecido.' });
        if (multiplier < 0) return res.status(400).json({ error: 'Multiplicador inválido.' });

        // Get Game Session
        const sessions = await query('SELECT * FROM game_sessions WHERE id = ? AND user_id = ?', [gameId, decoded.id]);
        if (sessions.length === 0) return res.status(404).json({ error: 'Sessão de jogo não encontrada.' });

        const session = sessions[0];

        if (session.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'Jogo já finalizado.' });
        }

        const betAmount = parseFloat(session.bet_amount);
        const winAmount = betAmount * multiplier;
        const status = winAmount > 0 ? 'COMPLETED' : 'CRASHED';

        // Update Game Session
        await query(
            'UPDATE game_sessions SET multiplier = ?, win_amount = ?, status = ? WHERE id = ?',
            [multiplier, winAmount, status, gameId]
        );

        // Credit Win if any
        if (winAmount > 0) {
            await query('UPDATE users SET balance = balance + ? WHERE id = ?', [winAmount, decoded.id]);

            // Log Transaction (Win)
            await query(
                'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "WIN", ?, "COMPLETED", ?, NOW())',
                [decoded.id, winAmount, JSON.stringify({ gameId, multiplier })]
            );
        }

        // Get updated balance
        const updatedUser = await query('SELECT balance FROM users WHERE id = ?', [decoded.id]);

        res.json({ success: true, winAmount, newBalance: parseFloat(updatedUser[0].balance) });

    } catch (err) {
        console.error("Game End Error", err);
        res.status(500).json({ error: 'Erro ao finalizar jogo.' });
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

        // Get earnings
        const earnings = await query('SELECT cpa_earnings, revshare_earnings FROM users WHERE id = ?', [decoded.id]);

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

        // Get referral link (just username)
        const userData = await query('SELECT username FROM users WHERE id = ?', [decoded.id]);

        res.json({
            referrals: referralsCount[0].count,
            earnings: {
                cpa: parseFloat(earnings[0].cpa_earnings || 0),
                revShare: parseFloat(earnings[0].revshare_earnings || 0)
            },
            recentReferrals: referralsList.map(r => ({
                username: r.username,
                date: r.date,
                depositAmount: parseFloat(r.depositAmount || 0)
            })),
            referralCode: userData[0].username
        });
    } catch (err) {
        console.error("Affiliate Stats Error", err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas de afiliados.' });
    }
});

app.get('/api/config', async (req, res) => {
    try {
        const settings = await query('SELECT * FROM settings');
        const config = {};

        const publicKeys = ['minDeposit', 'minWithdraw', 'prices', 'cpaValue', 'cpaMinDeposit', 'realRevShare', 'fakeRevShare', 'autoWithdrawEnabled', 'autoWithdrawLimit'];

        settings.forEach(row => {
            if (publicKeys.includes(row.setting_key)) {
                try {
                    config[row.setting_key] = JSON.parse(row.setting_value);
                } catch (e) {
                    config[row.setting_key] = row.setting_value;
                }
            }
        });

        res.json(config);
    } catch (err) {
        console.error("Public Config Error", err);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body || {};
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ error: 'Senha não fornecida.' });
        }
        if (password !== adminPassword) {
            return res.status(401).json({ error: 'Senha de administrador incorreta.' });
        }
        const token = jwt.sign(
            { role: 'admin', username: process.env.ADMIN_USERNAME || 'admin' },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );
        res.json({ token });
    } catch (err) {
        console.error("Admin Login Error", err);
        res.status(500).json({ error: 'Erro ao autenticar administrador.' });
    }
});

// CONFIG: Get Config
app.get('/api/admin/config', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        } catch (e) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const settings = await query('SELECT * FROM settings');
        const config = {};

        settings.forEach(row => {
            try {
                // Try to parse JSON, if fails use raw string
                config[row.setting_key] = JSON.parse(row.setting_value);
            } catch (e) {
                config[row.setting_key] = row.setting_value;
            }
        });

        res.json(config);
    } catch (err) {
        console.error("Get Config Error", err);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
});

// CONFIG: Save Config
app.post('/api/admin/config', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        } catch (e) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const config = req.body;
        const values = Object.entries(config).map(([key, value]) => {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return [key, stringValue];
        });

        if (values.length > 0) {
            for (const [key, value] of values) {
                await query('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Save Config Error", err);
        res.status(500).json({ error: 'Erro ao salvar configurações.', details: err.message });
    }
});

// DEPOSIT: Create Deposit (Secure)
app.post('/api/deposit', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { amount, cpf } = req.body;

        // Get user details
        const users = await query('SELECT * FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        const user = users[0];

        // Update CPF if provided and different
        let userCpf = user.cpf;
        if (cpf && cpf !== user.cpf) {
            try {
                await query('UPDATE users SET cpf = ? WHERE id = ?', [cpf, decoded.id]);
                userCpf = cpf;
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Este CPF já está sendo usado por outra conta. Por favor, use outro CPF ou recupere sua conta antiga.' });
                }
                throw err;
            }
        }

        // Get PagViva Config from DB
        const settings = await query('SELECT setting_value FROM settings WHERE setting_key = "pagViva"');

        let pagVivaConfig = null;
        if (settings.length > 0) {
            try {
                pagVivaConfig = JSON.parse(settings[0].setting_value);
            } catch (e) {
                console.error("Error parsing pagViva settings", e);
            }
        }

        if (!pagVivaConfig || !pagVivaConfig.token || !pagVivaConfig.secret) {
            console.error("PagViva config missing or incomplete:", {
                hasConfig: !!pagVivaConfig,
                hasToken: !!pagVivaConfig?.token,
                hasSecret: !!pagVivaConfig?.secret,
                hasApiKey: !!pagVivaConfig?.apiKey
            });
            return res.status(500).json({
                error: 'Credenciais PagVIVA não configuradas no servidor. Verifique se Token, Secret e API Key estão preenchidos no painel administrativo.'
            });
        }

        // Call PagViva API
        const postbackUrl = `https://${req.get('host')}/api/callback`; // Force HTTPS for webhooks

        const payload = JSON.stringify({
            postback: postbackUrl,
            amount: amount,
            debtor_name: user.username, // Using username as name if full name not available
            email: user.email || 'user@example.com',
            debtor_document_number: userCpf || '00000000000',
            phone: user.phone || '00000000000',
            method_pay: 'pix'
        });

        const authString = Buffer.from(`${pagVivaConfig.token}:${pagVivaConfig.secret}`).toString('base64');

        const options = {
            hostname: 'pagviva.com',
            path: '/api/transaction/deposit',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authString}`,
                'X-API-KEY': pagVivaConfig.apiKey || ''
            }
        };

        console.log('PagViva Deposit Request:', {
            url: `https://${options.hostname}${options.path}`,
            headers: { ...options.headers, 'Authorization': 'Bearer [REDACTED]' },
            payload: JSON.parse(payload)
        });

        const apiRequest = https.request(options, (apiRes) => {
            let data = '';

            apiRes.on('data', (chunk) => {
                data += chunk;
            });

            apiRes.on('end', () => {
                console.log('PagViva Deposit Response:', {
                    statusCode: apiRes.statusCode,
                    headers: apiRes.headers,
                    body: data
                });

                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    try {
                        const jsonResponse = JSON.parse(data);
                        const txId = jsonResponse.idTransaction || jsonResponse.id || jsonResponse.transactionId || jsonResponse.transaction_id;
                        if (txId) {
                            query(
                                'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "DEPOSIT", ?, "PENDING", ?, NOW())',
                                [decoded.id, amount, JSON.stringify({ txId, method: 'PIX_PENDING' })]
                            ).catch(e => console.error("Error saving pending deposit tx:", e));
                        }
                        res.json(jsonResponse);
                    } catch (e) {
                        console.error('Error parsing PagViva response:', e, data);
                        res.status(500).json({ error: 'Erro ao processar resposta do pagamento.' });
                    }
                } else {
                    let errorMessage = `Erro PagVIVA (${apiRes.statusCode}): ${data}`;
                    try {
                        const errorJson = JSON.parse(data);
                        if (errorJson.message) errorMessage = errorJson.message;
                        else if (errorJson.error) errorMessage = errorJson.error;
                    } catch (e) {
                        // Keep original message if parsing fails
                    }
                    console.error('PagViva Deposit Error:', errorMessage);
                    res.status(apiRes.statusCode || 500).json({ error: errorMessage });
                }
            });
        });

        apiRequest.on('error', (e) => {
            console.error('PagViva Request Error:', e);
            res.status(500).json({ error: `Erro de conexão com gateway de pagamento: ${e.message}` });
        });

        apiRequest.write(payload);
        apiRequest.end();

    } catch (err) {
        console.error("Deposit Error", err);
        if (err.name === 'TokenExpiredError' || err.message === 'jwt expired') {
            return res.status(401).json({ error: 'Sua sessão expirou. Atualize a página e faça login novamente.' });
        }
        res.status(500).json({ error: err.message || 'Erro ao criar depósito.' });
    }
});

// DEPOSIT: Check Status
app.get('/api/deposit/status/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];

    try {
        jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { id } = req.params;

        // Get PagViva Config
        const settings = await query('SELECT setting_value FROM settings WHERE setting_key = "pagViva"');
        let pagVivaConfig = null;
        if (settings.length > 0) {
            try {
                pagVivaConfig = JSON.parse(settings[0].setting_value);
            } catch (e) {
                console.error("Error parsing pagViva settings", e);
            }
        }

        if (!pagVivaConfig || !pagVivaConfig.token || !pagVivaConfig.secret) {
            console.error("PagViva config missing or incomplete for status check");
            return res.status(500).json({ error: 'Credenciais PagVIVA não configuradas.' });
        }

        const authString = Buffer.from(`${pagVivaConfig.token}:${pagVivaConfig.secret}`).toString('base64');

        const options = {
            hostname: 'pagviva.com',
            path: `/api/transaction/${id}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authString}`,
                'X-API-KEY': pagVivaConfig.apiKey || ''
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => data += chunk);
            apiRes.on('end', () => {
                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    try {
                        const jsonResponse = JSON.parse(data);
                        res.json(jsonResponse);
                    } catch (e) {
                        console.error('Error parsing PagViva status response:', e, data);
                        res.json({ status: 'PENDING' });
                    }
                } else {
                    console.error('PagViva Status Error:', apiRes.statusCode, data);
                    res.json({ status: 'PENDING' }); // Default to PENDING on error to avoid breaking flow
                }
            });
        });

        apiRequest.on('error', (e) => {
            console.error('PagViva Status Request Error:', e);
            res.json({ status: 'PENDING' });
        });

        apiRequest.end();

    } catch (err) {
        console.error("Check Status Error", err);
        res.status(500).json({ error: 'Erro ao verificar status.' });
    }
});

// DEPOSIT: Confirm (Update Balance)
app.post('/api/deposit/confirm', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { txId } = req.body;

        // Check if transaction already exists and is completed
        const existing = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT" AND status = "COMPLETED"', [`%${txId}%`]);
        if (existing.length > 0) {
            return res.json({ success: true, message: 'Depósito já processado.' });
        }

        // Fetch Pagviva config to verify the transaction
        const settings = await query('SELECT setting_value FROM settings WHERE setting_key = "pagViva"');
        let pagVivaConfig = null;
        if (settings.length > 0) {
            try { pagVivaConfig = JSON.parse(settings[0].setting_value); } catch (e) { }
        }
        if (!pagVivaConfig || !pagVivaConfig.token || !pagVivaConfig.secret) {
            return res.status(500).json({ error: 'Credenciais PagVIVA não configuradas.' });
        }

        const authString = Buffer.from(`${pagVivaConfig.token}:${pagVivaConfig.secret}`).toString('base64');
        const apiRes = await new Promise((resolve, reject) => {
            const reqData = https.request({
                hostname: 'pagviva.com',
                path: `/api/transaction/${txId}`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authString}`, 'X-API-KEY': pagVivaConfig.apiKey || '' }
            }, (resData) => {
                let data = '';
                resData.on('data', d => data += d);
                resData.on('end', () => resolve({ statusCode: resData.statusCode, data }));
            });
            reqData.on('error', reject);
            reqData.end();
        });

        if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
            return res.status(apiRes.statusCode || 500).json({ error: 'Erro na API PagViva.' });
        }

        const jsonResponse = JSON.parse(apiRes.data);
        const status = (jsonResponse.status || jsonResponse.transactionStatus || '').toUpperCase();

        if (status !== 'PAID' && status !== 'COMPLETED') {
            return res.json({ success: false, message: 'Pagamento ainda não confirmado.' });
        }

        // Use the actual paid amount from PagViva instead of client request
        const amount = parseFloat(jsonResponse.amount || jsonResponse.payment_value || jsonResponse.value);
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valor inválido na resposta do PagViva.' });
        }

        // Double check to prevent race conditions during verification
        const doubleCheck = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT" AND status = "COMPLETED"', [`%${txId}%`]);
        if (doubleCheck.length > 0) {
            return res.json({ success: true, message: 'Depósito já processado.' });
        }

        // Update User Balance
        await query('UPDATE users SET balance = balance + ?, totalDeposited = totalDeposited + ? WHERE id = ?', [amount, amount, decoded.id]);

        // Log Transaction
        await query(
            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "DEPOSIT", ?, "COMPLETED", ?, NOW())',
            [decoded.id, amount, JSON.stringify({ txId, method: 'PIX' })]
        );

        // Check for CPA (First Deposit)
        const user = (await query('SELECT invitedBy, totalDeposited FROM users WHERE id = ?', [decoded.id]))[0];

        // Get Settings
        const settingsRows = await query('SELECT * FROM settings');
        const config = {};
        settingsRows.forEach(r => config[r.setting_key] = r.setting_value);

        const cpaValue = parseFloat(config.cpaValue || 10);
        const cpaMinDeposit = parseFloat(config.cpaMinDeposit || 20);

        // If user was invited, hasn't triggered CPA yet, and total deposits meet criteria
        if (user.invitedBy && user.totalDeposited >= cpaMinDeposit) {
            // Check if CPA already paid
            const referrer = (await query('SELECT id FROM users WHERE username = ?', [user.invitedBy]))[0];
            if (referrer) {
                const referral = (await query('SELECT cpa_paid FROM referrals WHERE referrer_id = ? AND referred_user_id = ?', [referrer.id, decoded.id]))[0];

                if (referral && !referral.cpa_paid) {
                    // Pay CPA
                    await query('UPDATE users SET cpa_earnings = cpa_earnings + ? WHERE id = ?', [cpaValue, referrer.id]);
                    await query('UPDATE referrals SET cpa_paid = TRUE WHERE referrer_id = ? AND referred_user_id = ?', [referrer.id, decoded.id]);

                    // Log for Referrer
                    await query(
                        'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "CPA_REWARD", ?, "COMPLETED", ?, NOW())',
                        [referrer.id, cpaValue, JSON.stringify({ fromUser: decoded.username })]
                    );
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Confirm Deposit Error", err);
        res.status(500).json({ error: 'Erro ao confirmar depósito.' });
    }
});

// WITHDRAW: Request
app.post('/api/withdraw', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const { amount, pixKey, pixKeyType } = req.body;

        // Check Balance
        const user = (await query('SELECT balance FROM users WHERE id = ?', [decoded.id]))[0];
        if (parseFloat(user.balance) < amount) {
            return res.status(400).json({ error: 'Saldo insuficiente.' });
        }

        // Get PagViva Config
        const settings = await query('SELECT setting_value FROM settings WHERE setting_key = "pagViva"');
        let pagVivaConfig = null;
        if (settings.length > 0) {
            try {
                pagVivaConfig = JSON.parse(settings[0].setting_value);
            } catch (e) {
                console.error("Error parsing pagViva settings", e);
            }
        }

        if (!pagVivaConfig || !pagVivaConfig.token || !pagVivaConfig.secret) {
            console.error("PagViva config missing or incomplete for withdraw");
            return res.status(500).json({
                error: 'Credenciais de saque não configuradas. Verifique se Token, Secret e API Key estão preenchidos no painel administrativo.'
            });
        }

        // Deduct Balance First (Pessimistic Locking ideally, but simple update here)
        const dbRes = await query('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [amount, decoded.id, amount]);
        if (dbRes.affectedRows === 0) return res.status(400).json({ error: 'Saldo insuficiente.' });

        // Call PagViva
        const postbackUrl = `${req.protocol}://${req.get('host')}/api/withdraw-callback`;

        const payload = JSON.stringify({
            baasPostbackUrl: postbackUrl,
            amount: amount,
            pixKey: pixKey,
            pixKeyType: pixKeyType || 'cpf'
        });

        const authString = Buffer.from(`${pagVivaConfig.token}:${pagVivaConfig.secret}`).toString('base64');

        const options = {
            hostname: 'pagviva.com',
            path: '/api/transaction/payment',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authString}`,
                'X-API-KEY': pagVivaConfig.apiKey || ''
            }
        };

        console.log('PagViva Withdraw Request:', {
            url: `https://${options.hostname}${options.path}`,
            headers: { ...options.headers, 'Authorization': 'Bearer [REDACTED]' },
            payload: JSON.parse(payload)
        });

        const apiRequest = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => data += chunk);
            apiRes.on('end', async () => {
                console.log('PagViva Withdraw Response:', {
                    statusCode: apiRes.statusCode,
                    headers: apiRes.headers,
                    body: data
                });

                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    try {
                        const jsonResponse = JSON.parse(data);

                        // Log Transaction
                        await query(
                            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "WITHDRAW", ?, "PENDING", ?, NOW())',
                            [decoded.id, amount, JSON.stringify({ txId: jsonResponse.id, pixKey })]
                        );

                        res.json(jsonResponse);
                    } catch (e) {
                        // Refund on error
                        console.error("Withdraw Parse Error", e, data);
                        await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, decoded.id]).catch(console.error);
                        res.status(500).json({ error: 'Erro ao processar resposta do saque.' });
                    }
                } else {
                    // Refund user
                    let errorMessage = `Erro PagVIVA (${apiRes.statusCode}): ${data}`;
                    try {
                        const errorJson = JSON.parse(data);
                        if (errorJson.message) errorMessage = errorJson.message;
                        else if (errorJson.error) errorMessage = errorJson.error;
                    } catch (e) {
                        // Keep original message
                    }
                    console.error('PagViva Withdraw Error:', errorMessage);
                    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, decoded.id]).catch(console.error);
                    res.status(apiRes.statusCode || 500).json({ error: errorMessage });
                }
            });
        });

        apiRequest.on('error', async (e) => {
            console.error('PagViva Withdraw Request Error:', e);
            // Refund user
            await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, decoded.id]).catch(console.error);
            res.status(500).json({ error: `Erro de conexão com gateway de pagamento: ${e.message}` });
        });

        apiRequest.write(payload);
        apiRequest.end();

    } catch (err) {
        console.error("Withdraw Error", err);
        if (err.name === 'TokenExpiredError' || err.message === 'jwt expired') {
            return res.status(401).json({ error: 'Sua sessão expirou. Atualize a página e faça login novamente.' });
        }
        res.status(500).json({ error: 'Erro ao solicitar saque.' });
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

// GAME: Process Result (REMOVED FOR SECURITY)
// Use /api/game/start and /api/game/end instead

// ADMIN ROUTES
app.get('/api/admin/users', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        } catch (e) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const users = await query('SELECT * FROM users ORDER BY created_at DESC');

        // Enhance users with referral counts
        const enhancedUsers = await Promise.all(users.map(async (u) => {
            const referralCount = await query('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', [u.id]);
            return {
                ...u,
                referralCount: referralCount[0].count,
                balance: parseFloat(u.balance),
                bonusBalance: parseFloat(u.bonusBalance)
            };
        }));

        res.json(enhancedUsers);
    } catch (err) {
        console.error("Admin Users Error", err);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// ADMIN: Update User
app.put('/api/admin/users/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        } catch (e) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }
        const { id } = req.params;
        const { balance, bonusBalance, isVip, vipExpiry, inventory } = req.body;

        await query(
            'UPDATE users SET balance = ?, bonusBalance = ?, isVip = ?, vipExpiry = ?, inventory = ? WHERE id = ?',
            [balance, bonusBalance, isVip ? 1 : 0, vipExpiry || null, JSON.stringify(inventory || {}), id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Admin Update User Error", err);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// ADMIN: Delete User
app.delete('/api/admin/users/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        } catch (e) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const { id } = req.params;

        // Delete related records first to maintain integrity
        await query('DELETE FROM referrals WHERE referrer_id = ? OR referred_user_id = ?', [id, id]);
        await query('DELETE FROM transactions WHERE user_id = ?', [id]);

        // Delete user
        await query('DELETE FROM users WHERE id = ?', [id]);

        res.json({ success: true });
    } catch (err) {
        console.error("Admin Delete User Error", err);
        res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
});

app.get('/api/admin/stats', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        } catch (e) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const [totalUsers] = await query('SELECT COUNT(*) as count FROM users');
        const [totalDeposits] = await query('SELECT SUM(amount) as total FROM transactions WHERE type = "DEPOSIT" AND status = "COMPLETED"');
        const [totalWithdrawals] = await query('SELECT SUM(amount) as total FROM transactions WHERE type = "WITHDRAW" AND status = "COMPLETED"');

        res.json({
            totalUsers: totalUsers.count,
            totalDeposited: totalDeposits.total || 0,
            totalWithdrawn: totalWithdrawals.total || 0
        });
    } catch (err) {
        console.error("Admin Stats Error", err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Serve Static Frontend (Production)
// If dist exists, serve it. If not, just send API status.
const distPath = path.join(__dirname, '../dist');

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

// WEBHOOKS
app.post('/api/callback', async (req, res) => {
    try {
        const body = req.body;
        console.log("PagViva Deposit Webhook:", body);

        // PagViva sends { id, status, etc. }
        const txId = body.idTransaction || body.id || body.transactionId || body.transaction_id;
        if (!txId) {
            return res.status(400).send('No ID');
        }

        // Verify with PagViva GET /api/transaction/:id just to be safe
        const settings = await query('SELECT setting_value FROM settings WHERE setting_key = "pagViva"');
        let pagVivaConfig = null;
        if (settings.length > 0) {
            try { pagVivaConfig = JSON.parse(settings[0].setting_value); } catch (e) { }
        }
        if (!pagVivaConfig || !pagVivaConfig.token) return res.status(500).send('No config');

        const authString = Buffer.from(`${pagVivaConfig.token}:${pagVivaConfig.secret}`).toString('base64');
        const apiRes = await new Promise((resolve, reject) => {
            const reqData = https.request({
                hostname: 'pagviva.com',
                path: `/api/transaction/${txId}`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authString}`, 'X-API-KEY': pagVivaConfig.apiKey || '' }
            }, (resData) => {
                let data = '';
                resData.on('data', d => data += d);
                resData.on('end', () => resolve({ statusCode: resData.statusCode, data }));
            });
            reqData.on('error', reject);
            reqData.end();
        });

        if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
            const jsonResponse = JSON.parse(apiRes.data);
            const status = (jsonResponse.status || jsonResponse.transactionStatus || '').toUpperCase();

            if (status === 'PAID' || status === 'COMPLETED') {
                const amount = parseFloat(jsonResponse.amount || jsonResponse.payment_value || jsonResponse.value);
                const cpf = jsonResponse.debtor_document_number || jsonResponse.cpf;

                const doubleCheck = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT" AND status = "COMPLETED"', [`%${txId}%`]);
                if (doubleCheck.length > 0) return res.send('OK'); // Already processed

                const pendingTxRow = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT" AND status = "PENDING"', [`%${txId}%`]);
                if (pendingTxRow.length > 0) {
                    const pendingTx = pendingTxRow[0];
                    await query('UPDATE users SET balance = balance + ?, totalDeposited = totalDeposited + ? WHERE id = ?', [amount, amount, pendingTx.user_id]);
                    await query('UPDATE transactions SET status = "COMPLETED", amount = ?, details = ? WHERE id = ?', [amount, JSON.stringify({ txId, method: 'PIX_WEBHOOK' }), pendingTx.id]);

                    // CPA logic
                    const users = await query('SELECT id, invitedBy, totalDeposited FROM users WHERE id = ?', [pendingTx.user_id]);
                    if (users.length > 0) {
                        const user = users[0];
                        const settings = await query('SELECT * FROM settings');
                        const config = {};
                        settings.forEach(r => config[r.setting_key] = r.setting_value);
                        const cpaValue = parseFloat(config.cpaValue || 10);
                        const cpaMinDeposit = parseFloat(config.cpaMinDeposit || 20);

                        if (user.invitedBy && user.totalDeposited >= cpaMinDeposit) {
                            const referrer = (await query('SELECT id FROM users WHERE username = ?', [user.invitedBy]))[0];
                            if (referrer) {
                                const referral = (await query('SELECT cpa_paid FROM referrals WHERE referrer_id = ? AND referred_user_id = ?', [referrer.id, user.id]))[0];
                                if (referral && !referral.cpa_paid) {
                                    await query('UPDATE users SET cpa_earnings = cpa_earnings + ? WHERE id = ?', [cpaValue, referrer.id]);
                                    await query('UPDATE referrals SET cpa_paid = TRUE WHERE referrer_id = ? AND referred_user_id = ?', [referrer.id, user.id]);
                                    await query(
                                        'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "CPA_REWARD", ?, "COMPLETED", ?, NOW())',
                                        [referrer.id, cpaValue, JSON.stringify({ fromUser: user.username })]
                                    );
                                }
                            }
                        }
                    }
                } else if (cpf) {
                    const users = await query('SELECT id, invitedBy, totalDeposited, username FROM users WHERE cpf = ?', [cpf]);
                    if (users.length > 0) {
                        const user = users[0];
                        await query('UPDATE users SET balance = balance + ?, totalDeposited = totalDeposited + ? WHERE id = ?', [amount, amount, user.id]);
                        await query(
                            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "DEPOSIT", ?, "COMPLETED", ?, NOW())',
                            [user.id, amount, JSON.stringify({ txId, method: 'PIX_WEBHOOK' })]
                        );
                        // CPA logic omitted here for webhook brevity, /confirm handles CPA.
                        const settings = await query('SELECT * FROM settings');
                        const config = {};
                        settings.forEach(r => config[r.setting_key] = r.setting_value);
                        const cpaValue = parseFloat(config.cpaValue || 10);
                        const cpaMinDeposit = parseFloat(config.cpaMinDeposit || 20);

                        if (user.invitedBy && (user.totalDeposited + amount) >= cpaMinDeposit) {
                            const referrer = (await query('SELECT id FROM users WHERE username = ?', [user.invitedBy]))[0];
                            if (referrer) {
                                const referral = (await query('SELECT cpa_paid FROM referrals WHERE referrer_id = ? AND referred_user_id = ?', [referrer.id, user.id]))[0];
                                if (referral && !referral.cpa_paid) {
                                    await query('UPDATE users SET cpa_earnings = cpa_earnings + ? WHERE id = ?', [cpaValue, referrer.id]);
                                    await query('UPDATE referrals SET cpa_paid = TRUE WHERE referrer_id = ? AND referred_user_id = ?', [referrer.id, user.id]);
                                    await query(
                                        'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "CPA_REWARD", ?, "COMPLETED", ?, NOW())',
                                        [referrer.id, cpaValue, JSON.stringify({ fromUser: user.username })]
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
        res.status(200).send("OK");
    } catch (e) {
        console.error("Webhook error", e);
        res.status(500).send("Error");
    }
});

app.post('/api/withdraw-callback', async (req, res) => {
    try {
        const body = req.body;
        console.log("PagViva Withdraw Webhook:", body);
        const txId = body.idTransaction || body.id || body.transactionId || body.transaction_id;
        const status = (body.status || '').toUpperCase();

        if (txId) {
            if (status === 'PAID' || status === 'COMPLETED') {
                await query('UPDATE transactions SET status = "COMPLETED" WHERE details LIKE ? AND type = "WITHDRAW"', [`%${txId}%`]);
            } else if (status === 'ERROR' || status === 'FAILED' || status === 'CANCELED') {
                // Refund user
                const txRow = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "WITHDRAW" AND status = "PENDING"', [`%${txId}%`]);
                if (txRow.length > 0) {
                    const tx = txRow[0];
                    await query('UPDATE transactions SET status = ? WHERE id = ?', [status, tx.id]);
                    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [tx.amount, tx.user_id]);
                }
            }
        }
        res.status(200).send("OK");
    } catch (e) {
        console.error("Withdraw Webhook error", e);
        res.status(500).send("Error");
    }
});

app.get('/api/debug/txs', async (req, res) => {
    try {
        const txs = await query('SELECT * FROM transactions ORDER BY id DESC LIMIT 20');
        res.json(txs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
});
