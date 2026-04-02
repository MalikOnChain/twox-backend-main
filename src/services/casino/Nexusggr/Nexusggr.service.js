import axios from 'axios';
import { Types } from 'mongoose';

import config from '@/config/index';
import betHistorySocketController from '@/controllers/SocketControllers/bet-history-socket';
import { GameTransactionHandler } from '@/controllers/TransactionControllers/GameTransactionManager';
import BetHistory from '@/models/gameHistory/BetHistory';
import { CasinoGame, GAME_STATUS } from '@/models/gameHistory/CasinoGame';
import FavoriteGame from '@/models/slotGames/FavoriteGame';
import GameCategory from '@/models/slotGames/GameCategory';
import GameList from '@/models/slotGames/nexusggr/NexusggrGames';
import GameProvider from '@/models/slotGames/nexusggr/NexusggrProvider';
import User from '@/models/users/User';
import BalanceManagerService from '@/services/balance/BalanceManager.service';
import { API_METHODS, API_CALLBACK_METHODS } from '@/types/casino/nexusggr/nexusggr';
import { GAME_CATEGORIES } from '@/types/game/game';
import { logger } from '@/utils/logger';

export class NexusGGRService {
  constructor() {
    this.apiUrl = process.env.NEXUSGGR_API_URL;
    this.requiredPayload = {
      agent_code: config.nexusggr.agent_code,
      agent_token: config.nexusggr.token,
    };
  }

  async initGameProviders() {
    try {
      // First get and save providers
      const providers = await this.getProviderList();
      await this.updateProviders(providers);

      // Then get and save games for each active provider
      await this.syncGamesForActiveProviders();

      logger.debug('Game providers and games successfully synchronized');
      return providers;
    } catch (error) {
      console.error('Failed to initialize game providers:', error);
      throw new Error(error?.message || 'Error initializing game providers');
    }
  }

  async getProviderList() {
    try {
      const payload = {
        method: API_METHODS.PROVIDER_LIST,
        ...this.requiredPayload,
      };

      const response = await axios.post(this.apiUrl, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.data?.status) {
        throw new Error(response.data.msg);
      }
      return response.data.providers;
    } catch (error) {
      console.error('Failed to fetch provider list:', error);
      throw new Error(error?.message || 'Error getting provider list');
    }
  }

  async updateProviders(providers) {
    const session = await GameProvider.startSession();
    try {
      await session.withTransaction(async () => {
        const formattedProviders = providers.map((provider) => ({
          code: provider.code,
          name: provider.name,
          type: provider.type.toLowerCase(),
          status: provider.status,
        }));

        await GameProvider.bulkWrite(
          formattedProviders.map((provider) => ({
            updateOne: {
              filter: { code: provider.code },
              update: { $set: provider },
              upsert: true,
            },
          }))
        );

        // Deactivate providers not in the list
        const activeCodes = formattedProviders.map((p) => p.code);
        await GameProvider.updateMany({ code: { $nin: activeCodes } }, { $set: { status: 0 } });
      });
    } finally {
      await session.endSession();
    }
  }

  async getGameList(providerCode) {
    try {
      const payload = {
        method: API_METHODS.GAME_LIST,
        provider_code: providerCode,
        ...this.requiredPayload,
      };

      const response = await axios.post(this.apiUrl, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.data?.status) {
        throw new Error(response.data.msg);
      }
      return response.data.games;
    } catch (error) {
      console.error(`Failed to fetch games for provider ${providerCode}:`, error);
      throw new Error(error?.message || 'Error getting game list');
    }
  }

  transformImageUrl(originalUrl) {
    try {
      if (!originalUrl) return originalUrl;
      // if (provider === 'EVOLUTION') {
      //   // Extract the image filename from the original URL and remove extension
      //   const filename = originalUrl
      //     .split('/')
      //     .pop()
      //     .replace(/\.[^/.]+$/, '');

      //   // Construct the new S3 URL with .jpg extension
      //   return `${config.imageStore.URL}/${provider.toLowerCase()}/${filename}.jpg`;
      // }
      return originalUrl;
    } catch (error) {
      console.error('Error transforming Evolution image URL:', error);
      return originalUrl; // Return original URL if transformation fails
    }
  }

