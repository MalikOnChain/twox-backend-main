import GameTransaction from '@/models/transactions/GameTransactions';
import User from '@/models/users/User';
import { logger } from '@/utils/logger';

export async function cleanGameTransactions() {
  try {
    logger.info('Connected to MongoDB');

    // Get all unique userIds from gameTransactions
    const gameTransactions = await GameTransaction.distinct('userId');

    logger.info(`Found ${gameTransactions.length} unique users in gameTransactions`);

    // Get all existing user IDs
    const existingUsers = await User.distinct('_id');
    logger.info(`Found ${existingUsers.length} existing users in User collection`);

    // Find userIds in gameTransactions that don't exist in User collection
    const nonExistentUserIds = gameTransactions.filter(
      (userId) => !existingUsers.some((existingId) => existingId.toString() === userId.toString())
    );

    if (nonExistentUserIds.length === 0) {
      logger.info('No transactions with non-existent users found');
      return;
    }

    logger.info(`Found ${nonExistentUserIds.length} transactions with non-existent users`);

    // Delete transactions with non-existent users
    const deleteResult = await GameTransaction.deleteMany({
      userId: { $in: nonExistentUserIds },
    });

    logger.info(`Successfully deleted ${deleteResult.deletedCount} transactions`);
  } catch (error) {
    logger.error('Error cleaning gameTransactions:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    logger.info('MongoDB connection closed');
  }
}

export default cleanGameTransactions;
