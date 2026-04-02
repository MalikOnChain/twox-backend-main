import mongoose from 'mongoose';

import Bonus from '@/models/bonus/Bonuses';
import UserBonusBalance from '@/models/users/UserBonusBalance';
import UserCashbackBalance from '@/models/users/UserCashbackBalance';
import UserFreeSpinBalance from '@/models/users/UserFreeSpinBalance';
import UserReferBonusBalance from '@/models/users/UserReferBonusBalance';
import UserWagerRaceBalance from '@/models/users/UserWagerRaceBalance';
import VipUser from '@/models/vip/VipUser';
import NotificationService from '@/services/notification/Notification.service';
import { ServiceTransactionHandler } from '@/controllers/TransactionControllers/ServiceTransactionManager';
import { BonusType } from '@/types/bonus/bonus';
import { SERVICE_TRANSACTION_TYPES } from '@/types/bonus/service';
import { logger } from '@/utils/logger';

export class BonusManagementService {
  static instance = null;
  static config = {
    defaultWageringMultiplier: 30,
    defaultBonusExpiryDays: 7,
  };

  constructor() {
    if (BonusManagementService.instance) {
      return BonusManagementService.instance;
    }

    this.notificationService = NotificationService;
    BonusManagementService.instance = this;
  }

  static initialize() {
    if (!BonusManagementService.instance) {
      BonusManagementService.instance = new BonusManagementService();
    }
    return BonusManagementService.instance;
  }

  static getInstance() {
    if (!BonusManagementService.instance) {
      throw new Error('BonusManagementService has not been initialized. Call initialize() first.');
    }
    return BonusManagementService.instance;
  }

  async increaseCashbackBalance(user, amount, wageringMultiplier, session) {
    try {
      return await this.addBonus(
        user,
        {
          bonusId: new mongoose.Types.ObjectId(),
          amount,
          wageringMultiplier: wageringMultiplier || 5,
          type: SERVICE_TRANSACTION_TYPES.CASHBACK,
        },
        session
      );
    } catch (error) {
      logger.error(`Failed to increase cashback balance: ${error.message}`);
      throw error;
    }
  }

  async increaseFreeSpinsBalance(user, amount, session = null) {
    try {
      return await this.addBonus(
        user,
        {
          bonusId: new mongoose.Types.ObjectId(),
          amount,
          wageringMultiplier: 1,
          type: SERVICE_TRANSACTION_TYPES.FREE_SPINS,
        },
        session
      );
    } catch (error) {
      logger.error(`Failed to increase free spins balance: ${error.message}`);
      throw error;
    }
  }

  async addBonus(user, bonusDetails, session = null) {
    const sessionRequired = !session;
    let localSession = session;

    try {
      if (sessionRequired) {
        localSession = await mongoose.startSession();
        localSession.startTransaction();
      }

      const { bonusId, amount, wageringMultiplier, type } = bonusDetails;

      if (!bonusId) {
        throw new Error('BonusId is required');
      }

      if (isNaN(amount) || amount < 0) {
        throw new Error('Valid amount is required');
      }

      if (
        isNaN(wageringMultiplier) ||
        wageringMultiplier < 0 ||
        wageringMultiplier === null ||
        wageringMultiplier === undefined
      ) {
        throw new Error('Valid wagering multiplier is required');
      }

      if (!type) {
        throw new Error('Bonus type is required');
      }

      switch (type) {
        case BonusType.REFERRAL:
          await this._processReferralBonus(user, bonusDetails, localSession);
          break;

        case BonusType.CASHBACK:
        case SERVICE_TRANSACTION_TYPES.CASHBACK:
          await this._processCashbackBonus(user, bonusDetails, localSession);
          break;

        case SERVICE_TRANSACTION_TYPES.FREE_SPINS:
          await this._processFreeSpinsBonus(user, bonusDetails, localSession);
          break;

        case 'trivia':
          await this._processTriviaBonus(user, bonusDetails, localSession);
          break;

        default:
          await this._processStandardBonus(user, bonusDetails, localSession);
          break;
      }

      if (sessionRequired) {
        await localSession.commitTransaction();
      }

      logger.info(
        `Added ${amount} bonus (${type}) for user ${user._id} with wagering requirement: ${amount * wageringMultiplier}`
      );

      return true;
    } catch (error) {
      if (sessionRequired) {
        await localSession.abortTransaction();
      }
      throw error;
    } finally {
      if (sessionRequired) {
        localSession.endSession();
      }
    }
  }

