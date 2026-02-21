import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { User, BetRecord, Difficulty, DIFFICULTY_CONFIG, ITEM_PRICES, TransactionRecord } from '../../types';
import { Wallet, LogOut, TrendingUp, AlertTriangle, DollarSign, History, ArrowUpRight, ArrowDownLeft, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Skull, Key, CheckCircle, Menu, X, ShoppingBag, Shield, Magnet, Zap, Gift, RefreshCw, Lock, Unlock, Users, Copy, ExternalLink, Sparkles, Flame, Info, ChevronRight, Star, Crown, Clock, Instagram, Trophy, Medal, TrendingDown, Coins, Box, Star as StarIcon, Banknote, Heart, QrCode } from 'lucide-react';
import { getAppConfig, AppConfig, CONFIG_KEY } from '../../utils/config';
import { api } from '../../services/api';

interface DashboardScreenProps {
    user: User;
    betHistory: BetRecord[];
    onLogout: () => void;
    onUpdateUser: (user: User) => void;
    onStartGame: (betAmount: number, difficulty: Difficulty, source: 'REAL' | 'BONUS') => void;
}

interface RankingItem {
    id: string;
    username: string;
    amount: number;
    type: 'WIN' | 'LOSS';
    timestamp: number;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
    user,
    betHistory,
    onLogout,
    onUpdateUser,
    onStartGame
}) => {
    const [amount, setAmount] = useState('');
    const [betAmount, setBetAmount] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('MEDIUM');
    const [betSource, setBetSource] = useState<'REAL' | 'BONUS'>('REAL');
    const [historyTab, setHistoryTab] = useState<'BETS' | 'TRANSACTIONS'>('BETS');

    // App Config
    const [config, setConfig] = useState<AppConfig>(getAppConfig());

    // UI States
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRankingOpen, setIsRankingOpen] = useState(false);
    const [activeModal, setActiveModal] = useState<'NONE' | 'DEPOSIT' | 'WITHDRAW' | 'REFERRAL'>('NONE');

    // PagVIVA States
    const [depositQrCode, setDepositQrCode] = useState<string | null>(null);
    const [depositQrCodeUrl, setDepositQrCodeUrl] = useState<string | null>(null);
    const [depositCopyPaste, setDepositCopyPaste] = useState<string | null>(null);
    const [currentTxId, setCurrentTxId] = useState<string | null>(null);
    const [currentTxAmount, setCurrentTxAmount] = useState<number>(0);

    // Bonus & Box Animation State
    const [bonusReward, setBonusReward] = useState<number | null>(null);
    const [isOpeningBox, setIsOpeningBox] = useState(false);
    const [boxState, setBoxState] = useState<'IDLE' | 'SHAKING' | 'OPENED'>('IDLE');
    const [boxReward, setBoxReward] = useState<number>(0);
    const [showWithdrawCelebration, setShowWithdrawCelebration] = useState(false);

    // Notification Logic
    const [showStoreNotification, setShowStoreNotification] = useState(false);
    const [notificationType, setNotificationType] = useState<'BONUS' | 'STORE_ADS'>('BONUS');
    const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ranking / Live Feed Data
    const [rankingData, setRankingData] = useState<RankingItem[]>([]);

    // Bonus Logic
    const [timeLeft, setTimeLeft] = useState<string>('');

    // Banner Logic
    const [currentBanner, setCurrentBanner] = useState(0);

    // Processing States
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [walletError, setWalletError] = useState<string | null>(null);
    const [storeMessage, setStoreMessage] = useState<string | null>(null);
    const [referralCopied, setReferralCopied] = useState(false);

    // Listen for config changes
    useEffect(() => {
        // Sync with localStorage on mount (fixes SSR hydration mismatch)
        setConfig(getAppConfig());

        const handleConfigUpdate = () => {
            setConfig(getAppConfig());
        };
        window.addEventListener('snakebet_config_updated', handleConfigUpdate);
        window.addEventListener('storage', handleConfigUpdate); // Listen for cross-tab updates
        return () => {
            window.removeEventListener('snakebet_config_updated', handleConfigUpdate);
            window.removeEventListener('storage', handleConfigUpdate);
        };
    }, []);

    // --- BONUS LOGIC (STRICT DEPOSIT CHECK) ---
    const isNewDay = new Date(user.lastDailyBonus).getDate() !== new Date().getDate();
    const claimsToday = isNewDay ? 0 : user.dailyBonusClaims;
    const maxClaims = user.isVip ? 2 : 1;
    const hasDeposited = user.totalDeposited > 0;

    // Only allow claim if they have deposited AND haven't reached daily limit
    const canClaimBonus = hasDeposited && (claimsToday < maxClaims);
    const isBonusLocked = !hasDeposited; // If never deposited, it's locked

    // --- FAKE RANKING GENERATOR ---
    useEffect(() => {
        // Initial Population
        const initialData: RankingItem[] = Array.from({ length: 8 }).map(() => generateRandomEntry());
        setRankingData(initialData);

        // Interval to add new entries
        const interval = setInterval(() => {
            setRankingData(prev => {
                const newItem = generateRandomEntry();
                return [newItem, ...prev].slice(15); // Keep last 15
            });
        }, 3500); // New entry every 3.5 seconds

        return () => clearInterval(interval);
    }, []);

    const generateRandomEntry = (): RankingItem => {
        const names = ["Pedro", "Lucas", "Joao", "Ana", "Maria", "Carlos", "BetPro", "Snake", "Master", "King", "Lucky", "Silva", "Souza", "Lima", "Oliveira"];
        const randomName = names[Math.floor(Math.random() * names.length)];
        const suffix = Math.floor(Math.random() * 999);
        const username = `${randomName}${suffix}***`;

        // 70% chance of Win, 30% chance of Loss (Losers have low value as requested)
        const isWin = Math.random() > 0.3;

        let amount;
        if (isWin) {
            // Winners: Random between 20 and 500, sometimes BIG win
            const isBigWin = Math.random() > 0.9;
            amount = isBigWin ? (Math.random() * 2000) + 500 : (Math.random() * 200) + 20;
        } else {
            // Losers: Low values (1 to 50)
            amount = (Math.random() * 49) + 1;
        }

        return {
            id: Math.random().toString(36).substr(2, 9),
            username,
            amount,
            type: isWin ? 'WIN' : 'LOSS',
            timestamp: Date.now()
        };
    };

    // --- BONUS COUNTDOWN TIMER ---
    useEffect(() => {
        const updateTimer = () => {
            if (canClaimBonus) {
                setTimeLeft('Disponível!');
                return;
            }

            if (isBonusLocked) {
                setTimeLeft('Bloqueado');
                return;
            }

            // Logic to show time until tomorrow
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const diff = tomorrow.getTime() - now.getTime();

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const pad = (n: number) => n.toString().padStart(2, '0');
            setTimeLeft(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
        };

        updateTimer(); // Initial call
        const timerInterval = setInterval(updateTimer, 1000);

        return () => clearInterval(timerInterval);
    }, [user.lastDailyBonus, canClaimBonus, isBonusLocked]);

    // --- EXTERNAL LINKS ---
    const handleOpenInstagram = () => {
        window.open('https://instagram.com/iitech_golden', '_blank');
    };

    // --- BANNERS DATA ---
    const banners = [
        {
            id: 0,
            title: "Seja um Parceiro",
            subtitle: "É influenciador? Feche parceria exclusiva no Instagram @iitech_golden",
            actionLabel: "CHAMAR NO INSTA",
            action: handleOpenInstagram,
            gradient: "from-yellow-600 via-yellow-500 to-yellow-800",
            icon: <Crown className="text-white fill-yellow-200 animate-bounce" size={48} />,
            bgImage: "radial-gradient(circle at center, rgba(234, 179, 8, 0.3), transparent)"
        },
        {
            id: 1,
            title: "Bônus de Boas-vindas",
            subtitle: "Dobre seu primeiro depósito agora!",
            actionLabel: "DEPOSITAR",
            action: () => setActiveModal('DEPOSIT'),
            gradient: "from-green-600 via-emerald-600 to-green-900",
            icon: <Zap className="text-yellow-300 fill-yellow-300 animate-pulse" size={48} />,
            bgImage: "radial-gradient(circle at top right, rgba(57, 255, 20, 0.2), transparent)"
        },
        {
            id: 2,
            title: "Convide & Lucre",
            subtitle: "Ganhe % vitalícia sobre seus amigos.",
            actionLabel: "CONVIDAR",
            action: () => setActiveModal('REFERRAL'),
            gradient: "from-blue-600 via-indigo-600 to-purple-900",
            icon: <Users className="text-blue-300" size={48} />,
            bgImage: "radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.3), transparent)"
        },
        {
            id: 3,
            title: "Itens de Proteção",
            subtitle: "Evite perder tudo com o Escudo.",
            actionLabel: "ABRIR LOJA",
            action: () => setIsMenuOpen(true),
            gradient: "from-purple-600 via-pink-600 to-red-900",
            icon: <ShieldCheck className="text-purple-300" size={48} />,
            bgImage: "radial-gradient(circle at center, rgba(168, 85, 247, 0.2), transparent)"
        }
    ];

    // --- BANNER ROTATION ---
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentBanner((prev) => (prev + 1) % banners.length);
        }, 5000); // Change every 5 seconds
        return () => clearInterval(interval);
    }, [banners.length]);

    // --- SMART NOTIFICATION SYSTEM ---
    const scheduleNotification = () => {
        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);

        const minTime = 3 * 60 * 1000;
        const maxTime = 5 * 60 * 1000;
        const randomTime = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);

        const isFirstLoad = !notificationTimerRef.current;
        const delay = isFirstLoad ? 5000 : randomTime;

        notificationTimerRef.current = setTimeout(() => {
            if (!isMenuOpen && !isRankingOpen && !bonusReward && !isOpeningBox) {
                setNotificationType(prev => {
                    return 'BONUS';
                });
                setShowStoreNotification(true);
            }
        }, delay);
    };

    useEffect(() => {
        scheduleNotification();
        return () => {
            if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (showStoreNotification) {
            if (canClaimBonus) {
                setNotificationType('BONUS');
            } else {
                setNotificationType('STORE_ADS');
            }
        }
    }, [showStoreNotification, canClaimBonus]);

    const handleCloseNotification = () => {
        setShowStoreNotification(false);
        scheduleNotification();
    };

    const openStoreFromNotification = () => {
        setShowStoreNotification(false);
        setIsMenuOpen(true);
        scheduleNotification();
    };

    const onUpdateBalance = (newBalance: number) => {
        onUpdateUser({ ...user, balance: newBalance });
    };

    const resetModal = () => {
        setActiveModal('NONE');
        setAmount('');
        setPixKey('');
        setWalletError(null);
        setIsProcessing(false);
        setShowSuccess(false);
        setReferralCopied(false);
        setDepositQrCode(null);
        setDepositQrCodeUrl(null);
        setDepositCopyPaste(null);
        setCurrentTxId(null);
        setCurrentTxAmount(0);
    };

    // --- Affiliate Logic ---
    const fetchAffiliateStats = async () => {
        try {
            const stats = await api.getAffiliateStats();
            if (stats) {
                onUpdateUser({
                    ...user,
                    affiliateEarnings: stats.earnings,
                    referrals: stats.recentReferrals.map((r: any) => ({
                        username: r.username,
                        date: r.date,
                        depositAmount: r.depositAmount
                    }))
                });
            }
        } catch (err) {
            console.error("Failed to fetch affiliate stats", err);
        }
    };

    const handleClaimAffiliateEarnings = async () => {
        if (!user.affiliateEarnings || (user.affiliateEarnings.cpa + user.affiliateEarnings.revShare <= 0)) {
            setStoreMessage("Sem saldo de afiliado para resgatar.");
            setTimeout(() => setStoreMessage(null), 2000);
            return;
        }

        setIsProcessing(true);
        try {
            const result = await api.claimAffiliateEarnings();
            if (result && result.success) {
                setStoreMessage(`Resgate de R$ ${result.claimedAmount.toFixed(2)} realizado!`);
                setTimeout(() => setStoreMessage(null), 3000);

                // Update user balance and reset earnings
                onUpdateUser({
                    ...user,
                    balance: user.balance + result.claimedAmount,
                    affiliateEarnings: { cpa: 0, revShare: 0 }
                });

                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 2000);
            }
        } catch (err: any) {
            setStoreMessage(err.message || "Erro ao resgatar ganhos.");
            setTimeout(() => setStoreMessage(null), 2000);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        if (activeModal === 'REFERRAL') {
            fetchAffiliateStats();
        }
    }, [activeModal]);

    // --- Polling for Deposit Status ---
    useEffect(() => {
        let interval: any;

        const checkStatus = async () => {
            if (!currentTxId) return;

            const status = await api.checkDepositStatus(currentTxId);

            if (status === 'PAID' || status === 'COMPLETED' || status === 'APPROVED') {
                clearInterval(interval);
                handleDepositSuccess(currentTxAmount);
            }
        };

        if (activeModal === 'DEPOSIT' && currentTxId && !showSuccess) {
            checkStatus(); // Initial check
            interval = setInterval(checkStatus, 5000); // Poll every 5s
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeModal, currentTxId, showSuccess, config, currentTxAmount]);

    const handleDepositSuccess = (amount: number) => {
        const newTransaction: TransactionRecord = {
            id: currentTxId || Date.now().toString(),
            type: 'DEPOSIT',
            amount: amount,
            timestamp: Date.now(),
            status: 'COMPLETED'
        };

        // Confirm Deposit on Server & Process CPA
        api.confirmDeposit(currentTxId || Date.now().toString(), amount)
            .then(() => console.log("Deposit confirmed on server"))
            .catch(err => console.error("Failed to confirm deposit", err));

        onUpdateUser({
            ...user,
            balance: user.balance + amount,
            totalDeposited: (user.totalDeposited || 0) + amount,
            consecutiveFreeClaims: 0,
            transactions: [newTransaction, ...(user.transactions || [])]
        });

        setIsProcessing(false);
        setShowSuccess(true);
        // Reset QR Code after success
        setDepositQrCode(null);
        setDepositQrCodeUrl(null);
        setDepositCopyPaste(null);
        setCurrentTxId(null);
        setCurrentTxAmount(0);

        setTimeout(resetModal, 3000);
    };

    // --- Transactions ---
    const handleTransaction = async () => {
        if (isProcessing) return; // Prevent double submission

        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            setWalletError("Valor inválido.");
            return;
        }

        if (activeModal === 'WITHDRAW') {
            if (val > user.balance) {
                setWalletError("Saldo insuficiente.");
                return;
            }
            if (val < config.minWithdraw) {
                setWalletError(`Saque mínimo de R$ ${config.minWithdraw.toFixed(2)}.`);
                return;
            }

            const cleanPix = pixKey.replace(/\D/g, '');
            if (cleanPix.length !== 11) {
                setWalletError("Por favor, insira um CPF válido (11 dígitos).");
                return;
            }
        }

        if (activeModal === 'DEPOSIT') {
            // Force refresh config to ensure latest value
            const currentConfig = getAppConfig();
            if (val < currentConfig.minDeposit) {
                setWalletError(`Depósito mínimo de R$ ${currentConfig.minDeposit.toFixed(2)}.`);
                // Update state as well to keep UI in sync
                setConfig(currentConfig);
                return;
            }

            const cleanCpf = pixKey.replace(/\D/g, '');
            if (cleanCpf.length !== 11) {
                setWalletError("Por favor, insira um CPF válido para gerar o PIX.");
                return;
            }
        }

        setIsProcessing(true);
        setWalletError(null);

        try {
            if (activeModal === 'DEPOSIT') {
                const depositData = await api.createDeposit(val, pixKey.replace(/\D/g, ''));

                if (!depositData) {
                    throw new Error("Sem resposta do gateway de pagamento.");
                }

                console.log("PagVIVA Response:", depositData);

                // Safe extraction of QR Code to prevent render crashes
                let qrCodeStr = '';
                if (depositData.qrcode) {
                    if (typeof depositData.qrcode === 'string') {
                        qrCodeStr = depositData.qrcode;
                    } else if (typeof depositData.qrcode === 'object') {
                        // Try to extract content if nested, otherwise stringify
                        // @ts-ignore
                        qrCodeStr = depositData.qrcode.content || depositData.qrcode.text || JSON.stringify(depositData.qrcode);
                    } else {
                        qrCodeStr = String(depositData.qrcode);
                    }
                }

                let qrUrlStr = '';
                if (depositData.qr_code_image_url) {
                    qrUrlStr = String(depositData.qr_code_image_url);
                }

                if (!qrCodeStr) {
                    // Try to find QR Code in other common fields if main field is missing
                    // @ts-ignore
                    if (depositData.pix_key) qrCodeStr = depositData.pix_key;
                    // @ts-ignore
                    else if (depositData.emv) qrCodeStr = depositData.emv;
                }

                if (!qrCodeStr) {
                    console.error("QR Code missing in response:", depositData);
                    throw new Error("Não foi possível gerar o QR Code. Tente novamente.");
                }

                setDepositQrCode(qrCodeStr);
                setDepositQrCodeUrl(qrUrlStr);
                setDepositCopyPaste(qrCodeStr);

                // Start Polling for Status
                if (depositData.idTransaction) {
                    setCurrentTxId(depositData.idTransaction);
                    setCurrentTxAmount(val);

                    // Log PENDING Deposit
                    api.recordTransaction('DEPOSIT', val, 'PENDING', {
                        txId: depositData.idTransaction,
                        qrCode: qrCodeStr
                    }).catch(console.error);

                    // Keep isProcessing true for polling UI or reset? 
                    // Usually reset to allow user to close modal, but here we show QR Code inside modal
                    // If we keep isProcessing true, the 'Confirmar' button stays disabled which is good.
                } else {
                    console.warn("No Transaction ID returned for polling");
                    setIsProcessing(false); // Reset if no ID to poll
                }

                return;
            } else if (activeModal === 'WITHDRAW') {
                // ... existing withdraw code ...
                const withdrawData = await api.requestWithdraw(val, pixKey, 'cpf');

                // Generate unique ID based on gateway response or timestamp
                const txId = withdrawData.id || `WD-${Date.now()}`;

                // Always mark as PENDING initially - waiting for gateway processing
                // No more fake auto-approval
                const newTransaction: TransactionRecord = {
                    id: txId,
                    type: 'WITHDRAW',
                    amount: val,
                    timestamp: Date.now(),
                    status: 'PENDING',
                    pixKey: pixKey
                };

                // Log PENDING Withdraw
                api.recordTransaction('WITHDRAW', val, 'PENDING', {
                    txId: txId,
                    pixKey: pixKey
                }).catch(console.error);

                onUpdateUser({
                    ...user,
                    balance: user.balance - val,
                    transactions: [newTransaction, ...(user.transactions || [])]
                });

                setIsProcessing(false);
                setShowSuccess(true);
                setTimeout(resetModal, 2000);
                return;
            }
        } catch (e: any) {
            console.error("Transaction Error", e);
            setWalletError(e?.error || e?.message || (typeof e === 'string' ? e : "Erro ao processar transação."));
            setIsProcessing(false);
        }
    };

    // --- Store & Inventory ---
    const handleBuyItem = (item: 'SHIELD' | 'MAGNET' | 'VIP' | 'MYSTERY_BOX' | 'EXTRA_LIFE') => {
        const price = config.prices[item];

        // Strict Check: Only allow Real Balance for items
        if (user.balance < price) {
            setStoreMessage("Saldo REAL insuficiente!");
            setTimeout(() => setStoreMessage(null), 2000);
            return;
        }

        const newInventory = { ...user.inventory };

        if (item === 'SHIELD') newInventory.shields++;
        if (item === 'MAGNET') newInventory.magnets++;
        if (item === 'EXTRA_LIFE') newInventory.extraLives++;

        if (item === 'VIP') {
            // Check if already VIP
            if (user.isVip && user.vipExpiry && user.vipExpiry > Date.now()) {
                setStoreMessage("VOCÊ JÁ POSSUI VIP ATIVO!");
                setTimeout(() => setStoreMessage(null), 3000);
                return;
            }

            // MONTHLY VIP LOGIC (30 Days)
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const newExpiry = Date.now() + thirtyDaysMs;

            onUpdateUser({
                ...user,
                balance: user.balance - price,
                isVip: true,
                vipExpiry: newExpiry
            });
            setStoreMessage("VOCÊ AGORA É VIP (30 DIAS)!");
            setTimeout(() => setStoreMessage(null), 3000);
            return;
        }

        if (item === 'MYSTERY_BOX') {
            // Trigger Mystery Box Animation Sequence
            setIsMenuOpen(false);
            setIsOpeningBox(true);
            setBoxState('SHAKING');

            // --- UPDATED BOX LOGIC (60% Return on 3rd box) ---
            const currentCount = (user.boxTracker?.count || 0) + 1;
            const accumulatedSpent = (user.boxTracker?.totalSpent || 0) + price;

            let prize = 0;
            let newTracker = { count: currentCount, totalSpent: accumulatedSpent };

            if (currentCount >= 3) {
                // Guaranteed Pity System: Return 60% of total spent
                prize = accumulatedSpent * 0.60;
                // Add a tiny random variance (e.g., +/- 5%) to feel organic
                const variance = (Math.random() * 0.1) - 0.05;
                prize = prize * (1 + variance);

                // Reset tracker
                newTracker = { count: 0, totalSpent: 0 };
            } else {
                // Standard RNG (Hard to win big)
                const rand = Math.random() * 100;
                if (rand < 75) {
                    // 75% Chance: Loss (0.50 - 3.00)
                    prize = (Math.random() * 2.5) + 0.5;
                } else if (rand < 95) {
                    // 20% Chance: Small Profit / Break Even (5.00 - 8.00)
                    prize = (Math.random() * 3) + 5;
                } else if (rand < 99) {
                    // 4% Chance: Good Profit (8.00 - 12.00)
                    prize = (Math.random() * 4) + 8;
                } else {
                    // 1% Chance: Jackpot (15.00)
                    prize = 15;
                }
            }

            // Deduct cost immediately
            onUpdateUser({
                ...user,
                balance: user.balance - price,
                boxTracker: newTracker
            });

            // Delay to show prize after animation
            setTimeout(() => {
                setBoxReward(prize);
                setBoxState('OPENED');
                // Add prize
                onUpdateUser({
                    ...user,
                    balance: (user.balance - price) + prize,
                    boxTracker: newTracker
                });
            }, 3500); // 3.5s animation duration

            return;
        }

        onUpdateUser({
            ...user,
            balance: user.balance - price,
            inventory: newInventory
        });

        setStoreMessage(`Compra realizada! (-R$ ${price})`);
        setTimeout(() => setStoreMessage(null), 2000);
    };

    // --- Daily Bonus ---
    const handleClaimBonus = () => {
        if (isBonusLocked) {
            setStoreMessage("Faça um depósito primeiro!");
            setTimeout(() => setStoreMessage(null), 2000);
            return;
        }

        if (!canClaimBonus) {
            setStoreMessage("Limite diário atingido!");
            setTimeout(() => setStoreMessage(null), 2000);
            return;
        }

        // Random reward between 1 and 5
        let reward = Math.floor(Math.random() * 5) + 1;

        // VIP Perk: Double Bonus
        if (user.isVip) {
            reward *= 2;
        }

        // Logic for new day reset
        const isNewDay = new Date(user.lastDailyBonus).getDate() !== new Date().getDate();
        const newClaims = isNewDay ? 1 : user.dailyBonusClaims + 1;

        // Trigger Animation Modal
        setBonusReward(reward);
        setIsMenuOpen(false); // Close store to show modal cleanly

        onUpdateUser({
            ...user,
            bonusBalance: user.bonusBalance + reward,
            rollover: {
                current: 0,
                target: user.rollover.target + (reward * 3)
            },
            lastDailyBonus: Date.now(),
            dailyBonusClaims: newClaims,
            consecutiveFreeClaims: user.consecutiveFreeClaims + 1
        });
    };

    // --- Convert Bonus ---
    const handleConvertBonus = () => {
        if (user.rollover.current >= user.rollover.target && user.bonusBalance > 0) {
            onUpdateUser({
                ...user,
                balance: user.balance + user.bonusBalance,
                bonusBalance: 0,
                rollover: { current: 0, target: 0 }
            });
            setStoreMessage("Bônus convertido em saldo Real!");
            setTimeout(() => setStoreMessage(null), 2000);
        }
    };

    const [affiliateStats, setAffiliateStats] = useState<any>(null);

    useEffect(() => {
        if (activeModal === 'REFERRAL') {
            loadAffiliateStats();
        }
    }, [activeModal]);

    const loadAffiliateStats = async () => {
        try {
            const stats = await api.getAffiliateStats();
            setAffiliateStats(stats);
        } catch (error) {
            console.error("Failed to load affiliate stats", error);
        }
    };

    const copyReferral = () => {
        const baseUrl = window.location.origin;
        // Ensure username is safe for URL
        const safeUsername = encodeURIComponent(user.username);
        const url = `${baseUrl}/u/${safeUsername}`;

        if (navigator.share) {
            navigator.share({
                title: 'SnakeBet',
                text: 'Venha jogar SnakeBet e ganhe bônus!',
                url: url,
            }).catch(console.error);
        } else {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(() => {
                    setReferralCopied(true);
                    setTimeout(() => setReferralCopied(false), 2000);
                }).catch(err => {
                    console.error('Async: Could not copy text: ', err);
                    fallbackCopyTextToClipboard(url);
                });
            } else {
                fallbackCopyTextToClipboard(url);
            }
        }
    };

    const fallbackCopyTextToClipboard = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setReferralCopied(true);
                setTimeout(() => setReferralCopied(false), 2000);
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    };

    const copyQrCode = () => {
        if (depositCopyPaste) {
            navigator.clipboard.writeText(depositCopyPaste);
            setReferralCopied(true);
            setTimeout(() => setReferralCopied(false), 2000);
        }
    };

    // --- Game Start ---
    const handlePlay = () => {
        const bet = parseFloat(betAmount);
        setError(null);

        if (isNaN(bet) || bet <= 0) {
            setError("Digite um valor válido.");
            return;
        }

        const balanceToUse = betSource === 'REAL' ? user.balance : user.bonusBalance;
        const walletName = betSource === 'REAL' ? 'Real' : 'Bônus';

        if (bet > balanceToUse) {
            setError(`Saldo ${walletName} insuficiente.`);
            return;
        }

        if (bet < 1) {
            setError("Mínimo R$ 1,00.");
            return;
        }

        onStartGame(bet, selectedDifficulty, betSource);
    };

    return (
        <div className="min-h-screen bg-neon-dark text-white pb-24 relative overflow-x-hidden">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neon-purple/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-green/5 rounded-full blur-[100px]" />
            </div>

            {/* DYNAMIC NOTIFICATION POPUP */}
            {showStoreNotification && !bonusReward && !isOpeningBox && !showWithdrawCelebration && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-[400px] animate-in slide-in-from-top-12 fade-in duration-500 pointer-events-auto">
                    <div className="bg-[#111827]/95 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] flex items-center p-3 gap-3">

                        {/* Icon Container */}
                        <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full border ${notificationType === 'BONUS' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                            {notificationType === 'BONUS' ? (
                                <Gift size={22} className="animate-pulse" />
                            ) : (
                                <Shield size={22} />
                            )}
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                            <h4 className="font-bold text-white text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                {notificationType === 'BONUS' ? 'Resgate seu Bônus!' : 'Domine o Jogo!'}
                            </h4>
                            <p className="text-[11px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
                                {notificationType === 'BONUS' ? 'Dinheiro grátis te esperando.' : 'Compre Escudos e Ímãs na Loja.'}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0 mr-1">
                            <button
                                onClick={openStoreFromNotification}
                                className={`${notificationType === 'BONUS' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'} text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-colors tracking-wide active:scale-95`}
                            >
                                {notificationType === 'BONUS' ? 'PEGAR' : 'COMPRAR'}
                            </button>
                            <button onClick={handleCloseNotification} className="text-gray-500 hover:text-gray-300 p-1 flex items-center justify-center transition-colors">
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* --- EPIC BONUS REWARD MODAL --- */}
            {bonusReward !== null && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-500"></div>

                    <div className="relative z-10 flex flex-col items-center animate-in zoom-in-50 slide-in-from-bottom-10 duration-700">

                        {/* Rotating Sunburst Effect */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[conic-gradient(from_0deg,transparent_0_20deg,rgba(168,85,247,0.2)_40deg,transparent_60deg)] animate-[spin_10s_linear_infinite] rounded-full pointer-events-none"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-purple-500/20 rounded-full blur-[80px] animate-pulse pointer-events-none"></div>

                        {/* Confetti Particles (CSS Simulation) */}
                        <div className="absolute inset-0 pointer-events-none">
                            {[...Array(12)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute top-1/2 left-1/2 w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                                    style={{
                                        transform: `rotate(${i * 30}deg) translate(120px)`,
                                        animationDelay: `${i * 0.1}s`,
                                        animationDuration: '1.5s'
                                    }}
                                />
                            ))}
                        </div>

                        <div className="relative mb-6">
                            <Gift size={100} className="text-purple-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.8)] animate-bounce" />
                            <Sparkles size={40} className="absolute -top-2 -right-4 text-yellow-300 animate-spin-slow" />
                            <Sparkles size={30} className="absolute -bottom-2 -left-4 text-yellow-300 animate-pulse" />
                        </div>

                        <h1 className="text-3xl font-display font-black text-white italic tracking-wider mb-2 text-glow drop-shadow-xl">
                            RECOMPENSA DIÁRIA!
                        </h1>

                        <div className="bg-gradient-to-r from-gray-900 to-black border border-purple-500/50 p-6 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.3)] mb-8 text-center min-w-[280px]">
                            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Você recebeu</span>
                            <div className="text-6xl font-black font-display text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-300 filter drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                                R$ {bonusReward.toFixed(2)}
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-2 text-purple-400 text-sm font-bold bg-purple-500/10 py-1 px-3 rounded-full">
                                <Coins size={14} /> Bônus Creditado
                            </div>
                        </div>

                        <Button
                            onClick={() => setBonusReward(null)}
                            variant="neon"
                            className="px-12 py-4 text-xl shadow-[0_0_40px_rgba(57,255,20,0.5)] animate-pulse"
                        >
                            COLETAR AGORA
                        </Button>
                    </div>
                </div>
            )}

            {/* --- HAPPY WITHDRAWAL ANIMATION MODAL --- */}
            {showWithdrawCelebration && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500"></div>

                    {/* Money Rain Animation */}
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute -top-10 text-neon-green animate-[float_4s_ease-in-out_infinite]"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDuration: `${Math.random() * 2 + 3}s`,
                                    animationDelay: `${Math.random() * 2}s`
                                }}
                            >
                                <Banknote size={Math.random() * 30 + 20} className="opacity-80 rotate-12" />
                            </div>
                        ))}
                    </div>

                    <div className="relative z-10 flex flex-col items-center animate-in zoom-in-50 duration-500">
                        <div className="mb-6 relative">
                            <div className="absolute inset-0 bg-neon-green/30 blur-2xl rounded-full animate-pulse"></div>
                            <CheckCircle size={100} className="text-neon-green relative z-10 animate-bounce" />
                        </div>

                        <h2 className="text-4xl font-black text-white italic text-center mb-2 text-glow-green">
                            SAQUE SOLICITADO!
                        </h2>
                        <p className="text-gray-300 text-center mb-8 max-w-xs">
                            Parabéns! Seu dinheiro já está sendo processado e cairá na sua conta em breve.
                        </p>

                        <Button
                            onClick={() => setShowWithdrawCelebration(false)}
                            variant="neon"
                            className="px-8 py-3"
                        >
                            CONTINUAR GANHANDO
                        </Button>
                    </div>
                </div>
            )}

            {/* --- MYSTERY BOX ANIMATION MODAL --- */}
            {isOpeningBox && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500"></div>

                    <div className="relative z-10 flex flex-col items-center">

                        {boxState === 'SHAKING' && (
                            <div className="animate-[bounce_0.5s_infinite] relative">
                                {/* Glow behind */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/30 rounded-full blur-[60px] animate-pulse"></div>

                                <div className="relative z-10 animate-[spin_0.1s_linear_infinite_reverse]">
                                    <Box size={140} className="text-yellow-400 fill-yellow-600 drop-shadow-[0_0_50px_rgba(234,179,8,0.8)]" />
                                    <div className="absolute inset-0 border-4 border-yellow-200 rounded-xl animate-ping opacity-50"></div>
                                </div>
                                <p className="text-yellow-200 font-bold mt-8 text-center animate-pulse tracking-widest uppercase">
                                    Abrindo Baú Dourado...
                                </p>
                            </div>
                        )}

                        {boxState === 'OPENED' && (
                            <div className="flex flex-col items-center animate-in zoom-in-50 duration-500">
                                {/* Rays of Light */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[conic-gradient(from_0deg,transparent_0_20deg,rgba(234,179,8,0.4)_40deg,transparent_60deg)] animate-[spin_10s_linear_infinite] rounded-full pointer-events-none"></div>

                                <div className="relative mb-6">
                                    <Box size={100} className="text-yellow-400 fill-yellow-600 drop-shadow-[0_0_50px_rgba(234,179,8,1)]" />
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                                        <div className="text-6xl animate-bounce">✨</div>
                                    </div>
                                </div>

                                <h2 className="text-2xl font-black text-yellow-400 uppercase italic mb-2 text-shadow-glow">
                                    {boxReward >= 5 ? 'GRANDE SORTE!' : 'RECOMPENSA!'}
                                </h2>

                                <div className="bg-gradient-to-br from-yellow-900/80 to-black border border-yellow-500 p-8 rounded-3xl shadow-[0_0_60px_rgba(234,179,8,0.4)] text-center mb-8 min-w-[280px] relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

                                    <span className="text-yellow-500/80 text-xs font-bold uppercase tracking-widest block mb-2 relative z-10">
                                        Você encontrou
                                    </span>
                                    <div className="text-5xl font-black font-display text-white relative z-10 drop-shadow-md">
                                        R$ {boxReward.toFixed(2)}
                                    </div>
                                </div>

                                <Button
                                    onClick={() => {
                                        setIsOpeningBox(false);
                                        setBoxState('IDLE');
                                    }}
                                    variant="neon"
                                    className="px-12 py-3 bg-yellow-400 text-black border-yellow-200 hover:bg-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.6)]"
                                >
                                    GUARDAR NA CARTEIRA
                                </Button>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Left Sidebar (Store) */}
            <div className={`fixed inset-0 z-[100] transition-all duration-500 ${isMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <div
                    className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setIsMenuOpen(false)}
                />
                <div className={`absolute top-0 left-0 h-full w-[85%] max-w-[320px] bg-[#0f0f13] border-r border-white/10 shadow-2xl transform transition-transform duration-500 flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-6 flex justify-between items-center border-b border-white/5 bg-black/20">
                        <span className="font-display font-bold text-xl flex items-center gap-2">
                            <ShoppingBag className="text-neon-purple" /> Loja & Bônus
                        </span>
                        <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* ... (Existing Store Content) ... */}
                        {storeMessage && (
                            <div className="bg-neon-green/10 text-neon-green p-3 rounded-lg text-sm text-center font-bold animate-pulse border border-neon-green/20">
                                {storeMessage}
                            </div>
                        )}

                        {/* PARTNERSHIP SECTION IN STORE */}
                        <div className="relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-800 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                            <div className="glass-panel p-4 rounded-xl border border-yellow-500/30 relative z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Crown size={20} className="text-yellow-400 fill-yellow-400/20" />
                                    <h4 className="font-bold text-yellow-100 text-sm">Seja um Parceiro</h4>
                                </div>
                                <p className="text-xs text-yellow-200/80 mb-3 leading-relaxed">
                                    Você é influenciador? Venha fechar uma parceria exclusiva e lucre com a gente.
                                </p>
                                <Button
                                    onClick={handleOpenInstagram}
                                    className="w-full py-2 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black border-none text-xs hover:scale-105"
                                >
                                    <Instagram size={14} /> CHAMAR NO INSTA
                                </Button>
                                <p className="text-[9px] text-center text-yellow-500/50 mt-2 font-mono">@iitech_golden</p>
                            </div>
                        </div>

                        {/* Daily Bonus Section */}
                        <div className="relative group">
                            {!isBonusLocked && canClaimBonus && (
                                <div className="absolute -inset-[2px] rounded-xl bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-[spin_4s_linear_infinite] via-purple-500 to-transparent"></div>
                            )}
                            <div className={`absolute -inset-[1px] rounded-xl opacity-70 blur-sm animate-pulse ${isBonusLocked ? 'bg-red-900/40' : 'bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600'}`}></div>

                            <div className="relative p-4 rounded-xl bg-black border border-purple-500/30 z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <Gift className={`${isBonusLocked ? 'text-gray-500' : 'text-purple-400'}`} />
                                    <h3 className="font-bold text-white">Bônus Diário</h3>
                                </div>

                                {isBonusLocked ? (
                                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-xs mb-1">
                                            <Lock size={14} /> BLOQUEADO
                                        </div>
                                        <p className="text-[10px] text-gray-400">
                                            Faça seu primeiro depósito para desbloquear o bônus diário.
                                        </p>
                                        <Button
                                            variant="primary"
                                            className="w-full mt-2 py-2 text-xs"
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                setActiveModal('DEPOSIT');
                                            }}
                                        >
                                            DEPOSITAR AGORA
                                        </Button>
                                    </div>
                                ) : !canClaimBonus ? (
                                    <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 text-gray-400 font-bold text-xs mb-1">
                                            <Clock size={14} className="animate-pulse" /> PRÓXIMO EM
                                        </div>
                                        <div className="text-xl font-mono font-bold text-white tracking-widest">
                                            {timeLeft}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-[10px] text-gray-400 mb-4">
                                            {user.isVip ? 'VIP: Resgate 2x + Bônus Dobro!' : 'Resgate até R$ 5,00 grátis.'}
                                        </p>
                                        <Button variant="primary" fullWidth onClick={handleClaimBonus} className="py-2 text-sm bg-purple-600 border-purple-400 hover:bg-purple-500">
                                            RESGATAR AGORA
                                        </Button>
                                    </>
                                )}

                                <div className="mt-2 flex justify-between text-[9px] text-gray-500 uppercase font-bold tracking-wider">
                                    {user.isVip && (
                                        <span className="text-yellow-500 flex items-center gap-1"><StarIcon size={8} fill="currentColor" /> VIP ATIVO</span>
                                    )}
                                    <span>Hoje: {user.dailyBonusClaims}/{user.isVip ? 2 : 1}</span>
                                </div>
                            </div>
                        </div>

                        {/* Wallet Conversion Section */}
                        <div className="glass-panel p-4 rounded-xl border-t border-white/10">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                <RefreshCw size={12} /> Conversão de Bônus
                            </h4>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Progresso:</span>
                                <span className="text-purple-400 font-mono">
                                    R$ {user.rollover.current.toFixed(2)} / {user.rollover.target.toFixed(2)}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-700 rounded-full mb-4 overflow-hidden">
                                <div
                                    className="h-full bg-purple-500 transition-all duration-500"
                                    style={{ width: `${Math.min((user.rollover.current / (user.rollover.target || 1)) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <Button
                                variant="secondary"
                                fullWidth
                                className="py-2 text-xs"
                                onClick={handleConvertBonus}
                                disabled={user.rollover.current < user.rollover.target || user.bonusBalance <= 0}
                            >
                                {user.rollover.current >= user.rollover.target ? (
                                    <span className="flex items-center gap-2 text-green-400"><Unlock size={14} /> CONVERTER</span>
                                ) : (
                                    <span className="flex items-center gap-2"><Lock size={14} /> Bloqueado</span>
                                )}
                            </Button>
                        </div>

                        {/* VIP MEMBERSHIP */}
                        {!user.isVip ? (
                            <div className="relative group overflow-hidden rounded-xl border border-yellow-500/50 p-4">
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 to-black z-0"></div>
                                <div className="absolute top-0 right-0 p-2"><Crown size={40} className="text-yellow-500 opacity-20" /></div>
                                <div className="relative z-10">
                                    <h3 className="text-yellow-400 font-black italic text-lg mb-1">CLUBE VIP</h3>
                                    <ul className="text-[10px] text-yellow-200/80 mb-3 space-y-1">
                                        <li>• Resgate Bônus 2x por Dia</li>
                                        <li>• Valor do Bônus em Dobro</li>
                                        <li>• Destaque Dourado no Ranking</li>
                                        <li>• Skin de Cobra Dourada</li>
                                    </ul>
                                    <Button variant="neon" fullWidth className="py-2 text-xs bg-yellow-500 text-black border-yellow-400 hover:bg-yellow-400" onClick={() => handleBuyItem('VIP')}>
                                        ASSINAR (30 DIAS) - R$ {config.prices.VIP.toFixed(2)}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative group overflow-hidden rounded-xl border border-yellow-500/20 p-4 bg-yellow-900/10">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-yellow-500 font-bold flex items-center gap-2"><Crown size={18} /> MEMBRO VIP</h3>
                                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">ATIVO</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mb-2">
                                    Expira em: {user.vipExpiry ? new Date(user.vipExpiry).toLocaleDateString() : 'N/A'}
                                </p>
                                <Button variant="secondary" fullWidth disabled className="py-2 text-xs border-yellow-500/30 text-yellow-500 opacity-50 cursor-not-allowed">
                                    VIP ATIVO
                                </Button>
                            </div>
                        )}

                        {/* MYSTERY BOX */}
                        <div className="relative group overflow-hidden rounded-xl border border-purple-500/50 p-4">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black z-0"></div>
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <h3 className="text-yellow-300 font-bold text-sm mb-1 flex items-center gap-1">
                                        <StarIcon size={12} fill="currentColor" /> Caixa de Ouro
                                    </h3>
                                    <p className="text-[10px] text-gray-400 mb-2">Sorteio de R$ 0,50 a R$ 15,00</p>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" className="py-1 px-3 text-xs border-purple-500/50 hover:bg-yellow-500/20 hover:text-yellow-200 hover:border-yellow-500/50 transition-colors" onClick={() => handleBuyItem('MYSTERY_BOX')}>
                                            ABRIR - R$ {config.prices.MYSTERY_BOX.toFixed(2)}
                                        </Button>
                                        {user.boxTracker?.count > 0 && (
                                            <div className="text-[9px] text-gray-500 flex items-center bg-white/5 px-2 rounded-lg">
                                                {user.boxTracker.count}/3
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-yellow-500 blur-xl opacity-20 animate-pulse"></div>
                                    <Box size={40} className="text-yellow-400 fill-yellow-600 animate-bounce relative z-10" />
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-px bg-white/5"></div>

                        {/* Items */}
                        <div className="space-y-4">
                            {/* Vida Extra - NEW ITEM */}
                            <div className="flex justify-between items-center relative overflow-hidden rounded-lg p-2 bg-red-900/10 border border-red-500/30">
                                <div className="flex items-center gap-3">
                                    <Heart className="text-red-500 fill-red-500 animate-pulse" size={20} />
                                    <div>
                                        <div className="text-sm font-bold text-red-100">Vida Extra</div>
                                        <div className="text-[10px] text-red-300">R$ {config.prices.EXTRA_LIFE.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-white bg-black/50 px-2 py-1 rounded">x{user.inventory?.extraLives || 0}</span>
                                    <Button variant="danger" className="py-1 px-3 text-xs" onClick={() => handleBuyItem('EXTRA_LIFE')}>
                                        +
                                    </Button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Shield className="text-blue-400" size={20} />
                                    <div>
                                        <div className="text-sm font-bold">Escudo</div>
                                        <div className="text-[10px] text-gray-500">R$ {config.prices.SHIELD.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-white bg-black/50 px-2 py-1 rounded">x{user.inventory?.shields || 0}</span>
                                    <Button variant="secondary" className="py-1 px-3 text-xs" onClick={() => handleBuyItem('SHIELD')}>
                                        +
                                    </Button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Magnet className="text-yellow-400" size={20} />
                                    <div>
                                        <div className="text-sm font-bold">Ímã</div>
                                        <div className="text-[10px] text-gray-500">R$ {config.prices.MAGNET.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-white bg-black/50 px-2 py-1 rounded">x{user.inventory?.magnets || 0}</span>
                                    <Button variant="secondary" className="py-1 px-3 text-xs" onClick={() => handleBuyItem('MAGNET')}>
                                        +
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 pb-4 text-center opacity-30 text-[9px] font-mono tracking-widest uppercase">
                            Sistema desenvolvido por<br />
                            <span className="font-bold text-yellow-500">@iitech_golden</span>
                        </div>

                    </div>
                </div>
            </div>

            {/* Right Sidebar (Ranking / Live Feed) */}
            <div className={`fixed inset-0 z-[100] transition-all duration-500 ${isRankingOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <div
                    className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${isRankingOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setIsRankingOpen(false)}
                />
                <div className={`absolute top-0 right-0 h-full w-[85%] max-w-[320px] bg-[#0f0f13] border-l border-white/10 shadow-2xl transform transition-transform duration-500 flex flex-col ${isRankingOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-6 flex justify-between items-center border-b border-white/5 bg-black/20">
                        <span className="font-display font-bold text-xl flex items-center gap-2">
                            <Trophy className="text-yellow-400" /> Ranking Global
                        </span>
                        <button onClick={() => setIsRankingOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 bg-yellow-500/5 border-b border-white/5">
                        <div className="flex items-center gap-2 text-xs text-yellow-500 font-bold animate-pulse">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                            APOSTAS AO VIVO
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {rankingData.map((item, index) => (
                            <div
                                key={item.id}
                                className={`p-3 rounded-xl border flex items-center justify-between animate-in slide-in-from-right-4 fade-in duration-300 ${item.type === 'WIN' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/10'}`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Avatar / Rank */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${item.type === 'WIN' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                                        {index === 0 && item.type === 'WIN' ? <Crown size={14} /> : (item.username.substring(0, 1))}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-gray-200">{item.username}</div>
                                        <div className="text-[10px] text-gray-500">Snake Pro</div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className={`font-mono font-bold text-sm flex items-center justify-end gap-1 ${item.type === 'WIN' ? 'text-neon-green' : 'text-red-500'}`}>
                                        {item.type === 'WIN' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {item.type === 'WIN' ? '+' : '-'}{item.amount.toFixed(2)}
                                    </div>
                                    <div className="text-[9px] text-gray-600 uppercase tracking-wider">
                                        {item.type === 'WIN' ? 'Ganhou' : 'Perdeu'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Header */}
            <header className="px-6 py-5 glass-panel sticky top-0 z-50 border-b-0 border-b-white/5 backdrop-blur-xl">
                <div className="max-w-xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMenuOpen(true)}
                            className="p-2 -ml-2 hover:bg-white/10 rounded-xl transition-colors text-white relative group"
                        >
                            <div className="absolute inset-0 bg-purple-500/20 rounded-xl blur-sm group-hover:bg-purple-500/40 transition-all"></div>
                            <Menu size={24} className="relative z-10" />
                            {canClaimBonus && <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full animate-ping z-20"></span>}
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-neon-green blur opacity-40 rounded-full animate-pulse"></div>
                                <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center border relative z-10 ${user.isVip ? 'border-yellow-500' : 'border-neon-green/50'}`}>
                                    <span className={`font-display font-bold ${user.isVip ? 'text-yellow-500' : 'text-neon-green'}`}>{user.username.substring(0, 2).toUpperCase()}</span>
                                    {user.isVip && <div className="absolute -top-2 -right-2"><Crown size={14} className="text-yellow-500 fill-yellow-500" /></div>}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-display font-bold text-lg leading-tight flex items-center gap-1">
                                    {user.username}
                                    {user.isVip && <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1 rounded border border-yellow-500/50">VIP</span>}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* RANKING TOGGLE BUTTON */}
                        <button
                            onClick={() => setIsRankingOpen(true)}
                            className="p-2 bg-yellow-500/10 text-yellow-400 rounded-full border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors relative group"
                        >
                            <Trophy size={20} />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full animate-ping"></span>
                        </button>

                        <button
                            onClick={() => setActiveModal('REFERRAL')}
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] animate-pulse hover:scale-105 transition-transform"
                        >
                            <Users size={14} /> INDIQUE
                        </button>
                        <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Rest of the component (Game Config, History, Footer) - No major changes needed there except ensuring they render correctly */}
            <main className="max-w-xl mx-auto p-6 space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

                {/* === ROTATING BANNER SYSTEM === */}
                <div className="relative w-full h-40 rounded-3xl overflow-hidden shadow-2xl border border-white/5 group">
                    {banners.map((banner, index) => (
                        <div
                            key={banner.id}
                            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                        >
                            {/* Background with Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-r ${banner.gradient} opacity-90`}></div>

                            {/* Decorative Background Image */}
                            <div className="absolute inset-0" style={{ background: banner.bgImage }}></div>
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

                            {/* Content */}
                            <div className="relative h-full flex flex-col justify-center px-6 z-20">
                                <div className="flex justify-between items-center">
                                    <div className="max-w-[70%]">
                                        <h3 className="text-2xl font-display font-black text-white leading-none mb-1 drop-shadow-md">
                                            {banner.title}
                                        </h3>
                                        <p className="text-xs text-white/80 font-medium mb-4 leading-tight">
                                            {banner.subtitle}
                                        </p>
                                        <button
                                            onClick={banner.action}
                                            className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:scale-105 transition-transform shadow-lg"
                                        >
                                            {banner.actionLabel} <ChevronRight size={12} />
                                        </button>
                                    </div>

                                    {/* Icon with float animation */}
                                    <div className="transform rotate-12 drop-shadow-2xl animate-float">
                                        {banner.icon}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Indicators */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                        {banners.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentBanner(index)}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentBanner ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Dual Wallet Display */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Real Wallet */}
                    <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-neon-green relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <DollarSign size={40} />
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Saldo Real</span>
                        <div className="text-2xl font-display font-black text-white mt-1">
                            R$ {user.balance.toFixed(2)}
                        </div>
                    </div>

                    {/* Bonus Wallet */}
                    <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-purple-500 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Gift size={40} />
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Saldo Bônus</span>
                        <div className="text-2xl font-display font-black text-purple-400 mt-1">
                            R$ {user.bonusBalance.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Actions with 3D Button */}
                <div className="grid grid-cols-2 gap-3 items-stretch">
                    {/* 3D DEPOSIT BUTTON */}
                    <button
                        onClick={() => setActiveModal('DEPOSIT')}
                        className="group relative h-16 w-full"
                    >
                        {/* Rotating Glow Border (The "Bonus" effect) */}
                        <div className="absolute -inset-[3px] rounded-xl bg-[conic-gradient(from_0deg,transparent_0_340deg,#39ff14_360deg)] opacity-100 animate-[spin_3s_linear_infinite] z-0"></div>

                        {/* 3D Shadow/Bottom part */}
                        <div className="absolute inset-[1px] top-2 bg-[#145209] rounded-xl z-10"></div>

                        {/* Main 3D Face */}
                        <div className="absolute inset-[1px] bg-gradient-to-t from-[#2db312] to-[#39ff14] rounded-xl border border-[#39ff14] flex items-center justify-center gap-2 transform transition-transform duration-100 group-active:translate-y-1.5 z-20">

                            {/* Inner Shine */}
                            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-xl"></div>

                            {/* Pulse Glow Behind */}
                            <div className="absolute inset-0 bg-neon-green/50 blur-lg opacity-0 group-hover:opacity-100 transition-opacity animate-pulse"></div>

                            <div className="relative z-10 flex items-center gap-2 font-display font-black text-black text-sm tracking-wide">
                                <ArrowDownCircle size={20} strokeWidth={3} />
                                DEPOSITAR
                            </div>
                        </div>

                        {/* Fire Effect */}
                        <div className="absolute -top-3 -right-2 z-30 animate-bounce">
                            <div className="relative">
                                <Flame className="text-yellow-300 fill-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,1)]" size={28} />
                                <div className="absolute inset-0 bg-orange-500/50 blur-md rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </button>

                    <Button onClick={() => setActiveModal('WITHDRAW')} variant="secondary" className="h-16 text-sm rounded-xl">
                        <ArrowUpCircle size={18} /> Sacar
                    </Button>
                </div>

                {/* Modals Container */}
                {activeModal !== 'NONE' && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={resetModal}></div>

                        {/* Modal Content */}
                        <div className="glass-panel p-6 rounded-3xl animate-in zoom-in duration-300 relative z-50 w-full max-w-sm overflow-y-auto max-h-[90vh]">
                            <button onClick={resetModal} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                                <X size={20} />
                            </button>

                            {/* REFERRAL MODAL */}
                            {activeModal === 'REFERRAL' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                            <Users size={32} className="text-blue-400" />
                                        </div>
                                        <h3 className="font-display font-bold text-2xl text-white">Indique e Ganhe</h3>
                                        <p className="text-gray-400 text-xs mt-2">
                                            Compartilhe seu link exclusivo e ganhe <strong className="text-neon-green">{config.fakeRevShare}% de RevShare</strong> sobre as perdas dos seus indicados e <strong className="text-neon-green">R$ {config.cpaValue.toFixed(2)}</strong> pelo primeiro depósito a partir de <strong className="text-neon-green">R$ {config.cpaMinDeposit.toFixed(2)}</strong> (CPA)!
                                        </p>
                                    </div>

                                    {/* Earnings Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-[#1a1a1c] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider relative z-10">Ganhos CPA</span>
                                            <span className="text-lg font-mono font-bold text-emerald-400 relative z-10">
                                                R$ {(user.affiliateEarnings?.cpa || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="bg-[#1a1a1c] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider relative z-10">Ganhos RevShare</span>
                                            <span className="text-lg font-mono font-bold text-blue-400 relative z-10">
                                                R$ {(user.affiliateEarnings?.revShare || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Claim Button */}
                                    <div className="mt-2">
                                        <Button
                                            onClick={handleClaimAffiliateEarnings}
                                            disabled={!user.affiliateEarnings || (user.affiliateEarnings.cpa + user.affiliateEarnings.revShare <= 0) || isProcessing}
                                            className={`w-full py-3 font-bold text-sm ${(!user.affiliateEarnings || (user.affiliateEarnings.cpa + user.affiliateEarnings.revShare <= 0)) ? 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-400' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}
                                        >
                                            {isProcessing ? 'PROCESSANDO...' : `RESGATAR R$ ${((user.affiliateEarnings?.cpa || 0) + (user.affiliateEarnings?.revShare || 0)).toFixed(2)}`}
                                        </Button>
                                        <p className="text-[10px] text-gray-500 text-center mt-2">
                                            O valor será creditado no seu Saldo Real.
                                        </p>
                                    </div>

                                    <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                                        <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">Seu Link de Indicação</label>
                                        <div className="flex gap-2">
                                            <code className="flex-1 bg-black/60 p-3 rounded-lg text-sm text-blue-400 font-mono overflow-hidden text-ellipsis whitespace-nowrap border border-white/5">
                                                {window.location.origin}/u/{user.username}
                                            </code>
                                            <button
                                                onClick={copyReferral}
                                                className="p-3 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors"
                                            >
                                                {referralCopied ? <CheckCircle size={18} /> : <Copy size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-sm text-gray-300 mb-4 flex items-center gap-2">
                                            <History size={14} /> Seus Indicados Recentes
                                        </h4>
                                        <div className="max-h-[200px] overflow-y-auto pr-2 space-y-2">
                                            {affiliateStats?.recentReferrals && affiliateStats.recentReferrals.length > 0 ? (
                                                affiliateStats.recentReferrals.map((ref: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center text-xs font-bold">
                                                                {ref.username.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-bold text-gray-200">{ref.username}</div>
                                                                <div className="text-[10px] text-gray-500">{new Date(ref.date).toLocaleDateString()}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500">Depositou</div>
                                                            <div className="text-sm font-bold text-neon-green">R$ {(ref.depositAmount || 0).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 text-gray-500 text-xs">
                                                    Você ainda não tem indicações.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TRANSACTION MODALS (DEPOSIT/WITHDRAW) */}
                            {(activeModal === 'DEPOSIT' || activeModal === 'WITHDRAW') && (
                                showSuccess ? (
                                    <div className="flex flex-col items-center justify-center py-4 text-green-400 gap-2">
                                        <CheckCircle size={48} className="animate-bounce" />
                                        <span className="font-bold text-lg">{activeModal === 'DEPOSIT' ? 'Depósito Realizado!' : 'Saque Solicitado!'}</span>
                                    </div>
                                ) : depositQrCode && activeModal === 'DEPOSIT' ? (
                                    <div className="flex flex-col items-center justify-center space-y-4">
                                        <h3 className="font-bold text-lg text-white">Pagamento via PIX</h3>
                                        <div className="bg-white p-2 rounded-xl">
                                            {depositQrCodeUrl ? (
                                                <img src={depositQrCodeUrl} alt="QR Code PIX" className="w-48 h-48 object-contain" />
                                            ) : (
                                                <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-black">QR Code</div>
                                            )}
                                        </div>
                                        <div className="w-full">
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Copia e Cola</label>
                                            <div className="flex gap-2">
                                                <input
                                                    readOnly
                                                    value={depositQrCode}
                                                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono"
                                                />
                                                <button
                                                    onClick={copyQrCode}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                                                >
                                                    {referralCopied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-center text-[10px] text-gray-400 max-w-[250px] flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-2 text-neon-green font-bold animate-pulse">
                                                <RefreshCw size={12} className="animate-spin" />
                                                Aguardando confirmação do pagamento...
                                            </div>
                                            <span className="opacity-50">O saldo será creditado automaticamente.</span>
                                        </div>
                                        <Button variant="secondary" fullWidth onClick={resetModal} className="mt-2">
                                            Fechar
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="font-bold mb-4">{activeModal === 'DEPOSIT' ? 'Depósito via Pix' : 'Saque via Pix'}</h3>

                                        {/* CPF WARNING FOR WITHDRAWAL */}
                                        {activeModal === 'WITHDRAW' && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/50 p-3 rounded-xl flex items-start gap-3 mb-4 animate-pulse">
                                                <div className="bg-yellow-500/20 p-1.5 rounded-full shrink-0">
                                                    <Info className="text-yellow-500" size={16} />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-yellow-200 text-xs font-bold">Atenção!</p>
                                                    <p className="text-yellow-400/80 text-[10px] leading-tight">
                                                        Saques são processados <strong>apenas para chaves PIX do tipo CPF</strong>. Outros tipos de chave serão estornados.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <Input
                                                label="Valor (R$)"
                                                type="number"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                icon={<DollarSign size={16} />}
                                            />
                                            {(activeModal === 'WITHDRAW' || activeModal === 'DEPOSIT') && (
                                                <Input
                                                    label={activeModal === 'DEPOSIT' ? "Seu CPF (Para o PIX)" : "Chave Pix (CPF)"}
                                                    value={pixKey}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        // Allow only numbers
                                                        if (/^\d*$/.test(v)) {
                                                            setPixKey(v);
                                                        }
                                                    }}
                                                    icon={<Key size={16} />}
                                                    placeholder="Apenas números (CPF)"
                                                    maxLength={11}
                                                />
                                            )}
                                        </div>
                                        {walletError && <p className="text-red-500 text-xs mt-2">{walletError}</p>}
                                        <div className="flex gap-2 mt-4">
                                            <Button variant="secondary" fullWidth onClick={resetModal}>Cancelar</Button>
                                            <Button variant="primary" fullWidth onClick={handleTransaction} disabled={isProcessing}>
                                                {isProcessing ? 'Processando...' : 'Confirmar'}
                                            </Button>
                                        </div>
                                    </>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* Game Config Card */}
                <div className="relative">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <TrendingUp className="text-neon-green" size={20} />
                        <h2 className="text-lg font-display font-bold">Configurar Partida</h2>
                    </div>

                    <div className="glass-panel p-6 rounded-3xl border border-neon-green/10 shadow-[0_0_50px_-20px_rgba(57,255,20,0.15)]">
                        <div className="space-y-6">

                            {/* Bet Amount */}
                            <div>
                                <div className="flex justify-between mb-3 px-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Valor da Aposta</label>

                                    {/* Wallet Selector */}
                                    <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
                                        <button
                                            onClick={() => setBetSource('REAL')}
                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${betSource === 'REAL' ? 'bg-neon-green text-black' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            REAL
                                        </button>
                                        <button
                                            onClick={() => setBetSource('BONUS')}
                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${betSource === 'BONUS' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            BÔNUS
                                        </button>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <div className={`absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center border-r border-white/10 z-10 font-bold bg-white/5 rounded-l-xl ${betSource === 'BONUS' ? 'text-purple-400' : 'text-gray-400'}`}>
                                        R$
                                    </div>
                                    <input
                                        type="number"
                                        className={`w-full bg-black/50 border rounded-xl py-6 pl-16 pr-4 text-3xl font-display font-bold text-white outline-none transition-all placeholder-gray-700 ${betSource === 'BONUS' ? 'border-purple-500/30 focus:border-purple-500' : 'border-white/10 focus:border-neon-green'}`}
                                        placeholder="0.00"
                                        value={betAmount}
                                        onChange={(e) => {
                                            setBetAmount(e.target.value);
                                            setError(null);
                                        }}
                                    />
                                </div>

                                {/* Quick Select */}
                                <div className="grid grid-cols-4 gap-2 mt-3">
                                    {[5, 10, 25, 50].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => setBetAmount(val.toString())}
                                            className="py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-medium transition-colors"
                                        >
                                            R$ {val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Difficulty Selector */}
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block px-1">Nível de Risco</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((level) => {
                                        const config = DIFFICULTY_CONFIG[level];
                                        const isSelected = selectedDifficulty === level;
                                        return (
                                            <button
                                                key={level}
                                                onClick={() => setSelectedDifficulty(level)}
                                                className={`
                                            relative py-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-1
                                            ${isSelected
                                                        ? `${config.bg} ${config.color} shadow-lg scale-105 z-10 border-current`
                                                        : 'bg-black/40 border-white/5 text-gray-500 hover:bg-white/5'}
                                        `}
                                            >
                                                <span className="text-xs font-bold uppercase tracking-wider">{config.label}</span>
                                                <span className="text-[10px] opacity-80">{config.multiplier}x</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-pulse">
                                    <AlertTriangle size={16} />
                                    {error}
                                </div>
                            )}

                            <Button
                                onClick={handlePlay}
                                variant={betSource === 'BONUS' ? 'primary' : 'neon'}
                                fullWidth
                                className={`py-5 text-xl ${betSource === 'BONUS' ? 'bg-purple-600 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'shadow-[0_0_30px_rgba(57,255,20,0.3)]'}`}
                            >
                                INICIAR {betSource === 'BONUS' && '(BÔNUS)'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* History Section */}
                <div className="relative">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                            <History className="text-gray-400" size={20} />
                            <h2 className="text-lg font-display font-bold text-gray-200">Histórico</h2>
                        </div>

                        {/* History Filter Toggle */}
                        <div className="bg-white/5 rounded-lg p-0.5 flex">
                            <button
                                onClick={() => setHistoryTab('BETS')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyTab === 'BETS' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                Apostas
                            </button>
                            <button
                                onClick={() => setHistoryTab('TRANSACTIONS')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyTab === 'TRANSACTIONS' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                Transações
                            </button>
                        </div>
                    </div>

                    <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
                        {historyTab === 'BETS' ? (
                            betHistory.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm font-medium">
                                    Nenhuma aposta realizada nesta sessão.
                                </div>
                            ) : (
                                <div className="max-h-[300px] overflow-y-auto">
                                    {betHistory.map((bet) => (
                                        <div key={bet.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${bet.outcome === 'WIN' ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                                                    {bet.outcome === 'WIN' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${bet.outcome === 'WIN' ? 'text-white' : 'text-gray-400'}`}>
                                                        {bet.outcome === 'WIN' ? 'Vitória' : 'Derrota'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        {bet.source === 'BONUS' && <Gift size={10} className="text-purple-400" />}
                                                        {new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className={`font-mono font-bold text-sm ${bet.outcome === 'WIN' ? 'text-neon-green text-glow-green' : 'text-gray-500'}`}>
                                                    {bet.outcome === 'WIN' ? '+' : ''}{bet.profit.toFixed(2)}
                                                </div>
                                                <div className="text-[10px] text-gray-600">
                                                    Aposta: <span className="text-gray-500">R$ {bet.betAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            // TRANSACTIONS HISTORY
                            (user.transactions && user.transactions.length > 0) ? (
                                <div className="max-h-[300px] overflow-y-auto">
                                    {user.transactions.map((tx) => (
                                        <div key={tx.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tx.type === 'DEPOSIT' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-orange-500/10 border-orange-500/30 text-orange-500'}`}>
                                                    {tx.type === 'DEPOSIT' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-200">
                                                        {tx.type === 'DEPOSIT' ? 'Depósito Pix' : 'Saque Pix'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className={`font-mono font-bold text-sm ${tx.type === 'DEPOSIT' ? 'text-blue-400' : 'text-orange-400'}`}>
                                                    {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount.toFixed(2)}
                                                </div>
                                                <div className="text-[10px] text-gray-600 flex items-center justify-end gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${tx.status === 'COMPLETED' ? 'bg-green-500' :
                                                        tx.status === 'REJECTED' ? 'bg-red-500' :
                                                            'bg-amber-500'
                                                        }`}></span>
                                                    {tx.status === 'COMPLETED' ? 'Sucesso' :
                                                        tx.status === 'REJECTED' ? 'Rejeitado' :
                                                            'Pendente'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500 text-sm font-medium">
                                    Nenhuma transação encontrada.
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Main Footer Credits */}
                <div className="text-center pb-8 pt-4 opacity-20 text-[10px] font-mono uppercase tracking-widest hover:opacity-50 transition-opacity">
                    Sistema desenvolvido por <span className="font-bold text-yellow-500">@iitech_golden</span>
                </div>

            </main>
        </div>
    );
};