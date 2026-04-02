// Import Dependencies
import mongoose from 'mongoose';

import customerIO from '@/services/CustomerIO/CustomerIO.service';
import { BALANCE_UPDATE_TYPES } from '@/types/balance/balance';
import { SERVICE_TRANSACTION_TYPES } from '@/types/bonus/service';
import { WITHDRAWAL_TYPES } from '@/types/crypto/crypto';
import { logger } from '@/utils/logger';

import WalletDepositAddresses, { createDepositAddressMiddleware } from '../crypto/WalletDepositAddresses';
import TierAffiliate from '../tier-affiliate/TierAffiliate';
import VipTier from '../vip/VipTier';
import VipUser from '../vip/VipUser';

const Schema = mongoose.Schema;

const UserSchema = new Schema<IUser>(
  {
    // Roles (e.g., 'user', 'admin', 'gesture', etc.)
    role: {
      type: String,
      default: 'user',
      enum: ['user', 'gesture', 'admin'], // You can add more roles here
      required: true,
    },
    // User's email address (unique and required)
    email: {
      type: String,
      unique: true,
      lowercase: true,
      sparse: true,
      match: [/^[\w.-]+@[a-zA-Z0-9]+\.[a-zA-Z]{2,4}$/, 'Please fill a valid email address'],
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    discordId: {
      type: String,
      unique: true,
      sparse: true,
    },
    telegramId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Username (unique and required)
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [16, 'Username cannot exceed 16 characters'],
    },
    // Password (hashed)
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters long'],
    },
    // Full name (optional)
    fullName: {
      type: String,
      default: '',
    },

    // Profile avatar (URL or path to the image)
    avatar: {
      type: String,
      default: 'default-avatar.png', // Provide a default avatar image
    },

    // Verified status
    verified: {
      type: [String],
      default: [], // Default to an empty array
      enum: ['steam', 'google', 'discord', 'telegram', 'wallet'], // You can add more verification methods here
    },

    isCustomAvatar: {
      type: Boolean,
      default: false, // Provide a default avatar image
    },
    // Game Token amount
    balance: {
      type: Number,
      default: 0,
    },

    fystackDepositWalletId: {
      type: String,
      default: '',
    },

    phoneNumber: {
      type: String,
      default: '',
    },

    address: {
      type: String,
      default: '',
    },

    city: {
      type: String,
      default: '',
    },

    country: {
      type: String,
      default: '',
    },

    zipCode: {
      type: String,
      default: '',
    },

    state: {
      type: String,
      default: '',
    },

    lock_bet: {
      type: Boolean,
      default: false,
    },
    lock_transaction: {
      type: Boolean,
      default: false,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    // Email verification status
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Token for email verification
    emailVerificationToken: {
      type: String,
      default: '',
    },
    // Password reset token (optional)
    resetPasswordToken: {
      type: String,
      default: '',
    },
    resetPasswordExpires: {
      type: Date,
      default: Date.now,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    referredByTier: { type: mongoose.Schema.Types.ObjectId, ref: 'TierAffiliate' },
    referredByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCode: {
      type: String,
      default: '',
    },
    // UTM tracking fields
    utm_source: {
      type: String,
      enum: [
        'google',
        'facebook',
        'sms',
        'email',
        'whatsapp',
        'telegram',
        'instagram',
        'youtube',
        'tiktok',
        'twitter',
        'linkedin',
        'pinterest',
        'reddit',
        'blog',
        'snapchat',
        'discord',
        'x',
      ],
      sparse: true,
    },
    utm_campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      sparse: true,
    },
    CPFNumber: {
      type: String,
      default: '',
    },
    locked: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Favorite games (array of game IDs)
    favoriteGames: {
      type: [String],
      default: [],
      index: true,
    },
    // Recently played games (array of game IDs with timestamps)
    recentGames: {
      type: [{
        gameId: String,
        playedAt: { type: Date, default: Date.now }
      }],
      default: [],
    },
  },
  {
    timestamps: true, // Automatically manage `createdAt` and `updatedAt`
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

UserSchema.virtual('hasPassword').get(function () {
  return !!this.password;
});

// Add middleware to emit socket event when gameToken balance is modified
if (process.env.CREATE_DEPOSIT_ADDRESS_DISABLE !== 'true') {
  UserSchema.pre('save', createDepositAddressMiddleware);
}

async function ensureDefaultVipTier() {
  let vipTier = await VipTier.findOne({}).limit(1).lean();
  if (vipTier) {
    return vipTier;
  }

  const defaultLevels = [
    { level: 1, minXP: 0, icon: 'default', name: 'Starter I' },
    { level: 2, minXP: 100, icon: 'default', name: 'Starter II' },
    { level: 3, minXP: 250, icon: 'default', name: 'Starter III' },
  ];

  try {
    await VipTier.create({
      name: 'Starter',
      icon: 'default',
      downgradePeriod: 0,
      levels: defaultLevels,
    });
  } catch {
    // Race: another request may have inserted a tier
  }

  vipTier = await VipTier.findOne({}).limit(1).lean();
  if (!vipTier) {
    throw new Error('VipTier not found and could not create default tier');
  }

  logger.warn(
    'No VIP tiers in DB: created minimal "Starter" tier. Run src/scripts/createVipTiers.js for full VIP data.'
  );
  return vipTier;
}

UserSchema.pre('save', async function (next) {
  try {
    if (!this.isNew) {
      return next();
    }

    const vipTier = await ensureDefaultVipTier();

    const existingVipUser = await VipUser.findOne({ userId: this._id });
    if (!existingVipUser) {
      await VipUser.create({
        userId: this._id,
        totalWagered: 0,
        totalXP: vipTier.levels[0].minXP,
        currentTier: vipTier.name,
        currentLevel: vipTier.levels[0].name,
        loyaltyTierId: vipTier._id,
      });
    }

    if (this.email) {
      customerIO.registerWithCustomerIO(
        this._id,
        this.email,
        (this.fullName && this.fullName.length > 1) || this.username
      );
    }

    if (!this.referralCode) {
      await this.generateReferralCode();
    }
    return next();
  } catch (err) {
    logger.error('Error in User pre-save hook:', err);
    return next(err as Error);
  }
});

// Method to generate a unique referral code
UserSchema.methods.generateReferralCode = async function () {
  const tierAffiliate = await TierAffiliate.find();
  const referralCodesTier = tierAffiliate.map((tier) => tier.referralCode);
  const userReferralCodes = await User.find({ referralCode: { $ne: '' } }).select('referralCode');
  const referralCodes = [...referralCodesTier, ...userReferralCodes];

  let generatedCode = '';
  let uniqueCode = false;
  while (!uniqueCode) {
    generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    if (!referralCodes.includes(generatedCode)) {
      uniqueCode = true;
      break;
    }
  }

  this.referralCode = generatedCode;
};

// Method to get user's active wallet addresses
UserSchema.methods.getWalletDepositAddresses = async function () {
  return WalletDepositAddresses.getUserAddresses(this._id);
};

UserSchema.methods.hasSufficientBalance = async function (amount: number) {
  if (amount == null) {
    throw new Error('Amount must be provided');
  }
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    throw new Error('Amount must be a valid number');
  }

  if (numericAmount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  return this.balance >= numericAmount;
};

// Add balance management methods
UserSchema.methods.increaseGameTokenBalance = async function (
  amount: number,
  type: string,
  metadata: Record<string, any> = {},
  session?: any
) {
  if (isNaN(amount) || amount < 0) {
    throw new Error('Invalid amount for balance increase');
  }

  if (!type || typeof type !== 'string') {
    throw new Error('Transaction type is required');
  }

  try {
    if (metadata && typeof metadata !== 'object') {
      throw new Error('Metadata must be an object');
    }

    // Import BalanceManager here to avoid circular dependency
    const BalanceManager = (await import('../../services/balance/BalanceManager.service')).default;
    const balanceManager = BalanceManager;

    if (type === SERVICE_TRANSACTION_TYPES.BONUS) {
      return await balanceManager.addBonus(
        this,
        {
          bonusId: metadata.bonus._id,
          amount: amount,
          wageringMultiplier: metadata.bonus.wageringMultiplier || 30,
          expiryDays: metadata.bonus.expiryDays || 7,
          type: metadata.bonus.type,
        },
        session
      );
    } else if (type === BALANCE_UPDATE_TYPES.GAME) {
      if (metadata.betDetails) {
        return await balanceManager.processWin(this, amount, metadata, session);
      } else {
        return await balanceManager.increaseRealBalance(this, amount, type, session, {}, false);
      }
    } else if (type === BALANCE_UPDATE_TYPES.DEPOSIT) {
      return await balanceManager.increaseRealBalance(this, amount, type, session, {}, true);
    } else if (type === SERVICE_TRANSACTION_TYPES.CASHBACK) {
      return await balanceManager.increaseCashbackBalance(this, amount, metadata.wagerMultiplier, session);
    } else if (type === SERVICE_TRANSACTION_TYPES.FREE_SPINS) {
      return await balanceManager.increaseFreeSpinsBalance(this, amount, session);
    } else {
      return await balanceManager.increaseRealBalance(this, amount, type, session, {}, false);
    }
  } catch (error) {
    console.error(`Error increasing game token balance: ${(error as Error).message}`);
    throw error;
  }
};

UserSchema.methods.decreaseGameTokenBalance = async function (
  amount: number,
  type: string,
  metadata: Record<string, any> = {},
  session?: any
) {
  const balanceManager = (await import('../../services/balance/BalanceManager.service')).default;
  logger.info('decreaseGameTokenBalance', { amount, type, metadata });

  if (type === BALANCE_UPDATE_TYPES.GAME) {
    // This is a game bet - need to handle bonuses
    const { user, betDetails } = await balanceManager.processBet(this, amount, metadata, session);

    // Store bet details in the session for later reference when processing win/loss
    if (metadata.storeDetails && session) {
      session.betDetails = betDetails;
    }

    return { user, betDetails };
  } else if (type === BALANCE_UPDATE_TYPES.WITHDRAWAL) {
    // Process withdrawal with bonus checks
    const withdrawalType = metadata.withdrawalType || WITHDRAWAL_TYPES.ALL;
    const result = await balanceManager.processWithdrawal(this, amount, withdrawalType, session);

    if (!result.success) {
      throw new Error((result as any).message);
    }

    return { user: (result as any).user, betDetails: null };
  } else {
    // Default is to deduct from real balance
    const user = await balanceManager.decreaseRealBalance(this, amount, type, session);
    return { user, betDetails: null };
  }
};

// Add these methods to the User schema or class

/**
 * Get user's deposit count from crypto transactions
 * @returns {Promise<number>} The number of deposits made by the user
 */
UserSchema.methods.getDepositCount = async function () {
  // Use CryptoTransactions model instead of generic Transaction
  const count = await mongoose.model('PixTransaction').countDocuments({
    userId: this._id,
    type: 'transaction',
    status: 1, // Using the appropriate status from TRANSACTION_STATUS
  });

  return count;
};

/**
 * Get user's total deposit amount from crypto transactions
 * @returns {Promise<number>} The total amount deposited by the user
 */
UserSchema.methods.getTotalDepositAmount = async function () {
  // Use CryptoTransactions model with the correct fields
  const result = await mongoose.model('PixTransaction').aggregate([
    {
      $match: {
        userId: this._id,
        type: 'transaction',
        status: 1, // Using the appropriate status from TRANSACTION_STATUS
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' }, // Use exchangedAmount instead of amount
      },
    },
  ]);

  return result.length > 0 ? result[0].totalAmount : 0;
};

/**
 * Get user's last deposit amount from crypto transactions
 * @returns {Promise<number>} The amount of the user's last deposit, or 0 if no deposits found
 */
UserSchema.methods.getLastDepositAmount = async function () {
  // Find the most recent completed deposit from CryptoTransactions
  const lastDeposit = await mongoose
    .model('PixTransaction')
    .findOne({
      userId: this._id,
      type: 'transaction',
      status: 1, // Using the appropriate status from TRANSACTION_STATUS
    })
    .sort({ createdAt: -1 });

  return lastDeposit ? lastDeposit.amount : 0; // Use exchangedAmount instead of amount
};

// Create the User model from the schema
const User = mongoose.model<IUser>('User', UserSchema);

// Export the model to be used in other parts of the application
export default User;
