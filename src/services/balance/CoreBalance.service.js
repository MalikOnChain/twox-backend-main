import statusSocket from '@/controllers/SocketControllers/status-socket';
import userSocketController from '@/controllers/SocketControllers/user-socket';
import User from '@/models/users/User';
import UserBonusBalance from '@/models/users/UserBonusBalance';
import UserCashbackBalance from '@/models/users/UserCashbackBalance';
import UserFreeSpinBalance from '@/models/users/UserFreeSpinBalance';
import UserReferBonusBalance from '@/models/users/UserReferBonusBalance';
import UserWagerRaceBalance from '@/models/users/UserWagerRaceBalance';
import NotificationService from '@/services/notification/Notification.service';
import { SERVICE_TRANSACTION_TYPES } from '@/types/bonus/service';
import { logger } from '@/utils/logger';

export class CoreBalanceService {
  static instance = null;
  static config = {
    defaultWageringMultiplier: 30,
    defaultBonusExpiryDays: 7,
    gameContributionRates: {
      default: 1.0,
      slots: 1.0,
      blackjack: 0.1,
      roulette: 0.5,
      baccarat: 0.1,
      poker: 0.1,
      crash: 0.8,
      dice: 0.9,
      limbo: 0.9,
      live_casino: 0.1,
    },
  };

  constructor() {
    if (CoreBalanceService.instance) {
      return CoreBalanceService.instance;
    }

    this.notificationService = NotificationService;
    CoreBalanceService.instance = this;
  }

  static initialize() {
    if (!CoreBalanceService.instance) {
      CoreBalanceService.instance = new CoreBalanceService();
    }
    return CoreBalanceService.instance;
  }

  static getInstance() {
    if (!CoreBalanceService.instance) {
      throw new Error('CoreBalanceService has not been initialized. Call initialize() first.');
    }
    return CoreBalanceService.instance;
  }

  async getTotalBalance(user, session = null) {
    try {
      const dbUser = await User.findById(user._id).session(session);
      if (!dbUser) {
        throw new Error('User not found');
      }

      const totalBonusBalance = await this.getTotalBonusBalance(user._id, session);
      const totalLockedWinnings = await this.getTotalLockedWinnings(user._id, session);
      const mainBalance = dbUser.balance;

      return Number((mainBalance + totalBonusBalance + totalLockedWinnings).toFixed(2));
    } catch (error) {
      logger.error(`Failed to calculate total balance: ${error.message}`);
      throw error;
    }
  }

  async getTotalAvailableBalance(user, session = null) {
    const totalBalance = await this.getTotalBalance(user, session);
    const freeSpinBalance = await this.getFreeSpinBalance(user, session);
    const totalAvailableBalance = totalBalance + freeSpinBalance;

    return totalAvailableBalance;
  }

  async getTotalBonusBalance(userId, session = null) {
    const bonuses = await UserBonusBalance.find({
      userId: userId,
      status: 'active',
    }).session(session);

    const commonBonusBalance = bonuses.reduce((sum, bonus) => sum + bonus.bonusBalance, 0);
    const cashbackBalance = await this.getCashbackBalance(userId, session);
    const referBonusBalance = await this.getReferBonusBalance(userId, session);
    const wagerRaceBalance = await this.getWagerRaceBalance(userId, session);

    const totalBonusBalance = commonBonusBalance + cashbackBalance + referBonusBalance + wagerRaceBalance;

    return totalBonusBalance;
  }

  async getTotalLockedWinnings(userId, session = null) {
    const bonuses = await UserBonusBalance.find({
      userId: userId,
      status: 'active',
    }).session(session);

    const commonLockedWinnings = bonuses.reduce((sum, bonus) => sum + bonus.lockedWinnings, 0);
    const cashbackLockedWinnings = await this.getCashbackLockedWinnings(userId, session);
    const referBonusLockedWinnings = await this.getReferBonusLockedWinnings(userId, session);
    const wagerRaceLockedWinnings = await this.getWagerRaceLockedWinnings(userId, session);
    const freeSpinLockedWinnings = await this.getFreeSpinLockedWinnings(userId, session);

    const totalLockedWinnings =
      commonLockedWinnings +
      cashbackLockedWinnings +
      referBonusLockedWinnings +
      wagerRaceLockedWinnings +
      freeSpinLockedWinnings;

    return totalLockedWinnings;
  }

