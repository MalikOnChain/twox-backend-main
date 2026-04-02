type UserReferBonusStatus = 'active' | 'completed';

interface IUserReferBonusBalance extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  referBonusBalance: number;
  initialAmount: number;
  wageringProgress: number;
  wageringMultiplier: number;
  lockedWinnings: number;
  wageringRequirement: number;
  rewardHistory: any;
  status: UserReferBonusStatus;
  lastUpdatedAt: Date;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isWageringRequirementMet(): boolean;
  getRemainingWageringRequirement(): number;
  updateWageringProgress(totalWagerAmount: number): IUserReferBonusBalance;
  addReferBonus(amount: number, wageringMultiplier?: number, session?: any): Promise<IUserReferBonusBalance>;
}

// Static methods interface
interface IUserReferBonusBalanceModel extends Mongoose.Model<IUserReferBonusBalance> {
  getOrCreate(userId: Mongoose.ObjectId, session?: any): Promise<IUserReferBonusBalance>;
  getUserReferBonusBalance(userId: Mongoose.ObjectId): Promise<number>;
}
