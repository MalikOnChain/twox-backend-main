import { handleValidationErrors } from '@/middleware/validation-error';
import PromotionService from '@/services/promotion/Promotion.service';
import { logger } from '@/utils/logger';

class PromotionController {
  getPromotions = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const promotions = await PromotionService.getPromotions(req.promotionId);
        return res.status(200).json({
          success: true,
          promotions,
        });
      } catch (error) {
        logger.error('Error getting promotions:', error);
        next(error);
      }
    },
  ];

  getPromotionById = [
    handleValidationErrors,
    async (req, res, next) => {
      const { id } = req.params;

      try {
        const promotion = await PromotionService.getPromotionById(id);
        return res.status(200).json({
          success: true,
          promotion,
        });
      } catch (error) {
        logger.error('Error getting promotion by id:', error);
        next(error);
      }
    },
  ];
}

export default new PromotionController();