  async getCashbackBalance(userId, session = null) {
    try {
      const cashback = await UserCashbackBalance.findOne({ userId }).session(session);
      return cashback ? cashback.cashbackBalance : 0;
    } catch (error) {
      logger.error('Error getting cashback balance:', error);
      return 0;
    }
  }

  async getFreeSpinBalance(userId, session = null) {
    try {
      const freeSpin = await UserFreeSpinBalance.findOne({ userId }).session(session);
      if (!freeSpin) return 0;

      const freeSpinAmount = freeSpin.freeSpinBalance * freeSpin.originalValue;

      return Number(freeSpinAmount.toFixed(2));
    } catch (error) {
      logger.error(`Error getting free spin balance: ${error.message}`);
      return 0;
    }
  }

  async getFreeSpinsBalanceDetails(userId, session = null) {
    try {
      const freeSpin = await UserFreeSpinBalance.findOne({ userId }).session(session);

      return freeSpin;
    } catch (error) {
      logger.error('Error getting free spin balance:', error);
      return 0;
    }
  }

  async getCashbackLockedWinnings(userId, session = null) {
    try {
      const cashback = await UserCashbackBalance.findOne({ userId }).session(session);
      return cashback ? cashback.lockedWinnings : 0;
    } catch (error) {
      logger.error('Error getting cashback locked winnings:', error);
      return 0;
    }
  }

  async getReferBonusBalance(userId, session = null) {
    try {
      const referBonus = await UserReferBonusBalance.findOne({ userId }).session(session);
      return referBonus ? referBonus.referBonusBalance : 0;
    } catch (error) {
      logger.error('Error getting refer bonus balance:', error);
      return 0;
    }
  }

  async getReferBonusLockedWinnings(userId, session = null) {
    try {
      const referBonus = await UserReferBonusBalance.findOne({ userId }).session(session);
      return referBonus ? referBonus.lockedWinnings : 0;
    } catch (error) {
      logger.error('Error getting refer bonus locked winnings:', error);
      return 0;
    }
  }

  async getWagerRaceBalance(userId, session = null) {
    try {
      const wagerRace = await UserWagerRaceBalance.findOne({ userId }).session(session);
      return wagerRace ? wagerRace.wagerRaceBalance : 0;
    } catch (error) {
      logger.error('Error getting wager race balance:', error);
      return 0;
    }
  }

  async getWagerRaceLockedWinnings(userId, session = null) {
    try {
      const wagerRace = await UserWagerRaceBalance.findOne({ userId }).session(session);
      return wagerRace ? wagerRace.lockedWinnings : 0;
    } catch (error) {
      logger.error('Error getting wager race locked winnings:', error);
      return 0;
    }
  }

  async hasEnoughBalance(user, amount, session = null) {
    try {
      const totalBalance = await this.getTotalBalance(user, session);
      return totalBalance >= amount;
    } catch (error) {
      logger.error(`Failed to check balance: ${error.message}`);
      throw error;
    }
  }

  async increaseRealBalance(user, amount, source, session, metadata = {}, isDeposit = false) {
    try {
      logger.info('increasing real balance', amount);

      user.balance = (user.balance || 0) + amount;

      await user.save({ session });

      const depositCount = await user.getDepositCount();

      await this._emitBalanceUpdate(user, source, metadata, session).catch((error) => {
        logger.error(`Failed to emit balance update: ${error.message}`);
      });

      if (isDeposit) {
        await statusSocket.sendNewEvent({
          userId: user._id,
          type: 'deposit',
          message: `Your deposit of ${amount} has been successfully processed`,
          metadata: {
            amount,
            isFirstDeposit: depositCount === 1 ? true : false,
            isSecondDeposit: depositCount === 2 ? true : false,
          },
          success: true,
        });
      }

      logger.info(`Increased real balance for user ${user._id} by ${amount} from ${source}`);
      return user;
    } catch (error) {
      logger.error(`Failed to increase real balance: ${error.message}`);
      throw error;
    }
  }

  async decreaseRealBalance(user, amount, source, session, metadata = {}) {
    try {
      if ((user.balance || 0) < amount) {
        throw new Error(`Insufficient real balance: ${user.balance} < ${amount}`);
      }

      user.balance -= amount;

      if (session) {
        await user.save({ session });
      } else {
        await user.save();
      }

      await this._emitBalanceUpdate(user, source, metadata, session);

      logger.info(`Decreased real balance for user ${user._id} by ${amount} for ${source}`);
      return user;
    } catch (error) {
      logger.error(`Failed to decrease real balance: ${error.message}`);
      throw error;
    }
  }

