import mongoose from 'mongoose';
import config from '@/config/index';
import { logger } from '@/utils/logger';
import Bonus from '@/models/bonus/Bonuses';
import BonusTierRewards from '@/models/bonus/BonusTierRewards';
import VipTier from '@/models/vip/VipTier';

/**
 * Seed BonusTierRewards with example data
 */
async function seedTierRewards() {
  try {
    // Connect to database
    await mongoose.connect(config.database.mongoURI);
    logger.info('Connected to MongoDB');

    // Get all VIP tiers
    const tiers = await VipTier.find().sort({ minWager: 1 });
    if (tiers.length === 0) {
      logger.error('No VIP tiers found. Please run createVipTiers.js first.');
      process.exit(1);
    }

    logger.info(`Found ${tiers.length} VIP tiers`);

    // Clear existing tier rewards
    await BonusTierRewards.deleteMany({});
    logger.info('Cleared existing tier rewards');

    // Create sample bonuses for tier rewards
    const bonuses = [];

    // Welcome Bonus for each tier
    for (const tier of tiers) {
      const welcomeBonus = new Bonus({
        name: `${tier.name} Welcome Bonus`,
        description: `Exclusive welcome bonus for ${tier.name} VIP members`,
        type: 'welcome',
        category: 'vip',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 50,
            maxAmount: 100,
          }
        },
        defaultWageringMultiplier: 30,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        maxClaimsPerUser: 1,
      });
      bonuses.push(welcomeBonus);
    }

    // Deposit Bonus for each tier
    for (const tier of tiers) {
      const depositBonus = new Bonus({
        name: `${tier.name} Reload Bonus`,
        description: `Daily reload bonus for ${tier.name} VIP members`,
        type: 'deposit',
        category: 'vip',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 25,
            maxAmount: 200,
          }
        },
        defaultWageringMultiplier: 20,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        maxClaimsPerUser: 30, // Can claim daily
      });
      bonuses.push(depositBonus);
    }

    // Loss Rebate for higher tiers
    const higherTiers = tiers.slice(Math.floor(tiers.length / 2)); // Top 50% of tiers
    for (const tier of higherTiers) {
      const rebateBonus = new Bonus({
        name: `${tier.name} Loss Rebate`,
        description: `Weekly loss rebate for ${tier.name} VIP members`,
        type: 'loss-rebate',
        category: 'vip',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 10,
            maxAmount: 1000,
          }
        },
        defaultWageringMultiplier: 1, // Low wagering for rebates
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        maxClaimsPerUser: 52, // Weekly for a year
      });
      bonuses.push(rebateBonus);
    }

    // Save all bonuses
    const savedBonuses = await Bonus.insertMany(bonuses);
    logger.info(`Created ${savedBonuses.length} tier bonuses`);

    // Create BonusTierRewards
    const tierRewards = [];
    let bonusIndex = 0;

    // Welcome bonuses (one per tier)
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const bonus = savedBonuses[bonusIndex++];
      
      // Scale rewards based on tier level
      const tierMultiplier = (i + 1) / tiers.length; // 0.1 to 1.0
      
      tierRewards.push({
        bonusId: bonus._id,
        tierId: tier._id,
        tierName: tier.name,
        tierLevel: 'I',
        tierReward: {
          cash: {
            percentage: Math.round(50 + (tierMultiplier * 50)), // 50-100%
            maxAmount: Math.round(100 + (tierMultiplier * 900)), // 100-1000 USDT
          }
        },
        tierWageringMultiplier: Math.max(10, 30 - Math.round(tierMultiplier * 15)), // 30x down to 15x
        isActive: true,
        priority: 10,
      });
    }

    // Deposit bonuses (one per tier)
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const bonus = savedBonuses[bonusIndex++];
      
      const tierMultiplier = (i + 1) / tiers.length;
      
      tierRewards.push({
        bonusId: bonus._id,
        tierId: tier._id,
        tierName: tier.name,
        tierLevel: 'II',
        tierReward: {
          cash: {
            percentage: Math.round(25 + (tierMultiplier * 25)), // 25-50%
            maxAmount: Math.round(200 + (tierMultiplier * 800)), // 200-1000 USDT
          }
        },
        tierWageringMultiplier: Math.max(5, 20 - Math.round(tierMultiplier * 10)), // 20x down to 10x
        isActive: true,
        priority: 8,
      });
    }

    // Loss rebates (for higher tiers only)
    for (let i = 0; i < higherTiers.length; i++) {
      const tier = higherTiers[i];
      const bonus = savedBonuses[bonusIndex++];
      
      const tierMultiplier = (i + 1) / higherTiers.length;
      
      tierRewards.push({
        bonusId: bonus._id,
        tierId: tier._id,
        tierName: tier.name,
        tierLevel: 'III',
        tierReward: {
          cash: {
            percentage: Math.round(10 + (tierMultiplier * 10)), // 10-20%
            maxAmount: Math.round(1000 + (tierMultiplier * 4000)), // 1000-5000 USDT
          }
        },
        tierWageringMultiplier: 1, // No wagering requirement for rebates
        isActive: true,
        priority: 6,
      });
    }

    // Save all tier rewards
    const savedTierRewards = await BonusTierRewards.insertMany(tierRewards);
    logger.info(`✅ Successfully created ${savedTierRewards.length} tier rewards`);

    // Display summary
    logger.info('\n=== Tier Rewards Summary ===');
    for (const tier of tiers) {
      const tierRewardCount = savedTierRewards.filter(
        r => r.tierId.toString() === tier._id.toString()
      ).length;
      logger.info(`${tier.name}: ${tierRewardCount} rewards`);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed tier rewards:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the seed function
seedTierRewards();

