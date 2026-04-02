import betHistorySocketController from '@/controllers/SocketControllers/bet-history-socket';
import BetHistory from '@/models/gameHistory/BetHistory';
import { CasinoGame, GAME_STATUS } from '@/models/gameHistory/CasinoGame';
import GameList from '@/models/slotGames/nexusggr/NexusggrGames';
import { GAME_CATEGORIES } from '@/types/game/game';
import { logger } from '@/utils/logger';

import { BotUserController } from './BotUserController';

export class BotUserControllerForSlots extends BotUserController {
  constructor() {
    super();
    this.isGeneratingBets = false;
    this.gameList = [];
    this.betTimer = null;
  }

  async generateSlotsRandomBets(gameList) {
    try {
      // Select a single random player
      const shuffledPlayers = this.cachedPlayers.sort(() => 0.5 - Math.random());
      if (shuffledPlayers.length === 0) return null;

      const fakeUser = shuffledPlayers[0];
      const { username, avatar, _id, maxMultiplier, minMultiplier, maxBet, minBet } = fakeUser;

      const randomGameIndex = Math.floor(Math.random() * gameList.length);
      const randomGame = gameList[randomGameIndex];

      // Generate random bet amount
      const betAmount = this.getRandomBetAmount({ minBet, maxBet });

      // Determine if this is a win (100% chance)
      const isWin = Math.random() < 1;

      // For wins, calculate a random multiplier between 1.1x and 50x

      const winMultiplier = isWin ? Math.random() * (maxMultiplier - minMultiplier) + minMultiplier : 0;
      const winAmount = isWin ? parseFloat((betAmount * winMultiplier).toFixed(2)) : 0;

      // Generate a unique transaction ID
      const transactionId = `BOT_${_id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Create casino game record
      const casinoGame = new CasinoGame({
        userId: _id,
        gameCategory: randomGame.type === 'live' ? GAME_CATEGORIES.LIVE_CASINO : GAME_CATEGORIES.SLOTS,
        providerCode: randomGame.provider_code,
        gameCode: randomGame.game_code,
        gameName: randomGame.game_name,
        transactionId: transactionId,
        roundType: 'BASE',
        betAmount: betAmount,
        winAmount: winAmount,
        currency: 'USD',
        userBalance: betAmount, // Not relevant for bots
        gameData: {
          provider_code: randomGame.provider_code,
          game_code: randomGame.game_code,
          bet_money: betAmount,
          win_money: winAmount,
        },
        players: [
          {
            playerId: _id,
            username: username,
            betAmount: betAmount,
            winAmount: winAmount,
            isBot: true,
            avatar: avatar || '',
          },
        ],
        totalWagers: betAmount,
        totalPayouts: winAmount,
        status: GAME_STATUS.Completed,
        createdAt: this.generateRandomTimestamp(new Date()),
      });

      await casinoGame.save();

      // Only emit and create history for wins
      if (isWin) {
        const betHistory = await BetHistory.createHistory({
          betAmount: betAmount,
          username: username,
          avatar: avatar,
          playerId: _id,
          payout: winAmount,
          category: randomGame.type === 'live' ? GAME_CATEGORIES.LIVE_CASINO : GAME_CATEGORIES.SLOTS,
          metadata: {
            game_code: randomGame.game_code,
            provider_code: randomGame.provider_code,
            game_name: randomGame.game_name,
            banner: randomGame.banner,
          },
        });

        betHistorySocketController.emitNewBet({
          id: betHistory._id,
          betAmount: betAmount,
          username: username,
          avatar: avatar,
          playerId: _id,
          payout: winAmount,
          category: randomGame.type === 'live' ? GAME_CATEGORIES.LIVE_CASINO : GAME_CATEGORIES.SLOTS,
          time: new Date(),
          metadata: {
            game_code: randomGame.game_code,
            provider_code: randomGame.provider_code,
            game_name: randomGame.game_name,
            banner: randomGame.banner,
          },
        });

        return {
          id: betHistory._id,
          betAmount: betAmount,
          username: username,
          avatar: avatar,
          playerId: _id,
          payout: winAmount,
          category: randomGame.type === 'live' ? GAME_CATEGORIES.LIVE_CASINO : GAME_CATEGORIES.SLOTS,
          game: {
            name: randomGame.game_name,
            provider: randomGame.provider_code,
            banner: randomGame.banner,
          },
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to generate random slot bet', { error });
      return null;
    }
  }

  // Generate a random timestamp within the last 5 minutes
  generateRandomTimestamp(now) {
    const fiveMinutesAgo = new Date(now.getTime() - 1000);
    return new Date(fiveMinutesAgo.getTime() + Math.random() * (now.getTime() - fiveMinutesAgo.getTime()));
  }

  // Generate a random interval between 5 and 20 seconds
  getRandomInterval() {
    return Math.floor(Math.random() * 4000) + 1000; // Between 5-20 seconds
  }

  // Start continuous generation of random bets
  async startGeneratingBets() {
    if (this.isGeneratingBets) return;

    const gameList = await GameList.find({ status: 1 }).lean();

    if (gameList.length === 0) {
      logger.error('No active live games found');
      return;
    }

    this.isGeneratingBets = true;
    this.gameList = gameList;

    logger.info('🤖 Starting automated slot bet generation');

    // Define the function to generate bets and schedule next execution
    const generateAndSchedule = async () => {
      if (!this.isGeneratingBets) return;

      try {
        await this.generateSlotsRandomBets(this.gameList);
      } catch (error) {
        logger.error('Error in automated slot bet generation', { error });
      }

      // Schedule next execution with random interval
      const nextInterval = this.getRandomInterval();
      this.betTimer = setTimeout(generateAndSchedule, nextInterval);
    };

    // Start the cycle
    generateAndSchedule();
  }

  // Stop continuous generation of random bets
  stopGeneratingBets() {
    logger.info('🤖 Stopping automated slot bet generation');
    this.isGeneratingBets = false;

    if (this.betTimer) {
      clearTimeout(this.betTimer);
      this.betTimer = null;
    }
  }
}

export default new BotUserControllerForSlots();