  async _processReferralBonus(user, bonusDetails, session) {
    const { amount, wageringMultiplier, bonusId } = bonusDetails;

    // Get user's balance before referral bonus
    const balanceBefore = user.balance || 0;

    let userReferBonus = await UserReferBonusBalance.findOne({
      userId: user._id,
    }).session(session);

    const referBonusBalanceBefore = userReferBonus?.referBonusBalance || 0;

    if (!userReferBonus) {
      userReferBonus = new UserReferBonusBalance({
        userId: user._id,
        referBonusBalance: 0,
        initialAmount: 0,
        wageringRequirement: 0,
        status: 'active',
      });
    }

    userReferBonus.referBonusBalance += amount;
    userReferBonus.initialAmount += amount;
    userReferBonus.wageringMultiplier = wageringMultiplier;
    userReferBonus.wageringRequirement += amount * wageringMultiplier;
    userReferBonus.status = 'active';
    userReferBonus.lastUpdatedAt = new Date();

    userReferBonus.rewardHistory.push({
      rewardId: bonusId,
      rewardAmount: amount,
      rewardType: BonusType.REFERRAL,
      rewardWageringMultiplier: wageringMultiplier,
      rewardClaimedAt: new Date(),
    });

    await userReferBonus.save({ session });

    // Create ServiceTransaction record for referral bonus
    try {
      const transactionHandler = new ServiceTransactionHandler(SERVICE_TRANSACTION_TYPES.REFERRAL_REWARD);
      
      const handler = await transactionHandler.startTransaction(
        user._id,
        amount,
        bonusId || user._id, // Use userId as referenceId if bonusId not provided
        {
          bonusType: BonusType.REFERRAL,
          wageringMultiplier: wageringMultiplier || 0,
          wageringRequirement: amount * (wageringMultiplier || 0),
          referBonusBalances: {
            before: { referBonusBalance: referBonusBalanceBefore },
            after: { referBonusBalance: userReferBonus.referBonusBalance },
          },
          userBalance: {
            before: balanceBefore,
            after: balanceBefore, // Balance doesn't change for referral bonus
          },
        },
        session
      );

      await handler.process(session);
      handler.reset();
      
      logger.info(`ServiceTransaction created for referral bonus: ${amount} USDT`);
    } catch (transactionError) {
      logger.error(`Failed to create ServiceTransaction for referral bonus:`, transactionError);
      // Don't throw - referral bonus was already added, just log the error
    }
  }

  async _processCashbackBonus(user, bonusDetails, session) {
    const { amount, wageringMultiplier, bonusId } = bonusDetails;

    // Get user's balance before cashback bonus
    const balanceBefore = user.balance || 0;

    let cashbackBalance = await UserCashbackBalance.findOne({
      userId: user._id,
    }).session(session);

    const cashbackBalanceBefore = cashbackBalance?.cashbackBalance || 0;

    if (!cashbackBalance) {
      cashbackBalance = new UserCashbackBalance({
        userId: user._id,
        cashbackBalance: 0,
        initialAmount: 0,
        wageringRequirement: 0,
        status: 'active',
      });
    }

    cashbackBalance.cashbackBalance += amount;
    cashbackBalance.initialAmount += amount;
    cashbackBalance.wageringMultiplier = wageringMultiplier || 5;
    cashbackBalance.wageringRequirement += amount * (wageringMultiplier || 5);
    cashbackBalance.status = 'active';
    cashbackBalance.lastUpdatedAt = new Date();

    await cashbackBalance.save({ session });

    // Create ServiceTransaction record for cashback bonus
    // Note: CashbackService also creates transactions, but this ensures consistency
    // when cashback bonuses are processed through BonusManagementService
    try {
      const transactionHandler = new ServiceTransactionHandler(SERVICE_TRANSACTION_TYPES.CASHBACK);
      
      const handler = await transactionHandler.startTransaction(
        user._id,
        amount,
        bonusId || user._id, // Use userId as referenceId if bonusId not provided
        {
          bonusType: BonusType.CASHBACK,
          wageringMultiplier: wageringMultiplier || 5,
          wageringRequirement: amount * (wageringMultiplier || 5),
          cashbackBalances: {
            before: { cashbackBalance: cashbackBalanceBefore },
            after: { cashbackBalance: cashbackBalance.cashbackBalance },
          },
          userBalance: {
            before: balanceBefore,
            after: balanceBefore, // Balance doesn't change for cashback bonus
          },
        },
        session
      );

      await handler.process(session);
      handler.reset();
      
      logger.info(`ServiceTransaction created for cashback bonus: ${amount} USDT`);
    } catch (transactionError) {
      logger.error(`Failed to create ServiceTransaction for cashback bonus:`, transactionError);
      // Don't throw - cashback bonus was already added, just log the error
    }
  }

