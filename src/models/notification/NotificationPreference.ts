import mongoose from 'mongoose';

const notificationPreferencesSchema = new mongoose.Schema<INotificationPreference>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    preferences: {
      email: {
        enabled: { type: Boolean, default: true },
        types: {
          DEPOSIT_SUCCESS: { type: Boolean, default: true },
          WITHDRAWAL_SUCCESS: { type: Boolean, default: true },
          WITHDRAWAL_PENDING: { type: Boolean, default: true },
          BONUS_RECEIVED: { type: Boolean, default: true },
          CASHBACK_RECEIVED: { type: Boolean, default: true },
          GAME_WIN: { type: Boolean, default: true },
          WAGER_RACE_REWARD: { type: Boolean, default: true },
          REFERRAL_REWARD: { type: Boolean, default: true },
          VIP_LEVEL_UP: { type: Boolean, default: true },
          SYSTEM_ANNOUNCEMENT: { type: Boolean, default: true },
          PROMOTION: { type: Boolean, default: true },
          MAINTENANCE: { type: Boolean, default: true },
        },
      },
      push: {
        enabled: { type: Boolean, default: true },
        types: {
          DEPOSIT_SUCCESS: { type: Boolean, default: true },
          WITHDRAWAL_SUCCESS: { type: Boolean, default: true },
          WITHDRAWAL_PENDING: { type: Boolean, default: true },
          BONUS_RECEIVED: { type: Boolean, default: true },
          CASHBACK_RECEIVED: { type: Boolean, default: true },
          GAME_WIN: { type: Boolean, default: true },
          WAGER_RACE_REWARD: { type: Boolean, default: true },
          REFERRAL_REWARD: { type: Boolean, default: true },
          VIP_LEVEL_UP: { type: Boolean, default: true },
          SYSTEM_ANNOUNCEMENT: { type: Boolean, default: true },
          PROMOTION: { type: Boolean, default: true },
          MAINTENANCE: { type: Boolean, default: true },
        },
      },
      inApp: {
        enabled: { type: Boolean, default: true },
        types: {
          DEPOSIT_SUCCESS: { type: Boolean, default: true },
          WITHDRAWAL_SUCCESS: { type: Boolean, default: true },
          WITHDRAWAL_PENDING: { type: Boolean, default: true },
          BONUS_RECEIVED: { type: Boolean, default: true },
          CASHBACK_RECEIVED: { type: Boolean, default: true },
          GAME_WIN: { type: Boolean, default: true },
          WAGER_RACE_REWARD: { type: Boolean, default: true },
          REFERRAL_REWARD: { type: Boolean, default: true },
          VIP_LEVEL_UP: { type: Boolean, default: true },
          SYSTEM_ANNOUNCEMENT: { type: Boolean, default: true },
          PROMOTION: { type: Boolean, default: true },
          MAINTENANCE: { type: Boolean, default: true },
        },
      },
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '22:00' }, // 24-hour format
      end: { type: String, default: '08:00' }, // 24-hour format
      timezone: { type: String, default: 'UTC' },
    },
  },
  {
    timestamps: true,
  }
);

// Export model
const NotificationPreferences = mongoose.model<INotificationPreference>(
  'NotificationPreferences',
  notificationPreferencesSchema
);

export default NotificationPreferences;
