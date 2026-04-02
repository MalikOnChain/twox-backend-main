// src/models/v2/bonus/BonusSettings.js
import mongoose from 'mongoose';

const BonusSettingsSchema = new mongoose.Schema<IBonusSettings>(
  {
    bonusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bonuses',
      required: true,
      unique: true,
      comment: 'Reference to the bonus',
    },

    // Claim Method and Automation
    claimMethod: {
      type: String,
      enum: ['auto', 'manual', 'code'],
      default: 'manual',
      comment: 'How the bonus can be claimed',
    },

    // Timing Settings
    timingSettings: {
      cooldownPeriod: {
        type: Number,
        min: 0,
        comment: 'Cooldown between claims in hours',
      },
      claimWindow: {
        type: Number,
        comment: 'Time window to claim bonus after becoming eligible (hours)',
      },
      autoExpiry: {
        type: Number,
        comment: 'Auto-expire unclaimed bonus after X hours',
      },
    },

    // Wagering Configuration
    wageringSettings: {
      contributionRates: {
        slots: {
          type: Number,
          default: 1.0,
          min: 0,
          max: 1,
          comment: 'Slots contribution to wagering (0.0 to 1.0)',
        },
        tableGames: {
          type: Number,
          default: 0.1,
          min: 0,
          max: 1,
          comment: 'Table games contribution to wagering',
        },
        liveGames: {
          type: Number,
          default: 0.1,
          min: 0,
          max: 1,
          comment: 'Live games contribution to wagering',
        },
        crash: {
          type: Number,
          default: 0.8,
          min: 0,
          max: 1,
          comment: 'Crash games contribution to wagering',
        },
      },
      maxBetLimit: {
        type: Number,
        comment: 'Maximum bet amount when using bonus funds',
      },
      restrictedGames: [
        {
          type: String,
          comment: 'Game IDs that are restricted when using bonus',
        },
      ],
      wageringTimeLimit: {
        type: Number,
        comment: 'Time limit to complete wagering (hours)',
      },
    },

    // Stacking and Combination Rules
    stackingRules: {
      canStackWithOtherBonuses: {
        type: Boolean,
        default: false,
        comment: 'Whether this bonus can be used with other bonuses',
      },
      allowedStackingTypes: [
        {
          type: String,
          comment: 'Bonus types this can stack with',
        },
      ],
      maxStackingValue: {
        type: Number,
        comment: 'Maximum total bonus value when stacking',
      },
    },

    // Forfeiture Rules
    forfeitureRules: {
      forfeitOnWithdrawal: {
        type: Boolean,
        default: true,
        comment: 'Forfeit bonus on withdrawal attempt',
      },
      forfeitOnLargeWin: {
        threshold: {
          type: Number,
          comment: 'Forfeit if single win exceeds this amount',
        },
        enabled: {
          type: Boolean,
          default: false,
        },
      },
      partialForfeitureAllowed: {
        type: Boolean,
        default: false,
        comment: 'Allow partial forfeiture of bonus',
      },
    },

    // Cashout and Withdrawal Settings
    withdrawalSettings: {
      maxCashoutMultiplier: {
        type: Number,
        comment: 'Maximum cashout as multiplier of bonus amount',
      },
      minBalanceForWithdrawal: {
        type: Number,
        comment: 'Minimum balance required for withdrawal',
      },
      withdrawalMethods: [
        {
          type: String,
          comment: 'Allowed withdrawal methods for bonus winnings',
        },
      ],
    },

    // Notification Settings
    notificationSettings: {
      sendClaimNotification: {
        type: Boolean,
        default: true,
        comment: 'Send notification when bonus is claimed',
      },
      sendExpiryReminder: {
        type: Boolean,
        default: true,
        comment: 'Send reminder before bonus expires',
      },
      reminderHoursBefore: {
        type: Number,
        default: 24,
        comment: 'Hours before expiry to send reminder',
      },
      sendProgressUpdates: {
        type: Boolean,
        default: false,
        comment: 'Send wagering progress updates',
      },
    },

    // Analytics and Tracking
    trackingSettings: {
      trackConversionRate: {
        type: Boolean,
        default: true,
        comment: 'Track bonus to deposit conversion',
      },
      trackWageringCompletion: {
        type: Boolean,
        default: true,
        comment: 'Track wagering completion rates',
      },
      customTrackingEvents: [
        {
          eventName: String,
          description: String,
          isActive: Boolean,
        },
      ],
    },

    // Abuse Prevention
    abusePreventionSettings: {
      maxClaimsPerIP: {
        type: Number,
        comment: 'Maximum claims per IP address',
      },
      minTimeBetweenClaims: {
        type: Number,
        comment: 'Minimum time between claims in minutes',
      },
      detectMultiAccounting: {
        type: Boolean,
        default: true,
        comment: 'Enable multi-accounting detection',
      },
      requirePhoneVerification: {
        type: Boolean,
        default: false,
        comment: 'Require phone verification to claim',
      },
    },

    // Feature Flags
    featureFlags: {
      enableAdvancedWagering: {
        type: Boolean,
        default: false,
        comment: 'Enable advanced wagering calculations',
      },
      enableAutoForfeiture: {
        type: Boolean,
        default: true,
        comment: 'Enable automatic bonus forfeiture',
      },
      enableProgressiveUnlock: {
        type: Boolean,
        default: false,
        comment: 'Enable progressive unlocking of bonus funds',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Removed duplicate index for bonusId since it's already indexed by unique: true

export default mongoose.model<IBonusSettings>('BonusSettings', BonusSettingsSchema);
