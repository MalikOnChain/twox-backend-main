type CryptoBlockchainProtocolName =
  | 'bitcoin'
  | 'litecoin'
  | 'dogecoin'
  | 'ethereum'
  | 'xrp'
  | 'binance-smart-chain'
  | 'tron'
  | 'polygon'
  | 'avalanche'
  | 'arbitrum';

type CryptoNetwork = 'mainnet' | 'testnet' | 'sepolia' | 'mordor' | 'nile' | 'amoy' | 'fuji';

type CryptoTransactionType = 'DEPOSIT' | 'WITHDRAWAL';

type VaultodyTxEvent =
  | 'TRANSACTION_REQUEST'
  | 'TRANSACTION_APPROVED'
  | 'TRANSACTION_REJECTED'
  | 'INCOMING_CONFIRMED_COIN_TX'
  | 'INCOMING_CONFIRMED_TOKEN_TX'
  | 'INCOMING_CONFIRMED_INTERNAL_TX'
  | 'INCOMING_MINED_TX'
  | 'OUTGOING_FAILED'
  | 'OUTGOING_MINED'
  | 'TRANSACTION_BROADCASTED';

type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

interface CryptoUserBalance {
  before: number;
  after: number;
}

interface ICryptoTransactions extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  blockchain: CryptoBlockchainProtocolName;
  network: CryptoNetwork;
  type: CryptoTransactionType;
  userBalance: CryptoUserBalance;
  status: VaultodyTxEvent | TransactionStatus;
  amount: number;
  exchangeRate: number;
  exchangedAmount: number;
  unit: string;
  transactionRequestId?: string;
  transactionId: string;
  address: string;
  metadata: any;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  currentConfirmations: number;
  targetConfirmations?: number;

  // Virtual Properties
  explorerUrl?: string;

  // Methods
  markCoinConfirmed(): Promise<ICryptoTransactions>;
}

// Static methods interface
interface ICryptoTransactionsModel extends Mongoose.Model<ICryptoTransactions> {
  getUserTransactions(userId: Mongoose.ObjectId, filters?: any): Promise<ICryptoTransactions[]>;
  getByTransactionId(transactionId: string): Promise<ICryptoTransactions | null>;
  getPendingDeposits(): Promise<ICryptoTransactions[]>;
  findOrCreateTransaction(transactionData: any): Promise<{ transaction: ICryptoTransactions; created: boolean }>;
}
