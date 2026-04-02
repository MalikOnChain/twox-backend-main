type GameStatus = 1 | 2 | 3 | 4 | 5 | 6; // NotStarted | Starting | InProgress | Over | Blocking | Refunded

type BetState = 1 | 2; // Playing | CashedOut

interface ICrashGamePlayer {
  playerId: Mongoose.ObjectId;
  username: string;
  betAmount: number;
  autoCashoutAt?: number;
  stoppedAt: number;
  winningAmount: number;
  forcedCashout: boolean;
  status: BetState | number;
  isBot: boolean;
  avatar: string;
}

interface ICrashGame extends Mongoose.Document {
  // Game Mechanics
  crashPoint: number;

  // Player Management
  players: ICrashGamePlayer[];
  refundedPlayers: Mongoose.ObjectId[];

  // Game Security
  privateSeed: string;
  publicSeed: string;
  gameHash: string;

  // Game State
  status: GameStatus | number;
  startedAt?: Date;
  endedAt?: Date;

  // Game Statistics
  totalWagers: number;
  totalPayouts: number;

  // Virtual Properties
  activePlayerCount: number;

  // Methods
  updateStatus(newStatus: GameStatus, additionalData?: any): Promise<ICrashGame>;
  addPlayer(playerId: Mongoose.ObjectId, playerData: Partial<ICrashGamePlayer>): Promise<ICrashGame>;
  addBotPlayer(playerId: Mongoose.ObjectId, playerData: Partial<ICrashGamePlayer>): Promise<ICrashGame | null>;
  updatePlayerBet(playerId: Mongoose.ObjectId, betData: Partial<ICrashGamePlayer>): Promise<ICrashGame>;
  processPlayerCashout(
    playerId: Mongoose.ObjectId,
    cashoutData: {
      stoppedAt: number;
      winningAmount: number;
      forcedCashout?: boolean;
    }
  ): Promise<ICrashGame | null>;
  formatGameHistory(): {
    _id: Mongoose.ObjectId;
    crashPoint: number;
    startedAt?: Date;
    endedAt?: Date;
    totalWagers: number;
    totalPayouts: number;
    playerCount: number;
  };
  bulkUpdatePlayerBets(bets: Partial<ICrashGamePlayer>[]): Promise<ICrashGame>;
}

// Static methods interface
interface ICrashGameModel extends Mongoose.Model<ICrashGame> {
  createNewGame(gameData: {
    privateSeed: string;
    publicSeed: string;
    crashPoint: number;
    gameHash: string;
  }): Promise<ICrashGame>;
  refundGame(): Promise<Array<{ id: string; refundedPlayers: Mongoose.ObjectId[] }>>;
  getTopWinners(GAME_STATUS: any, days?: number, limit?: number): Promise<any[]>;
}
