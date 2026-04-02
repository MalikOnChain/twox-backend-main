// src/models/v2/bonus/BonusEligibility.js
import mongoose from 'mongoose';

import { ClaimStatus } from '../../types/bonus/bonus';
import { logger } from '../../utils/logger';
import PixTransaction from '../transactions/PixTransaction';
import VipUser from '../vip/VipUser';

const BonusEligibilitySchema = new mongoose.Schema<IBonusEligibility>(
  {
    bonusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bonuses',
      required: true,
      index: true,
      comment: 'Reference to the bonus',
    },

    // User Targeting
    eligibilityType: {
      type: String,
      enum: ['all', 'vip_tiers', 'user_list', 'country', 'registration_date', 'deposit_history'],
      required: true,
      comment: 'Type of eligibility criteria',
    },

    // VIP Tier Eligibility
    vipTiers: [
      {
        tierId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'VipTiers',
          comment: 'VIP tier ID',
        },
        tierName: {
          type: String,
          comment: 'VIP tier name for reference',
        },
      },
    ],

    // Specific Users
    eligibleUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        comment: 'Specific users eligible for this bonus',
      },
    ],

    // Geographic Restrictions
    allowedCountries: [
      {
        type: String,
        comment: 'ISO country codes',
      },
    ],
    excludedCountries: [
      {
        type: String,
        comment: 'ISO country codes to exclude',
      },
    ],

    // Account Age Requirements
    minAccountAge: {
      hours: {
        type: Number,
        min: 0,
        comment: 'Minimum account age in hours',
      },
      days: {
        type: Number,
        min: 0,
        comment: 'Minimum account age in days',
      },
    },

    // Deposit History Requirements
    depositRequirements: {
      requireDeposit: {
        type: Boolean,
        default: false,
        comment: 'Whether a deposit is required to claim the bonus',
      },
      firstDepositOnly: {
        type: Boolean,
        default: false,
        comment: 'Whether the bonus is only for first deposits',
      },
      minDepositAmount: {
        type: Number,
        min: 0,
        comment: 'Minimum deposit amount required',
      },
      maxDepositAmount: {
        type: Number,
        min: 0,
        comment: 'Maximum deposit amount allowed',
      },
      minDepositCount: {
        type: Number,
        min: 0,
        comment: 'Minimum number of deposits required',
      },
      maxDepositsPerTimeframe: {
        type: Number,
        min: 0,
        comment: 'Maximum number of deposits allowed in timeframe',
      },
      minTotalDeposits: {
        type: Number,
        min: 0,
        comment: 'Minimum total deposit amount required',
      },
      depositTimeframe: {
        type: Number,
        min: 0,
        comment: 'Timeframe in hours to check deposit history',
      },
    },

    // Activity Requirements
    activityRequirements: {
      minWagered: {
        type: Number,
        min: 0,
        comment: 'Minimum total wagered amount',
      },
      minGamesPlayed: {
        type: Number,
        min: 0,
        comment: 'Minimum number of games played',
      },
      maxInactiveDays: {
        type: Number,
        min: 0,
        comment: 'Maximum days of inactivity (for reactivation bonuses)',
      },
      requiredGameCategories: [
        {
          type: String,
          comment: 'Required game categories to have played',
        },
      ],
    },

    // Time-based Eligibility
    timeRestrictions: {
      allowedDays: [
        {
          type: Number,
          min: 0,
          max: 6,
          comment: 'Days of week (0 = Sunday, 6 = Saturday)',
        },
      ],
      allowedHours: {
        start: {
          type: Number,
          min: 0,
          max: 23,
          comment: 'Start hour (24-hour format)',
        },
        end: {
          type: Number,
          min: 0,
          max: 23,
          comment: 'End hour (24-hour format)',
        },
      },
      timezone: {
        type: String,
        default: 'UTC',
        comment: 'Timezone for time restrictions',
      },
    },

    // Exclusion Rules
    exclusions: {
      excludeIfHasActiveBonus: {
        type: Boolean,
        default: false,
        comment: 'Exclude users with active bonuses',
      },
      excludedBonusTypes: [
        {
          type: String,
          comment: 'Bonus types that make user ineligible',
        },
      ],
      excludeAfterClaim: {
        type: Boolean,
        default: true,
        comment: 'Exclude user from this bonus after claiming once',
      },
    },

    // Custom Conditions
    customConditions: {
      type: mongoose.Schema.Types.Mixed,
      comment: 'Custom eligibility conditions for complex scenarios',
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
      comment: 'Whether this eligibility rule is active',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BonusEligibilitySchema.index({ bonusId: 1, isActive: 1 });
BonusEligibilitySchema.index({ eligibilityType: 1, isActive: 1 });
BonusEligibilitySchema.index({ vipTiers: 1 });
BonusEligibilitySchema.index({ eligibleUserIds: 1 });
BonusEligibilitySchema.index({ 'vipTiers.tierId': 1 });

// Methods
BonusEligibilitySchema.methods.checkUserEligibility = async function (user: IUser) {
  try {
    if (!this.isActive) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'Eligibility rule is not active',
      };
    }

    // Check eligibility type
    switch (this.eligibilityType) {
      case 'all':
        return {
          status: ClaimStatus.CAN_CLAIM,
          message: 'Open to all users',
        };

      case 'vip_tiers':
        return await this._checkVipTierEligibility(user);

      case 'user_list':
        return this._checkUserListEligibility(user);

      case 'country':
        return this._checkCountryEligibility(user);

      case 'registration_date':
        return this._checkRegistrationDateEligibility(user);

      case 'deposit_history':
        return await this._checkDepositHistoryEligibility(user);

      default:
        return {
          status: ClaimStatus.CAN_CLAIM,
          message: 'Unknown eligibility type, allowing access',
        };
    }
  } catch (error) {
    logger.error('Error checking user eligibility:', error);
    return {
      status: ClaimStatus.CANNOT_CLAIM,
      message: 'Error checking eligibility',
    };
  }
};

