import BlueOceanGameProvider from '@/models/slotGames/blueocean/BlueOceanGameProvider';
import BlueOceanGame from '@/models/slotGames/blueocean/BlueOceanGames';
import { BlueOceanGameProviders, BlueOceanGameTypes } from '@/types/casino/blueocean/blueocean-provider';
import { logger } from '@/utils/logger';
import blueOceanService from './BlueOcean.out.service';

interface GetGamesParams {
  offset?: number;
  limit?: number;
  provider?: BlueOceanGameProviders;
  type?: BlueOceanGameTypes;
  query?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  userId?: string;
  featurebuySupported?: boolean;
}

interface GameWithProvider {
  _id: string;
  gameId: string;
  name: string;
  type: BlueOceanGameTypes;
  subcategory: string;
  category: string;
  system: string;
  provider: BlueOceanGameProviders;
  providerName: string;

  // Game details
  details: string;
  licence: string;
  gamename: string;
  report: string;

  // Game metadata
  isNewGame: boolean;
  position: number;
  plays: number;
  rtp: string;
  wagering: string | null;

  // Platform support
  mobile: boolean;
  playForFunSupported: boolean;
  freeroundsSupported: boolean;
  featurebuySupported: boolean;
  hasJackpot: boolean;

  // Dates
  releaseDate: Date;
  showDate: Date;
  hideDate: Date | null;

  // Identifiers
  idHash: string;
  idParent: string;
  idHashParent: string;
  lottie: string | null;

  // Images
  image: string;
  imagePreview: string;
  imageFilled: string;
  imagePortrait: string;
  imageSquare: string;
  imageBackground: string;
  imageLottie: string;
  imagePortraitLottie: string;
  imageSquareLottie: string;
  imageBw: string;

  // Status and management
  status: 1 | 'inactive' | 'hidden';
  isEnabled: boolean;
  isFeatured: boolean;
  order: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date;
}
export class BlueOceanGameService {
  private shouldUseMockFallback(): boolean {
    return process.env.BLUEOCEAN_USE_MOCK === 'true';
  }

  /** BlueOcean getGameList often omits status; only explicit inactive/hidden/0 means disabled. */
  private isGameExplicitlyInactive(apiStatus: unknown): boolean {
    return (
      apiStatus === 'inactive' ||
      apiStatus === 'hidden' ||
      apiStatus === 0 ||
      apiStatus === '0'
    );
  }

  /** Single shape for getGames() — DB documents and mock rows both map through here. */
  private mapToGetGamesClientShape(
    input: {
      _id: string;
      gameId: string;
      provider: string;
      name: string;
      imagePortrait: string;
      type: string;
      status: string;
      order: number;
      isFeatured: boolean;
      featurebuySupported: boolean;
    },
    clientIdOverride?: number
  ) {
    const id =
      clientIdOverride !== undefined
        ? clientIdOverride
        : parseInt(input.gameId, 10) || 0;
    return {
      _id: input._id,
      id,
      game_code: input.gameId,
      provider_code: input.provider,
      game_name: input.name,
      banner: input.imagePortrait,
      type: input.type,
      status: input.status === 'active' ? 1 : 0,
      order: input.order,
      is_pinned: input.isFeatured,
      featurebuySupported: input.featurebuySupported,
    };
  }

  private getMockGames(): Array<{
    _id: string;
    id: number;
    game_code: string;
    provider_code: string;
    game_name: string;
    banner: string;
    type: string;
    status: number;
    order: number;
    is_pinned: boolean;
    featurebuySupported: boolean;
  }> {
    const providers = ['pragmatic_play', 'netent', 'playtech', 'playn_go', 'bgaming', 'evoplay'];
    const types = ['video-slots', 'livecasino', 'table-games'];

    return Array.from({ length: 60 }).map((_, index) => {
      const id = index + 1;
      return {
        _id: `mock_game_${id}`,
        id,
        game_code: `mock_${id}`,
        provider_code: providers[index % providers.length],
        game_name: `Demo Game ${id}`,
        banner: `https://picsum.photos/seed/twox-game-${id}/300/400`,
        type: types[index % types.length],
        status: 1,
        order: id,
        is_pinned: id % 10 === 0,
        featurebuySupported: id % 3 === 0,
      };
    });
  }

