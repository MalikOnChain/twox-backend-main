import BotUser from '@/models/users/BotUser';
import { logger } from '@/utils/logger';

export class BotUserController {
  constructor() {
    this.cachedPlayers = [];
  }

  async initializePlayerCache() {
    try {
      const perfEnd = logger.startPerformanceMeasurement('Initialize Player Cache');
      this.cachedPlayers = await BotUser.find(
        {},
        {
          username: 1,
          avatar: 1,
          wager: 1,
          rank: 1,
          _id: 1,
          maxMultiplier: 1,
          minMultiplier: 1,
          maxBet: 1,
          minBet: 1,
        }
      )
        .limit(300)
        .lean();

      if (!this.cachedPlayers) {
        return [];
      }

      logger.info('🤖 Bot users initialized', {
        count: this.cachedPlayers.length,
      });
      perfEnd();
    } catch (error) {
      logger.error('Failed to initialize player cache', { error });
    }
  }

  generateRandomNumberOfPlayers = () => {
    const randomNumberOfPlayers = Math.min(Math.floor(Math.random() * 100) + 10, this.cachedPlayers?.length || 0);
    return randomNumberOfPlayers;
  };

  getRandomBotUsers = () => {
    const subsetSize = this.generateRandomNumberOfPlayers();

    if (subsetSize === 0) {
      return [];
    }

    const shuffledArray = this.cachedPlayers.sort(() => 0.5 - Math.random());
    return shuffledArray.slice(0, subsetSize);
  };

  getRandomBetAmount = ({ minBet = null, maxBet = null } = {}) => {
    const realisticBetOptions = [0.2, 0.5, 1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 120, 150, 200, 250, 500, 1000];

    // Filter based on min and max (if provided)
    const filteredOptions = realisticBetOptions.filter((bet) => {
      const aboveMin = minBet === null || bet >= minBet;
      const belowMax = maxBet === null || bet <= maxBet;
      return aboveMin && belowMax;
    });

    if (filteredOptions.length === 0) return 0;

    const random = Math.random();
    let selectedOptions;

    if (random <= 0.95) {
      // 95% of bets are small-mid range
      if (Math.random() <= 0.65) {
        // 65% of those are very small (first 5 options)
        selectedOptions = filteredOptions.slice(0, 5);
      } else {
        // The rest are mid-range
        selectedOptions = filteredOptions.slice(5, filteredOptions.length / 2);
      }
    } else {
      // 5% of bets are high
      selectedOptions = filteredOptions.slice(filteredOptions.length / 2);
    }

    const finalOptions = selectedOptions.length ? selectedOptions : filteredOptions;
    const result = finalOptions[Math.floor(Math.random() * finalOptions.length)];

    return parseFloat(result.toFixed(2));
  };

  generateRandomNumber() {
    const min = 105;
    const max = 2000;
    const random = Math.random();
    let randomNumber;

    if (random < 0.3) {
      randomNumber = min + Math.random() * (150 - min);
    } else if (random < 0.5) {
      randomNumber = min + Math.random() * (200 - min);
    } else if (random < 0.7) {
      randomNumber = min + Math.random() * (300 - min);
    } else {
      randomNumber = min + Math.random() * (max - min);
    }

    return randomNumber;
  }
}

export default new BotUserController();
