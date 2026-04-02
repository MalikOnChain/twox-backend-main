import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import qs from 'querystring';

import { logger } from '@/utils/logger';

// ==================== BASE INTERFACES ====================

interface IBlueOceanBaseRequest {
  currency: string;
}

interface IBlueOceanResponse {
  success?: boolean;
  error?: string;
  message?: string;
  data?: any;
  [key: string]: any;
}

// ==================== GAME LIST RESPONSE INTERFACES ====================

interface IBlueOceanGameListResponse {
  error: number;
  response: IBlueOceanGameItem[];
  response_provider_logos: {
    livecasino: IBlueOceanGameProviderItem[];
    casino: IBlueOceanGameProviderItem[];
    sportsbook: IBlueOceanGameProviderItem[];
  };
}

type BlueOceanGameTypes =
  | 'livecasino'
  | 'poker'
  | 'virtual-sports'
  | 'sportsbook'
  | 'live-casino-table'
  | 'video-slots'
  | 'table-games'
  | 'video-poker'
  | 'virtual-games'
  | 'scratch-cards'
  | 'video-bingo'
  | 'tournaments'
  | 'livegames'
  | 'crash-games'
  | 'fast-games';

interface IBlueOceanGameItem {
  id: string;
  name: string;
  type: BlueOceanGameTypes;
  subcategory: string;
  details: string;
  new: string;
  position: number;
  plays: number;
  rtp: string;
  wagering: string;
  mobile: string;
  play_for_fun: string;
  free_rounds: string;
  feature_buy: string;
  jackpot: string;
  release_date: string;
  show_date: string;
  hide_date: string;
  id_hash: string;
  id_parent: string;
  id_hash_parent: string;
  lottie: string;
  image: string;
  image_preview: string;
  image_filled: string;
  image_portrait: string;
  image_square: string;
  image_background: string;
  image_lottie: string;
  image_portrait_lottie: string;
  image_square_lottie: string;
  image_bw: string;
  status: string;
  featured: string;
  order: number;
  provider: string;
  provider_name: string;
  system: string;
  licence: string;
  gamename: string;
  report: string;
}

interface IBlueOceanGameProviderItem {
  id: string;
  name: string;
  type: string;
  system: string;
  image: string;
  image_black: string;
  image_white: string;
  image_colored: string;
  image_small_color: string;
  image_small_gray: string;
}

// ==================== REQUEST INTERFACES ====================

interface IBlueOceanGameListRequest extends IBlueOceanBaseRequest {
  show_additional?: boolean;
  show_systems?: string;
}

interface IBlueOceanGameRequest extends IBlueOceanBaseRequest {
  lang?: string;
  user_username: string;
  user_password: string;
  gameid: string;
  play_for_fun?: boolean;
}

interface IBlueOceanPlayerRequest extends IBlueOceanBaseRequest {
  user_username: string;
  user_password?: string;
  currency: string;
}

interface IBlueOceanWalletRequest {
  action: 'balance' | 'debit' | 'credit' | 'rollback';
  remote_id: string;
  session_id: string;
  amount?: string;
  transaction_id?: string;
}

interface IBlueOceanWalletResponse {
  status: string;
  balance: string;
}

interface IBlueOceanFreeRoundsRequest extends IBlueOceanBaseRequest {
  tittle: string;
  playerids: string;
  gameids: string;
  available: number;
  validFrom?: string;
  validTo: string;
}

interface IBlueOceanRoundHistoryRequest extends IBlueOceanBaseRequest {
  date_start: string;
  date_end: string;
  status?: string;
}

function normalizeBlueOceanSeamlessBaseUrl(url: string): string {
  return url.trim().replace(/\?+$/, '');
}

class BlueOceanService {
  private apiUrl: string = normalizeBlueOceanSeamlessBaseUrl(
    process.env.BLUEOCEAN_API_URL || ''
  );
  private apiUsername: string = process.env.BLUEOCEAN_API_USERNAME || '';
  private apiPassword: string = process.env.BLUEOCEAN_API_PASSWORD || '';
  private backendUrl: string = process.env.BACKEND_URL || '';
  private saltKey: string = process.env.BLUEOCEAN_SALT_KEY || '';
  private callerPrefix: string = process.env.BLUEOCEAN_CALLER_PREFIX || '700h';

