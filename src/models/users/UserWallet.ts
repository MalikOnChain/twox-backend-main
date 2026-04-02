import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const WalletSchema = new mongoose.Schema<IUserWallet>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  address: {
    type: String,
    required: true,
    lowercase: true,
    unique: true,
  },
  chain: {
    type: String,
    required: true,
    enum: ['ethereum', 'solana'],
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
});

/**
 * Add a wallet for a user
 * @param {Object} walletData - Wallet details (userId, address, chain, isDefault, isVerified)
 * @returns {Promise<Object>} The newly created wallet
 */
WalletSchema.statics.addWallet = async function (walletData) {
  // If the wallet is set to default, unset the previous default wallet for the user
  if (walletData.isDefault) {
    await this.updateMany({ userId: walletData.userId, isDefault: true }, { $set: { isDefault: false } });
  }

  const wallet = new this(walletData);
  return await wallet.save();
};

/**
 * Remove a wallet by its address and userId
 * @param {String} userId - The user ID
 * @param {String} address - The wallet address to remove
 * @returns {Promise<Object|null>} The removed wallet document, or null if not found
 */
WalletSchema.statics.removeWallet = async function (userId, address) {
  return await this.findOneAndDelete({ userId, address });
};

/**
 * Set a wallet as the default wallet for a user
 * @param {String} userId - The user ID
 * @param {String} address - The wallet address to set as default
 * @returns {Promise<Object|null>} The updated wallet document, or null if not found
 */
WalletSchema.statics.setDefaultWallet = async function (userId, address) {
  // Unset any existing default wallet for the user
  await this.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } });

  // Set the new wallet as default
  return await this.findOneAndUpdate(
    { userId, address },
    { $set: { isDefault: true } },
    { new: true } // Return the updated document
  );
};

/**
 * Get all wallets for a user
 * @param {String} userId - The user ID
 * @returns {Promise<Array>} List of wallets for the user
 */
WalletSchema.statics.getWalletsByUser = async function (userId) {
  return await this.find({ userId });
};

/**
 * Verify a wallet (mark as verified)
 * @param {String} userId - The user ID
 * @param {String} address - The wallet address to verify
 * @returns {Promise<Object|null>} The updated wallet document, or null if not found
 */
WalletSchema.statics.verifyWallet = async function (userId, address) {
  return await this.findOneAndUpdate(
    { userId, address },
    { $set: { isVerified: true } },
    { new: true } // Return the updated document
  );
};

WalletSchema.statics.getUserIdByWalletAddress = async function (address) {
  const wallet = await this.findOne({ address });
  return wallet ? wallet.userId.toString() : null;
};

const UserWallet = mongoose.model<IUserWallet>('UserWallet', WalletSchema);

// Export the schema only, not as a model
export { UserWallet };
