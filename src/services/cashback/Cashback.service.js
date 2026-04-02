import moment from 'moment/moment';
import cron from 'node-cron';

import serviceTransactionManager, {
  ServiceTransactionHandler,
} from '@/controllers/TransactionControllers/ServiceTransactionManager';
import ServiceTransaction from '@/models/transactions/ServiceTransactions';
import UserCashbackBalance from '@/models/users/UserCashbackBalance';
import Cashback from '@/models/vip/Cashback';
import VipUser from '@/models/vip/VipUser';
import {
  SERVICE_TRANSACTION_STATUS,
  SERVICE_TRANSACTION_TYPES,
  CASHBACKCLAIMTYPES,
  CASHBACKTYPES,
} from '@/types/bonus/service';
import { logger } from '@/utils/logger';

export class CashbackService {
  static instance = null;

  constructor() {
    if (CashbackService.instance) {
      return CashbackService.instance;
    }

    CashbackService.instance = this;
    this.initSchedules();
  }

  static initialize() {
    if (!CashbackService.instance) {
      CashbackService.instance = new CashbackService();
    }
    return CashbackService.instance;
  }

  static getInstance() {
    if (!CashbackService.instance) {
      throw new Error('CashbackService has not been initialized. Call initialize() first.');
    }
    return CashbackService.instance;
  }

  async getAllActiveCashbacks(session = null) {
    try {
      return await Cashback.find({ status: 1 }).session(session);
    } catch (error) {
      logger.error('Error getting active cashbacks:', error);
      throw error;
    }
  }

  async getUserCashbackBalance(userId) {
    try {
      return await UserCashbackBalance.findOne({ userId });
    } catch (error) {
      logger.error('Error getting user cashback balance:', error);
      return null;
    }
  }

  async makeCashbackTransaction(userId, wageringAmount, gameType = null, session = null) {
    try {
      const vipUser = await VipUser.findOne({ userId }).session(session);
      if (!vipUser) {
        throw new Error('VIP user not found');
      }

      const cashbacks = await this.getAllActiveCashbacks(session);
      if (!cashbacks || cashbacks.length === 0) {
        throw new Error('Cashbacks not found or inactive');
      }

      // Calculate all cashback amounts first
      const cashbackCalculations = [];
      let totalCashbackAmount = 0;
      for (const cashback of cashbacks) {
        if (!this.isEligible(cashback, gameType, userId)) {
          continue;
        }

        let cashbackAmount = 0;

        switch (cashback.type) {
          case CASHBACKTYPES.DEFAULT:
            cashbackAmount = Number(
              (
                wageringAmount *
                cashback.getDefaultMultiplier({
                  tierName: vipUser.currentTier,
                  tierLevel: vipUser.currentLevel,
                  wageringAmount,
                })
              ).toFixed(8)
            );
            break;
          case CASHBACKTYPES.TIME_BOOST:
            cashbackAmount = Number(
              (
                wageringAmount *
                cashback.getCurrentTimeBoostMultiplier({
                  tierName: vipUser.currentTier,
                  tierLevel: vipUser.currentLevel,
                  wageringAmount,
                })
              ).toFixed(8)
            );
            break;
          case CASHBACKTYPES.GAME_BOOST:
            cashbackAmount = Number(
              (
                wageringAmount *
                cashback.getGameMultiplier({
                  gameType,
                  tierName: vipUser.currentTier,
                  tierLevel: vipUser.currentLevel,
                  wageringAmount,
                })
              ).toFixed(8)
            );
            break;
        }

        const now = new Date();
        let totalCashbackClaimed = 0;
        let remainingCashback = 0;

        switch (cashback.claimFrequency.mode) {
          case CASHBACKCLAIMTYPES.INSTANT:
          case CASHBACKCLAIMTYPES.DAILY: {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const dayStart = today.toISOString();
            totalCashbackClaimed = await this.getTotalCashbackClaimed(userId, cashback, dayStart);
            remainingCashback = Math.max(
              0,
              cashback.getCapAmount({ tierName: vipUser.currentTier, tierLevel: vipUser.currentLevel, type: 'day' }) -
                totalCashbackClaimed
            );
            break;
          }
          case CASHBACKCLAIMTYPES.WEEKLY: {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const weekStart = startOfWeek.toISOString();
            totalCashbackClaimed = await this.getTotalCashbackClaimed(userId, cashback, weekStart);
            remainingCashback = Math.max(
              0,
              cashback.getCapAmount({ tierName: vipUser.currentTier, tierLevel: vipUser.currentLevel, type: 'week' }) -
                totalCashbackClaimed
            );
            break;
          }
          case CASHBACKCLAIMTYPES.MONTHLY: {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthStart = startOfMonth.toISOString();
            totalCashbackClaimed = await this.getTotalCashbackClaimed(userId, cashback, monthStart);
            remainingCashback = Math.max(
              0,
              cashback.getCapAmount({ tierName: vipUser.currentTier, tierLevel: vipUser.currentLevel, type: 'month' }) -
                totalCashbackClaimed
            );
            break;
          }
          default:
            throw new Error('Invalid cashback claim mode');
        }

        if (remainingCashback <= 0) {
          continue;
        }

        cashbackAmount = Math.min(cashbackAmount, remainingCashback);
        cashbackAmount = Number(cashbackAmount.toFixed(8));

        if (cashbackAmount <= 0) {
          continue;
        }

        cashbackCalculations.push({
          cashback,
          amount: cashbackAmount,
        });

        // Process all cashbacks in a single transaction
        const transactionHandler = new ServiceTransactionHandler(SERVICE_TRANSACTION_TYPES.CASHBACK);

        totalCashbackAmount += cashbackAmount;

        if (cashbackAmount > 0) {
          const handler = await transactionHandler.startTransaction(
            userId,
            cashbackAmount,
            cashback._id,
            {
              userTier: vipUser.currentTier,
              tierLevel: vipUser.currentLevel,
              gameType: gameType || '',
              claimMode: cashback.claimFrequency.mode,
              cashbackType: cashback.type,
              cashbackName: cashback.name,
              cashbackDetails: cashbackCalculations,
              wagerMultiplier: cashback.wagerMultiplier,
            },
            session
          );

          try {
            await handler.process(session);
          } finally {
            handler.reset();
          }
        }
      }

      return totalCashbackAmount;
    } catch (error) {
      logger.error('Error calculating cashback amount:', error);
      throw error;
    }
  }

