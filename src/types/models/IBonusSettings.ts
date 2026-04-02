type ClaimMethod = 'auto' | 'manual' | 'code';

interface TimingSettings {
  cooldownPeriod?: number;
  claimWindow?: number;
  autoExpiry?: number;
}

interface ContributionRates {
  slots: number;
  tableGames: number;
  liveGames: number;
  crash: number;
}

interface WageringSettings {
  contributionRates: ContributionRates;
  maxBetLimit?: number;
  restrictedGames?: string[];
  wageringTimeLimit?: number;
}

interface StackingRules {
  canStackWithOtherBonuses: boolean;
  allowedStackingTypes?: string[];
  maxStackingValue?: number;
}

interface ForfeitureRules {
  forfeitOnWithdrawal: boolean;
  forfeitOnLargeWin?: {
    threshold?: number;
    enabled: boolean;
  };
  partialForfeitureAllowed: boolean;
}

interface WithdrawalSettings {
  maxCashoutMultiplier?: number;
  minBalanceForWithdrawal?: number;
  withdrawalMethods?: string[];
}

interface NotificationSettings {
  sendClaimNotification: boolean;
  sendExpiryReminder: boolean;
  reminderHoursBefore: number;
  sendProgressUpdates: boolean;
}

interface CustomTrackingEvent {
  eventName: string;
  description: string;
  isActive: boolean;
}

interface TrackingSettings {
  trackConversionRate: boolean;
  trackWageringCompletion: boolean;
  customTrackingEvents?: CustomTrackingEvent[];
}

interface AbusePreventionSettings {
  maxClaimsPerIP?: number;
  minTimeBetweenClaims?: number;
  detectMultiAccounting: boolean;
  requirePhoneVerification: boolean;
}

interface FeatureFlags {
  enableAdvancedWagering: boolean;
  enableAutoForfeiture: boolean;
  enableProgressiveUnlock: boolean;
}

interface IBonusSettings extends Mongoose.Document {
  bonusId: Mongoose.ObjectId;

  // Claim Method and Automation
  claimMethod: ClaimMethod;

  // Timing Settings
  timingSettings: TimingSettings;

  // Wagering Configuration
  wageringSettings: WageringSettings;

  // Stacking and Combination Rules
  stackingRules: StackingRules;

  // Forfeiture Rules
  forfeitureRules: ForfeitureRules;

  // Cashout and Withdrawal Settings
  withdrawalSettings: WithdrawalSettings;

  // Notification Settings
  notificationSettings: NotificationSettings;

  // Analytics and Tracking
  trackingSettings: TrackingSettings;

  // Abuse Prevention
  abusePreventionSettings: AbusePreventionSettings;

  // Feature Flags
  featureFlags: FeatureFlags;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
