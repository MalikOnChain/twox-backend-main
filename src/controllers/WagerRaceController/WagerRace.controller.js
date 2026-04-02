import { body, query } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import WagerRaceService from '@/services/wagerRace/WagerRace.service';
import { logger } from '@/utils/logger';

class WagerRaceController {
  getActiveRaces = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const activeRaces = await WagerRaceService.getAllActiveWagerRaces();
        return res.status(200).json({
          success: true,
          activeRaces,
        });
      } catch (error) {
        logger.error('Error getting active races:', error);
        next(error);
      }
    },
  ];

  entryRace = [
    body('raceId').isMongoId().withMessage('Invalid race ID'),
    body('inviteCode').optional().isString().trim().escape(),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { raceId, inviteCode } = req.body;
        const userId = req.user.id;

        const result = await WagerRaceService.entryRace(userId, raceId, inviteCode);
        return res.status(200).json({
          success: true,
          result,
        });
      } catch (error) {
        logger.error('Error entering race:', error);
        next(error);
      }
    },
  ];

  getWagerRaceById = [
    query('wagerRaceId').isMongoId().withMessage('Invalid wager race ID'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { wagerRaceId } = req.query;
        const wagerRace = await WagerRaceService.instance.getWagerRaceByIdForUser(wagerRaceId);
        return res.status(200).json({
          success: true,
          wagerRace,
        });
      } catch (error) {
        logger.error('Error getting wager race by ID:', error);
        next(error);
      }
    },
  ];

  getWagerRaceRankingById = [
    query('wagerRaceId').isMongoId().withMessage('Invalid wager race ID'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { wagerRaceId } = req.query;
        const rankingData = await WagerRaceService.instance.getRankingDataByWagerRaceId(wagerRaceId);
        return res.status(200).json({
          success: true,
          rankingData,
        });
      } catch (error) {
        logger.error('Error getting wager race ranking:', error);
        next(error);
      }
    },
  ];

  getUserRaceMetrics = [
    query('wagerRaceId').isMongoId().withMessage('Invalid wager race ID'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { wagerRaceId } = req.query;
        const userId = req.user.id;
        const metrics = await WagerRaceService.instance.getUserRaceMetrics(userId, wagerRaceId);
        return res.status(200).json({
          success: true,
          metrics,
        });
      } catch (error) {
        logger.error('Error getting user race metrics:', error);
        next(error);
      }
    },
  ];
}

export default new WagerRaceController();
