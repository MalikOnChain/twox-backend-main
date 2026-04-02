import axios, { AxiosError } from 'axios';

import { Time } from '@/utils/helpers/moment';
import { logger } from '@/utils/logger';

interface CacheEntry {
  price: number;
  timestamp: number;
}

interface CoinbaseResponse {
  data: {
    rates: {
      [key: string]: string;
    };
  };
}

export class CryptoPriceService {
  private static instance: CryptoPriceService;
  private readonly baseUrl: string;
  private readonly cache: Map<string, CacheEntry>;
  private cacheTimeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  private constructor() {
    this.baseUrl = 'https://api.coinbase.com/v2/exchange-rates';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  public static initialize(): CryptoPriceService {
    if (!CryptoPriceService.instance) {
      CryptoPriceService.instance = new CryptoPriceService();
    }
    return CryptoPriceService.instance;
  }

  public static getInstance(): CryptoPriceService {
    if (!CryptoPriceService.instance) {
      throw new Error('CryptoPriceService has not been initialized. Call initialize() first.');
    }
    return CryptoPriceService.instance;
  }

  private validateInputs(currency: CRYPTO_CURRENCY): void {
    if (!currency || typeof currency !== 'string') {
      throw new Error('Invalid currency parameter');
    }
  }

  private getCachedPrice(cacheKey: string): number | null {
    const cachedData = this.cache.get(cacheKey);
    if (cachedData && Time.now() - cachedData.timestamp < this.cacheTimeout) {
      return cachedData.price;
    } else {
      this.cache.delete(cacheKey);
    }
    return null;
  }

  private updateCache(cacheKey: string, price: number): void {
    this.cache.set(cacheKey, {
      price,
      timestamp: Time.now(),
    });
  }

  private async fetchPriceWithRetry(currency: CRYPTO_CURRENCY, retryCount = 0): Promise<any> {
    try {
      const response = await axios.get<CoinbaseResponse>(`${this.baseUrl}?currency=${currency}`, {
        headers: {
          'x-api-key': null,
        },
        timeout: 5000, // 5 second timeout
      });

      const { data } = response.data;
      if (!data?.rates) {
        throw new Error('Invalid API response format');
      }

      return data.rates;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        await Time.wait(delay);
        return this.fetchPriceWithRetry(currency, retryCount + 1);
      }

      const errorMessage =
        error instanceof AxiosError ? error.response?.data?.message || error.message : (error as Error).message;

      logger.error(`Failed to fetch price after ${this.maxRetries} retries`, { error: errorMessage });

      throw new Error(`Failed to fetch price after ${this.maxRetries} retries`, error as Error);
    }
  }

  public async getPriceInUSD(currency: CRYPTO_CURRENCY): Promise<number> {
    try {
      this.validateInputs(currency);

      const cacheKey = currency.toLowerCase();
      const cachedPrice = this.getCachedPrice(cacheKey);
      if (cachedPrice !== null) {
        return cachedPrice;
      }

      const rates = await this.fetchPriceWithRetry(currency);
      const priceUSD = parseFloat(rates.USD);
      
      // Coinbase API with currency=BTC returns how much 1 BTC is worth in USD
      // So rates.USD directly gives us the price
      this.updateCache(cacheKey, priceUSD);

      return priceUSD;
    } catch (error) {
      throw new Error(`Failed to get price for ${currency}`, error as Error);
    }
  }

  public async getAllPrices(): Promise<any> {
    const currencies = ['BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'LINK', 'XLM', 'SOL', 'USDT', 'TRX', 'BNB', 'DOGE', 'MATIC', 'AVAX', 'ARB'];
    const prices = await Promise.all(
      currencies.map(async (currency) => {
        try {
          const price = await this.getPriceInUSD(currency as CRYPTO_CURRENCY);
          return { currency, USD: price, EUR: price * 0.9 };
        } catch (error) {
          logger.error(`Failed to get price for ${currency}:`, error);
          return { currency, USD: 0, EUR: 0 };
        }
      })
    );
    return prices;
  }

  public async getAllPricesInUSD(): Promise<any> {
    const currencies = ['BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'LINK', 'XLM', 'SOL', 'USDT', 'TRX', 'BNB', 'DOGE', 'MATIC', 'AVAX', 'ARB'];
    const prices = await Promise.all(
      currencies.map(async (currency) => {
        try {
          const price = await this.getPriceInUSD(currency as CRYPTO_CURRENCY);
          return { currency, price };
        } catch (error) {
          logger.error(`Failed to get price for ${currency}:`, error);
          return { currency, price: 0 };
        }
      })
    );
    return prices.filter(p => p.price > 0); // Filter out failed requests
  }
}

export default CryptoPriceService.initialize();
