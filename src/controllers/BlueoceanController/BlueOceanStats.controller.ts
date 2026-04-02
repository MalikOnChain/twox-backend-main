import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { logger } from '@/utils/logger';
import BlueOceanWalletTransaction from '@/models/slotGames/blueocean/BlueOceanWalletTransaction';
import BlueOceanGame from '@/models/slotGames/blueocean/BlueOceanGames';
import User from '@/models/users/User';
import GameTransaction from '@/models/transactions/GameTransactions';
import WinnersFeedSettings from '@/models/cms/WinnersFeedSettings';
import { TRANSACTION_TYPES, GAME_TRANSACTION_STATUS } from '@/types/game/game';

export class BlueOceanStatsController {
  /**
   * Get latest winners
   * Returns recent winning transactions with game and user info
   * Now controlled by WinnersFeedSettings from admin panel
   */
  public async getLatestWinners(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 20 } = req.query;
      const limitNum = parseInt(limit as string);

      // Use WinnersFeedSettings to control what's displayed
      try {
        const settings = await WinnersFeedSettings.findOne();

        if (!settings || !settings.isEnabled) {
          return res.json({
            success: true,
            data: [],
          });
        }

        // Build query based on inclusion criteria (same as admin)
        const query: any = {
          type: TRANSACTION_TYPES.WIN,
          status: GAME_TRANSACTION_STATUS.COMPLETED,
          winAmount: { $gte: settings.inclusionCriteria.minWinAmount || 0 },
        };

        // Apply minimum bet amount filter
        if (settings.inclusionCriteria.minBetAmount) {
          query.betAmount = { $gte: settings.inclusionCriteria.minBetAmount };
        }

        // Apply game categories filter
        if (
          settings.inclusionCriteria.gameCategories &&
          settings.inclusionCriteria.gameCategories.length > 0
        ) {
          query.category = { $in: settings.inclusionCriteria.gameCategories };
        }

        // Apply time range filter
        if (settings.inclusionCriteria.timeRange?.hours) {
          const hoursAgo = new Date();
          hoursAgo.setHours(hoursAgo.getHours() - settings.inclusionCriteria.timeRange.hours);
          query.createdAt = { $gte: hoursAgo };
        }

        // Exclude hidden winners
        if (
          settings.displaySettings.hiddenWinners &&
          settings.displaySettings.hiddenWinners.length > 0
        ) {
          const hiddenIds = settings.displaySettings.hiddenWinners
            .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
            .map((id: any) => {
              if (id instanceof mongoose.Types.ObjectId) {
                return id;
              }
              return new mongoose.Types.ObjectId(id.toString());
            });
          if (hiddenIds.length > 0) {
            query._id = { $nin: hiddenIds };
          }
        }

        // Fetch winners with limit
        let winners = await GameTransaction.find(query)
          .populate('userId', 'username email')
          .sort({ createdAt: -1 })
          .limit(Math.min(limitNum, settings.displaySettings.maxItems || 50))
          .lean();

        // Apply game/provider exclusions
        if (
          settings.inclusionCriteria.excludeGameIds &&
          settings.inclusionCriteria.excludeGameIds.length > 0
        ) {
          winners = winners.filter(
            (winner: any) => !settings.inclusionCriteria.excludeGameIds?.includes(winner.game?.id)
          );
        }

        if (
          settings.inclusionCriteria.excludeProviderIds &&
          settings.inclusionCriteria.excludeProviderIds.length > 0
        ) {
          winners = winners.filter((winner: any) => {
            const gameProvider = (winner.game as any)?.provider;
            return !settings.inclusionCriteria.excludeProviderIds?.includes(gameProvider);
          });
        }

        // Sort featured winners first
        if (
          settings.displaySettings.featuredWinners &&
          settings.displaySettings.featuredWinners.length > 0
        ) {
          const featuredIds = settings.displaySettings.featuredWinners.map((id: any) =>
            id.toString()
          );
          winners.sort((a: any, b: any) => {
            const aFeatured = featuredIds.includes(a._id.toString());
            const bFeatured = featuredIds.includes(b._id.toString());
            if (aFeatured && !bFeatured) return -1;
            if (!aFeatured && bFeatured) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        // Format winners for user frontend
        const enrichedWinners = await Promise.all(
          winners.slice(0, limitNum).map(async (winner: any) => {
            const user = winner.userId;
            let username = user?.username || 'Unknown';

            // Apply username masking
            if (settings.maskRules.maskUsername) {
              if (settings.maskRules.maskPattern === 'full') {
                username = '***';
              } else {
                // Partial: show first 2 characters
                if (username.length > 2) {
                  username = username.substring(0, 2) + '***';
                } else {
                  username = '***';
                }
              }
            }

            // Get game info
            let game = null;
            const gameId = winner.game?.id;
            if (gameId) {
              game = await BlueOceanGame.findOne({ gameId }).lean();
            }

            // Calculate multiplier
            const betAmount = winner.betAmount || 0;
            const winAmount = settings.maskRules.showAmount ? winner.winAmount : 0;
            const multiplier =
              betAmount > 0 ? (winAmount / betAmount).toFixed(2) + 'x' : '0x';

            return {
              id: winner._id.toString(),
              gameName:
                settings.maskRules.showGame && game
                  ? game.name || 'Unknown Game'
                  : 'Unknown Game',
              gameCode: game?.gameId || gameId || undefined,
              providerCode: game?.provider || undefined,
              gameType: game?.type === 'livecasino' ? 'live-casino' : 'slots',
              gameImage:
                settings.maskRules.showGame && game
                  ? game.imageSquare || game.image || ''
                  : '',
              player: username,
              betAmount: settings.maskRules.showAmount ? betAmount : 0,
              winAmount: winAmount,
              profit: winAmount,
              multiplier: multiplier,
              currency: '$' as const,
              timestamp: settings.maskRules.showTime ? winner.createdAt : new Date(),
            };
          })
        );

        return res.json({
          success: true,
          data: enrichedWinners,
        });
      } catch (settingsError: any) {
        logger.warn('Failed to use WinnersFeedSettings, falling back to default:', settingsError);
        // Fall through to default behavior
      }

      // Fallback to original behavior if WinnersFeedSettings not available
      const winners = await BlueOceanWalletTransaction.aggregate([
        {
          $match: {
            action: 'credit',
            status: 'completed',
            amount: { $gt: 0 },
          }
        },
        {
          $sort: { created_at: -1 }
        },
        {
          $limit: limitNum
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        }
      ]);

      // Enrich with game information
      const enrichedWinners = await Promise.all(
        winners.map(async (winner) => {
          let game = null;
          if (winner.game_id) {
            game = await BlueOceanGame.findOne({ gameId: winner.game_id }).lean();
            
            if (!game) {
              logger.warn(`Game not found for gameId: ${winner.game_id}`);
            }
          }

          const betAmount = winner.balance_before - winner.balance_after + winner.amount;

          return {
            id: winner._id.toString(),
            gameName: game?.name || 'Unknown Game',
            gameCode: game?.gameId || winner.game_id || undefined,
            providerCode: game?.provider || undefined,
            gameType: game?.type === 'livecasino' ? 'live-casino' : 'slots',
            gameImage: game?.imageSquare || game?.image || '',
            player: winner.user.username,
            betAmount: betAmount > 0 ? betAmount : 0,
            winAmount: winner.amount,
            profit: winner.amount,
            multiplier: betAmount > 0 
              ? (winner.amount / betAmount).toFixed(2) + 'x'
              : '0x',
            currency: '$',
            timestamp: winner.created_at,
          };
        })
      );

      return res.json({
        success: true,
        data: enrichedWinners,
      });
    } catch (error) {
      logger.error('Failed to get latest winners:', error);
      next(error);
    }
  }

  /**
   * Get high rollers (biggest bets)
   */
  public async getHighRollers(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 20, period = 'day' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 1);
      }

