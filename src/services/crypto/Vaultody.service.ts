import CryptoJS from 'crypto-js';

import DepositWalletAddress from '@/models/crypto/WalletDepositAddresses';
import User from '@/models/users/User';
import { DEV_NETWORKS } from '@/types/crypto/crypto.enum';
import { logger } from '@/utils/logger';

// Define interfaces for better type safety
interface QueryParams {
  [key: string]: string;
}

interface GenerateAddressParams {
  blockchain: string;
  network: string;
  context?: string;
  label: string;
}

interface TransactionParams {
  blockchain: string;
  network: string;
  from: string;
  to: string;
  amount: number | string;
  unit: string;
  context?: string;
  note?: string;
}

// interface TransactionRequestItem {
//   recipientAddress: string;
//   amount: string;
//   note?: string;
//   feePriority?: 'slow' | 'medium' | 'fast';
// }

interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    details?: {
      message?: string;
    };
  };
}

enum BLOCKCHAIN_PROTOCOL_NAME {
  TRON = 'tron',
  ETHEREUM = 'ethereum',
  BITCOIN = 'bitcoin',
}

export class VaultodyService {
  private static instance: VaultodyService;
  private baseUrl: string;
  private apiKey: string;
  private vaultId: string;
  private apiSecret: string;
  private apiPassPhrase: string;

  private constructor() {
    this.baseUrl = 'https://rest.vaultody.com';
    this.apiKey = process.env.VAULTODY_API_KEY || '';
    this.vaultId = process.env.VAULTODY_VAULT_ID || '';
    this.apiSecret = process.env.VAULTODY_VAULT_API_SECRET || '';
    this.apiPassPhrase = process.env.VAULTODY_VAULT_PASS_PHRASE || '';
  }

  public static initialize(): VaultodyService {
    if (!VaultodyService.instance) {
      VaultodyService.instance = new VaultodyService();
    }
    return VaultodyService.instance;
  }

  public static getInstance(): VaultodyService {
    if (!VaultodyService.instance) {
      throw new Error('Vaultody has not been initialized. Call initialize() first.');
    }
    return VaultodyService.instance;
  }

  private _getCurrentUnixTimeUTC(): number {
    const date = new Date();
    return Math.floor(date.getTime() / 1000);
  }

  private _getHeaders(
    method: string,
    requestPath: string,
    body: Record<string, any> | string = {},
    queryParams: QueryParams = {}
  ): Record<string, string> {
    const timestamp = this._getCurrentUnixTimeUTC();

    // Convert query params to string values
    const stringifiedQuery = Object.keys(queryParams).reduce<QueryParams>((acc, key) => {
      acc[key] = String(queryParams[key]);
      return acc;
    }, {});

    // Normalize body
    const normalizedBody =
      method === 'GET'
        ? JSON.stringify({})
        : typeof body === 'string'
          ? body.replace(/\n(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '').replace(/(".*?")|\s+/g, '$1')
          : JSON.stringify(body);

    // Create message to sign: timestamp + method + requestPath + body + stringified query
    const messageToSign =
      timestamp + method.toUpperCase() + requestPath + normalizedBody + JSON.stringify(stringifiedQuery);

    // Create signature
    const key = CryptoJS.enc.Base64.parse(this.apiSecret);
    const hmac = CryptoJS.HmacSHA256(messageToSign, key);
    const signature = CryptoJS.enc.Base64.stringify(hmac);

    // Return headers
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
      'X-API-SIGN': signature,
      'X-API-TIMESTAMP': timestamp.toString(),
      'X-API-PASSPHRASE': this.apiPassPhrase,
    };
  }

  private async _handleResponse<T>(response: Response): Promise<T> {
    const data = (await response.json()) as ApiResponse<T>;

    if (!response.ok) {
      logger.error('response error', data.error);
      throw new Error(data.error ? `${data.error.message} ${data.error.details?.message || ''}` : 'API request failed');
    }

    return data as T;
  }

