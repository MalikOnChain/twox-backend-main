type GameCategory = 'slots' | 'live-casino' | 'crash';

interface GameInfo {
  name: string;
  id: string;
  provider: string;
}

interface LastBet {
  avatar: string;
  betAmount: number;
  winAmount: number;
  username: string;
  time: Date;
  category: GameCategory;
  payout: number;
}

interface IRecentWinList extends Mongoose.Document {
  category: GameCategory;
  game: GameInfo;
  banners: string;
  isActive: boolean;
  displayOrder: number;
  lastBet: LastBet;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}
