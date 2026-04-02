import Notification from '@/models/notification/Notification';
import NotificationPreferences from '@/models/notification/NotificationPreference';
import { Time } from '@/utils/helpers/moment';
import { logger } from '@/utils/logger';

export class NotificationService {
  static instance = null;

  constructor() {
    if (NotificationService.instance) {
      return NotificationService.instance;
    }

    this.notificationTemplates = this.initTemplates();
    this._socketController = null; // Lazy loaded socket controller
    NotificationService.instance = this;
  }

  // Add getter for socket controller
  get socketController() {
    if (!this._socketController) {
      this._socketController = (async () => {
        const { default: notificationSocket } = await import('@/controllers/SocketControllers/notification-socket');

        logger.debug('notificationSocket', notificationSocket);
        return notificationSocket;
      })();
    }
    return this._socketController;
  }

  /**
   * Initialize notification templates with placeholders
   * @returns {Object} Template mapping
   */
  initTemplates() {
    return {
      DEPOSIT_SUCCESS: {
        title: 'Deposit Successful',
        message: 'Your deposit of {{amount}} {{currency}} has been successfully processed.',
      },
      WITHDRAWAL_SUCCESS: {
        title: 'Withdrawal Successful',
        message: 'Your withdrawal of {{amount}} {{currency}} has been successfully processed.',
      },
      WITHDRAWAL_PENDING: {
        title: 'Withdrawal Pending',
        message: 'Your withdrawal request of {{amount}} {{currency}} is being processed.',
      },
      BONUS_RECEIVED: {
        title: 'Bonus Received',
        message: 'You have received a bonus of {{amount}} {{currency}}!',
      },
      CASHBACK_RECEIVED: {
        title: 'Cashback Received',
        message: 'You have received a cashback of {{amount}} {{currency}}!',
      },
      GAME_WIN: {
        title: 'Game Win',
        message: 'Congratulations! You won {{amount}} {{currency}} playing {{game}}!',
      },
      WAGER_RACE_REWARD: {
        title: 'Wager Race Reward',
        message: 'You have received {{amount}} {{currency}} from the Wager Race!',
      },
      REFERRAL_REWARD: {
        title: 'Referral Reward',
        message: 'You have received a referral reward of {{amount}} {{currency}}!',
      },
      VIP_LEVEL_UP: {
        title: 'VIP Level Up',
        message: 'Congratulations! You have reached VIP level {{level}}!',
      },
      SYSTEM_ANNOUNCEMENT: {
        title: 'System Announcement',
        message: '{{message}}',
      },
      PROMOTION: {
        title: '{{title}}',
        message: '{{message}}',
      },
      MAINTENANCE: {
        title: 'System Maintenance',
        message: '{{message}}',
      },
      CUSTOM: {
        title: '{{title}}',
        message: '{{message}}',
      },
      BONUS_WAGERING_PROGRESS: {
        title: 'Bonus Wagering Progress',
        message:
          'You have completed {{progress}}% of your {{bonusType}} bonus wagering requirement. {{#if remaining}}Remaining: {{remaining}}{{/if}}',
      },
      BONUS_WAGERING_COMPLETED: {
        title: 'Bonus Wagering Completed!',
        message:
          'Congratulations! You have completed the wagering requirement for your {{bonusType}} bonus. Your winnings are now unlocked!',
      },
      BONUS_EXPIRING_SOON: {
        title: 'Bonus Expiring Soon',
        message:
          'Your {{bonusType}} bonus will expire in {{timeRemaining}}. Complete the wagering requirement to unlock your winnings!',
      },
      BONUS_EXPIRED: {
        title: 'Bonus Expired',
        message: 'Your {{bonusType}} bonus has expired. Any remaining bonus balance has been forfeited.',
      },
    };
  }

