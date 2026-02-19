import { AppConfig } from '../utils/config';

export interface PagVivaDepositResponse {
  idTransaction: string;
  qrcode: string;
  qr_code_image_url: string;
}

export interface PagVivaWithdrawResponse {
  id: string;
  amount: number;
  pixKey: string;
  pixKeyType: string;
  withdrawStatusId: string;
  createdAt: string;
  updatedAt: string;
}

export const PagVivaService = {
  getHeaders: (config: AppConfig) => {
    if (!config.pagViva?.token || !config.pagViva?.secret || !config.pagViva?.apiKey) {
      // Return dummy headers if not configured to prevent crash in mock mode, 
      // though getHeaders shouldn't be called if we check config before.
      return {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Bearer MOCK",
          "X-API-KEY": "MOCK"
      };
    }

    const authString = btoa(`${config.pagViva.token}:${config.pagViva.secret}`);

    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${authString}`,
      "X-API-KEY": config.pagViva.apiKey
    };
  },

  createDeposit: async (
    config: AppConfig, 
    amount: number, 
    user: { name: string; email: string; cpf: string; phone: string }
  ): Promise<PagVivaDepositResponse> => {
    try {
      if (!config.pagViva?.token) {
          throw new Error('Credenciais PagVIVA não configuradas.');
      }

      const postbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/callback` : 'https://snakebet.pro/api/callback';

      const response = await fetch('https://pagviva.com/api/transaction/deposit', {
        method: 'POST',
        headers: PagVivaService.getHeaders(config),
        body: JSON.stringify({
          postback: postbackUrl,
          amount: amount,
          debtor_name: user.name,
          email: user.email,
          debtor_document_number: user.cpf,
          phone: user.phone,
          method_pay: 'pix'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let finalMessage = `Erro PagVIVA: ${response.status} - ${errorText}`;
        
        try {
            const errorJson = JSON.parse(errorText);
            // Prioritize user-friendly messages from API
            if (errorJson.message) {
                finalMessage = errorJson.message;
            }
            if (response.status === 429) {
                finalMessage = errorJson.message || "Muitas solicitações. Aguarde um momento antes de tentar novamente.";
            }
        } catch (e) {
            // If parsing fails, keep original message
        }

        throw new Error(finalMessage);
      }

      const data = await response.json();
      console.log('PagVIVA Deposit Response:', data);
      return data;
    } catch (error) {
      console.error('PagViva Deposit Error:', error);
      throw error;
    }
  },

  checkTransactionStatus: async (config: AppConfig, idTransaction: string): Promise<string> => {
      try {
          if (!config.pagViva?.token) return 'PENDING';

          const response = await fetch(`https://pagviva.com/api/transaction/${idTransaction}`, {
              method: 'GET',
              headers: PagVivaService.getHeaders(config)
          });

          if (!response.ok) return 'PENDING';

          const data = await response.json();
          // Normalize status
          const status = (data.status || data.transactionStatus || 'PENDING').toUpperCase();
          return status;
      } catch (error) {
          console.error('Check Status Error:', error);
          return 'ERROR';
      }
  },

  requestWithdraw: async (
    config: AppConfig,
    amount: number,
    pixKey: string,
    pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
  ): Promise<PagVivaWithdrawResponse> => {
    try {
      if (!config.pagViva?.token) {
          throw new Error('Credenciais PagVIVA não configuradas para saque.');
      }

      const response = await fetch('https://pagviva.com/api/transaction/payment', {
        method: 'POST',
        headers: PagVivaService.getHeaders(config),
        body: JSON.stringify({
          baasPostbackUrl: 'https://snakebet.pro/api/withdraw-callback', // Placeholder
          amount: amount,
          pixKey: pixKey,
          pixKeyType: pixKeyType
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let finalMessage = `Erro PagVIVA: ${response.status} - ${errorText}`;
        
        try {
            const errorJson = JSON.parse(errorText);
            
            // Handle common PagVIVA errors
            if (response.status === 429) {
                finalMessage = "Aguarde um momento antes de realizar um novo saque.";
            } else if (errorJson.message) {
                finalMessage = errorJson.message;
            } else if (errorJson.error) {
                finalMessage = errorJson.error;
            }
        } catch (e) {
            // Parsing failed
        }
        
        throw new Error(finalMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('PagViva Withdraw Error:', error);
      throw error;
    }
  }
};
