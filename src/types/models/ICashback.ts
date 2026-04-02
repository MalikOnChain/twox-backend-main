type CashbackType = 0 | 1 | 2 | 3;

type ClaimFrequencyMode = 'instant' | 'daily' | 'weekly' | 'monthly';

type CashbackModelStatus = 0 | 1;

interface TierCap {
  day: number;
  week: number;
  month: number;
}

interface CashbackTier {
  tierId: Mongoose.ObjectId;
  tierName: string;
  tierLevel: string;
  percentage: number;
  cap: TierCap;
  minWagering: number;
}

interface ClaimFrequency {
  mode: ClaimFrequencyMode;
  cooldown: number;
}

interface DefaultCashback {
  enabled: boolean;
  defaultPercentage: number;
}

interface TimeBoost {
  enabled: boolean;
  from?: Date;
  to?: Date;
  allowedDays: number[];
  defaultPercentage: number;
}

interface GameMultiplier {
  gameType: string;
  defaultPercentage: number;
}

interface GameSpecific {
  enabled: boolean;
  multipliers: GameMultiplier[];
}

interface ICashback extends Mongoose.Document {
  name: string;
  type: CashbackType;
  tiers: CashbackTier[];
  claimFrequency: ClaimFrequency;
  default: DefaultCashback;
  timeBoost: TimeBoost;
  gameSpecific: GameSpecific;
  status: CashbackModelStatus;
  wagerMultiplier: number;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isTimeBoostActive(): boolean;
  getCurrentTimeBoostMultiplier(params: { tierName: string; tierLevel: string; wageringAmount: number }): number;
  getGameMultiplier(params: { gameType: string; tierName: string; tierLevel: string; wageringAmount: number }): number;
  getDefaultMultiplier(params: { tierName: string; tierLevel: string; wageringAmount: number }): number;
  getCapAmount(params: { tierName: string; tierLevel: string; type: 'day' | 'week' | 'month' }): number;
}
