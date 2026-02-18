-- SnakeBet Pro Database Schema

-- REMOVIDO: CREATE DATABASE IF NOT EXISTS snakebet;
-- REMOVIDO: USE snakebet;
-- Em painéis compartilhados (como aaPanel/cPanel), você deve criar o banco manualmente e importar as tabelas abaixo.

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    cpf VARCHAR(14) NOT NULL UNIQUE,
    invitedBy VARCHAR(50),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    bonusBalance DECIMAL(10, 2) DEFAULT 0.00,
    cpa_earnings DECIMAL(10, 2) DEFAULT 0.00,
    revshare_earnings DECIMAL(10, 2) DEFAULT 0.00,
    is_vip BOOLEAN DEFAULT FALSE,
    vip_expiry DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    type VARCHAR(20) NOT NULL, -- DEPOSIT, WITHDRAW, BET, WIN, BONUS, CPA, REVSHARE
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED, REJECTED
    details TEXT, -- JSON or description
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- App Settings (Admin Config)
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT
);

-- Insert Default Settings
INSERT INTO settings (setting_key, setting_value) VALUES 
('min_deposit', '10.00'),
('min_withdraw', '50.00'),
('cpa_value', '10.00'),
('cpa_min_deposit', '20.00'),
('revshare_real', '20'),
('revshare_fake', '50');

-- Affiliate Links (Optional, if tracking clicks separately)
CREATE TABLE IF NOT EXISTS referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referrer_id INT,
    referred_user_id INT,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, QUALIFIED (CPA trigger)
    cpa_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);
