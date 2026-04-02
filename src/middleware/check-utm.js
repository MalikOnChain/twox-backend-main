import Promotion from '@/models/promotion/Promotion';

export const checkUtm = async (req, res, next) => {
  req.promotionId = null;

  if (req.user) {
    const promotion = await Promotion.findById(req.user.utm_campaign);
    if (promotion) {
      req.promotionId = promotion._id;
    } else {
      req.promotionId = null;
    }

    return next();
  }

  const promotionName = decodeURIComponent(req.headers['x-utm-campaign']);

  if (promotionName) {
    const promotion = await Promotion.findOne({ name: promotionName });
    if (promotion) {
      req.promotionId = promotion._id;
    }
  }
  return next();
};

export default checkUtm;
