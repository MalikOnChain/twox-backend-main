// src/models/v2/bonus/BonusTierRewards.js
import mongoose from 'mongoose';

const BonusTierRewardsSchema = new mongoose.Schema<IBonusTierRewards>(
  {
    bonusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bonuses',
      required: true,
      index: true,
      comment: 'Reference to the bonus',
    },
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VipTiers',
      required: true,
      index: true,
      comment: 'Reference to the VIP tier',
    },
    tierName: {
      type: String,
      required: true,
      comment: 'VIP tier name for reference',
    },
    tierLevel: {
      type: String,
      comment: 'VIP tier level (I, II, III, etc.)',
    },

    // Tier-Specific Reward Override
    tierReward: {
      cash: {
        amount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific fixed cash bonus amount',
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
          comment: 'Tier-specific cash bonus percentage',
        },
        minAmount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific minimum cash bonus amount',
        },
        maxAmount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific maximum cash bonus amount',
        },
      },
      freeSpins: {
        amount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific fixed number of free spins',
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
          comment: 'Tier-specific free spins percentage',
        },
        minAmount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific minimum number of free spins',
        },
        maxAmount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific maximum number of free spins',
        },
      },
      bonus: {
        amount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific fixed bonus amount',
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
          comment: 'Tier-specific bonus percentage',
        },
        minAmount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific minimum bonus amount',
        },
        maxAmount: {
          type: Number,
          min: 0,
          comment: 'Tier-specific maximum bonus amount',
        },
      },
      special: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
        comment: 'Tier-specific special reward configuration',
      },
    },

    // Tier-Specific Wagering Requirements
    tierWageringMultiplier: {
      type: Number,
      min: 0,
      comment: 'Tier-specific wagering multiplier (overrides default)',
    },

    // Tier-Specific Limits and Caps
    tierLimits: {
      maxClaimsPerUser: {
        type: Number,
        comment: 'Tier-specific max claims per user',
      },
      dailyCap: {
        type: Number,
        comment: 'Daily claiming cap for this tier',
      },
      weeklyCap: {
        type: Number,
        comment: 'Weekly claiming cap for this tier',
      },
      monthlyCap: {
        type: Number,
        comment: 'Monthly claiming cap for this tier',
      },
    },

    // Tier-Specific Unlock Conditions
    tierUnlockConditions: {
      minWageredAmount: {
        type: Number,
        min: 0,
        comment: 'Minimum wagered amount required for this tier',
      },
      minDepositAmount: {
        type: Number,
        min: 0,
        comment: 'Minimum deposit amount required for this tier',
      },
      requiredGameCategories: [
        {
          type: String,
          comment: 'Game categories that must be played',
        },
      ],
      minTimeInTier: {
        type: Number,
        comment: 'Minimum time spent in tier (hours)',
      },
    },

    // Priority and Ordering
    priority: {
      type: Number,
      default: 0,
      comment: 'Priority for this tier reward (higher = more priority)',
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
      comment: 'Whether this tier reward is active',
    },

    // Effective Period
    effectiveFrom: {
      type: Date,
      default: Date.now,
      comment: 'When this tier reward becomes effective',
    },
    effectiveTo: {
      type: Date,
      comment: 'When this tier reward expires',
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      comment: 'Additional tier-specific configuration',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BonusTierRewardsSchema.index({ bonusId: 1, tierId: 1 }, { unique: true });
BonusTierRewardsSchema.index({ bonusId: 1, isActive: 1 });
BonusTierRewardsSchema.index({ tierId: 1, isActive: 1 });

// Virtual for checking if tier reward is currently effective
BonusTierRewardsSchema.virtual('isEffective').get(function () {
  const now = new Date();
  return this.isActive && now >= this.effectiveFrom && (!this.effectiveTo || now <= this.effectiveTo);
});

// Methods
BonusTierRewardsSchema.methods.getEffectiveReward = function (defaultReward: any) {
  const tierReward = this.tierReward;

  // Apply multiplier to default reward if specified
  if (tierReward.multiplier && tierReward.multiplier !== 1) {
    return {
      percentage: (defaultReward.percentage || 0) * tierReward.multiplier,
      fixedAmount: (defaultReward.fixedAmount || 0) * tierReward.multiplier,
      minAmount: (defaultReward.minAmount || 0) * tierReward.multiplier,
      maxAmount: (defaultReward.maxAmount || 0) * tierReward.multiplier,
      freeSpins: (defaultReward.freeSpins || 0) * tierReward.multiplier,
    };
  }

  // Use tier-specific values if provided, otherwise fall back to default
  return {
    percentage: tierReward.percentage ?? defaultReward.percentage,
    fixedAmount: tierReward.fixedAmount ?? defaultReward.fixedAmount,
    minAmount: tierReward.minAmount ?? defaultReward.minAmount,
    maxAmount: tierReward.maxAmount ?? defaultReward.maxAmount,
    freeSpins: tierReward.freeSpins ?? defaultReward.freeSpins,
  };
};

export default mongoose.model<IBonusTierRewards>('BonusTierRewards', BonusTierRewardsSchema);
