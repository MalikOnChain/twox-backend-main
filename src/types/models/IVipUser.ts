interface VipStatusData {
  endTier?: string | null;
  endLevel?: string | null;
  currentTier: string;
  currentLevel: string;
  progress: number;
  remainingXP: number;
  totalRequired: number;
  currentXP: number;
  totalXP: number;
  startTier?: string;
  startTierLevel?: string;
}

interface VipStatistics {
  endTier?: string | null;
  endLevel?: string | null;
  currentTier: string;
  currentLevel: string;
  progress: number;
  remainingXP: number;
  totalRequired: number;
  currentXP: number;
  totalXP: number;
}

interface IVipUser extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  totalWagered: number;
  totalXP: number;
  loyaltyTierId: Mongoose.ObjectId;
  currentTier?: string;
  currentLevel: string;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface IVipUserModel extends Mongoose.Model<IVipUser> {
  updateVipStatus(
    userId: Mongoose.ObjectId,
    wagerAmount: number,
    type: string,
    gameCategory: string
  ): Promise<IVipUser>;
  processWagerUpdate(
    vipUser: IVipUser,
    wagerAmount: number,
    xpAmount: number,
    type: string
  ): Promise<{
    updatedVipUser: IVipUser;
    tierChanged: boolean;
  }>;
  calculateVipStatusData(vipUser: IVipUser): Promise<VipStatusData>;
  emitVipStatusEvents(userId: Mongoose.ObjectId, vipStatusData: VipStatusData, tierChanged: boolean): Promise<void>;
  getVipStatistics(userId: Mongoose.ObjectId): Promise<VipStatistics>;
  getWagerLeaderboard(limit?: number): Promise<IVipUser[]>;
  getTierDistribution(): Promise<any[]>;
  getVipUserData(userId: Mongoose.ObjectId): Promise<IVipUser | null>;
}