BonusEligibilitySchema.methods._checkVipTierEligibility = async function (user: IUser) {
  if (!this.vipTiers?.length) {
    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'No VIP tier restrictions',
    };
  }

  const vipUser = await VipUser.findOne({ userId: user._id });
  if (!vipUser) {
    return {
      status: ClaimStatus.CANNOT_CLAIM,
      message: 'VIP status required',
    };
  }

  const isEligibleTier = this.vipTiers.some((tier: any) => tier.tierId.toString() === vipUser.loyaltyTierId.toString());

  return {
    status: isEligibleTier ? ClaimStatus.CAN_CLAIM : ClaimStatus.CANNOT_CLAIM,
    message: isEligibleTier ? 'VIP tier eligible' : 'VIP tier not eligible',
  };
};

BonusEligibilitySchema.methods._checkUserListEligibility = function (user: IUser) {
  if (!this.eligibleUserIds?.length) {
    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'No user list restrictions',
    };
  }

  const isEligibleUser = this.eligibleUserIds.some((userId: any) => userId.toString() === user._id.toString());

  return {
    status: isEligibleUser ? ClaimStatus.CAN_CLAIM : ClaimStatus.CANNOT_CLAIM,
    message: isEligibleUser ? 'User is eligible' : 'User is not eligible',
  };
};

BonusEligibilitySchema.methods._checkCountryEligibility = function (user: IUser) {
  const userCountry = user.country || 'US';

  if (this.allowedCountries?.length && !this.allowedCountries.includes(userCountry)) {
    return {
      status: ClaimStatus.CANNOT_CLAIM,
      message: 'This bonus is not available in your country',
    };
  }

  if (this.excludedCountries?.length && this.excludedCountries.includes(userCountry)) {
    return {
      status: ClaimStatus.CANNOT_CLAIM,
      message: 'This bonus is not available in your country',
    };
  }

  return {
    status: ClaimStatus.CAN_CLAIM,
    message: 'Country eligibility requirements met',
  };
};

