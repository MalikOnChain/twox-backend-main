import cron from 'node-cron';

import Notification from '@/models/notification/Notification';
import { logger } from '@/utils/logger';

export class NotificationCleanupService {
  constructor() {
    this.cleanupSchedule = null;
    // By default, run daily at 3 AM
    this.cronExpression = process.env.NOTIFICATION_CLEANUP_CRON || '0 3 * * *';
  }

  /**
   * Start the cleanup scheduler
   */
  start() {
    logger.info(`Starting notification cleanup scheduler with cron: ${this.cronExpression}`);

    this.cleanupSchedule = cron.schedule(this.cronExpression, async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error('Error during notification cleanup:', error);
      }
    });

    return this;
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (this.cleanupSchedule) {
      this.cleanupSchedule.stop();
      this.cleanupSchedule = null;
      logger.info('Notification cleanup scheduler stopped');
    }
  }

  /**
   * Perform the actual cleanup operation
   */
  async performCleanup() {
    const now = new Date();
    logger.info(`Starting notification cleanup at ${now.toISOString()}`);

    try {
      // Delete expired notifications (those past their expiresAt date)
      const expiredResult = await Notification.deleteMany({
        expiresAt: { $lt: now },
      });

      logger.info(`Deleted ${expiredResult.deletedCount} expired notifications`);

      // Physical deletion of soft-deleted notifications older than 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deletedResult = await Notification.deleteMany({
        isDeleted: true,
        updatedAt: { $lt: ninetyDaysAgo },
      });

      logger.info(`Permanently deleted ${deletedResult.deletedCount} soft-deleted notifications older than 90 days`);

      // Optionally, archive read notifications older than X days to another collection
      // This would require setting up a separate archive collection

      return {
        expiredCount: expiredResult.deletedCount,
        deletedCount: deletedResult.deletedCount,
        timestamp: now,
      };
    } catch (error) {
      logger.error('Error performing notification cleanup:', error);
      throw error;
    }
  }

  /**
   * Run a manual cleanup operation
   */
  async runManualCleanup() {
    try {
      return await this.performCleanup();
    } catch (error) {
      logger.error('Error running manual notification cleanup:', error);
      throw error;
    }
  }
}

const notificationCleanupService = new NotificationCleanupService();
export default notificationCleanupService;
