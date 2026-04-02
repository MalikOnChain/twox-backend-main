type ChainType = 'ethereum' | 'solana';

interface IUserWallet extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  address: string;
  chain: ChainType;
  isDefault: boolean;
  isVerified: boolean;
}

// Static methods interface
interface IUserWalletModel {
  addWallet(walletData: {
    userId: Mongoose.ObjectId;
    address: string;
    chain: ChainType;
    isDefault?: boolean;
    isVerified?: boolean;
  }): Promise<IUserWallet>;
  removeWallet(userId: Mongoose.ObjectId, address: string): Promise<IUserWallet | null>;
  setDefaultWallet(userId: Mongoose.ObjectId, address: string): Promise<IUserWallet | null>;
  getWalletsByUser(userId: Mongoose.ObjectId): Promise<IUserWallet[]>;
  verifyWallet(userId: Mongoose.ObjectId, address: string): Promise<IUserWallet | null>;
  getUserIdByWalletAddress(address: string): Promise<string | null>;
}
