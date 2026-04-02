type BonusType =
  | 'welcome'
  | 'deposit'
  | 'recurring'
  | 'custom'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'referral'
  | 'wager-race'
  | 'free-spins'
  | 'game-specific'
  | 'win-streak'
  | 'milestone'
  | 'loss-rebate'
  | 'deposit-series'
  | 'challenge'
  | 'time-boost-cashback'
  | 'vip-level-up'
  | 'points-exchange'
  | 'reactivation';

type BonusStatus = 'active' | 'inactive' | 'draft' | 'expired';

type BonusCategory = 'standard' | 'vip' | 'promotional' | 'seasonal';

interface CashReward {
  amount?: number;
  percentage?: number;
  minAmount?: number;
  maxAmount?: number;
}

interface FreeSpinsReward {
  amount?: number;
  percentage?: number;
  minAmount?: number;
  maxAmount?: number;
}

interface BonusReward {
  amount?: number;
  percentage?: number;
  minAmount?: number;
  maxAmount?: number;
}

interface DefaultReward {
  cash: CashReward;
  freeSpins: FreeSpinsReward;
  bonus: BonusReward;
  special: any;
}

interface IBonus extends Mongoose.Document {
  // Basic Information
  name: string;
  code?: string;
  description: string;

  // Bonus Type and Category
  type: BonusType;
  category: BonusCategory;
  status: BonusStatus;
  isVisible: boolean;

  // Default Reward Configuration
  defaultReward: DefaultReward;

  // Wagering Requirements
  defaultWageringMultiplier: number;

  // Validity Period
  validFrom: Date;
  validTo?: Date;

  // Claim Restrictions
  maxClaims?: number;
  claimsCount: number;
  maxClaimsPerUser: number;

  // Priority and Ordering
  priority: number;
  displayOrder: number;

  // Media and Presentation
  imageUrl?: string;
  iconUrl?: string;
  termsAndConditions?: string;

  // Metadata for complex bonuses
  metadata: any;

  // Audit Trail
  createdBy?: Mongoose.ObjectId;
  lastModifiedBy?: Mongoose.ObjectId;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  isExpired: boolean;
  isActive: boolean;

  // Methods
  canBeClaimed(): boolean;
  incrementClaimsCount(): Promise<IBonus>;
}
