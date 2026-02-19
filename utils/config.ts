import { ITEM_PRICES } from '../types';

export interface AppConfig {
  version: number;
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
  version: 1,
  minDeposit: 1.00, // Changed to 1.00 as per user request
  minWithdraw: 5.00, // Changed to 5.00 to match user screenshot
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
      
      // Migration: If version is missing or old, force update critical values
      if (!parsed.version || parsed.version < 1) {
          parsed.minDeposit = 1.00;
          parsed.minWithdraw = 5.00;
          parsed.version = 1;
          // Note: We don't save back here to avoid side effects, 
          // but the app will see the correct values.
      }

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
