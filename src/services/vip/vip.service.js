import User from '@/models/users/User';
import VipTier from '@/models/vip/VipTier';

export class VipService {
  constructor(VipTierModel) {
    this.VipTier = VipTierModel;
  }

  // Get tier by using total XP
  async getTierByXP(totalXP) {
    try {
      // Find all tiers that have at least one level with minXP <= totalXP
      const tiers = await this.VipTier.find({
        levels: { $elemMatch: { minXP: { $lte: totalXP } } },
      }).lean();

      if (!tiers.length) {
        const firstTier = await this.VipTier.findOne({}).limit(1).lean();
        return {
          id: firstTier._id,
          name: firstTier.name,
          levelName: firstTier.levels[0].name,
          minXP: firstTier.levels[0].minXP,
          icon: firstTier.icon,
        };
      }

      // Sort tiers by their highest level's minXP in descending order
      const sortedTiers = tiers.sort((a, b) => {
        const aMaxXP = Math.max(...a.levels.map((level) => level.minXP));
        const bMaxXP = Math.max(...b.levels.map((level) => level.minXP));
        return bMaxXP - aMaxXP;
      });

      const highestTier = sortedTiers[0];

      // Find the highest level in this tier that matches the XP requirement
      const matchingLevel = highestTier.levels
        .filter((level) => level.minXP <= totalXP)
        .sort((a, b) => b.minXP - a.minXP)[0];

      return {
        id: highestTier._id,
        name: highestTier.name,
        levelName: matchingLevel?.name || highestTier.levels[0].name,
        minXP: matchingLevel?.minXP || highestTier.levels[0].minXP,
        icon: matchingLevel?.icon || highestTier.icon,
      };
    } catch (error) {
      console.error('Error getting tier by XP:', error);
      throw error;
    }
  }

  // Get tier by using tier name and level name
  async getTierByName(tierName, levelName) {
    try {
      const tier = await this.VipTier.findOne({
        name: tierName,
        'levels.name': levelName,
      }).lean();

      if (!tier) {
        throw new Error(`Tier ${tierName} with level ${levelName} not found`);
      }

      const levelData = tier.levels.find((level) => level.name === levelName);
      if (!levelData) {
        throw new Error(`Level ${levelName} not found in tier ${tierName}`);
      }

      return {
        ...tier,
        currentLevel: levelData,
      };
    } catch (error) {
      console.error('Error getting tier by name:', error);
      throw error;
    }
  }

  // Get next tier by using current tier name and level name
  async getNextTier(currentTierName, currentLevelName) {
    try {
      const currentTier = await this.getTierByName(currentTierName, currentLevelName);
      // First try to find next level in current tier
      const currentLevel = currentTier.currentLevel.level;
      const nextLevelInCurrentTier = currentTier.levels
        .sort((a, b) => a.level - b.level)
        .find((level) => level.level > currentLevel);

      if (nextLevelInCurrentTier) {
        return {
          ...currentTier,
          nextLevel: nextLevelInCurrentTier,
        };
      }

      // If no next level in current tier, find next tier
      const currentMaxXP = Math.max(...currentTier.levels.map((level) => level.minXP));
      const nextTier = await this.VipTier.findOne({
        'levels.minXP': { $gt: currentMaxXP },
      })
        .sort({ 'levels.minXP': 1 })
        .limit(1)
        .lean();

      if (!nextTier) {
        return null; // No next tier available
      }

      // Get the first level of the next tier
      const firstLevel = nextTier.levels.sort((a, b) => a.minXP - b.minXP)[0];
      return {
        ...nextTier,
        nextLevel: firstLevel,
      };
    } catch (error) {
      console.error('Error getting next tier:', error);
      throw error;
    }
  }

  async getRankingSystemInfo() {
    try {
      const tiers = await this.VipTier.find({}).lean();
      return tiers;
    } catch (error) {
      console.error('Error getting ranking system info:', error);
      throw error;
    }
  }

  async getRankingSystemIcon(userId) {
    try {
      const user = await User.findById(userId).lean();
      const tier = await this.getTierByXP(user.totalXP);
      return tier.icon;
    } catch (error) {
      console.error('Error getting ranking system icon:', error);
      throw error;
    }
  }
}

const vipService = new VipService(VipTier);

export default vipService;