  async syncGamesForActiveProviders() {
    const session = await GameList.startSession();
    try {
      await session.withTransaction(async () => {
        // Get all active providers
        const activeProviders = await GameProvider.find({ status: 1 });
        // Track all games for deactivation check
        let allActiveGameCodes = [];

        // Process each provider
        for (const provider of activeProviders) {
          try {
            const games = await this.getGameList(provider.code);
            const formattedGames = games.map((game) => ({
              id: game.id,
              game_code: game.game_code,
              game_name: game.game_name,
              banner: this.transformImageUrl(game.banner, provider.code),
              status: game.status,
              provider_code: provider.code,
              type: provider.type || 'any',
            }));

            // Bulk upsert games for this provider
            await GameList.bulkWrite(
              formattedGames.map((game) => ({
                updateOne: {
                  filter: {
                    game_code: game.game_code,
                    provider_code: provider.code,
                  },
                  update: { $set: game },
                  upsert: true,
                },
              }))
            );

            allActiveGameCodes = [...allActiveGameCodes, ...formattedGames.map((g) => g.game_code)];
            await new Promise((resolve) => setTimeout(resolve, 5000));
          } catch (error) {
            console.error(`Failed to sync games for provider ${provider.code}:`, error);
            // Continue with other providers even if one fails
          }
        }

        // Deactivate games that are no longer in any provider's list
        await GameList.updateMany(
          {
            game_code: { $nin: allActiveGameCodes },
          },
          {
            $set: { status: 0 },
          }
        );
      });
    } finally {
      await session.endSession();
    }
  }

  async getGames({
    offset = 0,
    limit = 10,
    provider = 'all',
    type,
    query: searchWord,
    category = null,
    sortBy = null,
    sortOrder = null,
    userId = null,
  }) {
    try {
      // Validate sortBy to prevent injection attacks
      const allowedSortFields = ['game_name', 'provider_code', 'createdAt', 'updatedAt', '_id'];

      // Only validate if sortBy is provided, otherwise use default
      const validSortBy = sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'game_name';
      const validSortOrder =
        sortOrder && ['asc', 'desc'].includes(sortOrder?.toLowerCase()) ? sortOrder.toLowerCase() : 'asc';

      // Build sort object
      const sortObject = {
        [validSortBy]: validSortOrder === 'asc' ? 1 : -1,
      };

      // Add secondary sorting to ensure consistent results
      if (validSortBy !== 'game_name') {
        sortObject.game_name = 1;
      }
      if (validSortBy !== '_id') {
        sortObject._id = 1;
      }

      let query = {};
      let gameProvider = null;
      let gameIdsOrder = [];

      // Build query based on provider and type
      if (provider !== 'all') {
        const providerQuery = { code: provider };
        // Only apply type filter if not looking for favorites
        if (category !== 'favorite' && type) {
          providerQuery.type = type;
        }
        gameProvider = await GameProvider.findOne(providerQuery).lean();
        if (!gameProvider) {
          throw new Error('Game provider is not found');
        }
        query.provider_code = gameProvider.code;
      } else {
        const providerQuery = { status: 1 };
        // Only apply type filter if not looking for favorites
        if (category !== 'favorite' && type) {
          providerQuery.type = type;
        }
        const providerCodes = await GameProvider.find(providerQuery).distinct('code').lean();
        query.provider_code = { $in: providerCodes };
      }

      query.status = 1;

      if (searchWord) {
        query.game_name = { $regex: searchWord, $options: 'i' };
      }

      if (category) {
        if (category === 'favorite') {
          // Handle favorite games case
          if (!userId) {
            throw new Error('User ID is required for favorite games');
          }

          // Get favorite game IDs for the user
          const favorites = await FavoriteGame.find({ user: userId }).select('game');
          const favoriteGameIds = favorites.map((f) => new Types.ObjectId(f.game));

          if (favoriteGameIds.length > 0) {
            query._id = { $in: favoriteGameIds };
            // Prepare string version for sorting
            gameIdsOrder = favoriteGameIds.map((id) => id.toString());
          } else {
            // If user has no favorites, return empty result
            return {
              data: [],
              pagination: {
                total: 0,
                offset: Number(offset),
                limit: Number(limit),
                hasMore: false,
              },
              sorting: {
                sortBy: validSortBy,
                sortOrder: validSortOrder,
                availableFields: allowedSortFields,
              },
            };
          }
        } else {
          // Handle regular game categories
          const gameCategory = await GameCategory.findOne({ title: category });
          if (gameCategory?.gameIds?.length > 0) {
            // Ensure _id.$in uses ObjectId[]
            const objectIdGameIds = gameCategory.gameIds.map((id) => new Types.ObjectId(id));
            query._id = { $in: objectIdGameIds };

            // Prepare string version for sorting
            gameIdsOrder = gameCategory.gameIds.map((id) => id.toString());
          }
        }
      }

      // Get total count for pagination
      const totalCount = await GameList.countDocuments(query);

      let games;

      // Check if custom sorting is explicitly requested (different) from defaults
      if (gameIdsOrder.length > 0) {
        if (sortBy) {
          // When category is specified AND custom sorting is requested,
          // apply custom sorting instead of category order
          games = await GameList.aggregate([
            { $match: query },
            { $sort: sortObject },
            { $skip: Number(offset) },
            { $limit: Number(limit) },
          ]);
        } else {
          // Default behavior: sort by category gameIds order
          games = await GameList.aggregate([
            { $match: query },
            {
              $addFields: {
                _idStr: { $toString: '$_id' }, // Convert _id to string
              },
            },
            {
              $addFields: {
                sortIndex: {
                  $indexOfArray: [gameIdsOrder, '$_idStr'],
                },
              },
            },
            { $match: { sortIndex: { $gte: 0 } } }, // Exclude items not in category
            { $sort: { sortIndex: 1 } },
            { $skip: Number(offset) },
            { $limit: Number(limit) },
            // Clean up temporary fields
            {
              $project: {
                _idStr: 0,
                sortIndex: 0,
              },
            },
          ]);
        }
      } else {
        // Default sorting when no category or no matching gameIds
        games = await GameList.find(query).sort(sortObject).skip(Number(offset)).limit(Number(limit)).lean();
      }

      return {
        data: games,
        pagination: {
          total: totalCount,
          offset: Number(offset),
          limit: Number(limit),
          hasMore: totalCount > Number(offset) + Number(limit),
        },
        sorting: {
          sortBy: validSortBy,
          sortOrder: validSortOrder,
          availableFields: allowedSortFields,
        },
      };
    } catch (error) {
      console.error('Error in getGames:', error);
      throw new Error(error?.message || 'Error getting game list');
    }
  }

