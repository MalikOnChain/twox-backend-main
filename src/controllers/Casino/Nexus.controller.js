import { body, query } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import NexusggrService from '@/services/casino/Nexusggr/Nexusggr.service';
import NexusDemoService from '@/services/casino/Nexusggr/NexusggrFun.service';
import { logger } from '@/utils/logger';

class NexusController {
  getProvidersList = [
    query('type').optional().isString().trim().escape(),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const data = await NexusggrService.getProviders(req.query);
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  launchGame = [
    body('provider_code').isString().trim().notEmpty().withMessage('Provider code is required'),
    body('game_code').isString().trim().notEmpty().withMessage('Game code is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { provider_code, game_code } = req.body;        
        const data = await NexusggrService.launchGame(req.user.id, provider_code, game_code);
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  launchDemoGame = [
    body('provider_code').isString().trim().notEmpty().withMessage('Provider code is required'),
    body('game_code').isString().trim().notEmpty().withMessage('Game code is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { provider_code, game_code } = req.body;
        const data = await NexusDemoService.launchDemoGame(provider_code, game_code);
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  getGamesHandler = [
    query('type').isString().trim().notEmpty().withMessage('Type is required'),
    query('provider_code').optional().isString().trim().escape(),
    query('category').optional().isString().trim().escape(),
    query('search').optional().isString().trim().escape(),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const queryWithUserId = {
          ...req.query,
          userId: req.user?._id || req.user?.id || null,
        };
        const data = await NexusggrService.getGames(queryWithUserId);
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  getGameHandler = [
    query('provider_code').isString().trim().notEmpty().withMessage('Provider code is required'),
    query('game_code').isString().trim().notEmpty().withMessage('Game code is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const data = await NexusggrService.getGame(req.query);
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  getFavoriteGames = [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive number'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const favoriteGames = await NexusggrService.getFavoriteGames(req.query, req.user.id);
        return res.status(200).json(favoriteGames);
      } catch (error) {
        next(error);
      }
    },
  ];

  getCallList = [
    query('status').optional().isString().trim().escape(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive number'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        logger.debug('getCallList', req.query);
        const data = await NexusggrService.getCallList(req.query);
        return res.status(200).json(data);
      } catch (error) {
        logger.debug('error', error);
        next(error);
      }
    },
  ];

  applyCall = [
    body('callId').isString().trim().notEmpty().withMessage('Call ID is required'),
    body('action').isString().trim().isIn(['accept', 'reject']).withMessage('Action must be either accept or reject'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const data = await NexusggrService.applyCall(req.body);
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  getCallPlayers = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const data = await NexusggrService.getCallPlayers();
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  getGameCategories = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const data = await NexusggrService.getGameCategories();
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  getProviderList = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const data = await NexusggrService.getProviderList();
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];

  getGameList = [
    query('provider_code').isString().trim().notEmpty().withMessage('Provider code is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const data = await NexusggrService.getGameList(req.query.provider_code);
        return res.status(200).json(data);
      } catch (error) {
        next(error);
      }
    },
  ];
}

export default new NexusController();
