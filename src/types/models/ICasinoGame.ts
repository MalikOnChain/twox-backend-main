type CasinoGameRoundType = 'BASE' | 'FREESPIN' | 'BONUS';

type CasinoGameStatus = 1 | 2 | 3; // Pending | Completed | Failed

type CasinoGameCategory = 'slots' | 'live-casino';

interface ICasinoGamePlayer {
  playerId: Mongoose.ObjectId;
  username: string;
  betAmount: number;
  winAmount: number;
  isBot: boolean;
  avatar: string;
}

interface ErrorDetails {
  code: string;
  message: string;
  timestamp: Date;
}

interface ICasinoGame extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  gameCategory: CasinoGameCategory;
  providerCode: string;
  gameCode: string;
  gameName: string;
  transactionId: string;
  roundType: CasinoGameRoundType | string;
  players: ICasinoGamePlayer[];
  totalWagers: number;
  totalPayouts: number;
  betAmount: number;
  winAmount: number;
  currency: string;
  gameData: any;
  userBalance: number;
  status: CasinoGameStatus | number;
  errorDetails?: ErrorDetails;
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  netAmount: number;

  // Methods
  updateStatus(newStatus: CasinoGameStatus, additionalData?: any): Promise<ICasinoGame>;
  addPlayer(playerId: Mongoose.ObjectId, playerData: Partial<ICasinoGamePlayer>): Promise<ICasinoGame>;
  updatePlayerBet(playerId: Mongoose.ObjectId, betData: Partial<ICasinoGamePlayer>): Promise<ICasinoGame>;
  setError(error: { code?: string; message: string }): Promise<ICasinoGame>;
  formatGameHistory(): {
    _id: Mongoose.ObjectId;
    gameName: string;
    providerCode: string;
    gameCode: string;
    betAmount: number;
    winAmount: number;
    netAmount: number;
    status: CasinoGameStatus;
    gameCategory: CasinoGameCategory;
    roundType: CasinoGameRoundType;
    totalWagers: number;
    totalPayouts: number;
    playerCount: number;
  };
}

// Static methods interface
interface ICasinoGameModel extends Mongoose.Model<ICasinoGame> {
  findByTransactionId(transactionId: string): Promise<ICasinoGame | null>;
  findByPlayerId(playerId: Mongoose.ObjectId, options?: { limit?: number; offset?: number }): Promise<ICasinoGame[]>;
  getTopWinners(days?: number, limit?: number): Promise<any[]>;
}