  async _processFreeSpinsBonus(user, bonusDetails, session) {
    const { amount, originalValue = 1, wageringMultiplier = 1, gameId = null, bonusId } = bonusDetails;

    if (!amount || amount <= 0) {
      throw new Error('Invalid free spins amount');
    }

    // Get user's balance before free spins bonus
    const balanceBefore = user.balance || 0;

    let freeSpinBalance = await UserFreeSpinBalance.findOne({
      userId: user._id,
    }).session(session);

    const freeSpinsBalanceBefore = freeSpinBalance?.freeSpinBalance || 0;

    if (!freeSpinBalance) {
      freeSpinBalance = new UserFreeSpinBalance({
        userId: user._id,
        freeSpinBalance: 0,
        originalValue: originalValue,
        initialAmount: 0,
        wageringMultiplier: wageringMultiplier,
        status: 'active',
        gameId: gameId,
        lastUpdatedAt: new Date(),
      });
    }

    freeSpinBalance.freeSpinBalance += amount;
    freeSpinBalance.initialAmount += amount;
    freeSpinBalance.originalValue = originalValue;
    freeSpinBalance.wageringMultiplier = wageringMultiplier;
    if (gameId) {
      freeSpinBalance.gameId = gameId;
    }
    freeSpinBalance.lastUpdatedAt = new Date();

    await freeSpinBalance.save({ session });

    // Create ServiceTransaction record for free spins
    try {
      const transactionHandler = new ServiceTransactionHandler(SERVICE_TRANSACTION_TYPES.FREE_SPINS);
      
      const handler = await transactionHandler.startTransaction(
        user._id,
        amount,
        bonusId || user._id, // Use userId as referenceId if bonusId not provided
        {
          bonusType: BonusType.FREE_SPINS,
          originalValue: originalValue,
          wageringMultiplier: wageringMultiplier || 1,
          gameId: gameId || null,
          freeSpinsBalances: {
            before: { freeSpinBalance: freeSpinsBalanceBefore },
            after: { freeSpinBalance: freeSpinBalance.freeSpinBalance },
          },
          userBalance: {
            before: balanceBefore,
            after: balanceBefore, // Balance doesn't change for free spins
          },
        },
        session
      );

      await handler.process(session);
      handler.reset();
      
      logger.info(`ServiceTransaction created for free spins bonus: ${amount} spins`);
    } catch (transactionError) {
      logger.error(`Failed to create ServiceTransaction for free spins bonus:`, transactionError);
      // Don't throw - free spins were already added, just log the error
    }
  }

  async _processTriviaBonus(user, bonusDetails, session) {
    return this._processStandardBonus(
      user,
      {
        ...bonusDetails,
        wageringMultiplier: bonusDetails.wageringMultiplier || 5,
      },
      session
    );
  }

  async _processStandardBonus(user, bonusDetails, session) {
    const { bonusId, amount, wageringMultiplier, type } = bonusDetails;

    let bonus = null;
    if (mongoose.Types.ObjectId.isValid(bonusId)) {
      bonus = await Bonus.findById(bonusId).session(session);
      if (!bonus) {
        logger.warn(`Bonus ${bonusId} not found, creating user bonus anyway`);
      }
    }

    // Get user's balance before bonus addition
    const balanceBefore = user.balance || 0;

    let userBonus = await UserBonusBalance.findOne({
      userId: user._id,
      bonusId,
      status: 'active',
    }).session(session);

    if (!userBonus) {
      userBonus = new UserBonusBalance({
        userId: user._id,
        bonusId,
        bonusBalance: 0,
        initialAmount: 0,
        bonusType: type,
        status: 'active',
      });
    }

    // Get bonus balances before
    const bonusBalancesBefore = {};
    if (userBonus.bonusBalance !== undefined) {
      bonusBalancesBefore[bonusId.toString()] = userBonus.bonusBalance;
    }

    userBonus.bonusBalance += amount;
    userBonus.initialAmount += amount;
    if (!isNaN(wageringMultiplier) && wageringMultiplier > 0) {
      userBonus.wageringMultiplier = wageringMultiplier;
    }
    userBonus.claimedAt = new Date();

    await userBonus.save({ session });

    // Get bonus balances after
    const bonusBalancesAfter = {};
    bonusBalancesAfter[bonusId.toString()] = userBonus.bonusBalance;

    // Determine transaction type based on bonus type
    let transactionType = SERVICE_TRANSACTION_TYPES.BONUS;
    if (type === BonusType.VIP_LEVEL_UP) {
      transactionType = SERVICE_TRANSACTION_TYPES.VIP_WELCOME_BONUS;
    } else if (type === BonusType.WELCOME && bonus?.type === 'vip') {
      transactionType = SERVICE_TRANSACTION_TYPES.VIP_WELCOME_BONUS;
    } else if (type === BonusType.DAILY || type === BonusType.WEEKLY || type === BonusType.MONTHLY) {
      transactionType = SERVICE_TRANSACTION_TYPES.LOYALTY_REWARD;
    }

    // Create ServiceTransaction record
    try {
      const transactionHandler = new ServiceTransactionHandler(transactionType);
      
      const handler = await transactionHandler.startTransaction(
        user._id,
        amount,
        bonusId,
        {
          bonusType: type,
          bonusName: bonus?.name || 'Unknown Bonus',
          wageringMultiplier: wageringMultiplier || 0,
          wageringRequirement: amount * (wageringMultiplier || 0),
          bonusBalance: {
            before: bonusBalancesBefore,
            after: bonusBalancesAfter,
          },
          userBalance: {
            before: balanceBefore,
            after: balanceBefore, // Balance doesn't change for bonus (only bonusBalance changes)
          },
        },
        session
      );

      await handler.process(session);
      handler.reset();
      
      logger.info(`ServiceTransaction created for bonus ${bonusId} (${type}): ${amount} USDT`);
    } catch (transactionError) {
      logger.error(`Failed to create ServiceTransaction for bonus ${bonusId}:`, transactionError);
      // Don't throw - bonus was already added, just log the error
    }

    try {
      await this.notificationService.createNotification(
        user._id,
        'BONUS_RECEIVED',
        {
          bonusType: type,
          amount: amount,
          currency: 'USDT',
          wageringRequirement: amount * wageringMultiplier,
          bonusId: bonusId,
        },
        {
          importance: 'HIGH',
        }
      );
    } catch (notificationError) {
      logger.error('Failed to send bonus notification:', notificationError);
    }
  }