  constructor() {
    if (!this.apiUrl || !this.apiUsername || !this.apiPassword) {
      throw new Error('BlueOcean API credentials are not properly configured');
    }
  }

  /**
   * Generate MD5 hash of API password
   */
  private hashPassword(password: string): string {
    return crypto.createHash('md5').update(password).digest('hex');
  }

  /**
   * Generate SHA1 signature for seamless wallet calls
   */
  private generateSignature(queryString: string): string {
    const payload = this.saltKey + queryString;
    return crypto.createHash('sha1').update(payload).digest('hex');
  }

  /**
   * Make API call to BlueOcean
   */
  private async makeApiCall<T>(data: Record<string, any>): Promise<T> {
    try {
      logger.info('BlueOcean API Request', {
        apiUrl: this.apiUrl,
        apiUsername: this.apiUsername,
        method: data.method,
      });

      const requestData = {
        ...data,
        api_password: this.apiPassword,
        api_login: this.apiUsername,
      };

      const response: AxiosResponse<T> = await axios.post(this.apiUrl, qs.stringify(requestData), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });
      console.log('response============>', response.data);

      return response.data;
    } catch (error) {
      logger.error('BlueOcean API Error', {
        method: data.method,
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw new Error(`BlueOcean API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make seamless wallet call
   */
  private async makeWalletCall<T>(params: Record<string, any>): Promise<T> {
    try {
      const hashedPassword = this.hashPassword(this.apiPassword);
      const queryParams = {
        callerId: this.apiUsername,
        callerPassword: hashedPassword,
        callerPrefix: this.callerPrefix,
        ...params,
      };

      const queryString = qs.stringify(queryParams);
      const signature = this.generateSignature(queryString);

      const finalUrl = `${this.apiUrl}?${queryString}&key=${signature}`;

      const response: AxiosResponse<T> = await axios.get(finalUrl, {
        timeout: 30000,
      });

      logger.info('BlueOcean Wallet Response', {
        action: params.action,
        status: response.status,
        data: response.data,
      });

      return response.data;
    } catch (error) {
      logger.error('BlueOcean Wallet Error', {
        action: params.action,
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
      });
      throw new Error(`BlueOcean wallet call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== GAME LAUNCH METHODS ====================

  /**
   * Get list of available games
   */
  async getGameList(request: IBlueOceanGameListRequest): Promise<IBlueOceanGameListResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'getGameList',
      currency: request.currency,
      show_additional: request.show_additional ? 'true' : 'false',
      show_systems: request.show_systems,
    };

    return this.makeApiCall(data);
  }

  /**
   * Launch a game for a player
   */
  async getGame(request: IBlueOceanGameRequest): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'getGame',
      lang: request.lang,
      user_username: request.user_username,
      user_password: request.user_password,
      gameid: request.gameid,
      homeurl: `${this.backendUrl}/casino/blueocean/wallet`,
      play_for_fun: request.play_for_fun,
      currency: request.currency,
    };

    return this.makeApiCall(data);
  }

