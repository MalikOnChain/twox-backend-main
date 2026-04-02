type SkinsbackTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | string;

interface SkinsbackUserBalance {
  before: number;
  after: number;
}

interface SkinsbackMetadata {
  tid?: string;
  hash?: string;
}

interface SkinsbackErrorDetails {
  code: string;
  message: string;
  timestamp: Date;
}

interface ISkinsbackTransactions extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  amount: number;
  userBalance: SkinsbackUserBalance;
  status: SkinsbackTransactionStatus;
  metadata: SkinsbackMetadata;
  errorDetails?: SkinsbackErrorDetails;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  isExpired: boolean;

  // Methods
  checkExpiration(): Promise<boolean>;
}

// Static methods interface
interface ISkinsbackTransactionsModel extends Mongoose.Model<ISkinsbackTransactions> {
  updateExpiredTransactions(): Promise<number>;
}
