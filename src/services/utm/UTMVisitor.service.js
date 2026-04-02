import Promotion from '@/models/promotion/Promotion';
import UTMVisitor from '@/models/UTMVisitor';
import { logger } from '@/utils/logger';

export class UTMVisitorService {
  async trackVisitor(ip_address, utm_source, utm_campaign, utm_id) {
    // Return early if no UTM parameters are present
    if (!utm_source && !utm_campaign) {
      logger.info('No UTM parameters present, skipping visitor tracking');
      return null;
    }

    // Get start and end of current day in UTC
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    // Check for existing visitor with same IP for current day
    const existingVisitor = await UTMVisitor.findOne({
      utm_source,
      ip_address,
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    });

    logger.debug(existingVisitor, 'existingVisitor');

    if (existingVisitor) {
      logger.info('Visitor with IP already exists for today, skipping:', { ip_address });
      return existingVisitor;
    }

    let visitorData = { ip_address };

    if (utm_source) {
      visitorData.utm_source = utm_source;
    }

    let promotion = null;

    if (utm_id) {
      promotion = await Promotion.findById(utm_id);
      if (promotion) {
        visitorData.utm_campaign = promotion._id;
      } else {
        logger.info('Promotion not found, skipping UTM campaign tracking:', { utm_id });
        return null;
      }
    }

    const visitor = new UTMVisitor(visitorData);
    await visitor.save();

    logger.info('UTM visitor tracked:', {
      utm_source,
      utm_campaign,
      ip_address,
    });

    return visitor;
  }

  async getVisitorStats(startDate, endDate) {
    const query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const stats = await UTMVisitor.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            utm_source: '$utm_source',
            utm_campaign: '$utm_campaign',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    return stats;
  }
}

export default new UTMVisitorService();
