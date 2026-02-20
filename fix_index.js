const fs = require('fs');
let content = fs.readFileSync('server/index.mjs', 'utf8');

// 1. Fix Withdraw TOCTOU
content = content.replace(
    "await query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, decoded.id]);",
    "const dbRes = await query('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [amount, decoded.id, amount]);\n        if (dbRes.affectedRows === 0) return res.status(400).json({ error: 'Saldo insuficiente.' });"
);

// 2. Fix Deposit Confirm Vulnerability
// We replace the trust-the-client logic with a verify-via-pagviva logic
const oldDepositBlock = `        const { txId, amount } = req.body;

        // Check if transaction already exists
        const existing = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT"', [\`%\${txId}%\`]);

        if (existing.length > 0) {
            return res.json({ success: true, message: 'Depósito já processado.' });
        }

        // Update User Balance
        await query('UPDATE users SET balance = balance + ?, totalDeposited = totalDeposited + ? WHERE id = ?', [amount, amount, decoded.id]);`;

const newDepositBlock = `        const { txId } = req.body;

        // Check if transaction already exists and is completed
        const existing = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT" AND status = "COMPLETED"', [\`%\${txId}%\`]);
        if (existing.length > 0) {
            return res.json({ success: true, message: 'Depósito já processado.' });
        }

        // Fetch Pagviva config to verify the transaction
        const settings = await query('SELECT setting_value FROM settings WHERE setting_key = "pagViva"');
        let pagVivaConfig = null;
        if (settings.length > 0) {
            try { pagVivaConfig = JSON.parse(settings[0].setting_value); } catch (e) {}
        }
        if (!pagVivaConfig || !pagVivaConfig.token || !pagVivaConfig.secret) {
            return res.status(500).json({ error: 'Credenciais PagVIVA não configuradas.' });
        }

        const authString = Buffer.from(\`\${pagVivaConfig.token}:\${pagVivaConfig.secret}\`).toString('base64');
        const apiRes = await new Promise((resolve, reject) => {
            const reqData = https.request({
                hostname: 'pagviva.com',
                path: \`/api/transaction/\${txId}\`,
                method: 'GET',
                headers: { 'Authorization': \`Basic \${authString}\`, 'X-API-KEY': pagVivaConfig.apiKey || '' }
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
        const doubleCheck = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT" AND status = "COMPLETED"', [\`%\${txId}%\`]);
        if (doubleCheck.length > 0) {
            return res.json({ success: true, message: 'Depósito já processado.' });
        }

        // Update User Balance
        await query('UPDATE users SET balance = balance + ?, totalDeposited = totalDeposited + ? WHERE id = ?', [amount, amount, decoded.id]);`;

content = content.replace(oldDepositBlock, newDepositBlock);

// 3. Add Webhook Endpoints at the end, right before "initDB().then(() => {"

const webhooks = `
// WEBHOOKS
app.post('/api/callback', async (req, res) => {
    try {
        const body = req.body;
        console.log("PagViva Deposit Webhook:", body);
        
        // PagViva sends { id, status, etc. }
        const txId = body.id || body.transactionId;
        if (!txId) {
            return res.status(400).send('No ID');
        }

        // Verify with PagViva GET /api/transaction/:id just to be safe
        const settings = await query('SELECT setting_value FROM settings WHERE setting_key = "pagViva"');
        let pagVivaConfig = null;
        if (settings.length > 0) {
            try { pagVivaConfig = JSON.parse(settings[0].setting_value); } catch(e) {}
        }
        if (!pagVivaConfig || !pagVivaConfig.token) return res.status(500).send('No config');

        const authString = Buffer.from(\`\${pagVivaConfig.token}:\${pagVivaConfig.secret}\`).toString('base64');
        const apiRes = await new Promise((resolve, reject) => {
            const reqData = https.request({
                hostname: 'pagviva.com',
                path: \`/api/transaction/\${txId}\`,
                method: 'GET',
                headers: { 'Authorization': \`Basic \${authString}\`, 'X-API-KEY': pagVivaConfig.apiKey || '' }
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

                const doubleCheck = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "DEPOSIT" AND status = "COMPLETED"', [\`%\${txId}%\`]);
                if (doubleCheck.length > 0) return res.send('OK'); // Already processed

                // Find user. Since webhook might not have user ID, find by CPF or recent pending tx?
                // For now, if user relies on /deposit/confirm it works. Webhook requires knowing the user.
                // Assuming CPF is in the pagviva response:
                if (cpf) {
                    const users = await query('SELECT id, invitedBy, totalDeposited FROM users WHERE cpf = ?', [cpf]);
                    if (users.length > 0) {
                        const user = users[0];
                        await query('UPDATE users SET balance = balance + ?, totalDeposited = totalDeposited + ? WHERE id = ?', [amount, amount, user.id]);
                        await query(
                            'INSERT INTO transactions (user_id, type, amount, status, details, created_at) VALUES (?, "DEPOSIT", ?, "COMPLETED", ?, NOW())',
                            [user.id, amount, JSON.stringify({ txId, method: 'PIX_WEBHOOK' })]
                        );
                        // CPA logic omitted here for webhook brevity, /confirm handles CPA.
                    }
                }
            }
        }
        res.status(200).send("OK");
    } catch(e) {
        console.error("Webhook error", e);
        res.status(500).send("Error");
    }
});

app.post('/api/withdraw-callback', async (req, res) => {
    try {
        const body = req.body;
        console.log("PagViva Withdraw Webhook:", body);
        const txId = body.id || body.transactionId;
        const status = (body.status || '').toUpperCase();
        
        if (txId) {
            if (status === 'PAID' || status === 'COMPLETED') {
                await query('UPDATE transactions SET status = "COMPLETED" WHERE details LIKE ? AND type = "WITHDRAW"', [\`%\${txId}%\`]);
            } else if (status === 'ERROR' || status === 'FAILED' || status === 'CANCELED') {
                // Refund user
                const txRow = await query('SELECT * FROM transactions WHERE details LIKE ? AND type = "WITHDRAW" AND status = "PENDING"', [\`%\${txId}%\`]);
                if (txRow.length > 0) {
                    const tx = txRow[0];
                    await query('UPDATE transactions SET status = ? WHERE id = ?', [status, tx.id]);
                    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [tx.amount, tx.user_id]);
                }
            }
        }
        res.status(200).send("OK");
    } catch(e) {
        console.error("Withdraw Webhook error", e);
        res.status(500).send("Error");
    }
});
`;

content = content.replace("initDB().then(() => {", webhooks + "\ninitDB().then(() => {");

fs.writeFileSync('server/index.mjs', content);
console.log('Fixed index.mjs');
