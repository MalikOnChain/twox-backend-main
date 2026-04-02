type GameTransactionCategory = 'slots' | 'live-casino' | 'crash';

type GameTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

type TransactionType = 'BET' | 'WIN' | 'REFUND' | 'BONUS' | 'CASHBACK';

interface GameUserBalance {
  before?: number;
  after?: number;
}

interface GameBalance {
  before?: any;
  after?: any;
}

interface GameInfo {
  id: string;
  [key: string]: any;
}

interface ErrorDetails {
  code: string;
  message: string;
  timestamp: Date;
}

interface IGameTransactions extends Mongoose.Document {
  category: GameTransactionCategory;
  userId: Mongoose.ObjectId;
  betAmount: number;
  winAmount: number;
  userBalance: GameUserBalance;
  bonusBalances: GameBalance;
  cashbackBalances: GameBalance;
  referBonusBalances: GameBalance;
  wagerRaceBalances: GameBalance;
  freeSpinBalances: GameBalance;
  betDetails?: any;
  type: TransactionType;
  status: GameTransactionStatus;
  game: GameInfo;
  errorDetails?: ErrorDetails;
  version: number;
  wagerRaces: Mongoose.ObjectId[];
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  netAmount: number;
}
