// src/services/BonusService.js
import mongoose from 'mongoose';

import Bonuses from '@/models/bonus/Bonuses';
import BonusTierRewards from '@/models/bonus/BonusTierRewards';
import ReferralUserReward from '@/models/bonus/ReferralUserReward';
import PixTransaction from '@/models/transactions/PixTransaction';
import User from '@/models/users/User';
import UserBonusBalance from '@/models/users/UserBonusBalance';
import UserReferBonusBalance from '@/models/users/UserReferBonusBalance';
import VipUser from '@/models/vip/VipUser';
import BalanceManagerService from '@/services/balance/BalanceManager.service';
import BonusConfigurationService from '@/services/bonus/BonusConfiguration.service';
import BonusValidationService from '@/services/bonus/ValidateBonus.service';
import { BonusStatus, BonusType, ClaimStatus, ReferralUserRewardStatus } from '@/types/bonus/bonus';
import { logger } from '@/utils/logger';

export class BonusService {
  constructor() {
    this.configService = BonusConfigurationService;
    this.validationService = BonusValidationService;
    this.balanceManager = BalanceManagerService;
  }

  async getAllActive(options = {}) {
    const { includeConfig = false, category = null, type = null } = options;

    const query = {
      status: BonusStatus.ACTIVE,
      isVisible: true,
      validFrom: { $lte: new Date() },
      $or: [{ validTo: null }, { validTo: { $gte: new Date() } }],
    };

    if (category) query.category = category;
    if (type) query.type = type;

    const bonuses = await Bonuses.find(query).sort({ priority: -1, displayOrder: 1 }).lean();

    if (!includeConfig) {
      return bonuses;
    }

    const bonusesWithConfig = await Promise.all(
      bonuses.map(async (bonus) => {
        try {
          const config = await this.configService.getBonusConfiguration(bonus._id);
          return {
            ...bonus,
            configuration: config,
          };
        } catch (error) {
          logger.error(`Error getting config for bonus ${bonus._id}:`, error);
          return bonus;
        }
      })
    );

    return bonusesWithConfig;
  }

  async getBonusById(bonusId) {
    if (!mongoose.Types.ObjectId.isValid(bonusId)) {
      throw new Error('Invalid bonus ID');
    }
    return await Bonuses.findById(bonusId);
  }