  /**
   * Get direct game launch URL
   */
  async getGameDirect(request: IBlueOceanGameRequest & { homeurl: string }): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'getGameDirect',
      lang: request.lang,
      user_username: request.user_username,
      user_password: request.user_password,
      gameid: request.gameid,
      homeurl: request.homeurl,
      play_for_fun: request.play_for_fun,
      currency: request.currency,
    };

    return this.makeApiCall(data);
  }

  // ==================== PLAYER MANAGEMENT METHODS ====================

  /**
   * Create a new player
   */
  async createPlayer(request: IBlueOceanPlayerRequest): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'createPlayer',
      user_username: request.user_username,
      user_password: request.user_password,
      currency: request.currency,
    };

    return this.makeApiCall(data);
  }

  /**
   * Check if player exists
   */
  async playerExists(request: IBlueOceanPlayerRequest): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'playerExists',
      user_username: request.user_username,
      currency: request.currency,
    };

    return this.makeApiCall(data);
  }

  // ==================== WALLET METHODS ====================

  /**
   * Get player balance
   */
  async getPlayerBalance(params: Omit<IBlueOceanWalletRequest, 'action'>): Promise<IBlueOceanWalletResponse> {
    return this.makeWalletCall({
      action: 'balance',
      ...params,
    });
  }

  /**
   * Debit player balance
   */
  async debitPlayerBalance(params: Omit<IBlueOceanWalletRequest, 'action'> & { amount: string; transaction_id: string }): Promise<IBlueOceanWalletResponse> {
    return this.makeWalletCall({
      action: 'debit',
      ...params,
    });
  }

  /**
   * Credit player balance
   */
  async creditPlayerBalance(params: Omit<IBlueOceanWalletRequest, 'action'> & { amount: string; transaction_id: string }): Promise<IBlueOceanWalletResponse> {
    return this.makeWalletCall({
      action: 'credit',
      ...params,
    });
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(params: Omit<IBlueOceanWalletRequest, 'action'> & { transaction_id: string }): Promise<IBlueOceanWalletResponse> {
    return this.makeWalletCall({
      action: 'rollback',
      ...params,
    });
  }

  // ==================== FREE ROUNDS METHODS ====================

  /**
   * Add free rounds for players
   */
  async addFreeRounds(request: IBlueOceanFreeRoundsRequest): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'addFreeRounds',
      currency: request.currency,
      tittle: request.tittle,
      playerids: request.playerids,
      gameids: request.gameids,
      available: request.available,
      validFrom: request.validFrom,
      validTo: request.validTo,
    };

    return this.makeApiCall(data);
  }

  // ==================== REPORTING METHODS ====================

  /**
   * Get daily report
   */
  async getDailyReport(request: IBlueOceanBaseRequest): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'getDailyReport',
      currency: request.currency,
    };

    return this.makeApiCall(data);
  }

  /**
   * Get daily balances
   */
  async getDailyBalances(request: IBlueOceanBaseRequest): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'getDailyBalances',
      currency: request.currency,
    };

    return this.makeApiCall(data);
  }

  /**
   * Get payment transactions
   */
  async getPaymentTransactions(request: IBlueOceanRoundHistoryRequest): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'getPaymentTransactions',
      currency: request.currency,
      date_start: request.date_start,
      date_end: request.date_end,
      status: request.status,
    };

    return this.makeApiCall(data);
  }

  // ==================== SYSTEM METHODS ====================

  /**
   * Get system username
   */
  async getSystemUsername(request: { system: string }): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'getSystemUsername',
      system: request.system,
    };

    return this.makeApiCall(data);
  }

  /**
   * Set system username
   */
  async setSystemUsername(request: { system: string; splayer_username: string }): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'setSystemUsername',
      system: request.system,
      splayer_username: request.splayer_username,
    };

    return this.makeApiCall(data);
  }

  /**
   * Set system password
   */
  async setSystemPassword(request: { system: string; splayer_password: string }): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'setSystemPassword',
      system: request.system,
      splayer_password: request.splayer_password,
    };

    return this.makeApiCall(data);
  }

  // ==================== PLAYER AUTHENTICATION METHODS ====================

  /**
   * Login player to BlueOcean system
   */
  async loginPlayer(request: {
    user_username: string;
    user_password: string;
    currency?: string;
  }): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'loginPlayer',
      user_username: request.user_username,
      user_password: request.user_password,
      currency: request.currency || 'EUR',
    };

    return this.makeApiCall(data);
  }

  /**
   * Logout player from BlueOcean system
   */
  async logoutPlayer(request: {
    user_username: string;
    currency?: string;
  }): Promise<IBlueOceanResponse> {
    const data = {
      api_login: this.apiUsername,
      api_password: this.apiPassword,
      method: 'logoutPlayer',
      user_username: request.user_username,
      currency: request.currency || 'EUR',
    };

    return this.makeApiCall(data);
  }
}

export default new BlueOceanService();
export { IBlueOceanGameListRequest, IBlueOceanGameRequest, IBlueOceanPlayerRequest, IBlueOceanWalletRequest, IBlueOceanWalletResponse, IBlueOceanFreeRoundsRequest, IBlueOceanRoundHistoryRequest };