  async getGameCategories() {
    const gameCategories = await GameCategory.find({ isPinned: true }).sort({ displayOrder: 1 }).lean();
    return gameCategories;
  }

  async getGame({ provider_code, game_code }) {
    try {
      let query = {};
      query.status = 1;
      query.provider_code = provider_code;
      query.game_code = game_code;

      // Get paginated results
      const game = await GameList.findOne(query).lean();
      return {
        data: game,
      };
    } catch (error) {
      console.error('Error in getGames:', error);
      throw new Error(error?.message || 'Error getting game list');
    }
  }

  async getProviders({ type = null }) {
    try {
      // Build the provider query
      const providerQuery = type ? { type, status: 1 } : { status: 1 };

      // Get all active providers first
      const providers = await GameProvider.find(providerQuery).lean();

      // Get game counts for each provider using aggregation
      const gameCounts = await GameList.aggregate([
        {
          $match: {
            status: 1,
            provider_code: { $in: providers.map((p) => p.code) },
          },
        },
        {
          $group: {
            _id: '$provider_code',
            count: { $sum: 1 },
          },
        },
      ]);

      // Create a map of provider codes to game counts
      const countMap = gameCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});

      // Combine provider info with game counts
      const providersWithCounts = providers.map((provider) => ({
        ...provider,
        gamesCount: countMap[provider.code] || 0,
      }));

      // Sort providers by game count (descending) and then by name
      const sortedProviders = providersWithCounts.sort((a, b) => {
        if (b.gamesCount !== a.gamesCount) {
          return b.gamesCount - a.gamesCount;
        }
        return a.name.localeCompare(b.name);
      });

      // Get total games count
      const totalGames = await GameList.countDocuments({
        status: 1,
        provider_code: { $in: providers.map((p) => p.code) },
      });