BonusEligibilitySchema.methods._checkRegistrationDateEligibility = function (user: IUser) {
  if (!this.minAccountAge) {
    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'No account age restrictions',
    };
  }

  const now = new Date();
  const registrationDate = new Date(user.createdAt);
  const accountAgeHours = (now.getTime() - registrationDate.getTime()) / (1000 * 60 * 60);
  const accountAgeDays = accountAgeHours / 24;

  if (this.minAccountAge.hours && accountAgeHours < this.minAccountAge.hours) {
    const requiredDate = new Date(registrationDate.getTime() + this.minAccountAge.hours * 60 * 60 * 1000);
    return {
      status: ClaimStatus.CANNOT_CLAIM,
      message: `Account must be at least ${this.minAccountAge.hours} hours old`,
      whenCanClaim: requiredDate,
    };
  }

  if (this.minAccountAge.days && accountAgeDays < this.minAccountAge.days) {
    const requiredDate = new Date(registrationDate.getTime() + this.minAccountAge.days * 24 * 60 * 60 * 1000);
    return {
      status: ClaimStatus.CANNOT_CLAIM,
      message: `Account must be at least ${this.minAccountAge.days} days old`,
      whenCanClaim: requiredDate,
    };
  }

  return {
    status: ClaimStatus.CAN_CLAIM,
    message: 'Account age requirements met',
  };
};

BonusEligibilitySchema.methods._checkDepositHistoryEligibility = async function (user: IUser) {
  if (!this.depositRequirements) {
    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'No deposit requirements specified',
    };
  }

  try {
    const deposits = await PixTransaction.find({
      userId: user._id,
      type: 'transaction',
      status: 1,
    }).sort({ createdAt: -1 });

    // Check if user has any deposits
    if (deposits.length === 0) {
      if (this.depositRequirements.requireDeposit) {
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
    if (this.depositRequirements.firstDepositOnly && deposits.length > 1) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: 'This bonus is only available for first deposits',
      };
    }

    // Check minimum deposit amount
    if (this.depositRequirements.minDepositAmount) {
      const lastDeposit = deposits[0];
      if (lastDeposit.amount < this.depositRequirements.minDepositAmount) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Minimum deposit amount of ${this.depositRequirements.minDepositAmount} required. Your last deposit was ${lastDeposit.amount}`,
        };
      }
    }

    // Check maximum deposit amount
    if (this.depositRequirements.maxDepositAmount) {
      const lastDeposit = deposits[0];
      if (lastDeposit.amount > this.depositRequirements.maxDepositAmount) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Maximum deposit amount of ${this.depositRequirements.maxDepositAmount} exceeded. Your last deposit was ${lastDeposit.amount}`,
        };
      }
    }

    // Check deposit count
    if (this.depositRequirements.minDepositCount && deposits.length < this.depositRequirements.minDepositCount) {
      return {
        status: ClaimStatus.CANNOT_CLAIM,
        message: `Minimum ${this.depositRequirements.minDepositCount} deposits required. You have made ${deposits.length} deposits.`,
      };
    }

    // Check deposit timeframe
    if (this.depositRequirements.depositTimeframe && this.depositRequirements.minTotalDeposits) {
      const timeframeStart = new Date(Date.now() - this.depositRequirements.depositTimeframe * 60 * 60 * 1000);
      const recentDeposits = deposits.filter((deposit) => deposit.createdAt >= timeframeStart);
      const recentTotal = recentDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);

      if (recentTotal < this.depositRequirements.minTotalDeposits) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Minimum ${this.depositRequirements.minTotalDeposits} deposited in the last ${this.depositRequirements.depositTimeframe} hours required`,
        };
      }
    }

    // Check deposit frequency
    if (this.depositRequirements.maxDepositsPerTimeframe && this.depositRequirements.depositTimeframe) {
      const timeframeStart = new Date(Date.now() - this.depositRequirements.depositTimeframe * 60 * 60 * 1000);
      const recentDeposits = deposits.filter((deposit) => deposit.createdAt >= timeframeStart);

      if (recentDeposits.length > this.depositRequirements.maxDepositsPerTimeframe) {
        return {
          status: ClaimStatus.CANNOT_CLAIM,
          message: `Maximum ${this.depositRequirements.maxDepositsPerTimeframe} deposits allowed in the last ${this.depositRequirements.depositTimeframe} hours`,
        };
      }
    }

    return {
      status: ClaimStatus.CAN_CLAIM,
      message: 'Deposit requirements met',
    };
  } catch (error) {
    logger.error('Error checking deposit history eligibility:', error);
    return {
      status: ClaimStatus.CANNOT_CLAIM,
      message: 'Unable to verify deposit requirements',
    };
  }
};

export default mongoose.model('BonusEligibility', BonusEligibilitySchema);
