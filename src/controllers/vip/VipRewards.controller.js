import { handleValidationErrors } from '@/middleware/validation-error';
import BonusTierRewards from '@/models/bonus/BonusTierRewards';
import VipUser from '@/models/vip/VipUser';
import { logger } from '@/utils/logger';

export class VipRewardsController {
  /**
   * Get tier rewards for user's current tier
   */
  getUserTierRewards = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;

        // Get user's VIP status
        const vipUser = await VipUser.findOne({ userId });
        if (!vipUser) {
          return res.json({
            success: true,
            rewards: [],
            total: 0,
          });
        }

        // Get tier rewards for user's current tier
        const rewards = await BonusTierRewards.find({
          tierId: vipUser.loyaltyTierId,
          isActive: true,
        })
          .populate('bonusId', 'name description type imageUrl')
          .sort({ priority: -1, createdAt: -1 });

        return res.json({
          success: true,
          rewards,
          total: rewards.length,
        });
      } catch (error) {
        logger.error('Failed to get user tier rewards:', error);
        next(error);
      }
    },
  ];

  /**
   * Claim a tier reward
   */
  claimTierReward = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { rewardId } = req.params;
        const userId = req.user.id;

        // Get reward details
        const reward = await BonusTierRewards.findById(rewardId).populate('bonusId');
        if (!reward || !reward.isActive) {
          return res.status(404).json({
            success: false,
            error: 'Reward not found or not active',
          });
        }

        // Verify user is in the correct tier
        const vipUser = await VipUser.findOne({ userId });
        if (!vipUser || vipUser.loyaltyTierId.toString() !== reward.tierId.toString()) {
          return res.status(403).json({
            success: false,
            error: 'You are not eligible for this reward',
          });
        }

        // Import and use BonusService to claim the reward
        const BonusService = (await import('@/services/bonus/BonusService.service')).default;
        const result = await BonusService.claimBonus(req.user, reward.bonusId._id);

        if (result.success) {
          return res.json({
            success: true,
            message: 'Reward claimed successfully!',
          });
        } else {
          return res.status(400).json({
            success: false,
            error: result.message || 'Failed to claim reward',
          });
        }
      } catch (error) {
        logger.error('Failed to claim tier reward:', error);
        next(error);
      }
    },
  ];
}

export default new VipRewardsController();

