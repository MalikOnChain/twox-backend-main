type PixCurrency = 'BRL' | 'USD' | string;

type PixTransactionType = 'transaction' | 'withdrawal';

type PixTransactionMethod = 'pix' | 'payout_pix';

type PixTransactionStatus = 0 | 1 | 2 | 3 | 4 | 5 | number; // CREATED | PAID | REJECTED | EXPIRED | MANUALLY_REJECTED | REFUNDED | WAITING

interface IPixTransaction extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  amount: number;
  currency: PixCurrency;
  type: PixTransactionType;
  method: PixTransactionMethod;
  due?: Date;
  status: PixTransactionStatus;
  pixKey?: string;
  paidAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
