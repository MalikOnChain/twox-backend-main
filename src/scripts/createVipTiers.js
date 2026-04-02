import mongoose from 'mongoose';
import config from '@/config/index';

import VipTier from '@/models/vip/VipTier';
import { VIP_TIERS } from '@/types/vip/vip';
import { logger } from '@/utils/logger';

export async function seedVipTiers() {
  try {
    // Connect to database
    await mongoose.connect(config.database.mongoURI);
    logger.info('Connected to MongoDB');

    logger.info('Starting VIP tiers seeding...');

    // Clear existing VIP tiers
    await VipTier.deleteMany({});
    logger.info('Cleared existing VIP tiers');

    // Transform the VIP_TIERS data to match our schema with levels
    // Each tier will have 3 levels (I, II, III) with increasing XP requirements
    const vipTiersData = Object.entries(VIP_TIERS).map(([key, tier], index) => {
      const baseXP = tier.minWager || 0; // Use minWager as base XP
      const levels = [
        {
          level: 1,
          minXP: baseXP,
          icon: tier.icon,
          name: `${tier.name} I`,
        },
        {
          level: 2,
          minXP: baseXP + (baseXP * 0.5), // 50% more XP for level II
          icon: tier.icon,
          name: `${tier.name} II`,
        },
        {
          level: 3,
          minXP: baseXP * 2, // 2x XP for level III
          icon: tier.icon,
          name: `${tier.name} III`,
        },
      ];

      return {
        name: tier.name,
        icon: tier.icon,
        downgradePeriod: tier.downgradePeriod || 0,
        levels: levels,
      };
    });

    logger.info(`Prepared ${vipTiersData.length} VIP tiers with levels`);
    
    // Insert the transformed data
    const result = await VipTier.insertMany(vipTiersData);
    logger.info(`✅ Successfully seeded ${result.length} VIP tiers`);

    // Display summary
    logger.info('\n=== VIP Tiers Summary ===');
    for (const tier of result) {
      logger.info(`${tier.name}: ${tier.levels.length} levels`);
      tier.levels.forEach(level => {
        logger.info(`  - ${level.name}: ${level.minXP} XP`);
      });
    }

    // eslint-disable-next-line no-process-exit
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding VIP tiers:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }
}

// Execute the seed function
seedVipTiers().catch((error) => {
  logger.error('Failed to seed VIP tiers:', error);
  process.exit(1);
});
