// src/services/BonusConfigurationService.js - Fixed implementation
import mongoose from 'mongoose';

import BonusEligibility from '@/models/bonus/BonusEligibility';
import Bonuses from '@/models/bonus/Bonuses';
import BonusSettings from '@/models/bonus/BonusSettings';
import BonusTierRewards from '@/models/bonus/BonusTierRewards';
import VipTier from '@/models/vip/VipTier';
import VipUser from '@/models/vip/VipUser';
import { logger } from '@/utils/logger';

export class BonusConfigurationService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  async getBonusConfiguration(bonusId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bonusId)) {
        throw new Error('Invalid bonus ID');
      }

      const [bonus, eligibility, settings, tierRewards] = await Promise.all([
        Bonuses.findById(bonusId),
        BonusEligibility.findOne({ bonusId, isActive: true }),
        BonusSettings.findOne({ bonusId }),
        BonusTierRewards.find({ bonusId, isActive: true }),
      ]);

      return {
        bonus,
        eligibility,
        settings,
        tierRewards: tierRewards || [],
      };
    } catch (error) {
      logger.error('Error getting bonus configuration:', error);
      return {
        bonus: null,
        eligibility: null,
        settings: null,
        tierRewards: [],
      };
    }
  }

  async getRewardForUser(bonus, user) {
    try {
      // Get user's VIP tier
      const vipUser = await VipUser.findOne({ userId: user._id });
      if (!vipUser) {
        return this._getDefaultReward(bonus);
      }

      // Check for tier-specific reward
      const tierReward = await BonusTierRewards.findOne({
        bonusId: bonus._id,
        tierId: vipUser.loyaltyTierId,
        isActive: true,
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
        effectiveFrom: { $lte: new Date() },
      });

      if (tierReward && tierReward.isEffective) {
        return tierReward.getEffectiveReward(bonus.defaultReward);
      }

      return this._getDefaultReward(bonus);
    } catch (error) {
      logger.error('Error getting reward for user:', error);
      // Return empty reward as fallback
      return {
        percentage: 0,
        fixedAmount: 0,
        minAmount: 0,
        maxAmount: 0,
        freeSpins: 0,
      };
    }
  }

  _getDefaultReward(bonus) {
    return {
      cash: {
        amount: bonus.defaultReward?.cash?.amount || 0,
        percentage: bonus.defaultReward?.cash?.percentage || 0,
        minAmount: bonus.defaultReward?.cash?.minAmount || 0,
        maxAmount: bonus.defaultReward?.cash?.maxAmount || 0,
      },
      freeSpins: {
        amount: bonus.defaultReward?.freeSpins?.amount || 0,
        percentage: bonus.defaultReward?.freeSpins?.percentage || 0,
        minAmount: bonus.defaultReward?.freeSpins?.minAmount || 0,
        maxAmount: bonus.defaultReward?.freeSpins?.maxAmount || 0,
      },
      bonus: {
        amount: bonus.defaultReward?.bonus?.amount || 0,
        percentage: bonus.defaultReward?.bonus?.percentage || 0,
        minAmount: bonus.defaultReward?.bonus?.minAmount || 0,
        maxAmount: bonus.defaultReward?.bonus?.maxAmount || 0,
      },
      special: bonus.defaultReward?.special || {},
    };
  }

  async checkEligibility(bonusId, user) {
    try {
      const eligibility = await BonusEligibility.findOne({
        bonusId,
        isActive: true,
      });

      if (!eligibility) {
        return { eligible: true, reason: 'No eligibility restrictions' };
      }

      // Use the eligibility model's method if it exists
      if (typeof eligibility.checkUserEligibility === 'function') {
        return await eligibility.checkUserEligibility(user);
      }

      // Basic eligibility check
      return this._performBasicEligibilityCheck(eligibility, user);
    } catch (error) {
      logger.error('Error checking eligibility:', error);
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  }

  async _performBasicEligibilityCheck(eligibility, user) {
    // Check eligibility type
    switch (eligibility.eligibilityType) {
      case 'all':
        return { eligible: true, reason: 'Open to all users' };

      case 'vip_tiers':
        return await this._checkVipTierEligibility(eligibility, user);

      case 'user_list':
        return this._checkUserListEligibility(eligibility, user);

      case 'country':
        return this._checkCountryEligibility(eligibility, user);

      case 'registration_date':
        return this._checkRegistrationDateEligibility(eligibility, user);

      case 'deposit_history':
        return await this._checkDepositHistoryEligibility(eligibility, user);

      default:
        return { eligible: true, reason: 'Unknown eligibility type, allowing access' };
    }
  }

  async _checkVipTierEligibility(eligibility, user) {
    try {
      if (!eligibility || !eligibility.vipTiers || !Array.isArray(eligibility.vipTiers)) {
        return { eligible: true, reason: 'No VIP tier restrictions' };
      }

      if (eligibility.vipTiers.length === 0) {
        return { eligible: true, reason: 'No VIP tier restrictions' };
      }

      const vipUser = await VipUser.findOne({ userId: user._id });
      if (!vipUser) {
        return { eligible: false, reason: 'VIP status required' };
      }

      if (!vipUser.loyaltyTierId) {
        return { eligible: false, reason: 'No VIP tier assigned' };
      }

      const isEligible = eligibility.vipTiers.some((tier) => {
        if (!tier || !tier.tierId) return false;
        return tier.tierId.toString() === vipUser.loyaltyTierId.toString();
      });

      return {
        eligible: isEligible,
        reason: isEligible ? 'VIP tier eligible' : 'VIP tier not eligible',
      };
    } catch (error) {
      logger.error(`Error checking VIP tier eligibility: ${error.message}`);
      return { eligible: false, reason: 'Error checking VIP tier eligibility' };
    }
  }

  _checkUserListEligibility(eligibility, user) {
    if (!eligibility.eligibleUserIds || eligibility.eligibleUserIds.length === 0) {
      return { eligible: true, reason: 'No user list restrictions' };
    }

    const isEligible = eligibility.eligibleUserIds.some((userId) => userId.toString() === user._id.toString());

    return {
      eligible: isEligible,
      reason: isEligible ? 'User in eligible list' : 'User not in eligible list',
    };
  }

  _checkCountryEligibility(eligibility, user) {
    const userCountry = user.country || 'US'; // Default fallback

    // Check allowed countries
    if (eligibility.allowedCountries && eligibility.allowedCountries.length > 0) {
      const isAllowed = eligibility.allowedCountries.includes(userCountry);
      if (!isAllowed) {
        return { eligible: false, reason: 'Country not in allowed list' };
      }
    }

    // Check excluded countries
    if (eligibility.excludedCountries && eligibility.excludedCountries.length > 0) {
      const isExcluded = eligibility.excludedCountries.includes(userCountry);
      if (isExcluded) {
        return { eligible: false, reason: 'Country is excluded' };
      }
    }

    return { eligible: true, reason: 'Country eligibility passed' };
  }

  _checkRegistrationDateEligibility(eligibility, user) {
    if (!eligibility.minAccountAge) {
      return { eligible: true, reason: 'No account age restrictions' };
    }

    const now = new Date();
    const registrationDate = new Date(user.createdAt);
    const accountAgeHours = (now - registrationDate) / (1000 * 60 * 60);
    const accountAgeDays = accountAgeHours / 24;

    if (eligibility.minAccountAge.hours && accountAgeHours < eligibility.minAccountAge.hours) {
      return {
        eligible: false,
        reason: `Account must be at least ${eligibility.minAccountAge.hours} hours old`,
      };
    }

    if (eligibility.minAccountAge.days && accountAgeDays < eligibility.minAccountAge.days) {
      return {
        eligible: false,
        reason: `Account must be at least ${eligibility.minAccountAge.days} days old`,
      };
    }

    return { eligible: true, reason: 'Account age requirements met' };
  }

  async _checkDepositHistoryEligibility(eligibility, user) {
    if (!eligibility.depositRequirements) {
      return { eligible: false, reason: 'No deposit requirements specified' };
    }

    try {
      // Get user's deposit count and total amount
      const depositCount = await user.getDepositCount();
      const totalDeposited = await user.getTotalDepositAmount();
      const lastDepositAmount = await user.getLastDepositAmount();

      const requirements = eligibility.depositRequirements;

      // For first deposit bonus, explicitly check if user has any deposits
      if (requirements.maxDepositCount === 1) {
        if (depositCount > 1) {
          return {
            eligible: false,
            reason: 'This bonus is only available for first deposits',
          };
        }
        if (depositCount === 0) {
          return {
            eligible: false,
            reason: 'You need to make a deposit to claim this bonus',
          };
        }
      }

      // Check minimum deposit count
      if (requirements.minDepositCount && depositCount < requirements.minDepositCount) {
        return {
          eligible: false,
          reason: `Minimum ${requirements.minDepositCount} deposits required`,
        };
      }

      // Check maximum deposit count (for new player bonuses)
      if (requirements.maxDepositCount && depositCount > requirements.maxDepositCount) {
        return {
          eligible: false,
          reason: `Maximum ${requirements.maxDepositCount} deposits allowed`,
        };
      }

      // Check minimum total deposits
      if (requirements.minTotalDeposits && totalDeposited < requirements.minTotalDeposits) {
        return {
          eligible: false,
          reason: `Minimum total deposits of ${requirements.minTotalDeposits} required`,
        };
      }

      // Check minimum last deposit amount
      if (requirements.minLastDepositAmount && lastDepositAmount < requirements.minLastDepositAmount) {
        return {
          eligible: false,
          reason: `Last deposit must be at least ${requirements.minLastDepositAmount}`,
        };
      }

      return { eligible: true, reason: 'Deposit requirements met' };
    } catch (error) {
      logger.error('Error checking deposit history:', error);
      return { eligible: false, reason: 'Unable to verify deposit history' };
    }
  }

  // Utility methods for bonus configuration management
  async createBonusConfiguration(bonusId, configData) {
    try {
      const { eligibility, settings, tierRewards } = configData;

      const promises = [];

      // Create eligibility rules if provided
      if (eligibility) {
        promises.push(
          BonusEligibility.create({
            bonusId,
            ...eligibility,
            isActive: true,
          })
        );
      }

      // Create settings if provided
      if (settings) {
        promises.push(
          BonusSettings.create({
            bonusId,
            ...settings,
          })
        );
      }

      // Create tier rewards if provided
      if (tierRewards && Array.isArray(tierRewards)) {
        tierRewards.forEach((tierReward) => {
          promises.push(
            BonusTierRewards.create({
              bonusId,
              ...tierReward,
              isActive: true,
            })
          );
        });
      }

      await Promise.all(promises);
      return { success: true, message: 'Bonus configuration created successfully' };
    } catch (error) {
      logger.error('Error creating bonus configuration:', error);
      throw error;
    }
  }

  async updateBonusConfiguration(bonusId, configData) {
    try {
      const { eligibility, settings, tierRewards } = configData;

      const promises = [];

      // Update eligibility rules
      if (eligibility) {
        promises.push(
          BonusEligibility.findOneAndUpdate({ bonusId, isActive: true }, eligibility, { upsert: true, new: true })
        );
      }

      // Update settings
      if (settings) {
        promises.push(BonusSettings.findOneAndUpdate({ bonusId }, settings, { upsert: true, new: true }));
      }

      // Update tier rewards (replace existing ones)
      if (tierRewards && Array.isArray(tierRewards)) {
        // First, deactivate existing tier rewards
        promises.push(BonusTierRewards.updateMany({ bonusId }, { isActive: false }));

        // Then create new ones
        tierRewards.forEach((tierReward) => {
          promises.push(
            BonusTierRewards.create({
              bonusId,
              ...tierReward,
              isActive: true,
            })
          );
        });
      }

      await Promise.all(promises);
      return { success: true, message: 'Bonus configuration updated successfully' };
    } catch (error) {
      logger.error('Error updating bonus configuration:', error);
      throw error;
    }
  }

  async deleteBonusConfiguration(bonusId) {
    try {
      await Promise.all([
        BonusEligibility.deleteMany({ bonusId }),
        BonusSettings.deleteOne({ bonusId }),
        BonusTierRewards.deleteMany({ bonusId }),
      ]);

      return { success: true, message: 'Bonus configuration deleted successfully' };
    } catch (error) {
      logger.error('Error deleting bonus configuration:', error);
      throw error;
    }
  }

  // Method to validate configuration consistency
  async validateConfiguration(bonusId) {
    try {
      const config = await this.getBonusConfiguration(bonusId);
      const issues = [];

      // Check if bonus exists
      if (!config.bonus) {
        issues.push('Bonus not found');
        return { valid: false, issues };
      }

      // Check tier rewards consistency
      if (config.tierRewards && config.tierRewards.length > 0) {
        const existingTiers = await VipTier.find({}).select('_id');
        const existingTierIds = existingTiers.map((tier) => tier._id.toString());

        config.tierRewards.forEach((tierReward) => {
          if (!existingTierIds.includes(tierReward.tierId.toString())) {
            issues.push(`Tier reward references non-existent tier: ${tierReward.tierId}`);
          }
        });
      }

      // Check eligibility logic
      if (config.eligibility) {
        if (
          config.eligibility.eligibilityType === 'vip_tiers' &&
          (!config.eligibility.vipTiers || config.eligibility.vipTiers.length === 0)
        ) {
          issues.push('VIP tier eligibility selected but no tiers specified');
        }

        if (
          config.eligibility.eligibilityType === 'user_list' &&
          (!config.eligibility.eligibleUserIds || config.eligibility.eligibleUserIds.length === 0)
        ) {
          issues.push('User list eligibility selected but no users specified');
        }
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error('Error validating configuration:', error);
      return {
        valid: false,
        issues: ['Error during validation'],
      };
    }
  }

  async getBonusConfigurationAggregated(bonusId) {
    const cacheKey = `bonus_config_${bonusId}`;
    const cachedConfig = this.cache.get(cacheKey);

    if (cachedConfig && Date.now() - cachedConfig.timestamp < this.cacheTTL) {
      return cachedConfig.data;
    }

    try {
      const result = await Bonuses.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(bonusId) } },
        {
          $lookup: {
            from: 'bonuseligibilities',
            let: { bonusId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$bonusId', '$$bonusId'] }, { $eq: ['$isActive', true] }],
                  },
                },
              },
            ],
            as: 'eligibility',
          },
        },
        {
          $lookup: {
            from: 'bonussettings',
            let: { bonusId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$bonusId', '$$bonusId'] },
                },
              },
            ],
            as: 'settings',
          },
        },
        {
          $lookup: {
            from: 'bonustierrewards',
            let: { bonusId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$bonusId', '$$bonusId'] }, { $eq: ['$isActive', true] }],
                  },
                },
              },
            ],
            as: 'tierRewards',
          },
        },
        {
          $addFields: {
            eligibility: { $arrayElemAt: ['$eligibility', 0] },
            settings: { $arrayElemAt: ['$settings', 0] },
          },
        },
      ]);

      if (!result || result.length === 0) {
        return { bonus: null };
      }

      const config = {
        bonus: result[0],
        eligibility: result[0].eligibility,
        settings: result[0].settings,
        tierRewards: result[0].tierRewards,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: config,
        timestamp: Date.now(),
      });

      return config;
    } catch (error) {
      logger.error('Error getting aggregated bonus configuration:', error);
      throw error;
    }
  }

  // Method to invalidate cache when bonus configuration changes
  invalidateCache(bonusId) {
    const cacheKey = `bonus_config_${bonusId}`;
    this.cache.delete(cacheKey);
  }

  // Method to clear all cache
  clearCache() {
    this.cache.clear();
  }

  async getRewardForUserWithContext(bonus, user, userContext, config) {
    try {
      if (!config || !config.bonus) {
        return null;
      }

      // If bonus has tier rewards, find applicable tier reward
      if (config.tierRewards && config.tierRewards.length > 0) {
        const vipUser = userContext.vipUser;
        if (vipUser) {
          const tierReward = config.tierRewards.find(
            (reward) => reward.tierId.toString() === vipUser.loyaltyTierId.toString() && reward.isActive
          );
          if (tierReward && tierReward.reward) {
            return tierReward.reward;
          }
        }
      }

      // Return default reward if no tier-specific reward found
      return config.bonus.defaultReward;
    } catch (error) {
      logger.error('Error getting reward for user:', error);
      return null;
    }
  }
}

export default new BonusConfigurationService();
