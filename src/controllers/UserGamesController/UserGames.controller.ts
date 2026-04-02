import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

import User from '@/models/users/User';
import BlueOceanGame from '@/models/slotGames/blueocean/BlueOceanGames';
import { logger } from '@/utils/logger';

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

export class UserGamesController {
  // Add game to favorites
  public addFavorite = [
    body('gameId').isString().notEmpty().withMessage('Game ID is required'),
    handleValidationErrors,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?._id;
        const { gameId } = req.body;

        if (!userId) {
          return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Check if game exists
        const game = await BlueOceanGame.findOne({ gameId });
        if (!game) {
          return res.status(404).json({ success: false, message: 'Game not found' });
        }

        // Add to favorites if not already there
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.favoriteGames && user.favoriteGames.includes(gameId)) {
          return res.status(400).json({ success: false, message: 'Game already in favorites' });
        }

        await User.findByIdAndUpdate(
          userId,
          { $addToSet: { favoriteGames: gameId } },
          { new: true }
        );

        return res.status(200).json({
          success: true,
          message: 'Game added to favorites',
          gameId,
        });
      } catch (error) {
        logger.error('Error adding game to favorites:', error);
        next(error);
      }
    },
  ];

  // Remove game from favorites
  public removeFavorite = [
    body('gameId').isString().notEmpty().withMessage('Game ID is required'),
    handleValidationErrors,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?._id;
        const { gameId } = req.body;

        if (!userId) {
          return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        await User.findByIdAndUpdate(
          userId,
          { $pull: { favoriteGames: gameId } },
          { new: true }
        );

        return res.status(200).json({
          success: true,
          message: 'Game removed from favorites',
          gameId,
        });
      } catch (error) {
        logger.error('Error removing game from favorites:', error);
        next(error);
      }
    },
  ];

  // Get user's favorite games
  public getFavorites = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const user = await User.findById(userId).select('favoriteGames');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const favoriteGames = user.favoriteGames || [];

      // Fetch game details
      const games = await BlueOceanGame.find({
        gameId: { $in: favoriteGames }
      }).lean();

      // Transform to frontend format
      const transformedGames = games.map((game) => ({
        _id: game._id.toString(),
        id: parseInt(game.gameId) || 0,
        game_code: game.gameId,
        provider_code: game.provider,
        game_name: game.name,
        banner: game.imagePortrait,
        type: game.type,
        status: game.status === 'active' ? 1 : 0,
        order: game.order,
        is_pinned: game.isFeatured,
        featurebuySupported: game.featurebuySupported,
      }));

      return res.status(200).json({
        success: true,
        data: transformedGames,
      });
    } catch (error) {
      logger.error('Error getting favorite games:', error);
      next(error);
    }
  };

  // Add game to recent games (automatically when launching)
  public addRecentGame = [
    body('gameId').isString().notEmpty().withMessage('Game ID is required'),
    handleValidationErrors,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?._id;
        const { gameId } = req.body;

        if (!userId) {
          return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Check if game exists
        const game = await BlueOceanGame.findOne({ gameId });
        if (!game) {
          return res.status(404).json({ success: false, message: 'Game not found' });
        }

        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Remove the game if it already exists in recent games
        await User.findByIdAndUpdate(userId, {
          $pull: { recentGames: { gameId } }
        });

        // Add to the beginning of recent games with current timestamp
        await User.findByIdAndUpdate(
          userId,
          {
            $push: {
              recentGames: {
                $each: [{ gameId, playedAt: new Date() }],
                $position: 0,
                $slice: 50 // Keep only last 50 recent games
              }
            }
          },
          { new: true }
        );

        return res.status(200).json({
          success: true,
          message: 'Game added to recent games',
          gameId,
        });
      } catch (error) {
        logger.error('Error adding game to recent games:', error);
        next(error);
      }
    },
  ];

  // Get user's recent games
  public getRecentGames = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const user = await User.findById(userId).select('recentGames');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const recentGames = user.recentGames || [];
      const gameIds = recentGames.map((rg: { gameId: string; playedAt: Date }) => rg.gameId);

      // Fetch game details
      const games = await BlueOceanGame.find({
        gameId: { $in: gameIds }
      }).lean();

      // Create a map of gameId to game for quick lookup
      const gameMap = new Map(games.map(g => [g.gameId, g]));

      // Transform to frontend format while maintaining recent order
      const transformedGames = gameIds
        .map((gameId: string) => {
          const game = gameMap.get(gameId);
          if (!game) return null;

          return {
            _id: game._id.toString(),
            id: parseInt(game.gameId) || 0,
            game_code: game.gameId,
            provider_code: game.provider,
            game_name: game.name,
            banner: game.imagePortrait,
            type: game.type,
            status: game.status === 'active' ? 1 : 0,
            order: game.order,
            is_pinned: game.isFeatured,
            featurebuySupported: game.featurebuySupported,
          };
        })
        .filter((game): game is NonNullable<typeof game> => game !== null);

      return res.status(200).json({
        success: true,
        data: transformedGames,
      });
    } catch (error) {
      logger.error('Error getting recent games:', error);
      next(error);
    }
  };
}

export default new UserGamesController();

