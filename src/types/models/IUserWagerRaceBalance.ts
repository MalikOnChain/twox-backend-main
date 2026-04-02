type WagerRaceStatus = 'active' | 'completed' | 'forfeited';

interface RaceHistoryEntry {
  raceId: Mongoose.ObjectId;
  position: number;
  prizeAmount: number;
  wageredAmount: number;
  completedAt: Date;
}

interface IUserWagerRaceBalance extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  wagerRaceBalance: number;
  initialAmount: number;
  wageringProgress: number;
  wageringMultiplier: number;
  wageringRequirement: number;
  status: WagerRaceStatus;
  lastUpdatedAt: Date;
  lockedWinnings: number;
  raceHistory: RaceHistoryEntry[];
  metadata: any;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isWageringRequirementMet(): boolean;
  getRemainingWageringRequirement(): number;
  updateWageringProgress(totalWagerAmount: number): IUserWagerRaceBalance;
  addWagerRacePrize(
    raceId: Mongoose.ObjectId,
    position: number,
    prizeAmount: number,
    wageredAmount: number,
    session?: any
  ): Promise<IUserWagerRaceBalance>;
  addWagerRaceBonus(amount: number, wageringMultiplier?: number, session?: any): Promise<IUserWagerRaceBalance>;
}

// Static methods interface
interface IUserWagerRaceBalanceModel {
  getOrCreate(userId: Mongoose.ObjectId, session?: any): Promise<IUserWagerRaceBalance>;
  getUserWagerRaceBalance(userId: Mongoose.ObjectId): Promise<number>;
  getUserRaceHistory(userId: Mongoose.ObjectId, limit?: number): Promise<RaceHistoryEntry[]>;
  getTopPerformers(raceId: Mongoose.ObjectId, limit?: number): Promise<IUserWagerRaceBalance[]>;
}
