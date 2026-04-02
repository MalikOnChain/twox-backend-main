import { logger } from '@/utils/logger';

import { BotUserController } from './BotUserController';

export class BotUserControllerForCrash extends BotUserController {
  constructor() {
    super();
  }

  async generateCrashRandomBets(BET_STATES) {
    try {
      const selectedPlayers = this.getRandomBotUsers();
      if (selectedPlayers.length === 0) return [];
      logger.info('🤖 Generating random bets', { count: selectedPlayers.length });

      const fakeBets = [];

      for (const fakeUser of selectedPlayers) {
        const { username, avatar, _id, rank } = fakeUser;

        const betAmount = this.getRandomBetAmount();
        const CASHOUTNUMBER = this.generateRandomNumber();
        const newBet = {
          autoCashoutAt: CASHOUTNUMBER,
          betAmount,
          createdAt: new Date(),
          playerId: _id,
          username: username,
          avatar: avatar,
          status: BET_STATES?.Playing,
          forcedCashout: true,
          botFlag: true,
          rank: rank,
        };

        fakeBets.push(newBet);
      }
      return fakeBets;
    } catch (error) {
      logger.error('Failed to generate random bets', { error });
      // updatePendingCount(-1);
    }
  }
}

export default new BotUserControllerForCrash();
