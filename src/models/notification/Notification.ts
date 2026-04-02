import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema<INotification>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'DEPOSIT_SUCCESS',
        'WITHDRAWAL_SUCCESS',
        'WITHDRAWAL_PENDING',
        'BONUS_RECEIVED',
        'CASHBACK_RECEIVED',
        'GAME_WIN',
        'WAGER_RACE_REWARD',
        'REFERRAL_REWARD',
        'VIP_LEVEL_UP',
        'SYSTEM_ANNOUNCEMENT',
        'PROMOTION',
        'MAINTENANCE',
        'CUSTOM',
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (this: any, data: any) {
          // Add type-specific validation based on notification type
          switch (this.type) {
            case 'DEPOSIT_SUCCESS':
            case 'WITHDRAWAL_SUCCESS':
              return data.amount && typeof data.amount === 'number';
            case 'GAME_WIN':
              return data.gameId && data.winAmount;
            default:
              return true;
          }
        },
        message: 'Invalid data structure for notification type',
      },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: function () {
        // Default expiration is 30 days after creation
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      },
    },
    importance: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
  },
  {
    timestamps: true,
  }
);

// Add TTL index for automatic cleanup of expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Add index for efficient querying
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, isDeleted: 1, createdAt: -1 });

// Static methods
notificationSchema.statics.getUnreadCount = async function (userId: mongoose.Types.ObjectId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid userId');
    }
    return await this.countDocuments({
      userId,
      isRead: false,
      isDeleted: false,
      expiresAt: { $gt: new Date() },
    });
  } catch (error: any) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }
};

notificationSchema.statics.getUserNotifications = async function (userId: mongoose.Types.ObjectId, options: any = {}) {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid userId');
    }

    const { limit = 20, skip = 0, includeRead = true, type = null, sort = { createdAt: -1 } } = options;

    const query: any = {
      userId,
      isDeleted: false,
      expiresAt: { $gt: new Date() },
    };

    if (!includeRead) {
      query.isRead = false;
    }

    if (type) {
      query.type = type;
    }

    const [notifications, total] = await Promise.all([
      this.find(query).sort(sort).skip(skip).limit(limit).lean(),
      this.countDocuments(query),
    ]);

    return {
      notifications: notifications || [],
      pagination: {
        total: total || 0,
        limit,
        skip,
        hasMore: (total || 0) > skip + limit,
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to get user notifications: ${error.message}`);
  }
};

notificationSchema.statics.markAsRead = async function (
  notificationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid notificationId or userId');
    }
    const notification = await this.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) {
      throw new Error('Notification not found');
    }
    return notification;
  } catch (error: any) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};

notificationSchema.statics.markAllAsRead = async function (userId: mongoose.Types.ObjectId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid userId');
    }
    const result = await this.updateMany({ userId, isRead: false, isDeleted: false }, { $set: { isRead: true } });
    return result;
  } catch (error: any) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
};

notificationSchema.statics.deleteNotification = async function (
  notificationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid notificationId or userId');
    }
    const notification = await this.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!notification) {
      throw new Error('Notification not found');
    }
    return notification;
  } catch (error: any) {
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
};

// Add method to clean up expired notifications
notificationSchema.statics.cleanupExpiredNotifications = async function () {
  try {
    const result = await this.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    return result;
  } catch (error: any) {
    throw new Error(`Failed to cleanup expired notifications: ${error.message}`);
  }
};

const Notification = mongoose.model<INotification, INotificationModel>('Notification', notificationSchema);

export default Notification;