  async getTotalCashbackClaimed(userId, cashback, sinceDate) {
    try {
      const query = {
        userId: userId,
        type: SERVICE_TRANSACTION_TYPES.CASHBACK,
        referenceId: cashback._id,
      };

      switch (cashback.claimFrequency.mode) {
        case CASHBACKCLAIMTYPES.INSTANT:
        case CASHBACKCLAIMTYPES.DAILY: {
          const startOfDay = new Date(sinceDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(startOfDay);
          endOfDay.setDate(endOfDay.getDate() + 1);
          query.createdAt = { $gte: startOfDay, $lt: endOfDay };
          break;
        }
        case CASHBACKCLAIMTYPES.WEEKLY: {
          const startOfWeek = new Date(sinceDate);
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 7);
          query.createdAt = { $gte: startOfWeek, $lt: endOfWeek };
          break;
        }
        case CASHBACKCLAIMTYPES.MONTHLY: {
          const startOfMonth = new Date(sinceDate);
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          const endOfMonth = new Date(startOfMonth);
          endOfMonth.setMonth(endOfMonth.getMonth() + 1);
          query.createdAt = { $gte: startOfMonth, $lt: endOfMonth };
          break;
        }
      }

      const transactions = await ServiceTransaction.find(query);
      const totalClaimed = transactions.reduce((total, tx) => total + tx.amount, 0);
      return totalClaimed;
    } catch (error) {
      logger.error('Error getting total cashback claimed:', error);
      throw error;
    }
  }

