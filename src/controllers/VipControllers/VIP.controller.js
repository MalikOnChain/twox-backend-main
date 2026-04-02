import { query } from 'express-validator';

import { requireAuth } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation-error';
import VipUser from '@/models/vip/VipUser';
import vipService from '@/services/vip/vip.service';
import { logger } from '@/utils/logger';

class VipController {
  getRankingSystemInfo = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const tiers = await vipService.getRankingSystemInfo();
        return res.status(200).json({
          success: true,
          ranks: tiers,
        });
      } catch (error) {
        logger.error('Error getting ranking system info:', error);
        next(error);
      }
    },
  ];

  getRankingSystemIcon = [
    query('userId').isMongoId().withMessage('Invalid user ID'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { userId } = req.query;
        const icons = await vipService.getRankingSystemIcon(userId);
        return res.status(200).json({
          success: true,
          icons,
        });
      } catch (error) {
        logger.error('Error getting rank icons:', error);
        next(error);
      }
    },
  ];

  getVipStatus = [
    requireAuth,
    async (req, res, next) => {
      try {
        const rank = await VipUser.getVipStatistics(req.user.id);
        return res.json({ rank });
      } catch (error) {
        return next(error);
      }
    },
  ];
}

export default new VipController();