  async getActiveBonuses(user, session = null) {
    try {
      return await UserBonusBalance.find({
        userId: user._id,
        status: 'active',
      })
        .sort({ createdAt: 1 })
        .session(session);
    } catch (error) {
      logger.error(`Failed to get active bonuses: ${error.message}`);
      throw error;
    }
  }

  async updateWageringProgress(user, session) {
    try {
      const activeBonuses = await UserBonusBalance.find({
        userId: user._id,
        status: 'active',
      }).session(session);

      const vipUser = await VipUser.findOne({ userId: user._id }).session(session);
      const totalWagerdAmount = vipUser.totalWagered;

      for (const bonus of activeBonuses) {
        bonus.updateWageringProgress(totalWagerdAmount);

        await bonus.save({ session });
      }

      const cashbackBalance = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
      if (cashbackBalance) {
        cashbackBalance.updateWageringProgress(totalWagerdAmount);
        await cashbackBalance.save({ session });
      }

      const referBonus = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
      if (referBonus) {
        referBonus.updateWageringProgress(totalWagerdAmount);
        await referBonus.save({ session });
      }

      const wagerRace = await UserWagerRaceBalance.findOne({ userId: user._id }).session(session);
      if (wagerRace) {
        wagerRace.updateWageringProgress(totalWagerdAmount);
        await wagerRace.save({ session });
      }

      const freeSpinBalance = await UserFreeSpinBalance.findOne({ userId: user._id }).session(session);
      if (freeSpinBalance) {
        freeSpinBalance.updateWageringProgress(totalWagerdAmount);
        await freeSpinBalance.save({ session });
      }

      return true;
    } catch (error) {
      logger.error(`Failed to update wagering progress: ${error.message}`);
      throw error;
    }
  }

  async checkAndUnlockWinnings(user, session) {
    try {
      const activeBonuses = await UserBonusBalance.find({
        userId: user._id,
        status: 'active',
      });

      let totalUnlocked = 0;

      for (const bonus of activeBonuses) {
        if (bonus.lockedWinnings <= 0) continue;

        const wageringMultiplier = bonus.wageringMultiplier || BonusManagementService.config.defaultWageringMultiplier;
        const requiredWagering = bonus.initialAmount * wageringMultiplier;

        if (bonus.wageringProgress >= requiredWagering) {
          const unlockAmount = bonus.lockedWinnings;
          totalUnlocked += unlockAmount;

          user.balance += unlockAmount;

          bonus.lockedWinnings = 0;

          if (bonus.bonusBalance <= 0) {
            bonus.status = 'completed';
          }

          await bonus.save({ session });
          logger.info(`Unlocked ${unlockAmount} in winnings from bonus ${bonus._id} for user ${user._id}`);

          await this.notificationService.createNotification(
            user._id,
            'BONUS_WAGERING_COMPLETED',
            {
              bonusType: bonus.bonusType,
              amount: unlockAmount,
              bonusId: bonus.bonusId,
            },
            {
              importance: 'HIGH',
            }
          );
        }
      }

      if (totalUnlocked > 0) {
        await user.save({ session });
      }

      return user;
    } catch (error) {
      logger.error(`Failed to check and unlock winnings: ${error.message}`);
      throw error;
    }
  }
}

BonusManagementService.initialize();

export default new BonusManagementService();
