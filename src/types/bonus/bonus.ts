export enum BonusType {
  // Original types with original format
  WELCOME = 'welcome',
  DEPOSIT = 'deposit',
  RECURRING = 'recurring',
  CUSTOM = 'custom',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  REFERRAL = 'referral',
  WAGER_RACE = 'wager-race',

  FREE_SPINS = 'free-spins',

  // New bonus types following the same kebab-case format
  GAME_SPECIFIC = 'game-specific', // Rewards for playing specific games
  WIN_STREAK = 'win-streak', // Rewards for consecutive wins
  MILESTONE = 'milestone', // Rewards for reaching specific milestones
  LOSS_REBATE = 'loss-rebate', // Rebate for significant losses
  DEPOSIT_SERIES = 'deposit-series', // Series of deposit bonuses
  CHALLENGE = 'challenge', // Multi-part challenges
  TIME_BOOST_CASHBACK = 'time-boost-cashback', // Higher cashback during specific hours
  VIP_LEVEL_UP = 'vip-level-up', // Bonus for reaching new VIP levels
  POINTS_EXCHANGE = 'points-exchange', // Exchange loyalty points for bonus
  REACTIVATION = 'reactivation', // Bonus for returning after inactivity
}

export enum ClaimStatus {
  CAN_CLAIM = 'canClaim',
  CLAIMED = 'claimed',
  CANNOT_CLAIM = 'cannotClaim',
}

export enum ClaimMethod {
  AUTO = 'auto',
  MANUAL = 'manual',
  CODE = 'code',
}

export enum BonusStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  EXPIRED = 'expired',
}

export enum ReferralUserRewardStatus {
  ACTIVE = 1,
  INACTIVE = 0,
}