  async getClaimableBonuses(user, options = {}) {
    const { category = null, type = null, includeProgress = true } = options;

    // Get all active bonuses in a single query with proper filtering
    const activeBonuses = await Bonuses.find({
      status: 'active',
      isVisible: true,
      ...(category && { category }),
      ...(type && { type }),
      $or: [{ validTo: { $gt: new Date() } }, { validTo: null }],
    }).lean();

    // Get all user-related data in a single operation
    const [vipUser, userClaimCount, deposits, activeUserBonuses] = await Promise.all([
      VipUser.findOne({ userId: user._id }).lean(),
      UserBonusBalance.countDocuments({ userId: user._id }).lean(),
      PixTransaction.find({
        userId: user._id,
        type: 'transaction',
        status: 1,
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      UserBonusBalance.find({
        userId: user._id,
        status: 'active',
      }).lean(),
    ]);

    const userContext = {
      vipUser,
      userClaimCount,
      deposits,
      activeBonuses: activeUserBonuses,
    };

    // Process all bonuses in parallel
    const claimableBonuses = await Promise.all(
      activeBonuses.map(async (bonus) => {
        try {
          // Get bonus configuration from cache if available
          const config = await this.configService.getBonusConfigurationAggregated(bonus._id);

          // Validate bonus claim using pre-fetched user context
          const validation = await this.validationService.validateBonusClaimWithContext(
            bonus,
            user,
            userContext,
            config
          );

          // Get reward using cached config
          const reward = await this.configService.getRewardForUserWithContext(bonus, user, userContext, config);

          // Only include bonuses that can be claimed or are already claimed by this user
          const bonusData = {
            ...bonus,
            claimStatus: validation.status,
            claimMessage: validation.message,
            whenCanClaim: validation.whenCanClaim || null,
            userReward: reward,
            progress: validation.progress || null,
          };

          if (includeProgress && validation.config) {
            bonusData.detailedConfig = validation.config;
          }

          return bonusData;
        } catch (error) {
          logger.error(`Error checking eligibility for bonus ${bonus._id}:`, error);
          return null;
        }
      })
    );

    // Filter out any null results from failed validations
    return claimableBonuses.filter((bonus) => bonus !== null);
  }

  async claimBonus(user, bonusId, options = {}) {
    const { code = null } = options;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get bonus configuration
      const config = await this.configService.getBonusConfiguration(bonusId);

      if (!config.bonus) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'Bonus not found',
        };
      }

      // Validate bonus code if required
      if (config.bonus?.claimMethod === 'code') {
        if (!code || code !== config.bonus.code) {
          await session.abortTransaction();
          return {
            success: false,
            message: 'Invalid or missing bonus code',
          };
        }
      }

      // Validate claim eligibility (unless skipped)
      const validation = await this.validationService.validateBonusClaim(config, user);
      if (validation.status !== ClaimStatus.CAN_CLAIM) {
        await session.abortTransaction();
        return {
          success: false,
          message: validation.message,
          whenCanClaim: validation.whenCanClaim,
        };
      }

      // Calculate reward amount for user
      const reward = await this.configService.getRewardForUser(config.bonus, user);
      const wageringMultiplier = await this.getWageringMultiplierForUser(bonusId, user);

      // Calculate actual bonus amounts
      const bonusAmounts = await this.calculateBonusAmount(reward, user);

      // Process the bonus through BalanceManagerService
      if (bonusAmounts.cash > 0) {
        await this.balanceManager.addBonus(
          user,
          {
            bonusId: config.bonus._id,
            amount: bonusAmounts.cash,
            wageringMultiplier: wageringMultiplier,
            type: config.bonus.type,
          },
          session
        );
      }

      // Process free spins if any
      if (bonusAmounts.freeSpins > 0) {
        await this.balanceManager.addBonus(
          user,
          {
            bonusId: bonusId, // Generate temporary ID for free spins
            amount: 0,
            wageringMultiplier: 1, // Default wagering multiplier for free spins
            type: BonusType.FREE_SPINS,
          },
          session
        );

        await this.balanceManager.increaseFreeSpinsBalance(user, bonusAmounts.freeSpins, session);
      }

      // Process bonus if any
      if (bonusAmounts.bonus > 0) {
        await this.balanceManager.addBonus(
          user,
          {
            bonusId: config.bonus._id,
            amount: bonusAmounts.bonus,
            wageringMultiplier: wageringMultiplier,
            type: config.bonus.type,
          },
          session
        );
      }

      // Update bonus claims count
      await config.bonus.incrementClaimsCount();

      await session.commitTransaction();

      return {
        success: true,
        message: 'Bonus claimed successfully',
        reward: {
          cash: bonusAmounts.cash,
          freeSpins: bonusAmounts.freeSpins,
          bonus: bonusAmounts.bonus,
          wageringMultiplier,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error claiming bonus ${bonusId} for user ${user._id}:`, error);
      return {
        success: false,
        message: error.message || 'Failed to claim bonus',
      };
    } finally {
      session.endSession();
    }
  }

  async getWageringMultiplierForUser(bonusId, user) {
    try {
      const vipUser = await VipUser.findOne({ userId: user._id });

      if (!vipUser) {
        const bonus = await Bonuses.findById(bonusId);
        return bonus?.defaultWageringMultiplier || 30;
      }

      // Check for tier-specific wagering multiplier
      const tierReward = await BonusTierRewards.findOne({
        bonusId,
        tierId: vipUser.loyaltyTierId,
        isActive: true,
      });

      if (tierReward?.tierWageringMultiplier) {
        return tierReward.tierWageringMultiplier;
      }

      // Fall back to default
      const bonus = await Bonuses.findById(bonusId);
      return bonus?.defaultWageringMultiplier || 30;
    } catch (error) {
      logger.error('Error getting wagering multiplier:', error);
      return 30; // Default fallback
    }
  }

  async calculateBonusAmount(reward, user) {
    let cashAmount = 0;
    let freeSpinsAmount = 0;
    let bonusAmount = 0;

    try {
      // Calculate cash bonus
      if (reward.cash) {
        // Calculate percentage-based cash bonus
        if (reward.cash.amount) {
          cashAmount = reward.cash.amount;
        }

        if (reward.cash.percentage && typeof user.getLastDepositAmount === 'function') {
          const lastDeposit = await user.getLastDepositAmount();
          if (lastDeposit > 0) {
            cashAmount = (lastDeposit * reward.cash.percentage) / 100;
          }
          if (reward.cash.maxAmount && cashAmount > reward.cash.maxAmount) {
            cashAmount = reward.cash.maxAmount;
          }
        }
      }

      // Calculate bonus amount (separate from cash)
      if (reward.bonus) {
        if (reward.bonus.amount) {
          bonusAmount = reward.bonus.amount;
        }

        if (reward.bonus.percentage && typeof user.getLastDepositAmount === 'function') {
          const lastDeposit = await user.getLastDepositAmount();
          logger.debug('lastDeposit', lastDeposit);

          if (lastDeposit > 0) {
            bonusAmount = (lastDeposit * reward.bonus.percentage) / 100;
          }
          logger.debug('bonusAmount', bonusAmount);

          if (reward.bonus.maxAmount && bonusAmount > reward.bonus.maxAmount) {
            bonusAmount = reward.bonus.maxAmount;
          }
        }
      }

      // Calculate free spins
      if (reward.freeSpins) {
        if (reward.freeSpins.amount) {
          freeSpinsAmount = reward.freeSpins.amount;
        }

        if (reward.freeSpins.percentage && typeof user.getLastDepositAmount === 'function') {
          const lastDeposit = await user.getLastDepositAmount();
          if (lastDeposit > 0) {
            freeSpinsAmount = Math.floor((lastDeposit * reward.freeSpins.percentage) / 100);
          }

          if (reward.freeSpins.maxAmount && freeSpinsAmount > reward.freeSpins.maxAmount) {
            freeSpinsAmount = reward.freeSpins.maxAmount;
          }
        }
      }

      // Validate that at least one reward type is present
      if (cashAmount === 0 && bonusAmount === 0 && freeSpinsAmount === 0) {
        logger.warn('No valid reward amounts calculated for user:', user._id);
      }

      return {
        cash: Math.round(cashAmount * 100) / 100, // Round to 2 decimal places
        freeSpins: Math.floor(freeSpinsAmount), // Ensure integer
        bonus: Math.round(bonusAmount * 100) / 100, // Round to 2 decimal places
        special: reward.special || {},
      };
    } catch (error) {
      logger.error('Error calculating bonus amount:', error);
      return { cash: 0, freeSpins: 0, bonus: 0, special: {} };
    }
  }

  // Referral bonus methods
  async getAllActiveReferralBonuses() {
    return await ReferralUserReward.find({
      status: ReferralUserRewardStatus.ACTIVE,
    }).sort({ requiredReferralCount: 1 });
  }

  async claimUserReferralBonus(userId, rewardId) {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(rewardId)) {
      return {
        success: false,
        message: 'Invalid user ID or reward ID',
      };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'User not found',
        };
      }

      const reward = await ReferralUserReward.findById(rewardId).session(session);
      if (!reward) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'Referral reward not found',
        };
      }

      // Check if user has enough referrals
      const referralCount = await User.countDocuments({ referredByUser: userId }).session(session);
      if (referralCount < reward.requiredReferralCount) {
        await session.abortTransaction();
        return {
          success: false,
          message: `You need ${reward.requiredReferralCount} referrals to claim this reward. You have ${referralCount}.`,
        };
      }

      // Check if already claimed
      const userReferBonus = await UserReferBonusBalance.findOne({ userId }).session(session);
      if (userReferBonus?.rewardHistory?.some((r) => r.rewardId.toString() === rewardId)) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'You have already claimed this referral reward',
        };
      }

      // Process the referral bonus
      await this.balanceManager.addBonus(
        user,
        {
          bonusId: rewardId,
          amount: reward.amount,
          wageringMultiplier: 30, // Default for referral bonuses
          type: BonusType.REFERRAL,
        },
        session
      );

      await session.commitTransaction();

      return {
        success: true,
        message: 'Referral bonus claimed successfully',
        reward: {
          amount: reward.amount,
          type: BonusType.REFERRAL,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error claiming referral bonus ${rewardId} for user ${userId}:`, error);
      return {
        success: false,
        message: error.message || 'Failed to claim referral bonus',
      };
    } finally {
      session.endSession();
    }
  }

