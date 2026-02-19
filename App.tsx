import React, { useState, useEffect } from 'react';
import { User, AppScreen, BetRecord, Difficulty } from './types';
import { AuthScreen } from './components/screens/AuthScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { GameScreen } from './components/screens/GameScreen';
import { GameOverScreen } from './components/screens/GameOverScreen';
import { AdminScreen } from './components/screens/AdminScreen';
import { AdminLoginScreen } from './components/screens/AdminLoginScreen';
import { LoadingScreen } from './components/screens/LoadingScreen';
import { getAppConfig } from './utils/config';
import { api } from './services/api';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.AUTH);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  
  // Game Session State
  const [activeBet, setActiveBet] = useState<number>(0);
  const [activeBetSource, setActiveBetSource] = useState<'REAL' | 'BONUS'>('REAL');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty>('MEDIUM');
  
  const [lastWin, setLastWin] = useState<number>(0);
  const [betHistory, setBetHistory] = useState<BetRecord[]>([]);

  // Check URL for admin access on mount
  useEffect(() => {
    const path = window.location.pathname;
    const adminSession = localStorage.getItem('snakebet_admin_session');
    
    // Check for user token
    const token = localStorage.getItem('snakebet_token');
    
    // Helper to enforce minimum loading time
    const minLoadingTime = new Promise(resolve => setTimeout(resolve, 2500));
    
    if (adminSession === 'true') {
        setCurrentScreen(AppScreen.ADMIN);
        setIsLoading(false);
    } else if (path === '/admin') {
        setCurrentScreen(AppScreen.ADMIN_LOGIN);
        setIsLoading(false);
    } else if (token) {
        const tryLocalRestore = () => {
             const lastUser = localStorage.getItem('snakebet_last_user');
             if (lastUser) {
                 const storedData = localStorage.getItem(`snakebet_data_${lastUser}`);
                 if (storedData) {
                     try {
                         const parsed = JSON.parse(storedData);
                         const userObj: User = {
                             username: lastUser,
                             balance: parsed.balance || 0,
                             bonusBalance: parsed.bonusBalance || 0,
                             isVip: parsed.isVip || false,
                             vipExpiry: parsed.vipExpiry || 0,
                             dailyBonusClaims: parsed.dailyBonusClaims || 0,
                             boxTracker: parsed.boxTracker || { count: 0, totalSpent: 0 },
                             transactions: parsed.transactions || [],
                             rollover: parsed.rollover || { current: 0, target: 0 },
                             lastDailyBonus: parsed.lastDailyBonus || 0,
                             consecutiveFreeClaims: parsed.consecutiveFreeClaims || 0,
                             totalDeposited: parsed.totalDeposited || 0,
                             inventory: parsed.inventory || { shields: 0, magnets: 0, extraLives: 0 },
                             referrals: parsed.referrals || [],
                             invitedBy: parsed.invitedBy,
                             affiliateEarnings: parsed.affiliateEarnings || { cpa: 0, revShare: 0 }
                         };
                         
                         setUser(userObj);
                         setCurrentScreen(AppScreen.DASHBOARD);
                         return true;
                     } catch (parseErr) {
                         console.error("Failed to parse local user data", parseErr);
                     }
                 }
             }
             return false;
        };

        // If it's a local token, skip API check entirely
        if (token.startsWith('local_token_')) {
             if (!tryLocalRestore()) {
                 localStorage.removeItem('snakebet_token');
             }
             // Wait for delay then stop loading
             minLoadingTime.then(() => setIsLoading(false));
             return;
        }

        // Attempt to load user profile from API
        const apiCheck = api.getProfile()
           .then(data => {
               if (data.user) {
                   const apiUser = data.user;
                   const userObj: User = { 
                        username: apiUser.username, 
                        balance: apiUser.balance || 0,
                        bonusBalance: apiUser.bonusBalance || 0,
                        isVip: apiUser.is_vip || false,
                        vipExpiry: apiUser.vip_expiry || 0,
                        dailyBonusClaims: 0,
                        boxTracker: { count: 0, totalSpent: 0 },
                        transactions: [],
                        rollover: { current: 0, target: 0 },
                        lastDailyBonus: 0,
                        consecutiveFreeClaims: 0,
                        totalDeposited: 0,
                        inventory: { shields: 0, magnets: 0, extraLives: 0 },
                        referrals: [],
                        invitedBy: apiUser.invitedBy,
                        affiliateEarnings: apiUser.affiliateEarnings
                    };
                   setUser(userObj);
                   setCurrentScreen(AppScreen.DASHBOARD);
               } else {
                   // Invalid token or response, but try local fallback just in case before clearing
                   if (!tryLocalRestore()) {
                        localStorage.removeItem('snakebet_token');
                   }
               }
           })
           .catch(err => {
               console.error("Failed to restore session", err);
               
               // Always try local fallback on error unless explicitly unauthorized
               const isAuthError = err.status === 401 || err.status === 403;

               if (!isAuthError) {
                   console.warn("API Error during session restore, trying local fallback");
                   if (tryLocalRestore()) {
                       return;
                   }
               }
               
               // If fallback fails or it's an auth error, remove token
               localStorage.removeItem('snakebet_token');
           });
           
        // Wait for both API check and min time
        Promise.all([apiCheck, minLoadingTime]).finally(() => {
            setIsLoading(false);
        });

    } else {
        // Even if no token, show splash for a bit
        minLoadingTime.then(() => setIsLoading(false));
    }

    if (path.startsWith('/u/')) {
        // Capture referral code
        let referrer = path.split('/u/')[1];
        if (referrer) {
            // Remove trailing slash if present
            referrer = referrer.replace(/\/$/, '');
            localStorage.setItem('snakebet_referrer', referrer);
            // Redirect to home to clean URL
            window.history.replaceState({}, '', '/');
        }
    }
  }, []);

  // Sync data to local storage
  useEffect(() => {
    if (user) {
      // Local Backup
      localStorage.setItem(`snakebet_data_${user.username}`, JSON.stringify({
          balance: user.balance,
          bonusBalance: user.bonusBalance,
          isVip: user.isVip,
          vipExpiry: user.vipExpiry,
          dailyBonusClaims: user.dailyBonusClaims,
          boxTracker: user.boxTracker,
          transactions: user.transactions,
          rollover: user.rollover,
          lastDailyBonus: user.lastDailyBonus,
          consecutiveFreeClaims: user.consecutiveFreeClaims,
          totalDeposited: user.totalDeposited,
          inventory: user.inventory,
          referrals: user.referrals,
          invitedBy: user.invitedBy,
          affiliateEarnings: user.affiliateEarnings
      }));

      // Remote Sync (Fire and Forget)
      // Only sync balance updates to server if token exists
      const token = localStorage.getItem('snakebet_token');
      if (token) {
          api.updateWallet(user.balance, user.bonusBalance)
             .catch(err => console.error("Background sync failed", err));
      }
    }
  }, [user]);

  // Listen for external updates (e.g. Referral earnings adding to balance while user is online)
  useEffect(() => {
      const handleStorageChange = (e: StorageEvent) => {
          if (!user) return;
          
          // Check if the modified key belongs to the current user
          if (e.key === `snakebet_data_${user.username}` && e.newValue) {
              try {
                  const newData = JSON.parse(e.newValue);
                  
                  // Check if balance increased (likely due to affiliate earnings)
                  // We update state if remote balance is different to keep in sync
                  if (newData.balance !== user.balance) {
                      console.log("Syncing balance from external update (Affiliate Earning?)");
                      setUser(prev => {
                          if (!prev) return null;
                          return {
                              ...prev,
                              balance: newData.balance,
                              affiliateEarnings: newData.affiliateEarnings || prev.affiliateEarnings,
                              referrals: newData.referrals || prev.referrals
                          };
                      });
                  }
              } catch (err) {
                  console.error("Error syncing storage change", err);
              }
          }
      };
  
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  const handleLogin = (userData: User) => {
    // Ensure we clear any stale admin session when logging in as a regular user
    localStorage.removeItem('snakebet_admin_session');

    const storedData = localStorage.getItem(`snakebet_data_${userData.username}`);
    let fullUser = userData;
    
    if (storedData) {
        const parsed = JSON.parse(storedData);
        fullUser = {
            ...userData,
            balance: parsed.balance ?? userData.balance,
            bonusBalance: parsed.bonusBalance ?? 0,
            isVip: parsed.isVip ?? false,
            vipExpiry: parsed.vipExpiry ?? 0,
            dailyBonusClaims: parsed.dailyBonusClaims ?? 0,
            boxTracker: parsed.boxTracker ?? { count: 0, totalSpent: 0 },
            transactions: parsed.transactions ?? [],
            rollover: parsed.rollover ?? { current: 0, target: 0 },
            lastDailyBonus: parsed.lastDailyBonus ?? 0,
            consecutiveFreeClaims: parsed.consecutiveFreeClaims ?? 0,
            totalDeposited: parsed.totalDeposited ?? 0,
            inventory: parsed.inventory ?? { shields: 0, magnets: 0, extraLives: 0 },
            referrals: parsed.referrals ?? [],
            invitedBy: parsed.invitedBy,
            affiliateEarnings: parsed.affiliateEarnings ?? { cpa: 0, revShare: 0 }
        };
    } else {
        // Check for referral code in localStorage (new user)
        const referrer = localStorage.getItem('snakebet_referrer');
        
        // Migration for legacy users
        const oldBalance = localStorage.getItem(`snakebet_balance_${userData.username}`);
        fullUser = {
            ...userData,
            balance: oldBalance ? parseFloat(oldBalance) : userData.balance,
            bonusBalance: 0,
            isVip: false,
            vipExpiry: 0,
            dailyBonusClaims: 0,
            boxTracker: { count: 0, totalSpent: 0 },
            transactions: [],
            rollover: { current: 0, target: 0 },
            lastDailyBonus: 0,
            consecutiveFreeClaims: 0,
            totalDeposited: 0,
            inventory: { shields: 0, magnets: 0, extraLives: 0 },
            referrals: [],
            invitedBy: referrer || undefined,
            affiliateEarnings: { cpa: 0, revShare: 0 }
        };
        
        // Clear referrer after use
        if (referrer) localStorage.removeItem('snakebet_referrer');
    }

    // Check VIP Expiry
    if (fullUser.isVip && fullUser.vipExpiry && fullUser.vipExpiry < Date.now()) {
        fullUser.isVip = false;
        fullUser.vipExpiry = 0;
    }

    setUser(fullUser);
    setCurrentScreen(AppScreen.DASHBOARD);
  };

  const handleLogout = () => {
    localStorage.removeItem('snakebet_admin_session');
    localStorage.removeItem('snakebet_token');
    setUser(null);
    setBetHistory([]);
    setCurrentScreen(AppScreen.AUTH);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleStartGame = (betAmount: number, difficulty: Difficulty, source: 'REAL' | 'BONUS') => {
    if (!user) return;

    if (source === 'REAL' && user.balance >= betAmount) {
        handleUpdateUser({ ...user, balance: user.balance - betAmount });
    } else if (source === 'BONUS' && user.bonusBalance >= betAmount) {
        handleUpdateUser({ ...user, bonusBalance: user.bonusBalance - betAmount });
    } else {
        return; // Insufficient funds
    }

    setActiveBet(betAmount);
    setActiveBetSource(source);
    setActiveDifficulty(difficulty);
    setCurrentScreen(AppScreen.GAME);
  };

  const handleCancelGame = () => {
      if (!user) return;
      
      // Refund the bet
      if (activeBetSource === 'REAL') {
          handleUpdateUser({ ...user, balance: user.balance + activeBet });
      } else {
          handleUpdateUser({ ...user, bonusBalance: user.bonusBalance + activeBet });
      }
      
      setCurrentScreen(AppScreen.DASHBOARD);
  };

  const handleConsumeItem = (itemType: 'SHIELD' | 'MAGNET' | 'EXTRA_LIFE') => {
      if (!user) return;
      const newInventory = { ...user.inventory };
      
      if (itemType === 'SHIELD' && newInventory.shields > 0) newInventory.shields--;
      if (itemType === 'MAGNET' && newInventory.magnets > 0) newInventory.magnets--;
      if (itemType === 'EXTRA_LIFE' && newInventory.extraLives > 0) newInventory.extraLives--;
      
      setUser({ ...user, inventory: newInventory });
  };

  const handlePlayAgain = () => {
    if (!user) return;
    
    const canPlayReal = activeBetSource === 'REAL' && user.balance >= activeBet;
    const canPlayBonus = activeBetSource === 'BONUS' && user.bonusBalance >= activeBet;

    if (canPlayReal || canPlayBonus) {
        handleStartGame(activeBet, activeDifficulty, activeBetSource);
    } else {
        setCurrentScreen(AppScreen.DASHBOARD);
    }
  };

  const handleGameOver = (winAmount: number) => {
    if (!user) return;
    setLastWin(winAmount);
    
    const profit = winAmount - activeBet;
    const newRecord: BetRecord = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      betAmount: activeBet,
      winAmount,
      profit,
      outcome: winAmount > 0 ? 'WIN' : 'LOSS',
      source: activeBetSource
    };
    setBetHistory(prev => [newRecord, ...prev]);

    const newUser = { ...user };

    if (winAmount > 0) {
      if (activeBetSource === 'REAL') {
          newUser.balance += winAmount;
      } else {
          // Winnings from Bonus go to Bonus Balance
          newUser.bonusBalance += winAmount;
          // Update Rollover progress
          if (profit > 0) {
              newUser.rollover.current += profit;
          }
      }
    }
    
    // Process Game Result on Server (Sync Balance + RevShare)
    api.processGameResult(activeBet, winAmount, activeBetSource)
       .then(data => {
           if (data && data.success) {
               console.log("Game result synced:", data);
               // Optional: ensure client balance matches server
               // newUser.balance = data.balance;
               // newUser.bonusBalance = data.bonusBalance;
           }
       })
       .catch(err => console.error("Failed to sync game result", err));

    handleUpdateUser(newUser);
    setCurrentScreen(AppScreen.GAME_OVER);
  };

  const handleAdminLogin = () => {
    localStorage.setItem('snakebet_admin_session', 'true');
    setCurrentScreen(AppScreen.ADMIN);
  };

  const renderScreen = () => {
    if (isLoading) {
        return <LoadingScreen />;
    }

    switch (currentScreen) {
      case AppScreen.AUTH:
        return <AuthScreen onLogin={handleLogin} />;
      
      case AppScreen.ADMIN_LOGIN:
        return <AdminLoginScreen onAdminLogin={handleAdminLogin} onBack={() => setCurrentScreen(AppScreen.AUTH)} />;

      case AppScreen.ADMIN:
        return <AdminScreen onLogout={handleLogout} />;

      case AppScreen.DASHBOARD:
        return user ? (
          <DashboardScreen 
            user={user} 
            betHistory={betHistory}
            onLogout={handleLogout}
            onUpdateUser={handleUpdateUser}
            onStartGame={handleStartGame}
          />
        ) : null;
      
      case AppScreen.GAME:
        return user ? (
          <GameScreen 
            betAmount={activeBet} 
            difficulty={activeDifficulty}
            userInventory={user.inventory}
            isVip={user.isVip}
            onConsumeItem={handleConsumeItem}
            onCancelMatch={handleCancelGame}
            onGameOver={handleGameOver} 
          />
        ) : null;
      
      case AppScreen.GAME_OVER:
        return (
          <GameOverScreen 
            winAmount={lastWin}
            betAmount={activeBet}
            balance={user ? (activeBetSource === 'REAL' ? user.balance : user.bonusBalance) : 0}
            onRestart={handlePlayAgain} 
            onHome={() => setCurrentScreen(AppScreen.DASHBOARD)}
          />
        );
        
      default:
        return <div>Error: Unknown screen</div>;
    }
  };

  return (
    <div className="font-sans antialiased text-slate-900 bg-black min-h-screen selection:bg-neon-green selection:text-black">
      {renderScreen()}
    </div>
  );
};

export default App;