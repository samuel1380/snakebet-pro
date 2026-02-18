import { ITEM_PRICES } from '../types';

export interface AppConfig {
  minDeposit: number;
  minWithdraw: number;
  autoWithdrawEnabled: boolean;
  autoWithdrawLimit: number;
  prices: typeof ITEM_PRICES;
  cpaValue: number;
  cpaMinDeposit: number;
  realRevShare: number;
  fakeRevShare: number;
  pagViva: {
    token: string;
    secret: string;
    apiKey: string;
  };
}

export const CONFIG_KEY = 'snakebet_app_config';

export const DEFAULT_CONFIG: AppConfig = {
  minDeposit: 20.00,
  minWithdraw: 50.00, // Changed default to be more realistic/standard, user can change it
  autoWithdrawEnabled: false,
  autoWithdrawLimit: 100.00,
  prices: { ...ITEM_PRICES },
  cpaValue: 10.00,
  cpaMinDeposit: 20.00,
  realRevShare: 20,
  fakeRevShare: 50,
  pagViva: {
    token: '',
    secret: '',
    apiKey: ''
  }
};

export const getAppConfig = (): AppConfig => {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with default to ensure all keys exist (in case of updates)
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        prices: { ...DEFAULT_CONFIG.prices, ...(parsed.prices || {}) },
        pagViva: { ...DEFAULT_CONFIG.pagViva, ...(parsed.pagViva || {}) }
      };
    }
  } catch (e) {
    console.error('Failed to load config', e);
  }
  
  return DEFAULT_CONFIG;
};

export const saveAppConfig = (config: AppConfig): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    // Dispatch a custom event so other components can react immediately if needed
    window.dispatchEvent(new Event('snakebet_config_updated'));
  } catch (e) {
    console.error('Failed to save config', e);
  }
};
