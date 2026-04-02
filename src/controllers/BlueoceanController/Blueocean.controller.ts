import { NextFunction, Request, Response } from 'express';
import { query, body } from 'express-validator';

import handleValidationErrors from '@/middleware/validation-error';
import BlueOceanGameService from '@/services/casino/blueocean/Blueocean.service';
import { BlueOceanGameProviders, BlueOceanGameTypes } from '@/types/casino/blueocean/blueocean-provider';
import { logger } from '@/utils/logger';

export class BlueOceanController {
  public syncGames = [
    async (req: Request, res: Response, next: NextFunction) => {
      console.log('🔄 syncGames===>')
      try {
        const result = await BlueOceanGameService.syncGamesFromAPI();
        
        if (result.success) {
          return res.status(200).json({
            success: true,
            message: result.message,
            syncedCount: result.syncedCount,
          });
        } else {
          return res.status(500).json({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        next(error);
      }
    },
  ];

  public syncProviders = [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await BlueOceanGameService.syncProvidersFromAPI();
        
        if (result.success) {
          return res.status(200).json({
            success: true,
            message: result.message,
            syncedCount: result.syncedCount,
          });
        } else {
          return res.status(500).json({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        next(error);
      }
    },
  ];

  public getGames = [
    // Validation middleware
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer').customSanitizer((value) => value ? parseInt(value) : undefined),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').customSanitizer((value) => value ? parseInt(value) : undefined),
    query('provider')
      .optional()
      .isString()
      .trim()
      .custom((value) => {
        if (value && value !== 'all') {
          // Allow enum values and common aliases
          const validProviders = [
            ...Object.values(BlueOceanGameProviders),
            ...Object.keys(BlueOceanGameProviders),
            'PRAGMATIC', 'pragmatic', 'pragmatic_play', 'P0', 'p0',
            'NETENT', 'netent', 'netent_premium',
            'PLAYTECH', 'playtech',
            'PLAYN_GO', 'playn_go',
            'BGAMING', 'bgaming',
            'EVOPLAY', 'evoplay',
            'SPINOMENAL', 'spinomenal',
            'RED_TIGER', 'red_tiger',
            'QUICKSPIN', 'quickspin',
            'THUNDERKICK', 'thunderkick',
            'YGGDRASIL', 'yggdrasil'
          ];
          if (!validProviders.includes(value)) {
            throw new Error('Provider must be a valid BlueOcean provider or "all"');
          }
        }
        return true;
      })
      .withMessage('Provider must be a valid BlueOcean provider or "all"'),
    query('type')
      .optional()
      .isString()
      .trim()
      .custom((value) => {
        if (value) {
          const validTypes = [
            ...Object.values(BlueOceanGameTypes),
            ...Object.keys(BlueOceanGameTypes),
            'slot', 'slots', 'live', 'live_casino', 'table', 'table_games',
            'roulette', 'blackjack', 'baccarat', 'poker', 'video_poker',
            'scratch_cards', 'bingo', 'crash', 'fast_games', 'all'
          ];
          if (!validTypes.includes(value)) {
            throw new Error('Type must be a valid game type');
          }
        }
        return true;
      })
      .withMessage('Type must be a valid game type'),
    query('query')
      .optional()
      .isString()
      .trim()
      .custom((value) => {
        if (value && value.length > 100) {
          throw new Error('Search query must be between 1 and 100 characters');
        }
        return true;
      })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('category')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be a string between 1 and 50 characters'),
    query('sortBy')
      .optional()
      .isString()
      .trim()
      .isIn([
        'name',
        'gamename',
        'createdAt',
        'updatedAt',
        'releaseDate',
        'plays',
        'rtp',
        'order',
        'provider',
        'type',
        'category',
        'is_pinned',
        'isFeatured',
      ])
      .withMessage('Invalid sortBy field'),
    query('sortOrder')
      .optional()
      .isString()
      .trim()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either "asc" or "desc"'),
    query('userId')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('UserId must be a string between 1 and 50 characters'),
    query('featurebuySupported')
      .optional()
      .isBoolean()
      .customSanitizer((value) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return undefined;
      })
      .withMessage('featurebuySupported must be a boolean value'),
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {        
        const {
          offset = 0,
          limit,
          provider,
          type,
          query: searchWord,
          category,
          sortBy = 'createdAt',
          sortOrder = 'desc',
          userId,
          featurebuySupported,
        } = req.query;

        const params = {
          offset: isNaN(Number(offset)) ? 0 : Number(offset),
          limit: isNaN(Number(limit)) ? 28 : Number(limit),
          provider: provider as BlueOceanGameProviders,
          type: type as BlueOceanGameTypes,
          query: searchWord as string,
          category: category as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc',
          userId: userId as string,
          featurebuySupported: typeof featurebuySupported === 'boolean' ? featurebuySupported : featurebuySupported === 'true',
        };

        const { success, data, pagination, message } = await BlueOceanGameService.getGames(params);

        if (!success) {
          return res.status(400).json({ success, message });
        }

        res.json({
          success,
          data,
          pagination,
          // Additional metadata
          meta: {
            requestParams: {
              offset: params.offset,
              limit: params.limit,
              provider: params.provider,
              type: params.type,
              query: params.query,
              category: params.category,
              sortBy: params.sortBy,
              sortOrder: params.sortOrder,
            },
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        logger.error('Error fetching BlueOcean games:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch games',
        });
      }
    },
  ];

  public getProviders = [
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { success, data, message } = await BlueOceanGameService.getProviders();

        if (!success) {
          return res.status(400).json({ success, message });
        }

        res.json({ success, data });
      } catch (error: any) {
        logger.error('Error fetching BlueOcean providers:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch providers',
        });
      }
    },
  ];

