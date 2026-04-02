type UserBonusType =
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

type UserBonusStatus = 'active' | 'completed' | 'expired' | 'forfeited';

interface IUserBonusBalance extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  bonusId: Mongoose.ObjectId;
  bonusBalance: number;
  lockedWinnings: number;
  initialAmount: number;
  wageringProgress: number;
  wageringMultiplier: number;
  claimedAt?: Date;
  status: UserBonusStatus;
  bonusType: UserBonusType;
  expiresAt: Date;
  metadata: any;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  isClaimed: boolean;
  wageringCompleted: boolean;
  remainingWagering: number;
  isExpired: boolean;
  wageringProgressPercentage: number;

  // Methods
  updateWageringProgress(totalWagerAmount: number): IUserBonusBalance;
  claim(): IUserBonusBalance;
  forfeit(reason?: string): Promise<IUserBonusBalance>;
  complete(): Promise<IUserBonusBalance>;
}

// Static methods interface
interface IUserBonusBalanceModel extends Mongoose.Model<IUserBonusBalance> {
  findActiveBonuses(userId: Mongoose.ObjectId): Promise<IUserBonusBalance[]>;
  findBonusesForWageringCheck(userId: Mongoose.ObjectId): Promise<IUserBonusBalance[]>;
  expireOldBonuses(): Promise<any>;
  getTotalActiveBonusBalance(userId: Mongoose.ObjectId): Promise<{
    totalBonusBalance: number;
    totalLockedWinnings: number;
  }>;
  getUserBonusStats(userId: Mongoose.ObjectId): Promise<{
    active: { count: number; totalAmount: number };
    completed: { count: number; totalAmount: number };
    expired: { count: number; totalAmount: number };
    forfeited: { count: number; totalAmount: number };
  }>;
}
