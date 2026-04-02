type UserRole = 'user' | 'gesture' | 'admin';

type VerificationMethod = 'steam' | 'google' | 'discord' | 'telegram' | 'wallet';

type UTMSource =
  | 'google'
  | 'facebook'
  | 'sms'
  | 'email'
  | 'whatsapp'
  | 'telegram'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'twitter'
  | 'linkedin'
  | 'pinterest'
  | 'reddit'
  | 'blog'
  | 'snapchat'
  | 'discord'
  | 'x';

interface IUserBase {
  role: UserRole;
  email?: string;
  googleId?: string;
  discordId?: string;
  telegramId?: string;
  username: string;
  password?: string;
  fullName: string;
  avatar: string;
  isCustomAvatar: boolean;

  // Verification & Security
  verified: VerificationMethod[];
  isEmailVerified: boolean;
  emailVerificationToken: string;
  resetPasswordToken: string;
  resetPasswordExpires: Date;
  isBanned: boolean;
  locked: boolean;

  // Balance & Gaming
  balance: number;
  /** Fystack MPC wallet UUID used for per-user deposit addresses (optional). */
  fystackDepositWalletId?: string;
  lock_bet: boolean;
  lock_transaction: boolean;
  isMuted: boolean;

  // Contact Information
  phoneNumber: string;
  address: string;
  city: string;
  country: string;
  zipCode: string;
  state: string;

  // Brazilian-specific
  CPFNumber: string;

  // Referral System
  referredByTier?: string;
  referredByUser?: string;
  referralCode: string;

  // UTM Tracking
  utm_source?: UTMSource;
  utm_campaign?: string;

  // Game Preferences
  favoriteGames: string[];
  recentGames: Array<{
    gameId: string;
    playedAt: Date;
  }>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  hasPassword?: boolean;
}

// Method interfaces for User instance methods
interface IUserMethods {
  generateReferralCode(): Promise<void>;
  getWalletDepositAddresses(): Promise<IWalletDepositAddresses[]>;
  hasSufficientBalance(amount: number): Promise<boolean>;
  increaseGameTokenBalance(amount: number, type: string, metadata?: Record<string, any>, session?: any): Promise<any>;
  decreaseGameTokenBalance(
    amount: number,
    type: string,
    metadata?: Record<string, any>,
    session?: any
  ): Promise<{ user: IUser; betDetails: any }>;
  getDepositCount(): Promise<number>;
  getTotalDepositAmount(): Promise<number>;
  getLastDepositAmount(): Promise<number>;
}

// Combined interface for User document with methods
interface IUser extends IUserBase, IUserMethods, Mongoose.Document {}
