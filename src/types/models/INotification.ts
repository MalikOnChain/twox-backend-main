type NotificationType =
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
  | 'MAINTENANCE'
  | 'CUSTOM';

type NotificationImportance = 'HIGH' | 'MEDIUM' | 'LOW';

interface NotificationData {
  amount?: number;
  gameId?: string;
  winAmount?: number;
  [key: string]: any;
}

interface INotification extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  isRead: boolean;
  isDeleted: boolean;
  expiresAt: Date;
  importance: NotificationImportance;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface INotificationModel {
  getUnreadCount(userId: Mongoose.ObjectId): Promise<number>;
  getUserNotifications(
    userId: Mongoose.ObjectId,
    options?: {
      limit?: number;
      skip?: number;
      includeRead?: boolean;
      type?: NotificationType;
      sort?: any;
    }
  ): Promise<{
    notifications: INotification[];
    pagination: {
      total: number;
      limit: number;
      skip: number;
      hasMore: boolean;
    };
  }>;
  markAsRead(notificationId: Mongoose.ObjectId, userId: Mongoose.ObjectId): Promise<INotification>;
  markAllAsRead(userId: Mongoose.ObjectId): Promise<any>;
  deleteNotification(notificationId: Mongoose.ObjectId, userId: Mongoose.ObjectId): Promise<INotification>;
  cleanupExpiredNotifications(): Promise<any>;
}
