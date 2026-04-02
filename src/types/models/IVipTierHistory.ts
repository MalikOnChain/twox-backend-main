interface TierHistoryEntry {
  tier: string;
  achievedAt: Date;
}

interface IVipTierHistory extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  history: TierHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface IVipTierHistoryModel extends Mongoose.Model<IVipTierHistory> {
  addTierHistory(userId: Mongoose.ObjectId, tier: string): Promise<void>;
}
