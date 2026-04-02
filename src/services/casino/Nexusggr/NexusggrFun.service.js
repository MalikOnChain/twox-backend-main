import axios from 'axios';

import config from '@/config';
import { API_METHODS, API_CALLBACK_METHODS } from '@/types/casino/nexusggr/nexusggr';
import { GAME_CATEGORIES } from '@/types/game/game';
import { logger } from '@/utils/logger';

const DEMO_API_URL = process.env.NEXUSGGR_DEMO_API_URL;
const DEFAULT_DEMO_BALANCE = config.nexusggr.demo_user_balance;

const DEMO_REQUIRED_PAYLOAD = {
  agent_code: config.nexusggr.demo_agent_code,
  agent_token: config.nexusggr.demo_token,
};

class BalanceStore {
  constructor() {
    this.balances = new Map(); // Store balance data with expiry
  }

  storeBalance(userId, balance) {
    this.balances.set(userId, {
      balance,
    });
  }

  getBalance(userId) {
    const balanceData = this.balances.get(userId);
    if (!balanceData) return null;

    return balanceData.balance;
  }

  removeBalance(userId) {
    this.balances.delete(userId);
  }
}

class NexusggrFunService {
  constructor() {
    this.store = new BalanceStore();
  }

  async launchDemoGame(provider_code, game_code) {
    try {
      if (!config.nexusggr.enable) {
        throw new Error('Game is not enabled');
      }

      const demoUserId = this.generateRandomUserId();

      // Initialize balance for the new user
      this.store.storeBalance(demoUserId, DEFAULT_DEMO_BALANCE);

      const payload = {
        method: API_METHODS.GAME_LAUNCH,
        provider_code: provider_code,
        user_code: demoUserId,
        game_code,
        lang: 'en',
        ...DEMO_REQUIRED_PAYLOAD,
      };

      logger.debug('payload', payload);

      const response = await axios.post(DEMO_API_URL, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.data?.status) {
        throw new Error(response.data.msg);
      }

      return {
        ...response.data,
        user_code: demoUserId,
        demo_balance: this.store.getBalance(demoUserId),
      };
    } catch (error) {
      console.error('Error in launchDemoGame:', error);
      throw new Error(error?.message || 'Error launching demo game');
    }
  }

  generateRandomUserId() {
    return `demo${Math.random().toString(36).substring(2, 10)}`;
  }

  processGameData(gameData) {
    const isSlotGame = gameData.game_type === 'slot';
    const gameInfo = isSlotGame ? gameData.slot : gameData.live;
    const gameType = isSlotGame ? GAME_CATEGORIES.SLOTS : GAME_CATEGORIES.LIVE_CASINO;

    return { gameInfo, gameType, isSlotGame };
  }

  calculateUpdateBalance(currentBalance, winMoney, betMoney) {
    return parseFloat(currentBalance.toString()) + parseFloat(winMoney) - parseFloat(betMoney);
  }

  getBalance(user_code) {
    const balance = this.store.getBalance(user_code);
    return { status: 1, user_balance: balance };
  }

  async handleDemoTransaction(gameData) {
    try {
      const { user_code } = gameData;
      const currentBalance = this.store.getBalance(user_code);

      if (currentBalance === null) {
        logger.error('No balance found for user:', user_code);
        return { status: 0, msg: 'INVALID_USER' };
      }

      const { gameInfo } = this.processGameData(gameData);

      // Calculate new balance
      const newBalance = this.calculateUpdateBalance(currentBalance, gameInfo.win_money, gameInfo.bet_money);

      // Update balance
      this.store.storeBalance(user_code, newBalance);

      return { status: 1, user_balance: newBalance };
    } catch (error) {
      logger.error('Transaction Error:', error);
      return { status: 0, msg: 'TRANSACTION_ERROR' };
    }
  }

  async handleCallback(req) {
    const body = req.body;
    logger.info('nexusggr/demo_api body', body);
    logger.info('body.agent_code', body.agent_code);

    // handle demo play
    if (body.agent_code === config.nexusggr.demo_agent_code) {
      logger.info('config.nexusggr.demo_agent_code', body.agent_code === config.nexusggr.demo_agent_code);
      logger.info('body.method', body.method);
      logger.info('API_CALLBACK_METHODS.USER_BALANCE', API_CALLBACK_METHODS.USER_BALANCE);
      logger.info('this', this);
      logger.info('this.getBalance', this.getBalance);

      switch (body.method) {
        case API_CALLBACK_METHODS.USER_BALANCE:
          return this.getBalance(body.user_code);
        case API_CALLBACK_METHODS.TRANSACTION:
          return this.handleDemoTransaction(body);
        default:
          return { status: 0 };
      }
    }

    return { status: 0 };
  }

  async getCallPlayers() {
    try {
      const payload = {
        method: API_METHODS.CALL_PLAYERS,
        ...DEMO_REQUIRED_PAYLOAD,
      };

      const response = await axios.post(DEMO_API_URL, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Error in getCallPlayers:', error);
      return { status: 0, msg: 'CALL_PLAYERS_ERROR' };
    }
  }

  async getCallList({ provider_code, game_code }) {
    try {
      const payload = {
        method: API_METHODS.CALL_LIST,
        provider_code,
        game_code,
        ...DEMO_REQUIRED_PAYLOAD,
      };

      logger.debug('payload', payload);

      const response = await axios.post(DEMO_API_URL, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.debug('response', response.data);

      return response.data;
    } catch (error) {
      logger.debug('error', error);
      logger.error('Error in getCallList:', error);
    }
  }

  async applyCall({ provider_code, game_code, user_id }) {
    try {
      // const user = await User.findById(userId);

      // if (!user) {
      // return { status: 0, msg: 'INSUFFICIENT_USER_FUNDS' };
      // }

      const payload = {
        method: API_METHODS.CALL_APPLY,
        provider_code,
        game_code,
        call_type: 2,
        call_rtp: 150,
        user_code: user_id,
        ...DEMO_REQUIRED_PAYLOAD,
      };

      logger.debug('payload', payload);

      const response = await axios.post(DEMO_API_URL, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error in applyCall:', error);
    }
  }
}

export default new NexusggrFunService();