  public async generateDepositAddress({ blockchain, network, context, label }: GenerateAddressParams): Promise<any> {
    if (!blockchain || !network || !label) {
      throw new Error('Missing required parameters');
    }

    // Construct path and query separately
    const requestPath = `/vaults/${this.vaultId}/${blockchain}/${network}/addresses`;
    const queryParams = context ? { context } : { context: '' };

    // Construct full URL with query parameters
    const queryString = context ? `?context=${encodeURIComponent(context)}` : '';
    const url = `${this.baseUrl}${requestPath}${queryString}`;

    const body = {
      context,
      data: {
        item: {
          label,
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this._getHeaders('POST', requestPath, body, queryParams),
        body: JSON.stringify(body),
      });

      return this._handleResponse(response);
    } catch (error) {
      logger.error('error', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create address: ${errorMessage}`);
    }
  }

  public async generateDepositAddressesForUser(userId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const originalDepositWalletAddresses = await DepositWalletAddress.find({
      userId,
    });

    if (originalDepositWalletAddresses.length > 0) {
      return originalDepositWalletAddresses;
    }

    const depositWalletAddresses: any[] = [];

    Object.values(DEV_NETWORKS).map(async (network: string) => {
      const depositWalletAddress = await this.generateDepositAddress({
        blockchain: 'tron',
        network: network,
        label: user.email || '',
      });

      depositWalletAddresses.push(depositWalletAddress);
    });

    return depositWalletAddresses;
  }

  public async getAssetsByAddress(address: string, blockchain: string, context = ''): Promise<any> {
    if (!address || !blockchain) {
      throw new Error('Missing required parameters: address, blockchain');
    }

    // Construct request path
    const requestPath = `/vaults/${this.vaultId}/addresses/${address}/assets`;

    // Construct query parameters
    const queryParams: QueryParams = {
      blockchain,
    };

    if (context) {
      queryParams.context = context;
    }

    // Convert query parameters to a URL string
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${this.baseUrl}${requestPath}?${queryString}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this._getHeaders('GET', requestPath, {}, queryParams),
      });

      return this._handleResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch assets for address ${address}: ${errorMessage}`);
    }
  }

  public async createTransaction({
    blockchain,
    network,
    from,
    to,
    amount,
    unit,
    context = '',
    note = '',
  }: TransactionParams): Promise<any> {
    if (!blockchain || !network || !from || !to || !amount || !unit) {
      throw new Error('Missing required parameters for transaction.');
    }

    let requestPath = `/vaults/${this.vaultId}/${blockchain}/${network}/addresses/${from}`;

    if (blockchain === BLOCKCHAIN_PROTOCOL_NAME.TRON) {
      requestPath += '/feeless-transaction-requests';
    } else {
      requestPath += '/transaction-requests';
    }

    // Construct API request path
    const queryParams: QueryParams = context ? { context } : {};
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${this.baseUrl}${requestPath}${queryString ? `?${queryString}` : ''}`;

    // Request body
    const body = {
      ...(context && { context }),
      data: {
        item: {
          recipientAddress: to,
          amount: String(amount), // Ensure amount is a string
          note,
          ...(blockchain !== BLOCKCHAIN_PROTOCOL_NAME.TRON && {
            feePriority: 'slow',
          }),
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this._getHeaders('POST', requestPath, body, queryParams),
        body: JSON.stringify(body),
      });

      return this._handleResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create transaction: ${errorMessage}`);
    }
  }

  public async validateAddress(address: string, blockchain: string, network: string): Promise<any> {
    if (!address || !blockchain || !network) {
      throw new Error('Missing required parameters for address validation.');
    }

    const requestPath = `/info/${blockchain}/${network}/addresses/validate`;
    const url = `${this.baseUrl}${requestPath}`;

    const body = {
      data: {
        item: {
          address: address,
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this._getHeaders('POST', requestPath, body),
        body: JSON.stringify(body),
      });

      return this._handleResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to validate address: ${errorMessage}`);
    }
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  public validateWebhook(signature: string, payload: string | object): boolean {
    try {
      // Ensure payload is JSON encoded string
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // Create HMAC using SHA256 and the API secret
      const hmac = CryptoJS.HmacSHA256(payloadString, this.apiSecret);

      // Convert the calculated signature to hex format
      const calculatedSignature = hmac.toString(CryptoJS.enc.Hex);

      // Compare signatures using constant-time comparison
      return this.constantTimeCompare(signature, calculatedSignature);
    } catch (error) {
      logger.error('Webhook validation error:', error);
      return false;
    }
  }
}

// Export singleton instance
export default VaultodyService.initialize();