  async isEligible(cashback, gameType = null, userId = null) {
    if (cashback.status === 0) {
      return false;
    }

    // Validate VIP tier configuration
    if (cashback.tiers && cashback.tiers.length > 0) {
      const validTiers = cashback.tiers.map((tier) => tier.tierName);
      const vipUser = await VipUser.findOne({ userId });
      if (!vipUser || !validTiers.includes(vipUser.currentTier)) {
        return false;
      }
    }

    switch (cashback.type) {
      case CASHBACKTYPES.DEFAULT:
        return true;
      case CASHBACKTYPES.TIME_BOOST:
        return cashback.isTimeBoostActive() && cashback.isInTimeWindow();
      case CASHBACKTYPES.GAME_BOOST:
        return (
          gameType &&
          cashback.gameSpecific.enabled &&
          cashback.gameSpecific.multipliers.some((m) => m.gameType === gameType)
        );
      default:
        return false;
    }
  }

  async checkCashback() {
    try {
      const cashbacks = await Cashback.find();
      if (!cashbacks || cashbacks.length === 0) {
        return;
      }

      for (const cashback of cashbacks) {
        if (cashback.type !== CASHBACKTYPES.TIME_BOOST) {
          continue;
        }

        const now = moment();
        if (cashback.status === 1) {
          if (moment(cashback.timeBoost.to).isSame(now, 'day')) {
            cashback.status = 0;
            await cashback.save();
          }
        } else {
          if (moment(cashback.timeBoost.from).isSame(now, 'day')) {
            cashback.status = 1;
            await cashback.save();
          }
        }
      }
    } catch (error) {
      logger.error('Error checking cashback:', error);
      throw error;
    }
  }

  initSchedules() {
    logger.info('Cashback cron started', new Date().toString());

    cron.schedule('59 23 * * *', async () => {
      logger.info('[Daily] Task running at the end of the day');
      await Promise.all([this.handleCashback(CASHBACKCLAIMTYPES.DAILY), this.checkCashback()]);
    });

    cron.schedule('59 23 * * 0', async () => {
      logger.info('[Weekly] Task running on Sunday at 23:59');
      await this.handleCashback(CASHBACKCLAIMTYPES.WEEKLY);
    });

    cron.schedule('59 23 28-31 * *', async () => {
      const today = new Date();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      if (today.getDate() === lastDayOfMonth) {
        logger.info('[Monthly] Task running on the last day of the month at 23:59');
        await this.handleCashback(CASHBACKCLAIMTYPES.MONTHLY);
      }
    });
  }

  async handleCashback(claimMode) {
    try {
      const transactions = await ServiceTransaction.find({
        type: SERVICE_TRANSACTION_TYPES.CASHBACK,
        status: SERVICE_TRANSACTION_STATUS.PENDING,
        'metadata.claimMode': claimMode,
      });

      for (const tr of transactions) {
        const handler = await serviceTransactionManager.getTransactionSession(tr.userId, tr._id);
        if (!handler) {
          continue;
        }

        await handler.process();
        handler.reset();
      }
    } catch (error) {
      logger.error('Error handling cashback:', error);
      throw error;
    }
  }

  async updateCashbackBalanceWithWin(userId, winAmount) {
    try {
      if (winAmount <= 0) {
        return { updated: false, amount: 0 };
      }

      const cashbackBalance = await UserCashbackBalance.findOne({ userId });

      if (!cashbackBalance) {
        return { updated: false, amount: 0 };
      }

      if (!cashbackBalance.isWageringRequirementMet()) {
        cashbackBalance.cashbackBalance += winAmount;
        cashbackBalance.lastUpdatedAt = new Date();
        await cashbackBalance.save();

        return { updated: true, amount: winAmount };
      }

      return { updated: false, amount: 0 };
    } catch (error) {
      logger.error('Error updating cashback balance with win:', error);
      return { updated: false, amount: 0 };
    }
  }

  async getUserWinStreak(userId) {
    try {
      // Get recent game results for the user
      const recentGames = await ServiceTransaction.find({
        userId,
        type: SERVICE_TRANSACTION_TYPES.GAME_RESULT,
        'metadata.result': 'win',
      })
        .sort({ createdAt: -1 })
        .limit(10);

      let streak = 0;
      for (const game of recentGames) {
        if (game.metadata.result === 'win') {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    } catch (error) {
      logger.error('Error getting user win streak:', error);
      return 0;
    }
  }
}

export default new CashbackService();
