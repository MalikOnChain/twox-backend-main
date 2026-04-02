type EligibilityType = 'all' | 'vip_tiers' | 'user_list' | 'country' | 'registration_date' | 'deposit_history';

type ClaimStatus = 'CAN_CLAIM' | 'CANNOT_CLAIM' | 'ALREADY_CLAIMED' | 'EXPIRED';

interface VipTier {
  tierId: string;
  tierName: string;
}

interface MinAccountAge {
  hours?: number;
  days?: number;
}

interface DepositRequirements {
  requireDeposit: boolean;
  firstDepositOnly: boolean;
  minDepositAmount?: number;
  maxDepositAmount?: number;
  minDepositCount?: number;
  maxDepositsPerTimeframe?: number;
  minTotalDeposits?: number;
  depositTimeframe?: number;
}

interface ActivityRequirements {
  minWagered?: number;
  minGamesPlayed?: number;
  maxInactiveDays?: number;
  requiredGameCategories?: string[];
}

interface TimeRestrictions {
  allowedDays?: number[];
  allowedHours?: {
    start: number;
    end: number;
  };
  timezone: string;
}

interface Exclusions {
  excludeIfHasActiveBonus: boolean;
  excludedBonusTypes?: string[];
  excludeAfterClaim: boolean;
}

interface EligibilityResult {
  status: ClaimStatus;
  message: string;
  whenCanClaim?: Date;
}

interface IBonusEligibility extends Mongoose.Document {
  bonusId: string | Mongoose.ObjectId;
  eligibilityType: EligibilityType;
  vipTiers?: VipTier[];
  eligibleUserIds?: string[];
  allowedCountries?: string[];
  excludedCountries?: string[];
  minAccountAge?: MinAccountAge;
  depositRequirements?: DepositRequirements;
  activityRequirements?: ActivityRequirements;
  timeRestrictions?: TimeRestrictions;
  exclusions?: Exclusions;
  customConditions?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  checkUserEligibility(user: any): Promise<EligibilityResult>;
  _checkVipTierEligibility(user: any): Promise<EligibilityResult>;
  _checkUserListEligibility(user: any): EligibilityResult;
  _checkCountryEligibility(user: any): EligibilityResult;
  _checkRegistrationDateEligibility(user: any): EligibilityResult;
  _checkDepositHistoryEligibility(user: any): Promise<EligibilityResult>;
}