  // Trivia bonus method
  async claimTriviaBonus(userId, _questionId) {
    try {
      const triviaBonus = {
        bonusId: new mongoose.Types.ObjectId(), // Generate a temporary ID for trivia bonuses
        amount: 10, // Default trivia reward amount
        wageringMultiplier: 5, // Lower wagering for trivia
        type: 'trivia',
      };

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await this.balanceManager.addBonus(user, triviaBonus);

      return {
        success: true,
        message: 'Trivia bonus claimed successfully',
        amount: triviaBonus.amount,
      };
    } catch (error) {
      logger.error(`Error claiming trivia bonus for user ${userId}:`, error);
      return {
        success: false,
        message: 'Failed to claim trivia bonus',
      };
    }
  }

  // Utility methods
  async getUserActiveBonuses(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    return await UserBonusBalance.find({
      userId,
      status: 'active',
    })
      .populate('bonusId')
      .sort({ createdAt: -1 });
  }

  async getUserBonusHistory(userId, limit = 20) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    return await UserBonusBalance.find({
      userId,
    })
      .populate('bonusId')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  // Bonus creation methods

  async createBonus(bonusData, configuration = {}, createdBy = null) {
    if (!bonusData) {
      return {
        success: false,
        message: 'Bonus data is required',
      };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate required fields
      const validationResult = this._validateBonusData(bonusData);
      if (!validationResult.valid) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors,
        };
      }