      // Get high roller transactions (largest bets)
      const highRollers = await BlueOceanWalletTransaction.aggregate([
        {
          $match: {
            action: 'debit',
            status: 'completed',
            created_at: { $gte: startDate },
          }
        },
        {
          $sort: { amount: -1 }
        },
        {
          $limit: parseInt(limit as string)
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        }
      ]);

      // Find corresponding win transactions
      const enrichedHighRollers = await Promise.all(
        highRollers.map(async (bet) => {
          let game = null;
          if (bet.game_id) {
            game = await BlueOceanGame.findOne({ gameId: bet.game_id }).lean();
            
            if (!game) {
              logger.warn(`High Rollers - Game not found for gameId: ${bet.game_id}`);
            }
          }

          // Find the corresponding credit transaction (win)
          const win = await BlueOceanWalletTransaction.findOne({
            session_id: bet.session_id,
            action: 'credit',
            status: 'completed',
          }).lean();

          const winAmount = win ? win.amount : 0;
          const profit = winAmount - bet.amount;

          return {
            id: bet._id.toString(),
            gameName: game?.name || 'Unknown Game',
            gameCode: game?.gameId || bet.game_id || undefined,
            providerCode: game?.provider || undefined,
            gameType: game?.type === 'livecasino' ? 'live-casino' : 'slots',
            player: bet.user.username,
            betAmount: bet.amount,
            winAmount: winAmount,
            profit: profit,
            multiplier: bet.amount > 0 ? (winAmount / bet.amount).toFixed(2) + 'x' : '0x',
            currency: '$',
            timestamp: bet.created_at,
          };
        })
      );