  /**
   * Get singleton instance
   * @returns {NotificationService} Singleton instance
   */
  static getInstance() {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Replace placeholders in template string
   * @param {string} template - Template string with placeholders
   * @param {Object} data - Data to replace placeholders
   * @returns {string} Formatted string
   */
  formatTemplate(template, data) {
    return template.replace(/{{(\w+)}}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Get user notification preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User notification preferences
   */
  async getUserPreferences(userId) {
    try {
      let preferences = await NotificationPreferences.findOne({ userId });

      if (!preferences) {
        // Create default preferences if none exist
        preferences = await NotificationPreferences.create({ userId });
      }

      return preferences;
    } catch (error) {
      logger.error(`Error getting user preferences: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   * @param {string} userId - User ID
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  async updateUserPreferences(userId, updates) {
    try {
      const preferences = await NotificationPreferences.findOneAndUpdate(
        { userId },
        { $set: updates },
        { new: true, upsert: true }
      );

      return preferences;
    } catch (error) {
      logger.error(`Error updating user preferences: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {string} channel - Notification channel (email, push, inApp)
   * @returns {Promise<boolean>} Whether notification should be sent
   */
  async shouldSendNotification(userId, type, channel) {
    try {
      const preferences = await this.getUserPreferences(userId);

      // Check if channel is enabled
      if (!preferences.preferences[channel].enabled) {
        return false;
      }

      // Check if notification type is enabled for channel
      if (!preferences.preferences[channel].types[type]) {
        return false;
      }

      // Check quiet hours
      if (preferences.quietHours.enabled && Time.isWithinQuietHours(preferences.quietHours)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error checking notification preferences: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Create a notification with channel-specific delivery
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {Object} data - Notification data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(userId, type, data = {}, options = {}) {
    try {
      const template = this.notificationTemplates[type] || this.notificationTemplates.CUSTOM;
      const title = this.formatTemplate(options.title || template.title, data);
      const message = this.formatTemplate(options.message || template.message, data);

      const notificationData = {
        userId,
        type,
        title,
        message,
        data,
        importance: options.importance || 'MEDIUM',
      };

      if (options.expiresAt) {
        notificationData.expiresAt = options.expiresAt;
      }

      const notification = await Notification.create(notificationData);

      // Check preferences and send through appropriate channels
      const channels = ['email', 'push', 'inApp'];
      for (const channel of channels) {
        if (await this.shouldSendNotification(userId, type, channel)) {
          switch (channel) {
            case 'inApp':
              this.emitNotification(userId, notification);
              break;
            case 'email':
              // TODO: Implement email notification service
              break;
            case 'push':
              // TODO: Implement push notification service
              break;
          }
        }
      }

      return notification;
    } catch (error) {
      logger.error(`Error creating notification: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Create a system announcement for all users
   * @param {string} message - Announcement message
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created notification
   */
  async createSystemAnnouncement(message, options = {}) {
    try {
      // For system announcements, we'll create a "template" notification
      // that we'll display to all users but not store individually for each
      const notification = await Notification.create({
        userId: 'SYSTEM', // Special identifier for system-wide notifications
        type: 'SYSTEM_ANNOUNCEMENT',
        title: options.title || 'System Announcement',
        message,
        data: options.data || {},
        importance: options.importance || 'MEDIUM',
        expiresAt: options.expiresAt || undefined,
      });

      // Emit to all connected users
      (await this.socketController).emitNotificationToAll({
        id: notification._id,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
        importance: notification.importance,
        data: notification.data,
      });

      return notification;
    } catch (error) {
      logger.error(`Error creating system announcement: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications with pagination
   */
  async getUserNotifications(userId, options = {}) {
    try {
      return await Notification.getUserNotifications(userId, options);
    } catch (error) {
      logger.error(`Error getting user notifications: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (error) {
      logger.error(`Error getting unread count: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId, userId) {
    try {
      const updatedNotification = await Notification.markAsRead(notificationId, userId);

      if (updatedNotification) {
        // Emit updated notification count
        const unreadCount = await this.getUnreadCount(userId);
        (await this.socketController).emitNotificationCount(userId, unreadCount);
      }

      return updatedNotification;
    } catch (error) {
      logger.error(`Error marking notification as read: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.markAllAsRead(userId);

      // Emit updated notification count (should be 0)
      (await this.socketController).emitNotificationCount(userId, 0);

      return result;
    } catch (error) {
      logger.error(`Error marking all notifications as read: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deleted notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const result = await Notification.deleteNotification(notificationId, userId);

      if (result) {
        // Emit updated notification count
        const unreadCount = await this.getUnreadCount(userId);
        (await this.socketController).emitNotificationCount(userId, unreadCount);
      }

      return result;
    } catch (error) {
      logger.error(`Error deleting notification: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Emit notification via socket
   * @param {string} userId - User ID
   * @param {Object} notification - Notification object
   */
  async emitNotification(userId, notification) {
    try {
      logger.debug(userId, notification, 'emitNotification');

      (await this.socketController).emitNotification(userId, {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
        importance: notification.importance,
        data: notification.data,
        isRead: notification.isRead,
      });
    } catch (error) {
      logger.error(`Error emitting notification: ${error.message}`, error);
    }
  }

  /**
   * Get notification templates
   * @returns {Object} Notification templates
   */
  getTemplates() {
    return this.notificationTemplates;
  }

  /**
   * Add or update a notification template
   * @param {string} type - Notification type
   * @param {Object} template - Template object with title and message
   */
  addTemplate(type, template) {
    if (!type || !template || !template.title || !template.message) {
      throw new Error('Invalid template format');
    }

    this.notificationTemplates[type] = {
      title: template.title,
      message: template.message,
    };
  }
}

export default new NotificationService();