  // Fetch games from BlueOcean API
  public async fetchGamesFromAPI(): Promise<{
    success: boolean;
    data: any[];
    providerLogos?: {
      casino: any[];
      livecasino: any[];
      sportsbook: any[];
    };
    message?: string;
  }> {
    try {
      const response = await blueOceanService.getGameList({
        currency: 'EUR',
        show_additional: true,
        show_systems: '1'
      });

      if (response.error && response.error !== 0) {
        throw new Error(`API error: ${response.error}`);
      }

      const games = response.response || [];
      const providerLogos = response.response_provider_logos || {
        casino: [],
        livecasino: [],
        sportsbook: []
      };
      
      // Log provider logos structure for debugging
      logger.info('BlueOcean API response structure', {
        hasProviderLogos: !!response.response_provider_logos,
        casinoCount: providerLogos?.casino?.length || 0,
        livecasinoCount: providerLogos?.livecasino?.length || 0,
        sportsbookCount: providerLogos?.sportsbook?.length || 0,
        gamesCount: games.length
      });
      
      return {
        success: true,
        data: games,
        providerLogos: providerLogos,
      };
    } catch (error: any) {
      logger.error('Failed to fetch games from BlueOcean API', error);
      
      // Check if it's a network error
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message.includes('Network error')) {
        return {
          success: false,
          data: [],
          message: 'BlueOcean API is not accessible. Please check your internet connection and API credentials.',
        };
      }
      
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to fetch games from API',
      };
    }
  }

  // Sync games from API to database
  public async syncGamesFromAPI(): Promise<{
    success: boolean;
    syncedCount: number;
    message?: string;
  }> {
    try {
      const apiResponse = await this.fetchGamesFromAPI();
      
      if (!apiResponse.success) {
        throw new Error(apiResponse.message || 'Failed to fetch games from API');
      }

      const games = apiResponse.data;
      let syncedCount = 0;

      for (const game of games) {
        try {
          // Map API game data to BlueOcean schema
          const gameId = game.game_id || game.id || game.gameId;
          if (!gameId) {
            logger.warn('Skipping game with no gameId', game);
            continue;
          }

          const gameData = {
            gameId: gameId,
            name: game.game_name || game.name || game.title || 'Unknown Game',
            type: this.mapGameType(game.type || game.game_type || 'slot'),
            subcategory: game.subcategory || '',
            category: game.category || 'slots',
            system: game.system || 'html5',
            provider: this.mapProvider(game.provider || game.provider_code || 'unknown'),
            providerName: game.provider_name || game.provider || 'Unknown Provider',
            details: typeof game.details === 'string' ? game.details : JSON.stringify(game.details || {}),
            licence: game.licence || '',
            gamename: game.game_name || game.name || game.gamename || '',
            report: game.report || gameId, // Use gameId as fallback for required report field
            isNewGame: game.is_new === '1' || game.is_new === true || game.isNewGame === true || false,
            position: parseInt(game.position) || 0,
            plays: parseInt(game.plays) || 0,
            rtp: game.rtp || '0',
            wagering: game.wagering || null,
            mobile: game.mobile === '1' || game.mobile === true || game.mobile === undefined ? true : false,
            playForFunSupported: game.play_for_fun === '1' || game.play_for_fun === true || game.playForFunSupported === true || false,
            freeroundsSupported: game.free_rounds === '1' || game.free_rounds === true || game.freeroundsSupported === true || false,
            featurebuySupported: game.feature_buy === '1' || game.feature_buy === true || game.featurebuySupported === true || false,
            hasJackpot: game.jackpot === '1' || game.jackpot === true || game.hasJackpot === true || false,
            releaseDate: game.release_date && !isNaN(new Date(game.release_date).getTime()) ? new Date(game.release_date) : new Date(),
            showDate: game.show_date && !isNaN(new Date(game.show_date).getTime()) ? new Date(game.show_date) : new Date(),
            hideDate: game.hide_date && !isNaN(new Date(game.hide_date).getTime()) ? new Date(game.hide_date) : null,
            idHash: game.id_hash || gameId,
            idParent: game.id_parent || '',
            idHashParent: game.id_hash_parent || '',
            lottie: game.lottie || null,
            image: game.image || game.banner || '',
            imagePreview: game.image_preview || game.image || '',
            imageFilled: game.image_filled || game.image || '',
            imagePortrait: game.image_portrait || game.image || '',
            imageSquare: game.image_square || game.image || '',
            imageBackground: game.image_background || game.image || '',
            imageLottie: game.image_lottie || '',
            imagePortraitLottie: game.image_portrait_lottie || '',
            imageSquareLottie: game.image_square_lottie || '',
            imageBw: game.image_bw || '',
            status: this.isGameExplicitlyInactive(game.status) ? 'inactive' : 'active',
            isEnabled: !this.isGameExplicitlyInactive(game.status),
            isFeatured: game.featured === '1' || game.featured === true || game.isFeatured === true || false,
            order: parseInt(game.order) || 0,
            lastSyncAt: new Date(),
          };

          // Use findOneAndUpdate with runValidators to ensure validation runs
          const result = await BlueOceanGame.findOneAndUpdate(
            { gameId: gameData.gameId },
            { $set: gameData },
            { 
              upsert: true, 
              new: true,
              runValidators: true,
              setDefaultsOnInsert: true
            }
          );

          if (result) {
            syncedCount++;
          } else {
            logger.warn(`Failed to upsert game ${gameData.gameId}`);
          }
        } catch (gameError: any) {
          logger.error(`Failed to sync game ${game.game_id || game.id || 'unknown'}`, {
            error: gameError.message,
            stack: gameError.stack,
            gameData: {
              game_id: game.game_id,
              id: game.id,
              name: game.game_name || game.name
            }
          });
        }
      }

      // Also sync providers - always try to sync, even if not in response
      logger.info('Starting provider sync...');
      const providerSyncResult = await this.syncProvidersFromAPI(apiResponse.providerLogos);
      logger.info(`Provider sync result: ${providerSyncResult.syncedCount} providers synced`, {
        success: providerSyncResult.success,
        message: providerSyncResult.message
      });

      return {
        success: true,
        syncedCount,
        message: `Successfully synced ${syncedCount} games`,
      };
    } catch (error: any) {
      logger.error('Failed to sync games from API', error);
      return {
        success: false,
        syncedCount: 0,
        message: error.message || 'Failed to sync games',
      };
    }
  }

  // Sync providers from API to database
  public async syncProvidersFromAPI(providerLogos?: {
    casino: any[];
    livecasino: any[];
    sportsbook: any[];
  }): Promise<{
    success: boolean;
    syncedCount: number;
    message?: string;
  }> {
    try {
      // If providerLogos not provided, fetch from API
      if (!providerLogos) {
        logger.info('Provider logos not provided, fetching from API...');
        const apiResponse = await this.fetchGamesFromAPI();
        if (!apiResponse.success) {
          throw new Error(apiResponse.message || 'Failed to fetch provider logos from API');
        }
        providerLogos = apiResponse.providerLogos || {
          casino: [],
          livecasino: [],
          sportsbook: []
        };
      }

      logger.info('Processing provider logos', {
        casinoCount: providerLogos?.casino?.length || 0,
        livecasinoCount: providerLogos?.livecasino?.length || 0,
        sportsbookCount: providerLogos?.sportsbook?.length || 0
      });

      let syncedCount = 0;
      const allProviders: any[] = [];

      // Process casino providers
      if (providerLogos.casino && Array.isArray(providerLogos.casino) && providerLogos.casino.length > 0) {
        logger.info(`Processing ${providerLogos.casino.length} casino providers`);
        const casinoProviders = providerLogos.casino
          .filter(provider => provider && provider.system && provider.name) // Filter out invalid providers
          .map((provider) => ({
            type: 'casino',
            name: provider.name || '',
            system: provider.system || '',
            provider: (provider.system || '').toLowerCase(),
            providerName: provider.name || '',
            image: provider.image || '',
            imageBlack: provider.image_black || '',
            imageWhite: provider.image_white || '',
            imageColored: provider.image_colored || '',
            imageSmallColor: provider.image_small_color || '',
            imageSmallGray: provider.image_small_gray || '',
            status: 1, // Default to enabled
          }));
        allProviders.push(...casinoProviders);
        logger.info(`Added ${casinoProviders.length} casino providers to sync list`);
      }

      // Process livecasino providers (FIX: use providers.livecasino, not providers.casino)
      if (providerLogos.livecasino && Array.isArray(providerLogos.livecasino) && providerLogos.livecasino.length > 0) {
        logger.info(`Processing ${providerLogos.livecasino.length} livecasino providers`);
        const livecasinoProviders = providerLogos.livecasino
          .filter(provider => provider && provider.system && provider.name) // Filter out invalid providers
          .map((provider) => ({
            type: 'livecasino',
            name: provider.name || '',
            system: provider.system || '',
            provider: (provider.system || '').toLowerCase(),
            providerName: provider.name || '',
            image: provider.image || '',
            imageBlack: provider.image_black || '',
            imageWhite: provider.image_white || '',
            imageColored: provider.image_colored || '',
            imageSmallColor: provider.image_small_color || '',
            imageSmallGray: provider.image_small_gray || '',
            status: 1, // Default to enabled
          }));
        allProviders.push(...livecasinoProviders);
        logger.info(`Added ${livecasinoProviders.length} livecasino providers to sync list`);
      }

      // Process sportsbook providers
      if (providerLogos.sportsbook && Array.isArray(providerLogos.sportsbook) && providerLogos.sportsbook.length > 0) {
        logger.info(`Processing ${providerLogos.sportsbook.length} sportsbook providers`);
        const sportsbookProviders = providerLogos.sportsbook
          .filter(provider => provider && provider.system && provider.name) // Filter out invalid providers
          .map((provider) => ({
            type: 'sportsbook',
            name: provider.name || '',
            system: provider.system || '',
            provider: (provider.system || '').toLowerCase(),
            providerName: provider.name || '',
            image: provider.image || '',
            imageBlack: provider.image_black || '',
            imageWhite: provider.image_white || '',
            imageColored: provider.image_colored || '',
            imageSmallColor: provider.image_small_color || '',
            imageSmallGray: provider.image_small_gray || '',
            status: 1, // Default to enabled
          }));
        allProviders.push(...sportsbookProviders);
        logger.info(`Added ${sportsbookProviders.length} sportsbook providers to sync list`);
      }

      logger.info(`Total providers to sync: ${allProviders.length}`);

      // Upsert each provider
      for (const providerData of allProviders) {
        try {
          // Validate required fields (check for null/undefined, not empty strings)
          if (
            providerData.provider === null || providerData.provider === undefined ||
            providerData.providerName === null || providerData.providerName === undefined ||
            providerData.name === null || providerData.name === undefined ||
            providerData.system === null || providerData.system === undefined ||
            providerData.type === null || providerData.type === undefined
          ) {
            logger.warn('Skipping provider with missing required fields', {
              provider: providerData.provider,
              providerName: providerData.providerName,
              name: providerData.name,
              system: providerData.system,
              type: providerData.type
            });
            continue;
          }

          // Use findOneAndUpdate with upsert to update existing or create new
          const result = await BlueOceanGameProvider.findOneAndUpdate(
            { 
              provider: providerData.provider.toLowerCase(),
              type: providerData.type 
            },
            { $set: providerData },
            { 
              upsert: true, 
              new: true,
              runValidators: true,
              setDefaultsOnInsert: true
            }
          );

          if (result) {
            syncedCount++;
            logger.debug(`Successfully synced provider: ${providerData.provider} (${providerData.type})`);
          } else {
            logger.warn(`Failed to upsert provider ${providerData.provider} (${providerData.type})`);
          }
        } catch (providerError: any) {
          logger.error(`Failed to sync provider ${providerData.provider} (${providerData.type})`, {
            error: providerError.message,
            stack: providerError.stack,
            providerData: {
              provider: providerData.provider,
              type: providerData.type,
              name: providerData.name
            }
          });
        }
      }

      logger.info(`Successfully synced ${syncedCount} out of ${allProviders.length} providers from API`);
      return {
        success: true,
        syncedCount,
        message: `Successfully synced ${syncedCount} providers`,
      };
    } catch (error: any) {
      logger.error('Failed to sync providers from API', error);
      return {
        success: false,
        syncedCount: 0,
        message: error.message || 'Failed to sync providers',
      };
    }
  }

  // Map game type from API to BlueOcean type
  private mapGameType(apiType: string): BlueOceanGameTypes {
    const typeMap: { [key: string]: BlueOceanGameTypes } = {
      'slot': BlueOceanGameTypes['video-slots'],
      'slots': BlueOceanGameTypes['video-slots'],
      'live': BlueOceanGameTypes.livecasino,
      'live_casino': BlueOceanGameTypes.livecasino,
      'table': BlueOceanGameTypes['table-games'],
      'table_games': BlueOceanGameTypes['table-games'],
      'roulette': BlueOceanGameTypes['live-casino-table'],
      'blackjack': BlueOceanGameTypes['live-casino-table'],
    };
    
    return typeMap[apiType.toLowerCase()] || BlueOceanGameTypes['video-slots'];
  }

  // Map provider from API to BlueOcean provider
  private mapProvider(apiProvider: string): BlueOceanGameProviders {
    // This is a simplified mapping - you may need to expand this based on actual provider codes
    const providerMap: { [key: string]: BlueOceanGameProviders } = {
      'pragmatic': BlueOceanGameProviders.pragmatic_play,
      'pragmatic_play': BlueOceanGameProviders.pragmatic_play,
      'netent': BlueOceanGameProviders.netent,
      'netent_premium': BlueOceanGameProviders.netent_premium,
      'playtech': BlueOceanGameProviders.playtech,
      'playn_go': BlueOceanGameProviders.playn_go,
      'evolution': BlueOceanGameProviders.pragmatic_play, // Map to available provider
      'ezugi': BlueOceanGameProviders.pragmatic_play, // Map to available provider
      'microgaming': BlueOceanGameProviders.pragmatic_play, // Map to available provider
    };
    
    return providerMap[apiProvider.toLowerCase()] || BlueOceanGameProviders.pragmatic_play; // Default to pragmatic
  }

  // Get games with filtering, searching, and pagination (formatted for frontend)
  public async getGames(params: GetGamesParams = {}): Promise<{
    success: boolean;
    data: any[];
    pagination: {
      total: number;
      offset: number;
      limit: number;
      hasMore: boolean;
    };
    message?: string;
  }> {
    const {
      offset = 0,
      limit,
      provider,
      type,
      query: searchWord,
      category,
      sortBy,
      sortOrder = 'desc',
      featurebuySupported,
    } = params;
    try {
      // Calculate pagination
      const limitNum = Math.max(1, Math.min(100, limit || 28)); // Default to 28 if undefined
      const page = Math.floor(offset / limitNum) + 1;
      const skip = offset;

      // Playable catalog: sync stores games as active unless API marks inactive/hidden
      // (see isGameExplicitlyInactive). Listing inactive would expose disabled titles.
      const filter: Record<string, any> = {
        status: 'active',
        isEnabled: true,
        idHash: { $not: /mobile/i } // Exclude mobile versions
      };

      // Provider filter
      if (provider && provider !== 'all' as any) {
        filter.provider = provider.toLowerCase();
      }

      // Type filter
      if (type && type !== 'all' as any) {
        filter.type = type.toLowerCase();
      }

      // Category filter
      if (category && category !== 'all') {
        filter.category = category.toLowerCase();
      }

      // Feature Buy-In filter
      if (featurebuySupported !== undefined) {
        filter.featurebuySupported = featurebuySupported;
      }

      // Search filter
      if (searchWord && searchWord.trim()) {
        const searchRegex = new RegExp(searchWord.trim(), 'i');
        filter.$or = [
          { name: searchRegex },
          { gamename: searchRegex },
          { providerName: searchRegex },
          { gameId: searchRegex },
        ];
      }

      // Build sort object
      const sort: Record<string, 1 | -1> = {};
      const validSortFields = [
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
        'isFeatured',
      ];

      if (sortBy && validSortFields.includes(sortBy)) {
        if (sortBy === 'plays') {
          // Special handling for plays: sort by plays first, then by createdAt for null/zero values
          sort.plays = sortOrder === 'asc' ? 1 : -1;
          sort.createdAt = sortOrder === 'asc' ? 1 : -1; // Secondary sort by creation date
        } else {
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }
      } else {
        sort.createdAt = -1; // Default sort
      }

      // Add secondary sort for consistency (only if not already set)
      if (sortBy !== 'createdAt' && !sort.createdAt) {
        sort.createdAt = -1;
      }

      // Execute queries in parallel
      const [games, totalCount] = await Promise.all([
        BlueOceanGame.find(filter).sort(sort).skip(skip).limit(limitNum).lean().exec(),
        BlueOceanGame.countDocuments(filter),
      ]);

      if (totalCount === 0 && this.shouldUseMockFallback()) {
        const mockGames = this.getMockGames();
        const filteredMockGames = mockGames.filter((game) => {
          if (provider && provider !== ('all' as any) && game.provider_code !== String(provider).toLowerCase()) return false;
          if (type && type !== ('all' as any) && game.type !== String(type).toLowerCase()) return false;
          if (category && category !== 'all' && game.type !== String(category).toLowerCase()) return false;
          if (featurebuySupported !== undefined && game.featurebuySupported !== featurebuySupported) return false;
          if (searchWord && searchWord.trim()) {
            const q = searchWord.trim().toLowerCase();
            return (
              game.game_name.toLowerCase().includes(q) ||
              game.game_code.toLowerCase().includes(q) ||
              game.provider_code.toLowerCase().includes(q)
            );
          }
          return true;
        });

        const sortedMockGames = [...filteredMockGames].sort((a, b) => {
          if (sortBy === 'plays' || sortBy === 'order') {
            return sortOrder === 'asc' ? a.order - b.order : b.order - a.order;
          }
          return a.game_name.localeCompare(b.game_name);
        });

        const pagedMockGames = sortedMockGames.slice(skip, skip + limitNum);
        const mockRows = pagedMockGames.map((mock) =>
          this.mapToGetGamesClientShape(
            {
              _id: mock._id,
              gameId: mock.game_code,
              provider: mock.provider_code,
              name: mock.game_name,
              imagePortrait: mock.banner,
              type: mock.type,
              status: mock.status === 1 ? 'active' : 'inactive',
              order: mock.order,
              isFeatured: mock.is_pinned,
              featurebuySupported: mock.featurebuySupported,
            },
            mock.id
          )
        );
        return {
          success: true,
          data: mockRows,
          pagination: {
            total: sortedMockGames.length,
            offset,
            limit: limitNum,
            hasMore: offset + limitNum < sortedMockGames.length,
          },
          message: 'Serving mock games in development mode',
        };
      }

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const currentPage = page;
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      const transformedGames = games.map((game) =>
        this.mapToGetGamesClientShape({
          _id: game._id.toString(),
          gameId: game.gameId,
          provider: game.provider,
          name: game.name,
          imagePortrait: game.imagePortrait,
          type: game.type,
          status: game.status,
          order: game.order,
          isFeatured: game.isFeatured,
          featurebuySupported: game.featurebuySupported,
        })
      );

      return {
        success: true,
        data: transformedGames,
        pagination: {
          total: totalCount,
          offset,
          limit: limitNum,
          hasMore: offset + limitNum < totalCount,
        },
      };
    } catch (error: any) {
      logger.error('Failed to fetch BlueOcean games', error);
      return {
        success: false,
        data: [],
        pagination: {
          total: 0,
          offset,
          limit: limit || 10,
          hasMore: false,
        },
        message: error.message || 'Failed to fetch games',
      };
    }
  }

  // Get available providers
  public async getProviders(): Promise<{
    success: boolean;
    data: any[];
    message?: string;
  }> {
    try {
      // Get providers from the provider collection, excluding those with status = 0
      // Only include providers with status !== 0 (status = 1 or status is undefined/null)
      const providerDetails = await BlueOceanGameProvider.find({
        $or: [
          { status: { $ne: 0 } },
          { status: { $exists: false } },
          { status: null },
        ],
      }).lean().exec();
      
      // Deduplicate providers by code (keep the first occurrence)
      const uniqueProviders = providerDetails.reduce((acc, provider) => {
        if (!acc.has(provider.provider)) {
          acc.set(provider.provider, provider);
        }
        return acc;
      }, new Map());
      
      const uniqueProviderDetails = Array.from(uniqueProviders.values());
      
      // Debug: Log the deduplication results
      console.log(`Original providers: ${providerDetails.length}, Unique providers: ${uniqueProviderDetails.length}`);
      
      // Extract provider codes
      const providers = uniqueProviderDetails.map(p => p.provider);

      // Create a map for quick lookup
      const providerMap = new Map();
      uniqueProviderDetails.forEach(provider => {
        providerMap.set(provider.provider, provider);
      });

      // Count only playable games (aligned with getGames / sync active-by-default rules)
      const gamesCounts = await BlueOceanGame.aggregate([
        {
          $match: {
            status: 'active',
            isEnabled: true,
            provider: { $in: providers }
          }
        },
        {
          $group: {
            _id: '$provider',
            gamesCount: { $sum: 1 }
          }
        }
      ]);

      // Create a map for games count lookup
      const gamesCountMap = new Map();
      gamesCounts.forEach(item => {
        gamesCountMap.set(item._id, item.gamesCount);
      });

      // Transform providers to match frontend expected format
      const transformedProviders = uniqueProviderDetails.map((provider, index) => {
        const gamesCount = gamesCountMap.get(provider.provider) || 0;
        
        return {
          _id: provider._id?.toString() || `provider_${index}`,
          code: provider.provider,
          name: provider.providerName || provider.provider,
          type: provider.type || 'slot',
          id: index + 1,
          gamesCount: gamesCount,
          image: provider.imageWhite || '',
          imageColored: provider.imageColored || '',
          imageSmallColor: provider.imageSmallColor || '',
        };
      });

      // Sort providers by games count (descending) and then by name
      transformedProviders.sort((a, b) => {
        if (b.gamesCount !== a.gamesCount) {
          return b.gamesCount - a.gamesCount;
        }
        return a.name.localeCompare(b.name);
      });

      if (transformedProviders.length === 0 && this.shouldUseMockFallback()) {
        const mockGames = this.getMockGames();
        const providerCodes = Array.from(new Set(mockGames.map((g) => g.provider_code)));
        const mockProviders = providerCodes.map((code, index) => ({
          _id: `mock_provider_${index + 1}`,
          code,
          name: code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          type: 'slot',
          id: index + 1,
          gamesCount: mockGames.filter((g) => g.provider_code === code).length,
          image: '',
          imageColored: '',
          imageSmallColor: '',
        }));

        return {
          success: true,
          data: mockProviders,
          message: 'Serving mock providers in development mode',
        };
      }

      return {
        success: true,
        data: transformedProviders,
      };
    } catch (error: any) {
      logger.error('Failed to fetch BlueOcean providers', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to fetch providers',
      };
    }
  }

  // Get available categories
  public async getCategories(): Promise<{
    success: boolean;
    data: string[];
    message?: string;
  }> {
    try {
      const categoriesWithCount = await BlueOceanGame.aggregate([
        {
          $match: {
            status: 'active',
            isEnabled: true,
            category: { $exists: true, $ne: null, $nin: ['', null] }
          }
        },
        {
          $group: {
            _id: '$category',
            gamesCount: { $sum: 1 }
          }
        },
        {
          $match: {
            _id: { $ne: null, $nin: ['', null] }
          }
        },
        {
          $sort: { gamesCount: -1, _id: 1 }
        }
      ]);

      // Extract category names and filter out empty ones
      const categories = categoriesWithCount
        .map(item => item._id)
        .filter((cat) => cat && cat.trim());

      logger.info(`Found ${categories.length} categories with games`, {
        categories: categories.slice(0, 10) // Log first 10 for debugging
      });

      if (categories.length === 0 && this.shouldUseMockFallback()) {
        const mockCategories = Array.from(new Set(this.getMockGames().map((g) => g.type)));
        return {
          success: true,
          data: mockCategories,
          message: 'Serving mock categories in development mode',
        };
      }

      return {
        success: true,
        data: categories,
      };
    } catch (error: any) {
      logger.error('Failed to fetch BlueOcean categories', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to fetch categories',
      };
    }
  }

  // Get available game types
  public async getGameTypes(): Promise<{
    success: boolean;
    data: string[];
    message?: string;
  }> {
    try {
      const types = await BlueOceanGame.distinct('type', {
        status: 1,
        isEnabled: true,
      });

      return {
        success: true,
        data: types.filter((type) => type && type.trim()),
      };
    } catch (error: any) {
      logger.error('Failed to fetch BlueOcean game types', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to fetch game types',
      };
    }
  }

  // Get game statistics
  public async getGameStats(): Promise<{
    success: boolean;
    data: {
      totalGames: number;
      activeGames: number;
      featuredGames: number;
      newGames: number;
      mobileGames: number;
      totalProviders: number;
      totalCategories: number;
      totalTypes: number;
    };
    message?: string;
  }> {
    try {
      const [totalGames, activeGames, featuredGames, newGames, mobileGames, totalProviders, categories, types] =
        await Promise.all([
          BlueOceanGame.countDocuments({}),
          BlueOceanGame.countDocuments({ status: 1, isEnabled: true }),
          BlueOceanGame.countDocuments({ status: 1, isEnabled: true, isFeatured: true }),
          BlueOceanGame.countDocuments({ status: 1, isEnabled: true, isNewGame: true }),
          BlueOceanGame.countDocuments({ status: 1, isEnabled: true, mobile: true }),
          BlueOceanGameProvider.countDocuments({}),
          BlueOceanGame.distinct('category', { status: 1, isEnabled: true }),
          BlueOceanGame.distinct('type', { status: 1, isEnabled: true }),
        ]);

      return {
        success: true,
        data: {
          totalGames,
          activeGames,
          featuredGames,
          newGames,
          mobileGames,
          totalProviders,
          totalCategories: categories.length,
          totalTypes: types.length,
        },
      };
    } catch (error: any) {
      logger.error('Failed to fetch BlueOcean game statistics', error);
      return {
        success: false,
        data: {
          totalGames: 0,
          activeGames: 0,
          featuredGames: 0,
          newGames: 0,
          mobileGames: 0,
          totalProviders: 0,
          totalCategories: 0,
          totalTypes: 0,
        },
        message: error.message || 'Failed to fetch game statistics',
      };
    }
  }

  // Get individual game details
  public async getGame(params: {
    provider_code: string;
    game_code: string;
  }): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      const { provider_code, game_code } = params;

      // Find the game in the database
      const game = await BlueOceanGame.findOne({
        gameId: game_code,
        provider: provider_code,
      });

      if (!game) {
        if (this.shouldUseMockFallback()) {
          const mockGame = this.getMockGames().find(
            (g) => g.game_code === game_code && g.provider_code === provider_code
          );
          if (mockGame) {
            return {
              success: true,
              data: {
                _id: mockGame._id,
                provider_code: mockGame.provider_code,
                game_code: mockGame.game_code,
                game_name: mockGame.game_name,
                banner: mockGame.banner,
                type: mockGame.type,
                status: 1,
                id: mockGame.id,
              },
            };
          }
        }
        return {
          success: false,
          message: 'Game not found or inactive',
        };
      }

      return {
        success: true,
        data: {
          _id: game._id,
          provider_code: game.provider,
          game_code: game.gameId,
          game_name: game.name,
          banner: game.image,
          type: game.type,
          status: game.status === 'active' ? 1 : 0,
          id: game.gameId,
        },
      };
    } catch (error: any) {
      console.error('Error getting BlueOcean game:', error);
      return {
        success: false,
        message: error.message || 'Failed to get game',
      };
    }
  }

  // Launch game (placeholder - would need BlueOcean API integration)
  public async launchGame(params: {
    provider_code: string;
    game_code: string;
  }): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      const { provider_code, game_code } = params;

      // Find the game in the database
      const game = await BlueOceanGame.findOne({
        gameId: game_code,
        provider: provider_code,
      });

      if (!game) {
        if (this.shouldUseMockFallback()) {
          const mockGame = this.getMockGames().find(
            (g) => g.game_code === game_code && g.provider_code === provider_code
          );
          if (mockGame) {
            return {
              success: true,
              data: {
                launch_url: `https://example.com/?provider=${provider_code}&game=${game_code}`,
                status: 1,
                game_name: mockGame.game_name,
                provider_code: mockGame.provider_code,
                game_code: mockGame.game_code,
              },
            };
          }
        }
        return {
          success: false,
          message: 'Game not found or inactive',
        };
      }

      // TODO: Integrate with BlueOcean API for actual game launch
      // For now, return a placeholder launch URL
      const launchUrl = `https://stage.game-program.com/game/${provider_code}/${game_code}`;

      return {
        success: true,
        data: {
          launch_url: launchUrl,
          status: 1,
          game_name: game.name,
          provider_code: game.provider,
          game_code: game.gameId,
        },
      };
    } catch (error: any) {
      console.error('Error launching BlueOcean game:', error);
      return {
        success: false,
        message: error.message || 'Failed to launch game',
      };
    }
  }

  /**
   * Complete gameplay flow: playerExists → createPlayer (if needed) → getGame → return game URL
   */
  public async launchGameplay(params: {
    user_username: string;
    user_password?: string;
    gameid: string;
    currency?: string;
    user_id?: string; // Add user_id parameter for wallet integration
  }): Promise<{
    success: boolean;
    data?: {
      game_url: string;
      player_exists: boolean;
      player_created: boolean;
      remote_id?: string;
      session_id?: string;
    };
    message?: string;
  }> {
    try {
      const {
        user_username,
        user_password,
        gameid,
        currency,
        user_id,
      } = params;

      // Generate session_id and use user_id as remote_id for wallet integration
      const session_id = `session_${user_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const remote_id = user_id || user_username; // Use user_id as remote_id for wallet calls

      // Store session-to-game mapping for transaction tracking
      const BlueOceanGameSession = (await import('@/models/slotGames/blueocean/BlueOceanGameSession')).default;
      const game = await BlueOceanGame.findOne({ gameId: gameid }).lean();
      
      if (game && user_id) {
        await BlueOceanGameSession.create({
          session_id,
          user_id,
          remote_id,
          game_id: gameid,
          game_name: game.name,
          started_at: new Date(),
          last_activity: new Date(),
        }).catch(err => logger.warn('Failed to create game session record:', err));
      }

      logger.info('Starting BlueOcean gameplay flow', {
        user_username,
        gameid,
      });

      // Step 1: Check if player exists
      logger.info('Step 1: Checking if player exists');
      const playerExistsResponse = await blueOceanService.playerExists({
        user_username,
        currency: currency || 'EUR',
      });

      let playerExists = false;
      let playerCreated = false;

      // Check if player exists based on response structure
      if (playerExistsResponse.error === '0' || !playerExistsResponse.error) {
        if (playerExistsResponse.response && playerExistsResponse.response !== false) {
          playerExists = true;
          logger.info('Player exists, proceeding with game launch', playerExistsResponse.response);
        } else {
          playerExists = false;
          logger.info('Player does not exist, creating new player');
        }
      } else {
        playerExists = false;
        logger.info('Player does not exist, creating new player');
      }

      // Step 2: Create player if they don't exist
      if (!playerExists) {
        const createPlayerResponse = await blueOceanService.createPlayer({
          currency: currency || 'EUR',
          user_username
        });

        if (createPlayerResponse.error === '0' || !createPlayerResponse.error) {
          playerCreated = true;
          playerExists = true;
          logger.info('Player created successfully');
        } else {
          logger.error('Failed to create player', createPlayerResponse);
          return {
            success: false,
            message: `Failed to create player: ${createPlayerResponse.message || 'Unknown error'}`,
          };
        }
      }

      // Step 3: Login player to BlueOcean system
      logger.info('Step 3: Logging in player to BlueOcean system');
      const loginResponse = await blueOceanService.loginPlayer({
        user_username,
        user_password: user_password || '',
        currency: currency || 'EUR',
      });

      if (loginResponse.error !== '0' && loginResponse.error) {
        logger.error('Failed to login player', loginResponse);
        return {
          success: false,
          message: `Failed to login player: ${loginResponse.message || 'Unknown error'}`,
        };
      }

      logger.info('Player logged in successfully to BlueOcean system');

      // Step 4: Launch game
      logger.info('Step 4: Launching game');
      const getGameResponse = await blueOceanService.getGame({
        user_username,
        user_password: user_password || '',
        currency: currency || 'EUR',
        lang: 'en',
        gameid,
        // play_for_fun: true,
      });

      if ((getGameResponse.error === '0' || !getGameResponse.error) && getGameResponse.sessionid){
        logger.info('Game launched successfully', {
          game_url: getGameResponse.response,
          player_exists: playerExists,
          player_created: playerCreated
        });

        return {
          success: true,
          data: {
            game_url: getGameResponse.response,
            player_exists: playerExists,
            player_created: playerCreated,
            remote_id: remote_id,
            session_id: session_id,
          },
        };
      } else {
        logger.error('Failed to launch game', getGameResponse);
        return {
          success: false,
          message: `Failed to launch game: ${getGameResponse.message || 'Unknown error'}`,
        };
      }
    } catch (error: any) {
      logger.error('Error in BlueOcean gameplay flow', error);
      return {
        success: false,
        message: error.message || 'Failed to complete gameplay flow',
      };
    }
  }

  /**
   * Logout player from BlueOcean system
   */
  public async logoutPlayer(params: {
    user_username: string;
    currency?: string;
  }): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const { user_username, currency } = params;

      logger.info('Logging out player from BlueOcean system', {
        user_username,
        currency: currency || 'EUR',
      });

      const logoutResponse = await blueOceanService.logoutPlayer({
        user_username,
        currency: currency || 'EUR',
      });

      if (logoutResponse.error !== '0' && logoutResponse.error) {
        logger.error('Failed to logout player', logoutResponse);
        return {
          success: false,
          message: `Failed to logout player: ${logoutResponse.message || 'Unknown error'}`,
        };
      }

      logger.info('Player logged out successfully from BlueOcean system');

      return {
        success: true,
        message: 'Player logged out successfully',
      };
    } catch (error: any) {
      logger.error('Error logging out BlueOcean player:', error);
      return {
        success: false,
        message: error.message || 'Failed to logout player',
      };
    }
  }
}

export default new BlueOceanGameService();