      return res.json({
        success: true,
        data: enrichedHighRollers,
      });
    } catch (error) {
      logger.error('Failed to get high rollers:', error);
      next(error);
    }
  }

  /**
   * Get best multipliers
   */
  public async getBestMultipliers(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 20, period = 'day' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 1);
      }

      // Get all bet-win pairs and calculate multipliers
      const bets = await BlueOceanWalletTransaction.find({
        action: 'debit',
        status: 'completed',
        created_at: { $gte: startDate },
        amount: { $gt: 0 },
      }).lean();

      const multiplierData = await Promise.all(
        bets.map(async (bet) => {
          const win = await BlueOceanWalletTransaction.findOne({
            session_id: bet.session_id,
            action: 'credit',
            status: 'completed',
          }).lean();

          if (!win || win.amount <= 0) return null;

          const multiplier = win.amount / bet.amount;
          
          // Only include significant multipliers (> 1x)
          if (multiplier <= 1) return null;

          let game = null;
          if (bet.game_id) {
            game = await BlueOceanGame.findOne({ gameId: bet.game_id }).lean();
            
            if (!game) {
              logger.warn(`Best Multipliers - Game not found for gameId: ${bet.game_id}`);
            }
          }

          const user = await User.findById(bet.user_id).lean();

          return {
            id: bet._id.toString(),
            gameName: game?.name || 'Unknown Game',
            gameCode: game?.gameId || bet.game_id || undefined,
            providerCode: game?.provider || undefined,
            gameType: game?.type === 'livecasino' ? 'live-casino' : 'slots',
            player: user?.username || 'Unknown',
            betAmount: bet.amount,
            winAmount: win.amount,
            profit: win.amount - bet.amount,
            multiplier: multiplier.toFixed(2) + 'x',
            multiplierValue: multiplier,
            currency: '$',
            timestamp: bet.created_at,
          };
        })
      );

      // Filter out nulls and sort by multiplier
      const validMultipliers = multiplierData
        .filter(item => item !== null)
        .sort((a, b) => b!.multiplierValue - a!.multiplierValue)
        .slice(0, parseInt(limit as string));

      return res.json({
        success: true,
        data: validMultipliers,
      });
    } catch (error) {
      logger.error('Failed to get best multipliers:', error);
      next(error);
    }
  }

  /**
   * Get winners of the day/month
   */
  public async getTopWinners(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 20, period = 'day' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 1);
      }

      // Aggregate total winnings per user
      const topWinners = await BlueOceanWalletTransaction.aggregate([
        {
          $match: {
            action: 'credit',
            status: 'completed',
            created_at: { $gte: startDate },
            amount: { $gt: 0 },
          }
        },
        {
          $group: {
            _id: '$user_id',
            totalWinnings: { $sum: '$amount' },
            totalBets: { $sum: '$balance_before' },
            winCount: { $sum: 1 },
            lastWin: { $max: '$created_at' },
            lastGameId: { $last: '$game_id' },
            lastSessionId: { $last: '$session_id' },
          }
        },
        {
          $sort: { totalWinnings: -1 }
        },
        {
          $limit: parseInt(limit as string)
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        }
      ]);

      // Enrich with game information
      const enrichedTopWinners = await Promise.all(
        topWinners.map(async (winner) => {
          let game = null;
          if (winner.lastGameId) {
            game = await BlueOceanGame.findOne({ gameId: winner.lastGameId }).lean();
            
            if (!game) {
              logger.warn(`Top Winners - Game not found for gameId: ${winner.lastGameId}`);
            }
          }

          // Get the last bet amount for this session
          const lastBet = await BlueOceanWalletTransaction.findOne({
            session_id: winner.lastSessionId,
            action: 'debit',
            status: 'completed',
          }).lean();

          const betAmount = lastBet?.amount || 0;
          const profit = winner.totalWinnings - betAmount;

          return {
            id: winner._id.toString(),
            gameName: game?.name || 'Multiple Games',
            gameCode: game?.gameId || winner.lastGameId || undefined,
            providerCode: game?.provider || undefined,
            gameType: game?.type === 'livecasino' ? 'live-casino' : 'slots',
            player: winner.user.username,
            betAmount: betAmount,
            winAmount: winner.totalWinnings,
            profit: profit,
            multiplier: betAmount > 0 
              ? (winner.totalWinnings / betAmount).toFixed(2) + 'x'
              : '0x',
            currency: '$',
            timestamp: winner.lastWin,
          };
        })
      );

      return res.json({
        success: true,
        data: enrichedTopWinners,
      });
    } catch (error) {
      logger.error('Failed to get top winners:', error);
      next(error);
    }
  }
}

export default new BlueOceanStatsController();

