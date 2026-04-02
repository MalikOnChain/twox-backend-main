type FreeSpinStatus = 'active' | 'completed';

interface IUserFreeSpinBalance extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  freeSpinBalance: number;
  originalValue: number;
  initialAmount: number;
  wageringProgress: number;
  wageringMultiplier: number;
  lockedWinnings: number;
  wageringRequirement: number;
  status: FreeSpinStatus;
  lastUpdatedAt: Date;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isWageringRequirementMet(): boolean;
  getRemainingWageringRequirement(): number;
  updateWageringProgress(totalWagerAmount: number): IUserFreeSpinBalance;
}

// Static methods interface
interface IUserFreeSpinBalanceModel {
  // Add static methods if any are defined in the model
}
