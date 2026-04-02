type CashbackStatus = 'active' | 'completed';

interface IUserCashbackBalance extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  cashbackBalance: number;
  lockedWinnings: number;
  initialAmount: number;
  wageringProgress: number;
  wageringMultiplier: number;
  wageringRequirement: number;
  status: CashbackStatus;
  lastUpdatedAt: Date;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isWageringRequirementMet(): boolean;
  getRemainingWageringRequirement(): number;
  updateWageringProgress(totalWagerAmount: number): IUserCashbackBalance;
  addCashback(amount: number, session?: any): Promise<IUserCashbackBalance>;
}

// Static methods interface
interface IUserCashbackBalanceModel {
  getOrCreate(userId: Mongoose.ObjectId, session?: any): Promise<IUserCashbackBalance>;
  getUserCashbackBalance(userId: Mongoose.ObjectId): Promise<number>;
}
