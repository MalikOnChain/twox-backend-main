type NotificationTypePreference =
  | 'DEPOSIT_SUCCESS'
  | 'WITHDRAWAL_SUCCESS'
  | 'WITHDRAWAL_PENDING'
  | 'BONUS_RECEIVED'
  | 'CASHBACK_RECEIVED'
  | 'GAME_WIN'
  | 'WAGER_RACE_REWARD'
  | 'REFERRAL_REWARD'
  | 'VIP_LEVEL_UP'
  | 'SYSTEM_ANNOUNCEMENT'
  | 'PROMOTION'
  | 'MAINTENANCE';

interface NotificationTypePreferences {
  DEPOSIT_SUCCESS: boolean;
  WITHDRAWAL_SUCCESS: boolean;
  WITHDRAWAL_PENDING: boolean;
  BONUS_RECEIVED: boolean;
  CASHBACK_RECEIVED: boolean;
  GAME_WIN: boolean;
  WAGER_RACE_REWARD: boolean;
  REFERRAL_REWARD: boolean;
  VIP_LEVEL_UP: boolean;
  SYSTEM_ANNOUNCEMENT: boolean;
  PROMOTION: boolean;
  MAINTENANCE: boolean;
}

interface ChannelPreferences {
  enabled: boolean;
  types: NotificationTypePreferences;
}

interface QuietHours {
  enabled: boolean;
  start: string; // 24-hour format
  end: string; // 24-hour format
  timezone: string;
}

interface NotificationPreferences {
  email: ChannelPreferences;
  push: ChannelPreferences;
  inApp: ChannelPreferences;
}

interface INotificationPreference extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  preferences: NotificationPreferences;
  quietHours: QuietHours;
  createdAt: Date;
  updatedAt: Date;
}