  public getCategories = [
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { success, data, message } = await BlueOceanGameService.getCategories();

        if (!success) {
          return res.status(400).json({ success, message });
        }

        res.json({ success, data });
      } catch (error: any) {
        logger.error('Error fetching BlueOcean categories:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch categories',
        });
      }
    },
  ];

  public getGameTypes = [
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { success, data, message } = await BlueOceanGameService.getGameTypes();

        if (!success) {
          return res.status(400).json({ success, message });
        }

        res.json({ success, data });
      } catch (error: any) {
        logger.error('Error fetching BlueOcean game types:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch game types',
        });
      }
    },
  ];

  public getGameStats = [
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { success, data, message } = await BlueOceanGameService.getGameStats();

        if (!success) {
          return res.status(400).json({ success, message });
        }

        res.json({ success, data });
      } catch (error: any) {
        logger.error('Error fetching BlueOcean game statistics:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch game statistics',
        });
      }
    },
  ];

  // Additional utility endpoint to get filtered games count
  public getGamesCount = [
    query('provider')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Provider must be a string between 1 and 50 characters'),
    query('type')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Type must be a string between 1 and 50 characters'),
    query('category')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be a string between 1 and 50 characters'),
    query('query')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { provider, type, category, query: searchWord } = req.query;

        // Use the existing service method with limit 0 to get just the count
        const { success, pagination, message } = await BlueOceanGameService.getGames({
          offset: 0,
          limit: 1, // Minimal limit to get pagination info
          provider: provider as BlueOceanGameProviders,
          type: type as BlueOceanGameTypes,
          category: category as string,
          query: searchWord as string,
        });

        if (!success) {
          return res.status(400).json({ success, message });
        }

        res.json({
          success,
          count: pagination.total,
          filters: {
            provider: provider || 'all',
            type: type || 'all',
            category: category || 'all',
            query: searchWord || '',
          },
        });
      } catch (error: any) {
        logger.error('Error fetching BlueOcean games count:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch games count',
        });
      }
    },
  ];

  public getGame = [
    query('provider_code').isString().trim().notEmpty().withMessage('Provider code is required'),
    query('game_code').isString().trim().notEmpty().withMessage('Game code is required'),
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { provider_code, game_code } = req.query;

        const { success, data, message } = await BlueOceanGameService.getGame({
          provider_code: provider_code as string,
          game_code: game_code as string,
        });

        if (!success) {
          return res.status(400).json({
            success: false,
            error: message,
          });
        }

        return res.json({
          success: true,
          data,
        });
      } catch (error: any) {
        logger.error('Error getting BlueOcean game:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to get game',
        });
      }
    },
  ];

  public launchGame = [
    body('provider_code').isString().trim().notEmpty().withMessage('Provider code is required'),
    body('game_code').isString().trim().notEmpty().withMessage('Game code is required'),
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { provider_code, game_code, fingerprint } = req.body;

        const { success, data, message } = await BlueOceanGameService.launchGame({
          provider_code,
          game_code,
        });

        // Save fingerprint if provided
        if (fingerprint && fingerprint.visitorId && req.user) {
          try {
            const FingerprintService = (await import('../../services/security/Fingerprint.service')).default;
            const { getClientIP, getClientUserAgent } = await import('../../utils/helpers/auth');
            
            await FingerprintService.saveFingerprint({
              visitorId: fingerprint.visitorId,
              fingerprintData: fingerprint.data || {},
              userId: req.user._id,
              action: 'game_launch',
              metadata: { provider_code, game_code },
              ipAddress: getClientIP(req),
              userAgent: getClientUserAgent(req),
            });
          } catch (fpError) {
            logger.error('Failed to save fingerprint on game launch', fpError);
          }
        }

        if (!success) {
          return res.status(400).json({
            success: false,
            error: message,
          });
        }

        return res.json({
          success: true,
          data,
        });
      } catch (error: any) {
        logger.error('Error launching BlueOcean game:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to launch game',
        });
      }
    },
  ];

  /**
   * Complete gameplay flow endpoint
   */
  public gameplay = [
    body('user_username').isString().trim().notEmpty().withMessage('Username is required'),
    body('gameid').isString().trim().notEmpty().withMessage('Game ID is required'),
    body('currency').optional().isString().trim().withMessage('Currency must be a string'),
    body('user_id').optional().isString().trim().withMessage('User ID must be a string'),
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const {
          user_username,
          user_password,
          gameid,
          currency,
          user_id,
        } = req.body;

        const { success, data, message } = await BlueOceanGameService.launchGameplay({
          user_username,
          user_password,
          gameid,
          currency,
          user_id,
        });

        if (!success) {
          return res.status(400).json({ success: false, error: message });
        }

        return res.json({
          success: true,
          data,
        });
      } catch (error: any) {
        logger.error('Error in BlueOcean gameplay:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to complete gameplay flow',
        });
      }
    },
  ];

  /**
   * Logout player from BlueOcean system
   */
  public logoutPlayer = [
    body('user_username').isString().trim().notEmpty().withMessage('Username is required'),
    body('currency').optional().isString().trim().withMessage('Currency must be a string'),
    handleValidationErrors,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { user_username, currency } = req.body;

        const { success, message } = await BlueOceanGameService.logoutPlayer({
          user_username,
          currency,
        });

        if (!success) {
          return res.status(400).json({ success: false, error: message });
        }

        return res.json({
          success: true,
          message,
        });
      } catch (error: any) {
        logger.error('Error in BlueOcean logout:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to logout player',
        });
      }
    },
  ];
}

export default new BlueOceanController();
