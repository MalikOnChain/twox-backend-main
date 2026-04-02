// src/services/ValidateBonusService.js - Complete implementation

import PixTransaction from '@/models/transactions/PixTransaction';
import UserBonusBalance from '@/models/users/UserBonusBalance';
import VipUser from '@/models/vip/VipUser';
import { ClaimStatus } from '@/types/bonus/bonus';
import { logger } from '@/utils/logger';

export class BonusValidationService {
  async validateBonusClaim(config, user) {
    try {
      if (!config.bonus) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'Bonus not found',
        };
      }

      // Get all user-related data in a single operation
      const userContext = await this.getUserBonusContext(user);

      // Check basic bonus validity
      logger.debug('config.bonus.name', config.bonus.name, user.username);

      const basicValidation = await this.validateBasicRequirements(config.bonus, user);
      logger.debug('basicValidation', basicValidation);

      if (basicValidation.status !== ClaimStatus.CAN_CLAIM) {
        return basicValidation;
      }

      // Check eligibility
      const eligibilityValidation = await this.validateEligibility(config.eligibility, user, userContext);
      if (eligibilityValidation.status !== ClaimStatus.CAN_CLAIM) {
        return eligibilityValidation;
      }

      // Check tier-specific requirements
      const tierValidation = await this.validateTierRequirements(config.tierRewards, user, userContext);
      if (tierValidation.status !== ClaimStatus.CAN_CLAIM) {
        return tierValidation;
      }

      // Check settings-based restrictions
      const settingsValidation = await this.validateSettings(config.settings, user, config.bonus._id, userContext);
      if (settingsValidation.status !== ClaimStatus.CAN_CLAIM) {
        return settingsValidation;
      }

