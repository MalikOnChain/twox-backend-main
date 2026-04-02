import RecentWinList from '@/models/gameHistory/RecentWinList';
import GameCategory from '@/models/slotGames/GameCategory';
import GameList from '@/models/slotGames/nexusggr/NexusggrGames';
import { GAME_CATEGORIES } from '@/types/game/game';
import { logger } from '@/utils/logger';

/**
 * Initialize the Recent Wins list with popular games
 */
export async function initRecentWinsList() {
  try {
    logger.info('Starting to initialize Recent Wins list...');

    // Check if we already have recent wins data
    const existingCount = await RecentWinList.countDocuments();
    if (existingCount > 0) {
      logger.info(`Found ${existingCount} existing recent wins. Skipping initialization.`);
      await RecentWinList.deleteMany();
    }

    const RecentWinGameList = await GameCategory.find({ title: 'RecentWinGameList' });

    logger.debug(RecentWinGameList);

    const gameIds = RecentWinGameList[0]?.gameIds || [];

    // Get only live casino games
    const games = await GameList.find({
      _id: { $in: gameIds },
    }).lean();

    logger.debug(games);

    const recentWinsData = [];

    const gameData = games.map((game, index) => ({
      category: game.type === 'slot' ? GAME_CATEGORIES.SLOTS : GAME_CATEGORIES.LIVE_CASINO,
      game: {
        name: game.game_name,
        id: game.game_code,
        provider: game.provider_code,
      },
      banners: game.banner,
      isActive: true,
      displayOrder: index,
    }));

    logger.debug(gameData);

    recentWinsData.push(...gameData);

    // Insert the data
    if (recentWinsData.length > 0) {
      await RecentWinList.insertMany(recentWinsData);
      logger.info(`Successfully initialized Recent Wins list with ${recentWinsData.length} live casino games`);
    } else {
      logger.warn('No live casino games found to initialize Recent Wins list');
    }

    //eslint-disable-next-line
    process.exit(0);
  } catch (error) {
    logger.error('Error initializing Recent Wins list:', error);
    throw error;
  }
}
