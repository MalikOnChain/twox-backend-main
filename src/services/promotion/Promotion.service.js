import Promotion from '@/models/promotion/Promotion';
import { logger } from '@/utils/logger';

class PromotionService {
  async getPromotions(utmPromotionId) {
    try {
      const promotions = await Promotion.find().lean();

      const publicPromotions = promotions.map((promotion) => {
        if (!promotion.isPublic) {
          if (utmPromotionId) {
            if (promotion._id.toString() === utmPromotionId.toString()) {
              return promotion;
            }
          }
          return null;
        }

        return promotion;
      });

      return publicPromotions.filter(Boolean);
    } catch (error) {
      logger.error('Error in getPromotions:', error);
      throw error;
    }
  }

  async getPromotionById(promotionId) {
    try {
      const promotion = await Promotion.findById(promotionId).lean();
      if (!promotion) {
        throw new Error('Promotion not found');
      }
      return promotion;
    } catch (error) {
      logger.error('Error in getPromotionById:', error);
      throw error;
    }
  }
}

export default new PromotionService();