      return {
        status: ClaimStatus.CAN_CLAIM,
        message: 'Bonus can be claimed',
        config,
      };
    } catch (error) {
      logger.error('Bonus validation error:', error);
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: `Validation error: ${error.message}`,
      };
    }
  }

  async validateBonusClaimWithContext(bonus, user, userContext, config) {
    try {
      if (!config.bonus) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'Bonus not found',
        };
      }

      // Check basic bonus validity
      const basicValidation = await this.validateBasicRequirements(config.bonus, user);

      if (basicValidation.status !== ClaimStatus.CAN_CLAIM) {
        return basicValidation;
      }

      // Check eligibility
      const eligibilityValidation = await this.validateEligibility(config.eligibility, user, userContext);
      if (eligibilityValidation.status !== ClaimStatus.CAN_CLAIM) {
        return eligibilityValidation;
      }

      // Check tier-specific requirements
      const tierValidation = await this.validateTierRequirements(config.tierRewards, user, userContext);
      if (tierValidation.status !== ClaimStatus.CAN_CLAIM) {
        return tierValidation;
      }

      // Check settings-based restrictions
      const settingsValidation = await this.validateSettings(config.settings, user, bonus._id, userContext);
      if (settingsValidation.status !== ClaimStatus.CAN_CLAIM) {
        return settingsValidation;
      }

      return {
        status: ClaimStatus.CAN_CLAIM,
        message: 'Bonus can be claimed',
        config,
      };
    } catch (error) {
      logger.error('Bonus validation error:', error);
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: `Validation error: ${error.message}`,
      };
    }
  }

  async validateBasicRequirements(bonus, user) {
    const now = new Date();

    // Check if bonus is active
    if (bonus.status !== 'active') {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Bonus is not currently active',
      };
    }

    // Check if bonus is visible
    if (!bonus.isVisible) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Bonus is not available',
      };
    }

    // Check validity period
    if (now < bonus.validFrom) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Bonus is not yet available',
        whenCanClaim: bonus.validFrom,
      };
    }

    if (bonus.validTo && now > bonus.validTo) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Bonus has expired',
      };
    }

    // Check maximum claims
    if (bonus.maxClaims && bonus.claimsCount >= bonus.maxClaims) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Bonus claim limit reached',
      };
    }

    // Check user-specific claim limit
    const userBonusBalance = await UserBonusBalance.findOne({ userId: user._id, bonusId: bonus._id });

    if (userBonusBalance) {
      return {
        status: ClaimStatus.CLAIMED,
        message: 'You have already claimed this bonus',
      };
    }

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Basic requirements met',
    };
  }

  async validateEligibility(eligibility, user, userContext) {
    // If no eligibility record exists or it's inactive, allow claiming (no restrictions)
    if (!eligibility || !eligibility.isActive) {
      return {
        status: ClaimStatus.CAN_CLAIM,
        message: 'No eligibility restrictions',
      };
    }

    // Check deposit history eligibility first
    if (eligibility.eligibilityType === 'deposit_history') {
      const depositValidation = await this.validateDepositRequirements(
        eligibility.depositRequirements,
        user,
        userContext
      );
      if (depositValidation.status !== ClaimStatus.CAN_CLAIM) {
        return depositValidation;
      }
    }

    const now = new Date();
    const userRegistrationDate = new Date(user.createdAt);

    // Check account age requirements
    if (eligibility.minAccountAge) {
      const accountAgeHours = (now - userRegistrationDate) / (1000 * 60 * 60);
      const accountAgeDays = accountAgeHours / 24;

      if (eligibility.minAccountAge.hours && accountAgeHours < eligibility.minAccountAge.hours) {
        const requiredDate = new Date(
          userRegistrationDate.getTime() + eligibility.minAccountAge.hours * 60 * 60 * 1000
        );
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Account must be at least ${eligibility.minAccountAge.hours} hours old`,
          whenCanClaim: requiredDate,
        };
      }

      if (eligibility.minAccountAge.days && accountAgeDays < eligibility.minAccountAge.days) {
        const requiredDate = new Date(
          userRegistrationDate.getTime() + eligibility.minAccountAge.days * 24 * 60 * 60 * 1000
        );
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Account must be at least ${eligibility.minAccountAge.days} days old`,
          whenCanClaim: requiredDate,
        };
      }
    }

    // Check VIP tier eligibility
    const vipUser = userContext.vipUser;
    if (eligibility.eligibilityType === 'vip_tiers' && eligibility.vipTiers?.length > 0) {
      if (!vipUser) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'VIP status required',
        };
      }

      const isEligibleTier = eligibility.vipTiers.some(
        (tier) => tier.tierId.toString() === vipUser.loyaltyTierId.toString()
      );

      if (!isEligibleTier) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'Your VIP tier is not eligible for this bonus',
        };
      }
    }

    // Check specific user list
    if (eligibility.eligibilityType === 'user_list' && eligibility.eligibleUserIds?.length > 0) {
      const isEligibleUser = eligibility.eligibleUserIds.some((userId) => userId.toString() === user._id.toString());

      if (!isEligibleUser) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'You are not eligible for this bonus',
        };
      }
    }

    // Check country restrictions
    if (eligibility.allowedCountries?.length > 0) {
      // You would need to implement country detection based on user data or IP
      // This is a placeholder implementation
      const userCountry = user.country || 'US'; // Default fallback
      if (!eligibility.allowedCountries.includes(userCountry)) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'This bonus is not available in your country',
        };
      }
    }

    if (eligibility.excludedCountries?.length > 0) {
      const userCountry = user.country || 'US';
      if (eligibility.excludedCountries.includes(userCountry)) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'This bonus is not available in your country',
        };
      }
    }

    // Check deposit requirements
    if (eligibility.depositRequirements) {
      const depositValidation = await this.validateDepositRequirements(
        eligibility.depositRequirements,
        user,
        userContext
      );
      if (depositValidation.status !== ClaimStatus.CAN_CLAIM) {
        return depositValidation;
      }
    }

    // Check activity requirements
    if (eligibility.activityRequirements) {
      const activityValidation = await this.validateActivityRequirements(
        eligibility.activityRequirements,
        user,
        userContext
      );
      if (activityValidation.status !== ClaimStatus.CAN_CLAIM) {
        return activityValidation;
      }
    }

    // Check time restrictions
    if (eligibility.timeRestrictions) {
      const timeValidation = this.validateTimeRestrictions(eligibility.timeRestrictions);
      if (timeValidation.status !== ClaimStatus.CAN_CLAIM) {
        return timeValidation;
      }
    }

    // Check exclusion rules
    if (eligibility.exclusions) {
      const exclusionValidation = await this.validateExclusionRules(eligibility.exclusions, user, userContext);
      if (exclusionValidation.status !== ClaimStatus.CAN_CLAIM) {
        return exclusionValidation;
      }
    }

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Eligibility requirements met',
    };
  }

  async validateDepositRequirements(requirements, user, userContext) {
    try {
      if (!requirements) {
        return {
          status: ClaimStatus.CAN_CLAIM,
          message: 'No deposit requirements specified',
        };
      }

      // Get all completed deposits for the user
      const deposits = userContext.deposits;

      // Check if user has any deposits
      if (deposits.length === 0) {
        if (requirements.requireDeposit) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: 'No deposits found. A deposit is required to claim this bonus.',
          };
        }
        return {
          status: ClaimStatus.CAN_CLAIM,
          message: 'No deposits required',
        };
      }

      // Check first deposit requirement
      if (requirements.firstDepositOnly && deposits.length > 1) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'This bonus is only available for first deposits',
        };
      }

      // Check minimum deposit amount
      if (requirements.minDepositAmount) {
        const lastDeposit = deposits[0];
        if (lastDeposit.amount < requirements.minDepositAmount) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `Minimum deposit amount of ${requirements.minDepositAmount} required. Your last deposit was ${lastDeposit.amount}`,
          };
        }
      }

      // Check maximum deposit amount
      if (requirements.maxDepositAmount) {
        const lastDeposit = deposits[0];
        if (lastDeposit.amount > requirements.maxDepositAmount) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `Maximum deposit amount of ${requirements.maxDepositAmount} exceeded. Your last deposit was ${lastDeposit.amount}`,
          };
        }
      }

      // Check deposit count
      if (requirements.minDepositCount && deposits.length < requirements.minDepositCount) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Minimum ${requirements.minDepositCount} deposits required. You have made ${deposits.length} deposits.`,
        };
      }

      // Check deposit timeframe
      if (requirements.depositTimeframe && requirements.minTotalDeposits) {
        const timeframeStart = new Date(Date.now() - requirements.depositTimeframe * 60 * 60 * 1000);
        const recentDeposits = deposits.filter((deposit) => deposit.createdAt >= timeframeStart);
        const recentTotal = recentDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);

        if (recentTotal < requirements.minTotalDeposits) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `Minimum ${requirements.minTotalDeposits} deposited in the last ${requirements.depositTimeframe} hours required`,
          };
        }
      }

      // Check deposit frequency
      if (requirements.maxDepositsPerTimeframe && requirements.depositTimeframe) {
        const timeframeStart = new Date(Date.now() - requirements.depositTimeframe * 60 * 60 * 1000);
        const recentDeposits = deposits.filter((deposit) => deposit.createdAt >= timeframeStart);

        if (recentDeposits.length > requirements.maxDepositsPerTimeframe) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `Maximum ${requirements.maxDepositsPerTimeframe} deposits allowed in the last ${requirements.depositTimeframe} hours`,
          };
        }
      }

      return {
        status: ClaimStatus.CAN_CLAIM,
        message: 'Deposit requirements met',
      };
    } catch (error) {
      logger.error('Error validating deposit requirements:', error);
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Unable to verify deposit requirements',
      };
    }
  }

  async validateActivityRequirements(requirements, user, userContext) {
    try {
      const GameTransaction = (await import('../../models/transactions/GameTransactions')).default;

      // Check minimum wagered amount
      if (requirements.minWagered) {
        const vipUser = userContext.vipUser;
        const totalWagered = vipUser?.totalWagered || 0;

        if (totalWagered < requirements.minWagered) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `Minimum wagered amount of ${requirements.minWagered} required. You have wagered ${totalWagered}`,
            progress: {
              current: totalWagered,
              required: requirements.minWagered,
            },
          };
        }
      }

      // Check minimum games played
      if (requirements.minGamesPlayed) {
        const gamesPlayed = await GameTransaction.countDocuments({
          userId: user._id,
          status: 'completed',
        });

        if (gamesPlayed < requirements.minGamesPlayed) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `Minimum ${requirements.minGamesPlayed} games required. You have played ${gamesPlayed}`,
            progress: {
              current: gamesPlayed,
              required: requirements.minGamesPlayed,
            },
          };
        }
      }

      // Check for inactivity (for reactivation bonuses)
      if (requirements.maxInactiveDays) {
        const lastActivity = await GameTransaction.findOne({
          userId: user._id,
        }).sort({ createdAt: -1 });

        if (lastActivity) {
          const daysSinceActivity = (Date.now() - lastActivity.createdAt) / (1000 * 60 * 60 * 24);
          if (daysSinceActivity < requirements.maxInactiveDays) {
            return {
              status: ClaimStatus.CANNOT_CLAIM,
              message: `You must be inactive for at least ${requirements.maxInactiveDays} days to claim this bonus`,
            };
          }
        }
      }

      // Check required game categories
      if (requirements.requiredGameCategories?.length > 0) {
        const playedCategories = await GameTransaction.distinct('category', {
          userId: user._id,
          status: 'completed',
        });

        const hasPlayedRequired = requirements.requiredGameCategories.every((category) =>
          playedCategories.includes(category)
        );

        if (!hasPlayedRequired) {
          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `You must play games in these categories: ${requirements.requiredGameCategories.join(', ')}`,
          };
        }
      }

      return {
        status: ClaimStatus.CAN_CLAIM,
        message: 'Activity requirements met',
      };
    } catch (error) {
      logger.error('Error validating activity requirements:', error);
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Unable to verify activity requirements',
      };
    }
  }

  validateTimeRestrictions(restrictions) {
    const now = new Date();
    const timezone = restrictions.timezone || 'UTC';

    // Convert to the specified timezone if needed
    // For simplicity, we'll use UTC. In production, you'd want proper timezone handling
    const currentDay = now.getUTCDay();
    const currentHour = now.getUTCHours();

    // Check allowed days
    if (restrictions.allowedDays?.length > 0) {
      if (!restrictions.allowedDays.includes(currentDay)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const allowedDayNames = restrictions.allowedDays.map((day) => dayNames[day]);

        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `This bonus is only available on: ${allowedDayNames.join(', ')}`,
        };
      }
    }

    // Check allowed hours
    if (restrictions.allowedHours?.start !== undefined && restrictions.allowedHours?.end !== undefined) {
      const { start, end } = restrictions.allowedHours;
      let isInTimeWindow = false;

      if (start <= end) {
        // Same day time window (e.g., 9 AM to 5 PM)
        isInTimeWindow = currentHour >= start && currentHour < end;
      } else {
        // Overnight time window (e.g., 10 PM to 6 AM)
        isInTimeWindow = currentHour >= start || currentHour < end;
      }

      if (!isInTimeWindow) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `This bonus is only available between ${start}:00 and ${end}:00 ${timezone}`,
        };
      }
    }

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Time restrictions met',
    };
  }

  async validateExclusionRules(exclusions, user, userContext) {
    // Check if user has active bonuses (if excluded)
    if (exclusions.excludeIfHasActiveBonus) {
      const activeBonuses = userContext.activeBonuses;

      if (activeBonuses.length > 0) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'You cannot claim this bonus while having other active bonuses',
        };
      }
    }

    // Check excluded bonus types
    if (exclusions.excludedBonusTypes?.length > 0) {
      const hasExcludedBonuses = await UserBonusBalance.findOne({
        userId: user._id,
        status: 'active',
        bonusType: { $in: exclusions.excludedBonusTypes },
      });

      if (hasExcludedBonuses) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: 'You have an active bonus that prevents claiming this bonus',
        };
      }
    }

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Exclusion rules passed',
    };
  }

  async validateTierRequirements(tierRewards, user, userContext) {
    if (!tierRewards || tierRewards.length === 0) {
      return {
        status: ClaimStatus.CAN_CLAIM,
        message: 'No tier-specific requirements',
      };
    }

    // Get user's VIP tier from context
    const vipUser = userContext.vipUser;
    if (!vipUser) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'VIP status required for this bonus',
      };
    }

    // Find applicable tier reward
    const applicableTierReward = tierRewards.find(
      (reward) => reward.tierId.toString() === vipUser.loyaltyTierId.toString() && reward.isEffective
    );

    if (!applicableTierReward) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Your VIP tier is not eligible for this bonus',
      };
    }

    // Check tier-specific unlock conditions
    if (applicableTierReward.tierUnlockConditions) {
      const conditions = applicableTierReward.tierUnlockConditions;

      if (conditions.minWageredAmount && vipUser.totalWagered < conditions.minWageredAmount) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `You need to wager at least ${conditions.minWageredAmount} to unlock this tier bonus`,
          progress: {
            current: vipUser.totalWagered,
            required: conditions.minWageredAmount,
          },
        };
      }
    }

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Tier requirements met',
      tierReward: applicableTierReward,
    };
  }

  async validateSettings(settings, user, bonusId, userContext) {
    if (!settings) {
      return {
        status: ClaimStatus.CAN_CLAIM,
        message: 'No special settings restrictions',
      };
    }

    // Check cooldown period
    if (settings.timingSettings?.cooldownPeriod) {
      const lastClaim = await UserBonusBalance.findOne({
        userId: user._id,
        bonusId: bonusId,
      }).sort({ claimedAt: -1 });

      if (lastClaim && lastClaim.claimedAt) {
        const timeSinceLastClaim = (Date.now() - lastClaim.claimedAt) / (1000 * 60 * 60);

        if (timeSinceLastClaim < settings.timingSettings.cooldownPeriod) {
          const remainingCooldown = settings.timingSettings.cooldownPeriod - timeSinceLastClaim;
          const whenCanClaim = new Date(Date.now() + remainingCooldown * 60 * 60 * 1000);

          return {
            status: ClaimStatus.CANNOT_CLAIM,
            message: `Cooldown period active. Try again in ${Math.ceil(remainingCooldown)} hours`,
            whenCanClaim,
          };
        }
      }
    }

    // Check claim window
    if (settings.timingSettings?.claimWindow) {
      // This would require tracking when the user became eligible
      // For now, we'll skip this check
    }

    // Check abuse prevention settings
    if (settings.abusePreventionSettings) {
      const abuseCheck = await this.validateAbusePreventionSettings(
        settings.abusePreventionSettings,
        user,
        userContext
      );
      if (abuseCheck.status !== ClaimStatus.CAN_CLAIM) {
        return abuseCheck;
      }
    }

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Settings validation passed',
    };
  }

  async validateAbusePreventionSettings(abuseSettings, user, _userContext) {
    // Check minimum time between claims
    if (abuseSettings.minTimeBetweenClaims) {
      const recentClaim = await UserBonusBalance.findOne({
        userId: user._id,
        claimedAt: {
          $gte: new Date(Date.now() - abuseSettings.minTimeBetweenClaims * 60 * 1000),
        },
      });

      if (recentClaim) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Please wait ${abuseSettings.minTimeBetweenClaims} minutes between bonus claims`,
        };
      }
    }

    // Other abuse prevention checks would go here
    // (IP tracking, multi-account detection, etc.)

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Abuse prevention checks passed',
    };
  }

  // New method to get all user-related data in a single operation
  async getUserBonusContext(user) {
    const [vipUser, deposits, activeBonuses] = await Promise.all([
      VipUser.findOne({ userId: user._id }).lean(),
      PixTransaction.find({
        userId: user._id,
        type: 'transaction',
        status: 1,
      })
        .sort({ createdAt: -1 })
        .limit(10) // Limit to recent deposits
        .lean(),
      UserBonusBalance.find({
        userId: user._id,
        status: 'active',
      }).lean(),
    ]);

    return {
      vipUser,
      deposits,
      activeBonuses,
    };
  }
}

export default new BonusValidationService();
