import { query } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import SkinsbackService from '@/services/skinsback/Skinsback.service';
import { logger } from '@/utils/logger';

class SkinsbackController {
  createOrder = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        const hash = await SkinsbackService.createOrder(userId);
        return res.status(200).json({
          success: true,
          data: { hash },
        });
      } catch (error) {
        logger.error('Error creating order:', error);
        next(error);
      }
    },
  ];

  getServerStatus = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const status = await SkinsbackService.getServerStatus();
        return res.status(200).json({
          success: true,
          data: status,
        });
      } catch (error) {
        logger.error('Error getting server status:', error);
        next(error);
      }
    },
  ];

  getGameItems = [
    query('gameType').isString().trim().notEmpty().withMessage('Game type is required'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive number'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { gameType, offset = 0, limit = 10 } = req.query;
        const items = await SkinsbackService.getGameItems(gameType, offset, limit);
        return res.status(200).json({
          success: true,
          data: items,
        });
      } catch (error) {
        logger.error('Error getting game items:', error);
        next(error);
      }
    },
  ];
}

export default new SkinsbackController();