      return {
        data: sortedProviders,
        summary: {
          totalProviders: providers.length,
          totalGames: totalGames,
          type: type || 'all',
        },
      };
    } catch (error) {
      console.error('Error in getProviders:', error);
      throw new Error(error?.message || 'Error getting providers list');
    }
  }

  async launchGame(userId, provider_code, game_code) {
    try {
      if (!config.nexusggr.enable) {
        throw new Error('Game is not enabled');
      }

      const payload = {
        method: API_METHODS.GAME_LAUNCH,
        provider_code: provider_code,
        user_code: userId,
        game_code,
        lang: 'en',
        ...this.requiredPayload,
      };
      logger.debug('payload', payload);
      const response = await axios.post(this.apiUrl, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.data?.status) {
        throw new Error(response.data.msg);
      }
      return response.data;
    } catch (error) {
      console.error('Error in launchGame:', error);
      throw new Error(error?.message || 'Error launch game');
    }
  }

  async createNewUser(userId) {
    try {
      const payload = {
        method: API_METHODS.USER_CREATE,
        user_code: userId,
        ...this.requiredPayload,
      };

      const response = await axios.post(this.apiUrl, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.data?.status) {
        throw new Error(response.data.msg);
      }
      return response.data;
    } catch (error) {
      console.error('Error in createNewUser:', error);
      throw new Error(error?.message || 'Error creating user');
    }
  }

  // Handling nexussggr callback
  getBalanceInfo(userBalance) {
    return { status: 1, user_balance: userBalance };
  }

  processGameData(gameData) {
    const isSlotGame = gameData.game_type === 'slot';
    const gameInfo = isSlotGame ? gameData.slot : gameData.live;
    const gameType = isSlotGame ? GAME_CATEGORIES.SLOTS : GAME_CATEGORIES.LIVE_CASINO;

    return { gameInfo, gameType, isSlotGame };
  }

  calculateUpdateBalance(currentBalance, winMoney, betMoney) {
    const result = parseFloat(currentBalance.toString()) + parseFloat(winMoney) - parseFloat(betMoney);
    return Number(result.toFixed(2));
  }

  async handleTransaction(user, gameData) {
    try {
      const userBalance = await BalanceManagerService.getTotalAvailableBalance(user);
      const { gameInfo } = this.processGameData(gameData);
      const betAmount = parseFloat(gameInfo.bet_money);

      if (!userBalance || userBalance < betAmount) {
        return { status: 0, msg: 'INSUFFICIENT_USER_FUNDS' };
      }

      const casinoGame = await this.placeSpin(user._id, gameData, userBalance);
      const response = await this.casinoGameTransaction(user._id, gameData, casinoGame);
      return response;
    } catch (error) {
      logger.error('Transaction Error:', error);
      return { status: 0, msg: 'TRANSACTION_ERROR' };
    }
  }

  async placeSpin(userId, gameData, userBalance) {
    const user = await User.findById(userId);

    const { gameInfo, gameType } = this.processGameData(gameData);

    const game_link = await GameList.findOne({
      game_code: gameInfo.game_code,
    });

    if (!game_link) {
      throw new Error('Game not found');
    }

    let casinoGame = await CasinoGame.findByTransactionId(gameInfo.txn_id);

    if (!casinoGame) {
      casinoGame = new CasinoGame({
        userId: user._id,
        gameCategory: gameType,
        providerCode: gameInfo.provider_code,
        gameCode: gameInfo.game_code,
        gameName: game_link.game_name,
        transactionId: gameInfo.txn_id,
        roundType: gameInfo.type || 'BASE',
        betAmount: gameInfo.bet_money,
        winAmount: gameInfo.win_money,
        currency: 'USD',
        userBalance: userBalance,
        gameData: gameInfo,
        players: [
          {
            playerId: user._id,
            username: user.username,
            betAmount: gameInfo.bet_money,
            winAmount: gameInfo.win_money,
            isBot: false,
            avatar: user.avatar || '',
          },
        ],
        totalWagers: gameInfo.bet_money,
        totalPayouts: gameInfo.win_money || 0,
      });
    }

    await casinoGame.save();
    return casinoGame;
  }

  async casinoGameTransaction(userId, gameData, casinoGame) {
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 1000; // 1 second initial delay
    const MAX_RETRY_DELAY = 5000; // 5 seconds max delay

    let retryCount = 0;
    let retryDelay = INITIAL_RETRY_DELAY;

    while (retryCount < MAX_RETRIES) {
      try {
        const user = await User.findById(userId);
        const { gameInfo, gameType } = this.processGameData(gameData);
        const game_link = await GameList.findOne({
          game_code: gameInfo.game_code,
          provider_code: gameInfo.provider_code,
        });

        const transactionHandler = new GameTransactionHandler(gameType);
        await transactionHandler.startTransaction(user._id, {
          id: casinoGame._id,
          category: casinoGame.gameCategory,
          gameName: game_link.game_name,
          provider: game_link.category_name,
          transactionId: gameInfo.txn_id,
          currency: 'BRC',
        });

        let availableBalance = 0;

        try {
          // Process bet
          const betResponse = await transactionHandler.placeBet(gameInfo.bet_money);

          availableBalance = betResponse.availableBalance;

          // Process win/lose
          if (gameInfo.win_money > 0) {
            const result = await transactionHandler.win(gameInfo.win_money);

            availableBalance = result.availableBalance;

            const betHistory = await BetHistory.createHistory({
              betAmount: gameInfo.bet_money,
              username: user.username,
              avatar: user.avatar,
              playerId: user._id,
              payout: gameInfo.win_money,
              category: gameType,
              metadata: {
                game_code: gameInfo.game_code,
                provider_code: gameInfo.provider_code,
                game_name: game_link.game_name,
                banner: game_link.banner,
              },
            });

            betHistorySocketController.emitNewBet({
              id: betHistory._id,
              betAmount: gameInfo.bet_money,
              username: user.username,
              avatar: user.avatar,
              playerId: user._id,
              payout: gameInfo.win_money,
              category: gameType,
              time: new Date(),
              metadata: {
                game_code: gameInfo.game_code,
                provider_code: gameInfo.provider_code,
                game_name: game_link.game_name,
                banner: game_link.banner,
              },
            });
          } else {
            await transactionHandler.lose();
          }

          // Update game status using model method
          await casinoGame.updateStatus(GAME_STATUS.Completed, {
            winAmount: gameInfo.win_money,
            userBalance: availableBalance,
            totalPayouts: gameInfo.win_money || 0,
          });

          logger.info('nexusggr/gold_api availableBalance', availableBalance);

          return { status: 1, user_balance: availableBalance };
        } catch (error) {
          // Handle transaction error using model method
          await casinoGame.setError(error);
          throw error;
        } finally {
          transactionHandler.reset();
        }
      } catch (error) {
        // Check if error is a transient MongoDB error
        const isTransientError =
          error.code === 11000 || // Duplicate key error
          error.code === 112 || // Write conflict
          error.errorLabels?.includes('TransientTransactionError');

        if (isTransientError) {
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            // Exponential backoff with jitter
            retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
            const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
            const actualDelay = retryDelay + jitter;

            logger.warn(
              `MongoDB transient error detected, retrying (attempt ${retryCount} of ${MAX_RETRIES}) after ${actualDelay}ms delay`
            );
            await new Promise((resolve) => setTimeout(resolve, actualDelay));
            continue;
          }
        }

        logger.error('Casino game transaction failed:', error);
        throw error;
      }
    }

    throw new Error('Max retries exceeded for casino game transaction');
  }

  async handleCallback(req) {
    const body = req.body;
    const { user_code, method } = body;

    logger.debug(req.body, 'incoming webhook request from nexusggr');

    const user = await User.findOne({
      _id: user_code,
    });

    if (!user) {
      return { status: 0, msg: 'INSUFFICIENT_USER_FUNDS' };
    }

    const availableBalance = await BalanceManagerService.getTotalAvailableBalance(user);

    switch (method) {
      case API_CALLBACK_METHODS.USER_BALANCE:
        return await this.getBalanceInfo(availableBalance);
      case API_CALLBACK_METHODS.TRANSACTION: {
        const response = await this.handleTransaction(user, body);
        logger.debug('response --- handleCallback', response);
        return response;
      }
      default:
        return { status: 0 };
    }
  }

  async getFavoriteGames({ offset = 0, limit = 10, query: searchWord }, userId) {
    try {
      let query = {
        status: 1,
      };
      if (searchWord) {
        query.game_name = { $regex: searchWord, $options: 'i' };
      }

      // Step 1: Get favorite game IDs for the user
      const favorites = await FavoriteGame.find({ user: userId }).select('game');
      const favoriteGameIds = favorites.map((f) => f.game);

      // Step 2: Count total matching games
      const totalCount = await GameList.countDocuments({ _id: { $in: favoriteGameIds }, ...query });

      // Step 3: Paginated query on Game collection
      const games = await GameList.find({ _id: { $in: favoriteGameIds }, ...query })
        .sort({ game_name: 1 }) // Sort by game name
        .skip(Number(offset))
        .limit(Number(limit))
        .lean();

      return {
        data: games,
        pagination: {
          total: totalCount,
          offset: Number(offset),
          limit: Number(limit),
          hasMore: totalCount > Number(offset) + Number(limit),
        },
      };
    } catch (error) {
      console.error('Error in getGames:', error);
      throw new Error(error?.message || 'Error getting game list');
    }
  }
}

// Create a singleton instance
export const nexusGGRService = new NexusGGRService();

export default nexusGGRService;
