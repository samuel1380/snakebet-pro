import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Point, Direction, GRID_SIZE, GameConfig, Difficulty, DIFFICULTY_CONFIG } from '../../types';
import { useInterval } from '../../hooks/useInterval';
import { api } from '../../services/api';
import { Coins, AlertOctagon, Zap, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Skull, Ghost, Bomb, Flame, Shield, Magnet, Timer, Sword, XCircle, HeartPulse, Wallet, Heart, CheckCircle2 } from 'lucide-react';

interface GameScreenProps {
    betAmount: number;
    difficulty: Difficulty;
    userInventory: { shields: number, magnets: number, extraLives: number };
    isVip: boolean; // Prop to determine skin
    onConsumeItem: (item: 'SHIELD' | 'MAGNET' | 'EXTRA_LIFE') => void;
    onGameOver: (finalWin: number) => void;
    onCancelMatch: () => void;
}

type GamePhase = 'LOBBY' | 'PLAYING' | 'CRASHED' | 'REVIVING';

const ControlBtn = ({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) => (
    <button
        className="bg-white/10 p-4 rounded-xl flex items-center justify-center active:bg-neon-green/50 active:scale-95 transition-all touch-manipulation text-white"
        onPointerDown={(e) => {
            e.preventDefault();
            onClick();
        }}
    >
        {React.cloneElement(icon as React.ReactElement<any>, { fill: "currentColor" })}
    </button>
);

export const GameScreen: React.FC<GameScreenProps> = ({ betAmount, difficulty, userInventory, isVip, onConsumeItem, onGameOver, onCancelMatch }) => {
    const diffConfig = DIFFICULTY_CONFIG[difficulty];

    // Phase Control
    const [phase, setPhase] = useState<GamePhase>('LOBBY');
    const [lobbyTimer, setLobbyTimer] = useState(10); // Alterado para 10 segundos
    const [gameId, setGameId] = useState<string | null>(null);

    // Loadout State (Pre-Game Selection)
    const [equippedItems, setEquippedItems] = useState({
        shield: false,
        magnet: false
    });

    // Game State
    const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]);
    const [bots, setBots] = useState<Point[][]>([]);
    const [apple, setApple] = useState<Point>({ x: 5, y: 5 });
    const [bomb, setBomb] = useState<Point | null>(null);
    const [direction, setDirection] = useState<Direction>(Direction.UP);
    const [crashReason, setCrashReason] = useState<'WALL' | 'SELF' | 'BOT' | 'BOMB' | 'WIN'>('WALL');

    // Combo & Tension State
    const [comboCount, setComboCount] = useState(0);
    const [comboTimer, setComboTimer] = useState(0);
    const [lastAppleTime, setLastAppleTime] = useState(0);

    // In-Game Item State
    const [shieldsUsed, setShieldsUsed] = useState(0);
    const [magnetActive, setMagnetActive] = useState(false);
    const [magnetTimer, setMagnetTimer] = useState(0);

    // Revive Mechanic State
    const [reviveTimer, setReviveTimer] = useState(10);
    const [isGhostMode, setIsGhostMode] = useState(false); // Invincibility after revive

    const [config, setConfig] = useState<GameConfig>({
        betAmount,
        potentialWin: 0,
        multiplier: diffConfig.multiplier,
        applesEaten: 0,
        difficulty
    });

    const directionRef = useRef(Direction.UP);
    const gameAreaRef = useRef<HTMLDivElement>(null);

    // Swipe Ref
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);

    // Determine Tension Level (0 to 3) based on profit multiplier
    const currentMultiplier = config.potentialWin / (config.betAmount || 1);
    const tensionLevel = currentMultiplier > 5 ? 3 : currentMultiplier > 2 ? 2 : currentMultiplier > 0.5 ? 1 : 0;

    // --- LOBBY LOGIC ---
    useEffect(() => {
        let timer: any;
        if (phase === 'LOBBY') {
            timer = setInterval(() => {
                setLobbyTimer((prev) => {
                    if (prev <= 1) {
                        startGame();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [phase, equippedItems]);

    // --- REVIVE TIMER LOGIC ---
    useEffect(() => {
        let timer: any;
        if (phase === 'REVIVING') {
            timer = setInterval(() => {
                setReviveTimer((prev) => {
                    if (prev <= 1) {
                        // Time ran out, really game over
                        onGameOver(0);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [phase]);

    // --- GHOST MODE TIMER ---
    useEffect(() => {
        if (isGhostMode) {
            const timer = setTimeout(() => {
                setIsGhostMode(false);
            }, 3000); // 3 seconds immunity
            return () => clearTimeout(timer);
        }
    }, [isGhostMode]);

    // --- COMBO TIMER LOGIC ---
    useEffect(() => {
        let interval: any;
        if (phase === 'PLAYING' && comboTimer > 0) {
            interval = setInterval(() => {
                setComboTimer(prev => Math.max(0, prev - 100)); // Decrease by 100ms
            }, 100);
        } else if (comboTimer <= 0) {
            setComboCount(0); // Reset combo if time runs out
        }
        return () => clearInterval(interval);
    }, [phase, comboTimer]);

    const toggleEquip = (item: 'shield' | 'magnet') => {
        if (item === 'shield' && userInventory.shields > 0) {
            setEquippedItems(prev => ({ ...prev, shield: !prev.shield }));
        }
        if (item === 'magnet' && userInventory.magnets > 0) {
            setEquippedItems(prev => ({ ...prev, magnet: !prev.magnet }));
        }
    };

    const startGame = async () => {
        if (phase === 'PLAYING') return;

        try {
            const response = await api.startGame(betAmount);
            setGameId(response.gameId);

            // Consume items based on selection
            if (equippedItems.shield) onConsumeItem('SHIELD');
            if (equippedItems.magnet) onConsumeItem('MAGNET');

            // Setup Initial Game State
            if (equippedItems.magnet) {
                setMagnetActive(true);
                setMagnetTimer(100); // 10 seconds
            }

            setPhase('PLAYING');
            initGameBoard();
        } catch (err: any) {
            console.error("Start Game Error", err);
            alert(err?.error || err?.message || "Erro ao iniciar partida.");
            onCancelMatch();
        }
    };

    const finishGameSession = async (multiplier: number) => {
        if (!gameId) {
            onGameOver(0);
            return;
        }
        try {
            const res = await api.endGame(gameId, multiplier);
            onGameOver(res.winAmount);
        } catch (err) {
            console.error("End Game Error", err);
            onGameOver(0);
        }
    };

    const handleRevive = () => {
        if (userInventory.extraLives <= 0) return;

        // 1. Consume Item
        onConsumeItem('EXTRA_LIFE');

        // 2. Apply 75% Penalty to potential win
        setConfig(prev => ({
            ...prev,
            potentialWin: prev.potentialWin * 0.25 // Retain only 25%
        }));

        // 3. Reset Snake position to center to avoid instant death again
        const startX = Math.floor(GRID_SIZE / 2);
        const startY = Math.floor(GRID_SIZE / 2);
        setSnake([{ x: startX, y: startY }, { x: startX, y: startY + 1 }, { x: startX, y: startY + 2 }]);

        setPhase('PLAYING');
        setIsGhostMode(true);
        setCrashReason('WALL'); // Reset reason
    };

    const handleGiveUp = () => {
        onGameOver(0);
    };

    // --- TOUCH / SWIPE HANDLERS ---
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;

        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY
        };

        const diffX = touchEnd.x - touchStartRef.current.x;
        const diffY = touchEnd.y - touchStartRef.current.y;

        // Minimum swipe distance to avoid accidental taps
        if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal Swipe
            if (diffX > 0) handleDirection(Direction.RIGHT);
            else handleDirection(Direction.LEFT);
        } else {
            // Vertical Swipe
            if (diffY > 0) handleDirection(Direction.DOWN);
            else handleDirection(Direction.UP);
        }

        touchStartRef.current = null;
    };

    // --- GAME LOGIC ---

    const initGameBoard = () => {
        // Initial Spawn centered based on new GRID_SIZE
        const startX = Math.floor(GRID_SIZE / 2);
        const startY = Math.floor(GRID_SIZE / 2);
        const startSnake = [{ x: startX, y: startY }, { x: startX, y: startY + 1 }, { x: startX, y: startY + 2 }];
        setSnake(startSnake);

        // Spawn Bots
        const initialBots: Point[][] = [];
        if (diffConfig.botCount > 0) {
            const spawnPoints = [
                { x: 1, y: 1 }, { x: GRID_SIZE - 2, y: 1 }, { x: 1, y: GRID_SIZE - 2 }, { x: GRID_SIZE - 2, y: GRID_SIZE - 2 },
                { x: Math.floor(GRID_SIZE / 2), y: 1 }, { x: Math.floor(GRID_SIZE / 2), y: GRID_SIZE - 2 },
                { x: 1, y: Math.floor(GRID_SIZE / 2) }, { x: GRID_SIZE - 2, y: Math.floor(GRID_SIZE / 2) }
            ];

            for (let i = 0; i < diffConfig.botCount; i++) {
                const start = spawnPoints[i % spawnPoints.length];
                initialBots.push([start, { x: start.x, y: start.y + 1 }, { x: start.x, y: start.y + 2 }]);
            }
        }
        setBots(initialBots);
        generateGameItems(startSnake, initialBots);
    };

    const generateGameItems = (currentSnake: Point[], currentBots: Point[][]) => {
        // 1. Generate Apple
        let newApple: Point;
        while (true) {
            newApple = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };

            const isOnSnake = currentSnake.some(s => s.x === newApple.x && s.y === newApple.y);
            const isOnBot = currentBots.some(bot => bot.some(b => b.x === newApple.x && b.y === newApple.y));

            if (!isOnSnake && !isOnBot) break;
        }
        setApple(newApple);

        // 2. Generate Bomb (20% chance)
        if (Math.random() < 0.20) {
            let newBomb: Point;
            let attempts = 0;
            let placed = false;

            while (attempts < 20) {
                newBomb = {
                    x: Math.floor(Math.random() * GRID_SIZE),
                    y: Math.floor(Math.random() * GRID_SIZE)
                };

                const isOnSnake = currentSnake.some(s => s.x === newBomb.x && s.y === newBomb.y);
                const isOnBot = currentBots.some(bot => bot.some(b => b.x === newBomb.x && b.y === newBomb.y));
                const isOnApple = newBomb.x === newApple.x && newBomb.y === newApple.y;
                const distToHead = Math.abs(currentSnake[0].x - newBomb.x) + Math.abs(currentSnake[0].y - newBomb.y);

                if (!isOnSnake && !isOnBot && !isOnApple && distToHead > 3) {
                    setBomb(newBomb);
                    placed = true;
                    break;
                }
                attempts++;
            }
            if (!placed) setBomb(null);
        } else {
            setBomb(null);
        }
    };

    // Timer for Magnet
    useEffect(() => {
        let interval: any;
        if (phase === 'PLAYING' && magnetActive && magnetTimer > 0) {
            interval = setInterval(() => {
                setMagnetTimer(prev => {
                    if (prev <= 1) {
                        setMagnetActive(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [magnetActive, phase]);

    const handleCashOut = () => {
        setCrashReason('WIN');
        setPhase('CRASHED'); // Overlay for WIN is handled in CRASHED phase UI

        // Small delay to let user see "WIN!"
        const totalWin = config.potentialWin + config.betAmount;
        const finalMultiplier = totalWin / config.betAmount;
        setTimeout(() => {
            finishGameSession(finalMultiplier);
        }, 2000);
    };

    const gameOver = (reason: 'WALL' | 'SELF' | 'BOT' | 'BOMB'): boolean => {
        // Shield Logic Check
        if (reason === 'BOMB' && equippedItems.shield && shieldsUsed < 2) {
            setShieldsUsed(prev => prev + 1);
            setBomb(null);
            return false;
        }

        // GHOST MODE CHECK
        if (isGhostMode) return false;

        setCrashReason(reason);

        // Instead of ending immediately, go to REVIVING phase if they have potential win
        if (config.potentialWin > 0) {
            setPhase('REVIVING');
            setReviveTimer(10);
        } else {
            setPhase('CRASHED');
            setTimeout(() => {
                finishGameSession(0);
            }, 2000);
        }

        return true;
    };

    // AI Logic for Bots
    const getBotMove = (botHead: Point, target: Point, allObstacles: Point[]): Point => {
        const possibleMoves = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
        const validMoves = possibleMoves.filter(move => {
            const nextX = botHead.x + move.x;
            const nextY = botHead.y + move.y;
            if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) return false;
            if (allObstacles.some(obs => obs.x === nextX && obs.y === nextY)) return false;
            return true;
        });

        if (validMoves.length === 0) return possibleMoves[0];

        validMoves.sort((a, b) => {
            const distA = Math.abs((botHead.x + a.x) - target.x) + Math.abs((botHead.y + a.y) - target.y);
            const distB = Math.abs((botHead.x + b.x) - target.x) + Math.abs((botHead.y + b.y) - target.y);
            return distA - distB;
        });

        const mistakeChance = difficulty === 'HARD' ? 0.05 : difficulty === 'MEDIUM' ? 0.2 : 0.5;
        if (Math.random() > (1 - mistakeChance) && validMoves.length > 1) return validMoves[1];
        return validMoves[0];
    };

    const gameLoop = () => {
        if (phase !== 'PLAYING') return;

        // --- MAGNET LOGIC: Move Apple Towards Snake ---
        let currentApple = { ...apple };
        if (magnetActive) {
            const head = snake[0];
            const dx = head.x - currentApple.x;
            const dy = head.y - currentApple.y;

            let moveX = 0;
            let moveY = 0;

            if (Math.abs(dx) > Math.abs(dy)) {
                moveX = dx > 0 ? 1 : -1;
            } else {
                moveY = dy > 0 ? 1 : -1;
            }

            const potentialApple = { x: currentApple.x + moveX, y: currentApple.y + moveY };
            const isBlocked = snake.some(s => s.x === potentialApple.x && s.y === potentialApple.y);

            if (!isBlocked && potentialApple.x >= 0 && potentialApple.x < GRID_SIZE && potentialApple.y >= 0 && potentialApple.y < GRID_SIZE) {
                currentApple = potentialApple;
                setApple(currentApple);
            }
        }

        // --- PLAYER MOVE ---
        const currentHead = snake[0];
        const newHead = { ...currentHead };

        switch (directionRef.current) {
            case Direction.UP: newHead.y -= 1; break;
            case Direction.DOWN: newHead.y += 1; break;
            case Direction.LEFT: newHead.x -= 1; break;
            case Direction.RIGHT: newHead.x += 1; break;
        }

        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
            gameOver('WALL');
            return;
        }
        if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
            gameOver('SELF');
            return;
        }
        if (bots.some(bot => bot.some(b => b.x === newHead.x && b.y === newHead.y))) {
            gameOver('BOT');
            return;
        }
        if (bomb && newHead.x === bomb.x && newHead.y === bomb.y) {
            if (gameOver('BOMB')) return;
        }

        let newSnake = [newHead, ...snake];
        let appleEatenByPlayer = false;

        // --- BOTS MOVE ---
        const botObstacles = [...snake, ...bots.flat()];
        if (bomb) botObstacles.push(bomb);

        const newBots = bots.map(bot => {
            const botHead = bot[0];
            const move = getBotMove(botHead, currentApple, botObstacles);
            const newBotHead = { x: botHead.x + move.x, y: botHead.y + move.y };
            let newBot = [newBotHead, ...bot];
            if (newBotHead.x === currentApple.x && newBotHead.y === currentApple.y) {
                return { bot: newBot, ate: true };
            } else {
                newBot.pop();
                return { bot: newBot, ate: false };
            }
        });

        const anyBotAte = newBots.some(b => b.ate);

        if (newHead.x === currentApple.x && newHead.y === currentApple.y) {
            appleEatenByPlayer = true;

            // COMBO LOGIC
            const now = Date.now();
            const comboBonus = comboCount > 1 ? 0.5 : 0; // Extra multiplier for combo
            setComboCount(prev => prev + 1);
            setComboTimer(4000); // 4 seconds to keep combo
            setLastAppleTime(now);

            setConfig(prev => ({
                ...prev,
                applesEaten: prev.applesEaten + 1,
                potentialWin: prev.potentialWin + (prev.betAmount * (prev.multiplier + comboBonus))
            }));
        } else {
            newSnake.pop();
        }

        if (newBots.some(b => b.bot[0].x === newHead.x && b.bot[0].y === newHead.y)) {
            gameOver('BOT');
            return;
        }

        setSnake(newSnake);
        setBots(newBots.map(b => b.bot));
        setDirection(directionRef.current);

        if (appleEatenByPlayer || anyBotAte) {
            generateGameItems(newSnake, newBots.map(b => b.bot));
        }
    };

    const currentSpeed = phase === 'PLAYING' ? Math.max(30, diffConfig.baseSpeed - (config.applesEaten * 5)) : null;

    useInterval(gameLoop, currentSpeed);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
                e.preventDefault();
            }
            switch (e.key) {
                case 'ArrowUp': if (directionRef.current !== Direction.DOWN) directionRef.current = Direction.UP; break;
                case 'ArrowDown': if (directionRef.current !== Direction.UP) directionRef.current = Direction.DOWN; break;
                case 'ArrowLeft': if (directionRef.current !== Direction.RIGHT) directionRef.current = Direction.LEFT; break;
                case 'ArrowRight': if (directionRef.current !== Direction.LEFT) directionRef.current = Direction.RIGHT; break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleDirection = (dir: Direction) => {
        if (phase !== 'PLAYING') return;
        if (dir === Direction.UP && directionRef.current !== Direction.DOWN) directionRef.current = Direction.UP;
        if (dir === Direction.DOWN && directionRef.current !== Direction.UP) directionRef.current = Direction.DOWN;
        if (dir === Direction.LEFT && directionRef.current !== Direction.RIGHT) directionRef.current = Direction.LEFT;
        if (dir === Direction.RIGHT && directionRef.current !== Direction.LEFT) directionRef.current = Direction.RIGHT;
    };

    // Styles for the Golden Cobra Skin (Statue Style)
    const goldenScalesStyle = {
        background: `
      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0) 25%),
      repeating-linear-gradient(45deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 4px),
      repeating-linear-gradient(-45deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 4px),
      linear-gradient(135deg, #8B6508 0%, #CD950C 25%, #F4C430 50%, #CD950C 75%, #8B6508 100%)
    `,
        boxShadow: 'inset -2px -2px 6px rgba(0,0,0,0.8), inset 1px 1px 3px rgba(255,255,255,0.5), 2px 2px 5px rgba(0,0,0,0.5)',
        border: '1px solid #5c4004',
        borderRadius: '35%' // Slightly squarish but rounded for scales
    };

    const goldenHeadStyle = {
        background: `
        radial-gradient(circle at 35% 25%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 20%),
        linear-gradient(160deg, #F4C430 0%, #B8860B 60%, #5c4004 100%)
    `,
        boxShadow: 'inset -3px -3px 8px rgba(0,0,0,0.8), 0 0 15px rgba(218, 165, 32, 0.4)',
        border: '1px solid #DAA520',
        borderRadius: '40%'
    };

    // --- RENDER LOBBY ---
    if (phase === 'LOBBY') {
        return (
            <div className="fixed inset-0 bg-[#070b14] flex flex-col items-center justify-center p-6 z-50 overflow-hidden touch-none font-sans">

                {/* Animated Background Mesh */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute top-[-20%] left-[-10%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_50%_50%,_rgba(57,255,20,0.05)_0%,_transparent_60%)] animate-[spin_60s_linear_infinite]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-[#39ff14] to-transparent opacity-20 blur-sm"></div>
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZHRoPSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 mix-blend-overlay"></div>
                </div>

                <div className="z-10 w-full max-w-md space-y-8 animate-in slide-in-from-bottom flex flex-col items-center duration-500">

                    {/* Timer Section */}
                    <div className="text-center relative">
                        <div className="absolute inset-0 bg-[#39ff14] blur-[60px] opacity-20 rounded-full"></div>
                        <h2 className="text-[#39ff14] font-black uppercase tracking-[0.3em] text-[10px] mb-3 drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]">Preparando Arena</h2>
                        <div className="text-9xl font-black font-display text-transparent bg-clip-text bg-gradient-to-b from-white to-[#888] tracking-tighter drop-shadow-2xl">
                            {lobbyTimer}
                        </div>
                        <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest font-bold">O confronto iniciará em breve...</p>
                    </div>

                    {/* Loadout Container */}
                    <div className="w-full bg-[#0a101d]/80 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                        <h3 className="text-white/90 font-black uppercase tracking-wider text-sm mb-4 flex items-center gap-2 justify-center">
                            <Sword size={16} className="text-[#39ff14]" /> Seus Equipamentos
                        </h3>

                        <div className="flex flex-col gap-3">
                            {/* Grid for Active items */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Shield Card */}
                                <div
                                    onClick={() => toggleEquip('shield')}
                                    className={`relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer group flex flex-col items-center text-center gap-2 overflow-hidden
                                      ${equippedItems.shield
                                            ? 'bg-blue-900/30 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-[1.02]'
                                            : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-[#111827]'}`}
                                >
                                    {equippedItems.shield && <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>}

                                    <div className={`p-3 rounded-full transition-colors ${equippedItems.shield ? 'bg-blue-500 shadow-[0_0_15px_#3b82f6]' : 'bg-gray-800'}`}>
                                        <Shield className={`w-6 h-6 ${equippedItems.shield ? 'text-white' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="z-10">
                                        <div className={`font-black uppercase tracking-wider text-[11px] ${equippedItems.shield ? 'text-blue-200' : 'text-gray-300'}`}>Escudo</div>
                                        <div className="text-[9px] text-gray-500 uppercase font-bold mt-1 tracking-wider">{userInventory.shields} disponíveis</div>
                                    </div>
                                    {userInventory.shields > 0 && equippedItems.shield && (
                                        <div className="absolute top-3 right-3 text-blue-400">
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}
                                </div>

                                {/* Magnet Card */}
                                <div
                                    onClick={() => toggleEquip('magnet')}
                                    className={`relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer group flex flex-col items-center text-center gap-2 overflow-hidden
                                      ${equippedItems.magnet
                                            ? 'bg-yellow-900/30 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)] scale-[1.02]'
                                            : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-[#111827]'}`}
                                >
                                    {equippedItems.magnet && <div className="absolute inset-0 bg-yellow-500/10 animate-pulse"></div>}

                                    <div className={`p-3 rounded-full transition-colors ${equippedItems.magnet ? 'bg-yellow-500 shadow-[0_0_15px_#eab308]' : 'bg-gray-800'}`}>
                                        <Magnet className={`w-6 h-6 ${equippedItems.magnet ? 'text-black' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="z-10">
                                        <div className={`font-black uppercase tracking-wider text-[11px] ${equippedItems.magnet ? 'text-yellow-200' : 'text-gray-300'}`}>Ímã</div>
                                        <div className="text-[9px] text-gray-500 uppercase font-bold mt-1 tracking-wider">{userInventory.magnets} disponíveis</div>
                                    </div>
                                    {userInventory.magnets > 0 && equippedItems.magnet && (
                                        <div className="absolute top-3 right-3 text-yellow-400">
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Passive Item Row - EXTRA LIFE */}
                            <div className={`relative p-4 rounded-2xl border flex items-center gap-4 overflow-hidden
                              ${userInventory.extraLives > 0
                                    ? 'bg-[#1a0f12] border-red-500/40 shadow-[0_0_20px_rgba(220,38,38,0.1)]'
                                    : 'bg-black/40 border-white/5 opacity-40'}`}
                            >
                                {userInventory.extraLives > 0 && <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-red-500 to-red-800"></div>}

                                <div className={`p-3 rounded-full ${userInventory.extraLives > 0 ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-gray-800'}`}>
                                    <Heart className={`w-5 h-5 ${userInventory.extraLives > 0 ? 'text-white fill-white animate-[pulse_1.5s_infinite]' : 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className={`font-black uppercase tracking-wider text-[11px] ${userInventory.extraLives > 0 ? 'text-red-200' : 'text-gray-300'}`}>Coração Extra</div>
                                        {userInventory.extraLives > 0 && (
                                            <span className="text-[8px] border border-red-500 text-red-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-red-950/50">
                                                Passivo
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-medium leading-tight">
                                        {userInventory.extraLives > 0
                                            ? `Você possui ${userInventory.extraLives} vida(s). Te salva da morte 1x.`
                                            : 'Nenhuma vida de ressurreição no inventário.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-3">
                        <button
                            onClick={startGame}
                            className="w-full relative group overflow-hidden rounded-2xl p-0.5 shadow-[0_0_30px_rgba(57,255,20,0.3)] transition-transform active:scale-95"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-[#39ff14] via-[#22c55e] to-[#39ff14] animate-[gradient_3s_linear_infinite] opacity-100"></div>
                            <div className="relative bg-[#070b14] w-full h-full rounded-[14px] flex items-center justify-center py-4 group-hover:bg-transparent transition-colors">
                                <span className="font-black font-display text-xl tracking-widest text-[#39ff14] group-hover:text-black transition-colors z-10">
                                    ENTRAR NA ARENA
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={onCancelMatch}
                            className="w-full py-4 rounded-2xl bg-transparent border border-white/10 text-gray-400 font-bold tracking-widest uppercase text-xs hover:bg-white/5 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <XCircle size={16} /> Abortar e Recuperar Saldo
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER GAME ---
    return (
        <div className={`fixed inset-0 bg-neon-dark flex flex-col items-center justify-center p-4 z-50 overflow-hidden touch-none transition-all duration-500 ${tensionLevel === 3 ? 'shadow-[inset_0_0_100px_rgba(220,38,38,0.3)]' : ''}`}>

            {/* Background Retro Grid with Dynamic Pulse */}
            <div className={`absolute inset-0 z-0 opacity-20 transform perspective-1000 rotate-x-12 scale-110 transition-all duration-1000 ${tensionLevel > 1 ? 'animate-pulse' : ''}`}>
                <div className="w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4" style={{
                    backgroundImage: `linear-gradient(rgba(4, 217, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(4, 217, 255, 0.3) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}></div>
            </div>

            {/* Heartbeat Overlay for High Stakes */}
            {tensionLevel >= 2 && (
                <div className="absolute inset-0 pointer-events-none z-[10] animate-[ping_1s_infinite] opacity-10 bg-red-500 mix-blend-overlay"></div>
            )}

            {/* Active Powerups HUD */}
            <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                {/* Combo Indicator */}
                {comboCount > 1 && (
                    <div className="glass-panel px-3 py-1 rounded-full flex items-center gap-2 border-orange-500/50 animate-bounce">
                        <Flame size={14} className="text-orange-500" fill="currentColor" />
                        <span className="text-xs font-bold text-white italic">
                            COMBO x{comboCount}
                        </span>
                    </div>
                )}
                {/* Shield Status */}
                {equippedItems.shield && (
                    <div className={`glass-panel px-3 py-1 rounded-full flex items-center gap-2 ${shieldsUsed >= 2 ? 'opacity-50 grayscale' : 'border-blue-500/50'}`}>
                        <Shield size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-white">
                            {2 - shieldsUsed}/2
                        </span>
                    </div>
                )}
                {/* Magnet Status */}
                {magnetActive && (
                    <div className="glass-panel px-3 py-1 rounded-full flex items-center gap-2 border-yellow-500/50 animate-pulse">
                        <Magnet size={14} className="text-yellow-400" />
                        <span className="text-xs font-bold text-white">
                            {(magnetTimer / 10).toFixed(1)}s
                        </span>
                    </div>
                )}
            </div>

            {/* Stats HUD */}
            <div className="w-full max-w-[400px] mb-6 z-20 flex flex-col gap-4">

                {/* Top Bar */}
                <div className="flex justify-between items-center glass-panel p-2 rounded-full px-4 border-neon-blue/20">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${diffConfig.color.replace('text', 'bg')}`}></div>
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                            {diffConfig.label}
                        </span>
                    </div>
                    <div className="font-mono text-xs text-gray-400">
                        Aposta: <span className="text-white font-bold">R$ {config.betAmount.toFixed(2)}</span>
                    </div>
                </div>

                {/* Main Score */}
                <div className="flex justify-center items-center py-2">
                    <div className={`relative transition-transform duration-200 ${tensionLevel > 0 ? 'scale-110' : ''}`}>
                        <div className={`absolute inset-0 blur-xl rounded-full transition-colors duration-500 ${tensionLevel === 3 ? 'bg-red-500/40' : tensionLevel === 2 ? 'bg-orange-500/30' : 'bg-neon-green/20'}`}></div>
                        <div className={`text-5xl font-black text-white font-display tracking-tighter flex items-center gap-2 ${tensionLevel === 3 ? 'text-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]' : 'text-glow-green'}`}>
                            <span className={`text-2xl opacity-80 ${tensionLevel === 3 ? 'text-red-500' : 'text-neon-green'}`}>+</span>
                            {config.potentialWin.toFixed(2)}
                        </div>
                    </div>
                </div>

            </div>

            {/* Game Board Container - SWIPE AREA */}
            <div
                className="relative z-20 p-1 rounded-xl bg-gradient-to-b from-gray-800 to-black shadow-2xl touch-none select-none"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    ref={gameAreaRef}
                    className={`relative bg-black rounded-lg overflow-hidden transition-all duration-300 touch-none select-none ${phase === 'CRASHED' ? 'border-2 border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.4)]' : tensionLevel === 3 ? 'border-2 border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.2)]' : 'border border-gray-800 shadow-inner'}`}
                    style={{
                        width: 'min(90vw, 400px)',
                        height: 'min(90vw, 400px)',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                        gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
                    }}
                >
                    {/* Inner Grid Texture */}
                    <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                        backgroundSize: '10px 10px'
                    }}></div>

                    {/* REVIVE MODAL OVERLAY */}
                    {phase === 'REVIVING' && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 flex-col backdrop-blur-xl animate-in fade-in zoom-in duration-300 p-6">
                            <div className="w-full max-w-sm">
                                <div className="text-center mb-4">
                                    <HeartPulse className="w-16 h-16 text-red-500 mx-auto mb-2 animate-pulse" />
                                    <h2 className="text-3xl font-black text-white font-display italic">NÃO PERCA TUDO!</h2>
                                    <p className="text-gray-300 text-xs">Você tem R$ {config.potentialWin.toFixed(2)} acumulados.</p>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 w-full mb-4 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 font-bold uppercase">Item Necessário</span>
                                        <div className="flex items-center gap-1 text-white">
                                            <Heart size={14} className="text-red-500 fill-red-500" /> Vida Extra
                                        </div>
                                    </div>

                                    {userInventory.extraLives > 0 ? (
                                        <div className="bg-green-500/10 border border-green-500/30 p-2 rounded text-center">
                                            <span className="text-green-400 text-xs font-bold">Você possui {userInventory.extraLives}x item(s)</span>
                                        </div>
                                    ) : (
                                        <div className="bg-red-500/20 border border-red-500/50 p-2 rounded text-center animate-pulse">
                                            <span className="text-red-400 text-xs font-bold">Sem item "Vida Extra"!</span>
                                            <div className="text-[9px] text-gray-400 mt-1">Compre na loja antes de jogar.</div>
                                        </div>
                                    )}

                                    <div className="w-full h-px bg-white/10 my-2"></div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400 font-bold uppercase">Penalidade</span>
                                        <span className="text-red-500 font-bold">-75% dos ganhos</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400 font-bold uppercase">Novo Saldo</span>
                                        <span className="text-yellow-400 font-bold">R$ {(config.potentialWin * 0.25).toFixed(2)}</span>
                                    </div>

                                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-2">
                                        <div
                                            className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                                            style={{ width: `${(reviveTimer / 10) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-center text-[10px] text-red-400 mt-1 font-mono">
                                        {reviveTimer}s restantes
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 w-full">
                                    <Button
                                        variant="neon"
                                        fullWidth
                                        onClick={handleRevive}
                                        disabled={userInventory.extraLives <= 0}
                                        className={`py-3 ${userInventory.extraLives <= 0 ? 'opacity-50 cursor-not-allowed bg-gray-700 border-gray-600 text-gray-400 shadow-none' : ''}`}
                                    >
                                        {userInventory.extraLives > 0 ? 'USAR ITEM & REVIVER' : 'ITEM NECESSÁRIO'}
                                    </Button>
                                    <Button variant="secondary" fullWidth onClick={handleGiveUp} className="py-2 text-xs">
                                        Desistir e Perder
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {phase === 'CRASHED' && (
                        <div className={`fixed inset-0 z-[100] flex items-center justify-center ${crashReason === 'WIN' ? 'bg-green-950/95' : 'bg-black/95'} flex-col backdrop-blur-md animate-in zoom-in duration-500`}>

                            {/* Visual Impact Effects */}
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                                <div className={`w-[150%] h-[150%] bg-[radial-gradient(circle_at_50%_50%,_${crashReason === 'WIN' ? 'rgba(57,255,20,0.1)' : 'rgba(220,38,38,0.1)'}_0%,_transparent_50%)] animate-[spin_10s_linear_infinite]`}></div>
                                <div className={`absolute top-1/2 left-0 w-full h-[1px] ${crashReason === 'WIN' ? 'bg-neon-green/30' : 'bg-red-500/30'}`}></div>
                            </div>

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="relative mb-6">
                                    <div className={`absolute inset-0 ${crashReason === 'WIN' ? 'bg-neon-green' : 'bg-red-500'} blur-[40px] opacity-30 rounded-full animate-pulse`}></div>
                                    {crashReason === 'WIN' ? (
                                        <Wallet className="text-neon-green w-32 h-32 drop-shadow-[0_0_20px_rgba(57,255,20,1)] animate-[pulse_1s_infinite]" />
                                    ) : (
                                        <AlertOctagon className="text-red-500 w-32 h-32 drop-shadow-[0_0_20px_rgba(220,38,38,1)] animate-[pulse_1s_infinite]" />
                                    )}
                                    {crashReason === 'BOT' && <Skull className="absolute -bottom-2 -right-2 text-white w-12 h-12 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-bounce" />}
                                    {crashReason === 'BOMB' && <Flame className="absolute -bottom-2 -right-2 text-orange-500 w-14 h-14 drop-shadow-[0_0_15px_rgba(249,115,22,1)] animate-pulse" />}
                                </div>
                            </div>
                            <h2 className={`text-6xl sm:text-7xl font-black text-transparent bg-clip-text ${crashReason === 'WIN' ? 'bg-gradient-to-b from-white to-neon-green text-shadow-[0_0_15px_rgba(57,255,20,0.8)]' : 'bg-gradient-to-b from-white to-red-600 text-shadow-red'} font-display italic tracking-widest z-10 text-center`}>
                                {crashReason === 'WIN' ? 'WIN!' : crashReason === 'BOT' ? 'KILLED' : crashReason === 'BOMB' ? 'BOOM!' : 'CRASHED'}
                            </h2>
                            <div className={`mt-4 px-6 py-2 ${crashReason === 'WIN' ? 'bg-green-950/50 border-neon-green/30' : 'bg-red-950/50 border-red-500/30'} border rounded-full z-10 backdrop-blur-sm`}>
                                <p className={`${crashReason === 'WIN' ? 'text-neon-green' : 'text-red-300'} font-black uppercase ${crashReason === 'WIN' ? 'tracking-[0.1em]' : 'tracking-[0.2em]'} text-sm`}>
                                    {crashReason === 'WIN' ? `Saque Realizado: R$ ${(config.potentialWin + config.betAmount).toFixed(2)}` : crashReason === 'BOT' ? 'Morto por um inimigo' : crashReason === 'WALL' ? 'Colisão com a parede' : crashReason === 'BOMB' ? 'Explosão fatal' : 'Auto-colisão detectada'}
                                </p>
                            </div>
                        </div>
                    )}
                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                        const x = i % GRID_SIZE;
                        const y = Math.floor(i / GRID_SIZE);

                        let isSnakeHead = snake[0].x === x && snake[0].y === y;
                        let isSnakeBody = snake.some((s, idx) => idx !== 0 && s.x === x && s.y === y);

                        let isBotHead = false;
                        let isBotBody = false;

                        bots.forEach(bot => {
                            if (bot[0].x === x && bot[0].y === y) isBotHead = true;
                            else if (bot.some((b, idx) => idx !== 0 && b.x === x && b.y === y)) isBotBody = true;
                        });

                        let isApple = apple.x === x && apple.y === y;
                        let isBomb = bomb && bomb.x === x && bomb.y === y;

                        return (
                            <div key={i} className="relative">
                                {/* Player Snake */}
                                {isSnakeHead && (
                                    <div
                                        className={`absolute inset-[1px] rounded z-30 
                        ${isVip
                                                ? '' // Custom VIP Styles applied via style prop
                                                : 'bg-neon-green shadow-[0_0_15px_#39ff14]'} 
                        ${phase === 'CRASHED' ? 'bg-red-500 shadow-red-500' : ''} 
                        ${isGhostMode ? 'animate-pulse opacity-50' : ''}`}
                                        style={isVip && phase !== 'CRASHED' ? goldenHeadStyle : {}}
                                    >
                                        {/* VIP Eyes and Nostrils for realism */}
                                        {isVip && phase !== 'CRASHED' && (
                                            <>
                                                {/* Eyes */}
                                                <div className="absolute top-[25%] left-[10%] w-[25%] h-[25%] bg-black rounded-full flex items-center justify-center transform -rotate-12 border border-[#8B0000]">
                                                    <div className="w-[30%] h-[70%] bg-[#ff0000] rounded-full shadow-[0_0_2px_#ff0000]"></div>
                                                </div>
                                                <div className="absolute top-[25%] right-[10%] w-[25%] h-[25%] bg-black rounded-full flex items-center justify-center transform rotate-12 border border-[#8B0000]">
                                                    <div className="w-[30%] h-[70%] bg-[#ff0000] rounded-full shadow-[0_0_2px_#ff0000]"></div>
                                                </div>
                                                {/* Nostrils */}
                                                <div className="absolute bottom-[20%] left-[35%] w-[8%] h-[8%] bg-black rounded-full opacity-60"></div>
                                                <div className="absolute bottom-[20%] right-[35%] w-[8%] h-[8%] bg-black rounded-full opacity-60"></div>
                                            </>
                                        )}
                                        {!isVip && <div className="absolute inset-0 bg-white/30 rounded-t"></div>}
                                    </div>
                                )}
                                {isSnakeBody && (
                                    <div
                                        className={`absolute inset-[1px] rounded z-20 
                        ${isVip
                                                ? '' // Custom VIP Styles
                                                : 'bg-neon-green/50 shadow-[0_0_5px_rgba(57,255,20,0.3)]'} 
                        ${phase === 'CRASHED' ? 'bg-red-500/50' : ''} 
                        ${isGhostMode ? 'opacity-30' : ''}`}
                                        style={isVip && phase !== 'CRASHED' ? goldenScalesStyle : {}}
                                    ></div>
                                )}

                                {/* Bot Snakes - Purple/Pink */}
                                {isBotHead && (
                                    <div className="absolute inset-[1px] bg-neon-purple rounded shadow-[0_0_15px_#bc13fe] z-30 animate-pulse">
                                        <div className="absolute top-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                                        <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                                    </div>
                                )}
                                {isBotBody && (
                                    <div className="absolute inset-[1px] bg-neon-purple/50 rounded shadow-[0_0_5px_rgba(188,19,254,0.3)] z-20"></div>
                                )}

                                {/* Apple */}
                                {isApple && (
                                    <div className="absolute inset-0 flex items-center justify-center z-20 transition-all duration-150">
                                        <div className="w-[80%] h-[80%] bg-gradient-to-br from-red-400 to-red-600 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-bounce">
                                            <div className="absolute top-1 right-1 w-2 h-2 bg-white/50 rounded-full blur-[1px]"></div>
                                        </div>
                                    </div>
                                )}

                                {/* Bomb */}
                                {isBomb && (
                                    <div className="absolute inset-0 flex items-center justify-center z-20 animate-pulse">
                                        <Bomb size="90%" className="text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]" fill="currentColor" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Controls & Action */}
            <div className="mt-6 z-20 w-full max-w-[360px] flex flex-col gap-4 pb-12 sm:pb-0">

                <Button
                    onClick={handleCashOut}
                    disabled={phase !== 'PLAYING' || config.applesEaten === 0}
                    className={`
            py-4 text-xl font-black uppercase tracking-wider transition-all duration-300
            ${config.applesEaten > 0
                            ? 'bg-gradient-to-r from-neon-green to-[#2db312] text-black shadow-[0_0_30px_rgba(57,255,20,0.4)] hover:scale-105 border-0 scale-105'
                            : 'glass-panel text-gray-500 border-white/5'}
            ${tensionLevel === 3 ? 'animate-pulse' : ''}
          `}
                >
                    {config.applesEaten > 0 ? (
                        <span className="flex items-center justify-center gap-2">
                            <Zap className="w-6 h-6 fill-current" />
                            SACAR R$ {(config.betAmount + config.potentialWin).toFixed(2)}
                        </span>
                    ) : (
                        "Pegue maçãs para sacar"
                    )}
                </Button>

                {/* Mobile Circular D-Pad - Redesigned & Lifted for iPhone */}
                <div className="relative mx-auto sm:hidden w-56 h-56 bg-gradient-to-b from-[#111113]/90 to-black/95 rounded-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.05)] backdrop-blur-xl flex items-center justify-center mb-16 pb-[calc(env(safe-area-inset-bottom)+20px)] pointer-events-auto select-none touch-manipulation">

                    {/* Inner glowing ring structure */}
                    <div className="absolute inset-1 rounded-full border border-white/5 pointer-events-none"></div>

                    {/* UP */}
                    <button
                        className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-16 bg-transparent active:bg-neon-green/30 rounded-t-[50px] flex items-center justify-center transition-all z-10 text-gray-400 active:text-neon-green touch-manipulation focus:outline-none"
                        onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.UP); }}
                    >
                        <ChevronUp size={44} className="drop-shadow-lg pb-1" />
                    </button>

                    {/* DOWN */}
                    <button
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-20 h-16 bg-transparent active:bg-neon-green/30 rounded-b-[50px] flex items-center justify-center transition-all z-10 text-gray-400 active:text-neon-green touch-manipulation focus:outline-none"
                        onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.DOWN); }}
                    >
                        <ChevronDown size={44} className="drop-shadow-lg pt-1" />
                    </button>

                    {/* LEFT */}
                    <button
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-16 h-20 bg-transparent active:bg-neon-green/30 rounded-l-[50px] flex items-center justify-center transition-all z-10 text-gray-400 active:text-neon-green touch-manipulation focus:outline-none"
                        onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.LEFT); }}
                    >
                        <ChevronLeft size={44} className="drop-shadow-lg pr-1" />
                    </button>

                    {/* RIGHT */}
                    <button
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-16 h-20 bg-transparent active:bg-neon-green/30 rounded-r-[50px] flex items-center justify-center transition-all z-10 text-gray-400 active:text-neon-green touch-manipulation focus:outline-none"
                        onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.RIGHT); }}
                    >
                        <ChevronRight size={44} className="drop-shadow-lg pl-1" />
                    </button>

                    {/* Center Core */}
                    <div className="w-16 h-16 bg-[#1a1a1d] rounded-full shadow-[inset_0_4px_15px_rgba(0,0,0,1),0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center relative z-0 border border-white/5 pointer-events-none">
                        <div className="w-5 h-5 bg-neon-green rounded-full shadow-[0_0_20px_rgba(57,255,20,0.8)] opacity-60"></div>
                    </div>
                </div>

                <p className="text-center text-gray-500 text-[10px] hidden sm:block uppercase tracking-widest mt-2 animate-pulse">
                    Dica: Use as setas do teclado ou deslize o dedo na tela
                </p>

            </div>
        </div >
    );
};