      // Check for duplicate bonus code if provided
      if (bonusData.code) {
        const existingBonus = await Bonuses.findOne({ code: bonusData.code }).session(session);
        if (existingBonus) {
          await session.abortTransaction();
          return {
            success: false,
            message: `Bonus code '${bonusData.code}' already exists`,
          };
        }
      }

      // Create the main bonus
      const bonusToCreate = {
        ...bonusData,
        createdBy: createdBy ? mongoose.Types.ObjectId(createdBy) : null,
        status: bonusData.status || BonusStatus.DRAFT,
        validFrom: bonusData.validFrom || new Date(),
      };

      const bonus = new Bonuses(bonusToCreate);
      await bonus.save({ session });

      if (configuration && Object.keys(configuration).length > 0) {
        try {
          await this.configService.createBonusConfiguration(bonus._id, configuration);
        } catch (configError) {
          logger.error('Error creating bonus configuration:', configError);
        }
      }

      await session.commitTransaction();

      logger.info(`Bonus created successfully: ${bonus._id} by admin: ${createdBy}`);

      return {
        success: true,
        message: 'Bonus created successfully',
        bonus: bonus.toObject(),
        bonusId: bonus._id,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error creating bonus: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Failed to create bonus',
      };
    } finally {
      session.endSession();
    }
  }

  async removeBonus(bonusId, removedBy = null, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(bonusId)) {
      return {
        success: false,
        message: 'Invalid bonus ID',
      };
    }

    const {
      forceRemove = false, // Force remove even if users have active bonuses
      handleActiveBonuses = 'expire', // 'expire', 'forfeit', or 'complete'
      notifyUsers = true, // Send notifications to affected users
    } = options;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if bonus exists
      const bonus = await Bonuses.findById(bonusId).session(session);
      if (!bonus) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'Bonus not found',
        };
      }

      // Check for active user bonuses
      const activeBonuses = await UserBonusBalance.find({
        bonusId: bonusId,
        status: 'active',
      }).session(session);

      if (activeBonuses.length > 0 && !forceRemove) {
        await session.abortTransaction();
        return {
          success: false,
          message: `Cannot remove bonus: ${activeBonuses.length} users have active bonuses. Use forceRemove option to override.`,
          activeUserCount: activeBonuses.length,
        };
      }

      const removalStats = {
        activeUserBonuses: activeBonuses.length,
        affectedUsers: [],
        configurationRemoved: false,
      };

      // Handle active user bonuses based on strategy
      if (activeBonuses.length > 0) {
        for (const userBonus of activeBonuses) {
          const user = await User.findById(userBonus.userId).session(session);
          if (!user) continue;

          switch (handleActiveBonuses) {
            case 'expire':
              userBonus.status = 'expired';
              userBonus.bonusBalance = 0;
              userBonus.lockedWinnings = 0;
              break;

            case 'forfeit':
              userBonus.status = 'forfeited';
              userBonus.bonusBalance = 0;
              userBonus.lockedWinnings = 0;
              userBonus.metadata.forfeitReason = 'Bonus removed by admin';
              userBonus.metadata.forfeitedAt = new Date();
              break;

            case 'complete':
              // Convert all locked winnings to real balance
              if (userBonus.lockedWinnings > 0) {
                user.balance += userBonus.lockedWinnings;
                await user.save({ session });
              }
              userBonus.status = 'completed';
              userBonus.lockedWinnings = 0;
              userBonus.bonusBalance = 0;
              break;

            default:
              userBonus.status = 'expired';
              userBonus.bonusBalance = 0;
              userBonus.lockedWinnings = 0;
          }

          await userBonus.save({ session });
          removalStats.affectedUsers.push({
            userId: userBonus.userId,
            action: handleActiveBonuses,
            bonusBalance: userBonus.bonusBalance,
            lockedWinnings: userBonus.lockedWinnings,
          });

          // Send notification to user if enabled
          if (notifyUsers) {
            try {
              const NotificationService = (await import('@/services/notification/Notification.service')).default;
              await NotificationService.createNotification(
                userBonus.userId,
                'BONUS_REMOVED',
                {
                  bonusName: bonus.name,
                  bonusId: bonus._id,
                  action: handleActiveBonuses,
                  removedBy: removedBy,
                },
                {
                  importance: 'HIGH',
                }
              );
            } catch (notificationError) {
              logger.error('Failed to send bonus removal notification:', notificationError);
            }
          }
        }
      }

      // Remove bonus configuration
      try {
        await this.configService.deleteBonusConfiguration(bonusId);
        removalStats.configurationRemoved = true;
      } catch (configError) {
        logger.error('Error removing bonus configuration:', configError);
        removalStats.configurationRemoved = false;
      }

      // Update bonus status to removed instead of actually deleting
      bonus.status = 'removed';
      bonus.lastModifiedBy = removedBy ? mongoose.Types.ObjectId(removedBy) : null;
      bonus.metadata = {
        ...bonus.metadata,
        removedAt: new Date(),
        removedBy: removedBy,
        removalReason: 'Admin removal',
        forceRemoved: forceRemove,
        activeUserBonusesHandled: handleActiveBonuses,
      };

      await bonus.save({ session });

      await session.commitTransaction();

      logger.info(`Bonus removed successfully: ${bonusId} by admin: ${removedBy}`, removalStats);

      return {
        success: true,
        message: 'Bonus removed successfully',
        bonus: bonus.toObject(),
        removalStats,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error removing bonus ${bonusId}: ${error.message}`);
      return {
        success: false,
        message: error.message || 'Failed to remove bonus',
      };
    } finally {
      session.endSession();
    }
  }

  _validateBonusData(bonusData) {
    const errors = [];

    // Required fields
    if (!bonusData.name || bonusData.name.trim().length === 0) {
      errors.push('Bonus name is required');
    }

    if (!bonusData.description || bonusData.description.trim().length === 0) {
      errors.push('Bonus description is required');
    }

    if (!bonusData.type || !Object.values(BonusType).includes(bonusData.type)) {
      errors.push('Valid bonus type is required');
    }

    // Validate dates
    if (bonusData.validFrom && bonusData.validTo) {
      const validFrom = new Date(bonusData.validFrom);
      const validTo = new Date(bonusData.validTo);

      if (validTo <= validFrom) {
        errors.push('Valid to date must be after valid from date');
      }
    }

    // Validate reward configuration
    if (bonusData.defaultReward) {
      const reward = bonusData.defaultReward;
      let hasValidReward = false;

      // Validate cash rewards
      if (reward.cash) {
        hasValidReward = true;
        if (reward.cash.percentage && (reward.cash.percentage < 0 || reward.cash.percentage > 100)) {
          errors.push('Cash bonus percentage must be between 0 and 100');
        }
        if (reward.cash.amount && reward.cash.amount < 0) {
          errors.push('Cash bonus amount must be non-negative');
        }
        if (reward.cash.minAmount && reward.cash.maxAmount && reward.cash.minAmount > reward.cash.maxAmount) {
          errors.push('Cash bonus maximum amount must be greater than minimum amount');
        }
      }

      // Validate free spins rewards
      if (reward.freeSpins) {
        hasValidReward = true;
        if (reward.freeSpins.percentage && (reward.freeSpins.percentage < 0 || reward.freeSpins.percentage > 100)) {
          errors.push('Free spins percentage must be between 0 and 100');
        }
        if (reward.freeSpins.amount && reward.freeSpins.amount < 0) {
          errors.push('Free spins amount must be non-negative');
        }
        if (
          reward.freeSpins.minAmount &&
          reward.freeSpins.maxAmount &&
          reward.freeSpins.minAmount > reward.freeSpins.maxAmount
        ) {
          errors.push('Free spins maximum amount must be greater than minimum amount');
        }
        if (reward.freeSpins.gameId && !mongoose.Types.ObjectId.isValid(reward.freeSpins.gameId)) {
          errors.push('Invalid game ID for free spins');
        }
      }

      // Validate bonus rewards
      if (reward.bonus) {
        hasValidReward = true;
        if (reward.bonus.percentage && (reward.bonus.percentage < 0 || reward.bonus.percentage > 100)) {
          errors.push('Bonus percentage must be between 0 and 100');
        }
        if (reward.bonus.amount && reward.bonus.amount < 0) {
          errors.push('Bonus amount must be non-negative');
        }
        if (reward.bonus.minAmount && reward.bonus.maxAmount && reward.bonus.minAmount > reward.bonus.maxAmount) {
          errors.push('Bonus maximum amount must be greater than minimum amount');
        }
      }

      // Validate special rewards
      if (reward.special) {
        hasValidReward = true;
        if (typeof reward.special !== 'object') {
          errors.push('Special reward must be an object');
        }
      }

      if (!hasValidReward) {
        errors.push('At least one valid reward type (cash, bonus, free spins, or special) must be specified');
      }
    }

    // Validate wagering multiplier
    if (bonusData.defaultWageringMultiplier && bonusData.defaultWageringMultiplier < 0) {
      errors.push('Wagering multiplier must be non-negative');
    }

    // Validate claim limits
    if (bonusData.maxClaims && bonusData.maxClaims < 0) {
      errors.push('Maximum claims must be non-negative');
    }

    if (bonusData.maxClaimsPerUser && bonusData.maxClaimsPerUser < 0) {
      errors.push('Maximum claims per user must be non-negative');
    }

    // Validate bonus code if provided
    if (bonusData.code) {
      if (typeof bonusData.code !== 'string' || bonusData.code.trim().length === 0) {
        errors.push('Bonus code must be a non-empty string');
      }
      if (bonusData.code.length > 50) {
        errors.push('Bonus code must not exceed 50 characters');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new BonusService();
