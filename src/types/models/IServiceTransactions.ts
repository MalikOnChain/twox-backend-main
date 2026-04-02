type ServiceTransactionType =
  | 'BONUS_CLAIM'
  | 'CASHBACK_CLAIM'
  | 'REFERRAL_REWARD'
  | 'VIP_REWARD'
  | 'WAGER_RACE_REWARD'
  | 'FREE_SPINS_CLAIM'
  | 'WITHDRAWAL'
  | 'DEPOSIT'
  | 'ADMIN_ADJUSTMENT';

type ServiceTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

interface ServiceUserBalance {
  before?: number;
  after?: number;
}

interface ServiceBalance {
  before?: any;
  after?: any;
}

interface ServiceErrorDetails {
  code: string;
  message: string;
  timestamp: Date;
}

interface IServiceTransactions extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  type: ServiceTransactionType;
  amount: number;
  userBalance: ServiceUserBalance;
  bonusBalances: ServiceBalance;
  cashbackBalances: ServiceBalance;
  referBonusBalances: ServiceBalance;
  wagerRaceBalances: ServiceBalance;
  freeSpinsBalances: ServiceBalance;
  status: ServiceTransactionStatus;
  referenceId: Mongoose.ObjectId;
  metadata?: any;
  errorDetails?: ServiceErrorDetails;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
