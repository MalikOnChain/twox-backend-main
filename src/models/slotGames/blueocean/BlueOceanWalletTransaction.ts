import mongoose, { Schema, Document } from 'mongoose';

export interface IBlueOceanWalletTransaction extends Document {
  remote_id: string;
  session_id: string;
  transaction_id: string;
  action: 'debit' | 'credit' | 'rollback';
  amount: number;
  balance_before: number;
  balance_after: number;
  status: 'pending' | 'completed' | 'rolled_back';
  user_id: mongoose.Types.ObjectId;
  game_id?: string;
  created_at: Date;
  updated_at: Date;
}

const BlueOceanWalletTransactionSchema = new Schema<IBlueOceanWalletTransaction>({
  remote_id: { type: String, required: true, index: true },
  session_id: { type: String, required: true, index: true },
  transaction_id: { type: String, required: true, unique: true, index: true },
  action: { 
    type: String, 
    required: true, 
    enum: ['debit', 'credit', 'rollback'],
    index: true 
  },
  amount: { type: Number, required: true },
  balance_before: { type: Number, required: true },
  balance_after: { type: Number, required: true },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'completed', 'rolled_back'],
    default: 'completed' 
  },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  game_id: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Indexes for performance
BlueOceanWalletTransactionSchema.index({ user_id: 1, created_at: -1 });
BlueOceanWalletTransactionSchema.index({ session_id: 1, action: 1 });
BlueOceanWalletTransactionSchema.index({ game_id: 1 });
BlueOceanWalletTransactionSchema.index({ created_at: -1 });

const BlueOceanWalletTransaction = mongoose.model<IBlueOceanWalletTransaction>(
  'BlueOceanWalletTransaction',
  BlueOceanWalletTransactionSchema
);

export default BlueOceanWalletTransaction;

