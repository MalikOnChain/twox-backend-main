// CrashGameInterface.js
import { EventEmitter } from 'events';

import { logger } from '../../utils/logger';

import CrashGameController from './crashGameController';
import UserSocketHandler from './userSocketHandler';

export class CrashGameInterface {
  constructor() {
    this.gameController = null;
    this.userHandler = null;
    this.eventEmitter = new EventEmitter();
    this.namespace = null;
  }

  async init(namespace, cb) {
    try {
      this.namespace = namespace;

      // Initialize game controller
      this.gameController = new CrashGameController(namespace);

      // Set up socket connection handling
      namespace.on('connection', (socket) => {
        cb(socket);
        this.userHandler = new UserSocketHandler(socket, this.gameController);
      });

      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize crash game service:', error);
      throw error;
    }
  }

  setupEventListeners() {
    this.gameController.gameEvents.on('gameStarting', (gameData) => {
      this.eventEmitter.emit('gameStarting', gameData);
    });

    this.gameController.gameEvents.on('gameStarted', (gameData) => {
      this.eventEmitter.emit('gameStarted', gameData);
    });

    this.gameController.gameEvents.on('gameEnded', (gameData) => {
      this.eventEmitter.emit('gameEnded', gameData);
    });

    this.gameController.gameEvents.on('playerBet', (betData) => {
      this.eventEmitter.emit('playerBet', betData);
    });

    this.gameController.gameEvents.on('playerCashout', (cashoutData) => {
      this.eventEmitter.emit('playerCashout', cashoutData);
    });
  }

  getCurrentGame() {
    return this.gameController?.getCurrentGame();
  }

  getPrivateHash() {
    return this.gameController?.getPrivateHash();
  }

  formatGame(game) {
    return this.gameController?.formatGame(game);
  }

  formatGameHistory(game) {
    return this.gameController?.formatGameHistory(game);
  }

  async cleanup() {
    try {
      // Clean up event listeners
      this.eventEmitter.removeAllListeners();

      // Cleanup game controller if it exists
      if (this.gameController) {
        await this.gameController.cleanup();
      }

      logger.debug('Crash game service cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up crash game service:', error);
      throw error;
    }
  }

  getGameStats() {
    return {
      totalGames: this.gameController?.getTotalGames() || 0,
      activePlayers: this.gameController?.getActivePlayers() || 0,
      currentMultiplier: this.gameController?.getCurrentMultiplier() || 1,
      gameState: this.gameController?.getGameState() || 'NotStarted',
    };
  }
}

// Export singleton instance
const crashGameInterface = new CrashGameInterface();
export default crashGameInterface;