  async getFreeSpinLockedWinnings(userId, session = null) {
    const freeSpin = await UserFreeSpinBalance.findOne({ userId }).session(session);
    if (!freeSpin) {
      return 0;
    }

    return freeSpin.lockedWinnings * freeSpin.originalValue;
  }

  getGameContribution(gameType = 'default') {
    if (!gameType) return CoreBalanceService.config.gameContributionRates.default;

    const normalizedType = gameType.toLowerCase();
    return (
      CoreBalanceService.config.gameContributionRates[normalizedType] ||
      CoreBalanceService.config.gameContributionRates.default
    );
  }

  async getBalanceDetails(user, session = null) {
    try {
      const activeBonuses = await UserBonusBalance.find({
        userId: user._id,
        status: 'active',
      }).session(session);

      const bonusBalances = activeBonuses.map((bonus) => ({
        bonusId: bonus.bonusId,
        bonusBalance: bonus.bonusBalance,
        lockedWinnings: bonus.lockedWinnings,
        wageringProgress: bonus.wageringProgress,
        initialAmount: bonus.initialAmount,
        wageringMultiplier: bonus.wageringMultiplier,
        bonusType: bonus.bonusType,
        remainingWagering: bonus.remainingWagering,
      }));

      const totalBonusBalance = await this.getTotalBonusBalance(user._id, session);
      const totalLockedWinnings = await this.getTotalLockedWinnings(user._id, session);

      const cashbackDetail = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
      const referBonusDetail = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
      const wagerRaceDetail = await UserWagerRaceBalance.findOne({ userId: user._id }).session(session);

      const freeSpinDetail = await UserFreeSpinBalance.findOne({ userId: user._id }).session(session);

      return {
        realBalance: user.balance || 0,
        totalBonusBalance,
        totalLockedWinnings,
        freeSpinBalance: freeSpinDetail.freeSpinBalance * freeSpinDetail.originalValue,
        totalBalance: (user.balance || 0) + (totalBonusBalance || 0) + (totalLockedWinnings || 0),
        bonusDetails: bonusBalances,
        cashbackDetails: cashbackDetail,
        referBonusDetails: referBonusDetail,
        wagerRaceDetails: wagerRaceDetail,
        freeSpinDetails: freeSpinDetail,
      };
    } catch (error) {
      logger.error(`Failed to get balance details: ${error.message}`);
      throw error;
    }
  }

  async getBonusBalanceDetails(user, session = null) {
    const bonusDetail = await UserBonusBalance.find({ userId: user._id }).session(session);
    return bonusDetail;
  }

  async getCashbackBalanceDetails(user) {
    const cashbackDetail = await UserCashbackBalance.findOne({ userId: user._id });

    return cashbackDetail;
  }

  async getReferBonusBalanceDetails(user) {
    const referBonusDetail = await UserReferBonusBalance.findOne({ userId: user._id });
    return referBonusDetail;
  }

  async getWagerRaceBalanceDetails(user) {
    const wagerRaceDetail = await UserWagerRaceBalance.findOne({ userId: user._id });
    return wagerRaceDetail;
  }

  async getUserDepositStats(userId) {
    try {
      const deposits = await this.transactionModel.find({
        userId,
        type: 'deposit',
        status: 'completed',
      });

      const depositCount = deposits.length;
      const depositAmount = deposits.reduce((total, deposit) => total + deposit.amount, 0);

      return {
        count: depositCount,
        totalAmount: depositAmount,
      };
    } catch (error) {
      console.error('Error getting user deposit stats:', error);
      throw error;
    }
  }

  async _emitBalanceUpdate(user, source, metadata = {}, session = null) {
    try {
      if (source === SERVICE_TRANSACTION_TYPES.FREE_SPINS) {
        logger.debug('emitting free spins balance update', metadata);
      }

      const balanceDetails = await this.getBalanceDetails(user, session);

      const userId = user._id;

      if (!userId || !balanceDetails) {
        logger.warn('Invalid parameters for _emitBalanceUpdate');
        return;
      }

      userSocketController
        .emitBalanceUpdate({
          userId,
          balance: balanceDetails,
          type: source,
          metadata,
        })
        .catch((error) => {
          logger.error(`Failed to emit socket update: ${error.message}`);
        });
    } catch (error) {
      logger.error(`Failed to emit balance update: ${error.message}`);
    }
  }
}

CoreBalanceService.initialize();

export default new CoreBalanceService();
