import mongoose from 'mongoose';
import config from '@/config/index';
import { logger } from '@/utils/logger';
import VipUser from '@/models/vip/VipUser';
import User from '@/models/users/User';
import VipTier from '@/models/vip/VipTier';

/**
 * Assign all users to the first VIP tier if they don't have one
 */
async function assignVipUsers() {
  try {
    await mongoose.connect(config.database.mongoURI);
    logger.info('Connected to MongoDB');

    // Get the first tier (Novice/lowest tier)
    const firstTier = await VipTier.findOne().sort({ minWager: 1 });
    if (!firstTier) {
      logger.error('No VIP tiers found. Please run createVipTiers.js first.');
      process.exit(1);
    }

    logger.info(`Using tier: ${firstTier.name} (${firstTier._id})`);

    // Get all users
    const users = await User.find();
    logger.info(`Found ${users.length} users`);

    let created = 0;
    let existing = 0;

    for (const user of users) {
      const vipUser = await VipUser.findOne({ userId: user._id });
      
      if (!vipUser) {
        await VipUser.create({
          userId: user._id,
          loyaltyTierId: firstTier._id,
          currentTier: firstTier.name,
          currentLevel: firstTier.name + ' I', // Default to first level
          totalWagered: 0,
          totalXP: 0,
        });
        created++;
        logger.info(`✅ Created VipUser for: ${user.username}`);
      } else {
        existing++;
      }
    }

    logger.info('\n=== Summary ===');
    logger.info(`Created: ${created} VipUsers`);
    logger.info(`Already existed: ${existing} VipUsers`);
    logger.info(`Total: ${users.length} users`);

    process.exit(0);
  } catch (error) {
    logger.error('Failed to assign VIP users:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

assignVipUsers();

