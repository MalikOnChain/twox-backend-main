interface TierReward {
  cash: {
    amount?: number;
    percentage?: number;
    minAmount?: number;
    maxAmount?: number;
  };
  freeSpins: {
    amount?: number;
    percentage?: number;
    minAmount?: number;
    maxAmount?: number;
  };
  bonus: {
    amount?: number;
    percentage?: number;
    minAmount?: number;
    maxAmount?: number;
  };
  special: any;
}

interface TierLimits {
  maxClaimsPerUser?: number;
  dailyCap?: number;
  weeklyCap?: number;
  monthlyCap?: number;
}

interface TierUnlockConditions {
  minWageredAmount?: number;
  minDepositAmount?: number;
  requiredGameCategories?: string[];
  minTimeInTier?: number;
}

interface IBonusTierRewards extends Mongoose.Document {
  bonusId: Mongoose.ObjectId;
  tierId: Mongoose.ObjectId;
  tierName: string;
  tierLevel?: string;

  // Tier-Specific Reward Override
  tierReward: TierReward;

  // Tier-Specific Wagering Requirements
  tierWageringMultiplier?: number;

  // Tier-Specific Limits and Caps
  tierLimits: TierLimits;

  // Tier-Specific Unlock Conditions
  tierUnlockConditions: TierUnlockConditions;

  // Priority and Ordering
  priority: number;

  // Status
  isActive: boolean;

  // Effective Period
  effectiveFrom: Date;
  effectiveTo?: Date;

  // Metadata
  metadata: any;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  isEffective: boolean;

  // Methods
  getEffectiveReward(defaultReward: any): any;
}
