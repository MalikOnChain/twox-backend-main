import { body, query } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import UTMVisitorService from '@/services/utm/UTMVisitor.service';
import { getClientIP } from '@/utils/helpers/auth';
import { logger } from '@/utils/logger';

class UTMVisitorController {
  trackVisitor = [
    body('utm_source').optional().isString().trim().escape(),
    body('utm_campaign').optional().isString().trim().escape(),
    body('utm_id').optional().isString().trim().escape(),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { utm_source, utm_campaign, utm_id } = req.body;
        const ip_address = getClientIP(req);

        logger.debug(utm_source, utm_campaign);

        const visitor = await UTMVisitorService.trackVisitor(ip_address, utm_source, utm_campaign, utm_id);
        return res.status(200).json({
          success: true,
          visitor,
        });
      } catch (error) {
        logger.error('Error tracking UTM visitor:', error);
        next(error);
      }
    },
  ];

  getVisitorStats = [
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { startDate, endDate } = req.query;
        const stats = await UTMVisitorService.getVisitorStats(startDate, endDate);
        return res.status(200).json({
          success: true,
          data: stats,
        });
      } catch (error) {
        logger.error('Error getting UTM visitor stats:', error);
        next(error);
      }
    },
  ];
}

export default new UTMVisitorController();
