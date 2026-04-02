interface IBetHistory extends Mongoose.Document {
  playerId: string;
  betAmount: number;
  payout: number;
  username: string;
  avatar: string;
  time: Date;
  metadata: any;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface IBetHistoryModel extends Mongoose.Model<IBetHistory> {
  createHistory(betData: {
    playerId: string;
    betAmount: number;
    payout: number;
    username: string;
    avatar: string;
    time?: Date;
    category: string;
    metadata?: any;
  }): Promise<IBetHistory>;
}
