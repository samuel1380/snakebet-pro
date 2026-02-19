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


// Helper: Query DB (Using .query instead of .execute for better compatibility with complex UPSERT queries)
async function query(sql, params) {
    if (!pool) throw new Error('Database not initialized');
    const [rows] = await pool.query(sql, params);
    return rows;
}

// CONFIG: Save Config
app.post('/api/admin/config', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    let connection;
    try {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET || 'secret');

        const config = req.body;
        const entries = Object.entries(config).filter(([key]) => key !== 'id'); // Exclude ID if present

        connection = await pool.getConnection();
        await connection.beginTransaction();

        for (const [key, value] of entries) {
            // Safer serialization: Only stringify if it's a non-null object
            const stringValue = (value !== null && typeof value === 'object')
                ? JSON.stringify(value)
                : String(value !== undefined ? value : '');

            await connection.query(
                'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [key, stringValue, stringValue]
            );
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Save Config Error", err);
        res.status(500).json({ error: 'Erro ao salvar configurações.', details: err.message });
    } finally {
        if (connection) connection.release();
    }
});

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

// CONFIG: Get Config
app.get('/api/admin/config', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET || 'secret');

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
            await query('UPDATE users SET cpf = ? WHERE id = ?', [cpf, decoded.id]);
            userCpf = cpf;
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

        if (!pagVivaConfig || !pagVivaConfig.token) {
            return res.status(500).json({ error: 'Credenciais PagVIVA não configuradas no servidor.' });
        }

        // Call PagViva API
        const postbackUrl = `${req.protocol}://${req.get('host')}/api/callback`; // Or from env

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

        const apiRequest = https.request(options, (apiRes) => {
            let data = '';

            apiRes.on('data', (chunk) => {
                data += chunk;
            });

            apiRes.on('end', () => {
                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    try {
                        const jsonResponse = JSON.parse(data);
                        res.json(jsonResponse);
                    } catch (e) {
                        res.status(500).json({ error: 'Erro ao processar resposta do pagamento.' });
                    }
                } else {
                    res.status(apiRes.statusCode).json({ error: `Erro PagVIVA: ${data}` });
                }
            });
        });

        apiRequest.on('error', (e) => {
            console.error(e);
            res.status(500).json({ error: 'Erro de conexão com gateway de pagamento.' });
        });

        apiRequest.write(payload);
        apiRequest.end();

    } catch (err) {
        console.error("Deposit Error", err);
        res.status(500).json({ error: 'Erro ao criar depósito.' });
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

        if (!pagVivaConfig || !pagVivaConfig.token) {
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
                        res.status(500).json({ error: 'Erro ao processar resposta.' });
                    }
                } else {
                    res.json({ status: 'PENDING' }); // Default to PENDING on error to avoid breaking flow
                }
            });
        });

        apiRequest.on('error', (e) => {
            console.error(e);
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
        const { txId, amount } = req.body;

        // Check if transaction already exists
        const existing = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT"', [`%${txId}%`]);

        if (existing.length > 0) {
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

        if (!pagVivaConfig || !pagVivaConfig.token) {
            return res.status(500).json({ error: 'Credenciais de saque não configuradas.' });
        }

        // Deduct Balance First (Pessimistic Locking ideally, but simple update here)
        await query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, decoded.id]);

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

        const apiRequest = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => data += chunk);
            apiRes.on('end', async () => {
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
                        // Refund on error? For now, just log
                        console.error("Withdraw Parse Error", e);
                        res.status(500).json({ error: 'Erro ao processar resposta do saque.' });
                    }
                } else {
                    // Refund user
                    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, decoded.id]);
                    res.status(apiRes.statusCode).json({ error: `Erro PagVIVA: ${data}` });
                }
            });
        });

        apiRequest.on('error', async (e) => {
            console.error(e);
            // Refund user
            await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, decoded.id]);
            res.status(500).json({ error: 'Erro de conexão com gateway de pagamento.' });
        });

        apiRequest.write(payload);
        apiRequest.end();

    } catch (err) {
        console.error("Withdraw Error", err);
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

            const revSharePct = parseFloat(config.realRevShare || 20);
            const commission = betAmount * (revSharePct / 100);

            if (commission > 0) {
                const referrer = await query('SELECT id FROM users WHERE username = ?', [user.invitedBy]);
                if (referrer.length > 0) {
                    await query(
                        'UPDATE users SET revshare_earnings = revshare_earnings + ? WHERE id = ?',
                        [commission, referrer[0].id]
                    );
                }
            }
        }

        res.json({ success: true, balance: newBalance, bonusBalance: newBonus });
    } catch (err) {
        console.error("Game Result Error", err);
        res.status(500).json({ error: 'Erro ao processar jogo.' });
    }
});

// ADMIN ROUTES
app.get('/api/admin/users', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET || 'secret');

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
        jwt.verify(token, process.env.JWT_SECRET || 'secret');
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
        jwt.verify(token, process.env.JWT_SECRET || 'secret');

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
        jwt.verify(token, process.env.JWT_SECRET || 'secret');

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

initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
});
