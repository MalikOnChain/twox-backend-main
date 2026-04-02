// Require Dependencies
import config from '../../config';
import { GameTransactionHandler } from '../../controllers/TransactionControllers';
import User from '../../models/users/User';
import VipUser from '../../models/vip/VipUser';
import { GAME_CATEGORIES } from '../../types/game/game';
import { logger } from '../../utils/logger';

export class UserSocketHandler {
  constructor(socket, gameController) {
    this.isBetting = false;
    this.socket = socket;
    this.user = socket?.user || null;
    this.gameController = gameController;
    // Get references to shared game state and constants
    this.GAME_STATE = gameController.GAME_STATE;
    this.GAME_STATUS = gameController.GAME_STATUS;
    this.BET_STATES = gameController.BET_STATES;
    // Get references to shared methods
    this.calculateGamePayout = gameController.calculateGamePayout.bind(gameController);
    this.formatPlayerBet = gameController.formatPlayerBet.bind(gameController);
    this.updatePendingCount = gameController.updatePendingCount.bind(gameController);
    this.doCashOut = gameController.doCashOut.bind(gameController);

    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.socket.on('place-bet', ({ autoCashoutAt, betAmount }) => this.handleJoinGame(autoCashoutAt, betAmount));
    this.socket.on('cashout', (userId) => this.handleBetCashout(userId));
    this.socket.on('my-bet', (userId) => this.findMyCurrentBet(userId));
    this.socket.on('change-auto-cash-out', (newAutoCashoutAt) => this.changeAutoCashOut(newAutoCashoutAt));
    this.socket.on('get-game-histories', (data, callback) => this.handleGetHistories(data, callback));

    this.joinSuccessHandler = (data) => this.socket.emit('game-join-success', data);
    this.joinErrorHandler = (data) => this.socket.emit('game-join-error', data);
    this.cashoutSuccessHandler = (data) => this.socket.emit('bet-cashout-success', data);
    this.cashoutErrorHandler = (data) => this.socket.emit('bet-cashout-error', data);
  }

  async findMyCurrentBet(userId) {
    if (this.user.id !== userId) {
      throw new Error("You're not allowed to get other user info!");
    }

    const currentGameState = this.GAME_STATE.status;
    if (currentGameState !== this.GAME_STATUS.InProgress) {
      return;
    }
    if (this.GAME_STATE.players[userId]) {
      try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
          return this.socket.emit('user banned');
        }
        this.socket.emit('current-bet', this.GAME_STATE.players[userId]);
        this.user = user;
      } catch (error) {
        return;
      }
    }
  }

  async userJoin(autoCashoutAt, formattedBetAmount) {
    try {
      // Validate game state first
      if (!this.user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Validate game state first
      if (this.GAME_STATE.status !== this.GAME_STATUS.Starting) {
        return { success: false, error: 'Game is in progress' };
      }

      // Process bet in a transaction-like manner
      const newBet = await this.generateNewBet({
        autoCashoutAt,
        betAmount: formattedBetAmount,
      });

      const transactionHandler = new GameTransactionHandler(GAME_CATEGORIES.CRASH);

      await transactionHandler.startTransaction(this.user.id, {
        ...newBet,
        id: this.GAME_STATE._id,
      });

      await transactionHandler.placeBet(formattedBetAmount);

      await this.GAME_STATE.currentGameModel.addPlayer(this.user.id, {
        playerId: newBet.playerId,
        username: newBet.username,
        betAmount: newBet.betAmount,
        autoCashoutAt: newBet.autoCashoutAt,
      });

      // Then update local state
      this.GAME_STATE.players[this.user.id] = {
        ...newBet,
        transactionHandler,
      };

      const formattedBet = this.formatPlayerBet(newBet);
      this.GAME_STATE.pendingBets.push(formattedBet);

      this.gameController.emitPlayerBets();
      return { success: true, bet: formattedBet };
    } catch (error) {
      logger.error('Join error:', error);
      return { success: false, error: error.message || 'Failed to process bet' };
    }
  }

  async handleJoinGame(autoCashoutAt, betAmount) {
    try {
      logger.debug('handleJoinGame', autoCashoutAt, betAmount);
      this.user = this.socket?.user;
      if (!this.user) throw new Error('Authentication Required!');

      // Now validate the bet
      const validationResult = await this.checkValidateBet(autoCashoutAt, betAmount);
      if (!validationResult.success) throw new Error(validationResult.error);

      this.isBetting = true;
      this.updatePendingCount(1);

      const formattedBetAmount = parseFloat(betAmount.toFixed(2));
      const joinResult = await this.userJoin(autoCashoutAt, formattedBetAmount);
      this.updatePendingCount(-1);

      if (!joinResult.success) throw new Error(joinResult.error);

      this.joinSuccessHandler({
        msg: 'Joined successfully!',
        data: joinResult.bet,
      });
    } catch (error) {
      logger.error('Join game error:', error);
      if (this.isBetting) this.updatePendingCount(-1);
      this.joinErrorHandler({
        msg: error.message || 'Failed to process in crash game join',
      });
    } finally {
      this.isBetting = false;
    }
  }

  async checkValidateBet(autoCashoutAt, betAmount) {
    try {
      // Basic bet amount validation
      if (typeof betAmount !== 'number' || isNaN(betAmount) || betAmount < 0) {
        return {
          success: false,
          error: 'Invalid bet amount',
          formattedBetAmount: null,
        };
      }

      const { minBetAmount, maxBetAmount } = config.games.crash;
      const formattedBetAmount = parseFloat(betAmount.toFixed(2));
      // Bet amount range validation
      if (formattedBetAmount < minBetAmount || formattedBetAmount > maxBetAmount) {
        return {
          success: false,
          error: `Bet must be between ${minBetAmount} and ${maxBetAmount} tokens`,
          formattedBetAmount: null,
        };
      }

      if (typeof autoCashoutAt !== 'number' || isNaN(autoCashoutAt) || autoCashoutAt < 0) {
        return {
          success: false,
          error: 'Invalid cashout multiplier',
          formattedBetAmount: null,
        };
      }

      const { minCashout, maxCashout } = config.games.crash;

      // Bet amount range validation
      if (autoCashoutAt < minCashout / 100 || autoCashoutAt > maxCashout / 100) {
        return {
          success: false,
          error: `Cashout multiplier must be between ${minCashout / 100} and ${maxCashout / 100}`,
          formattedBetAmount: null,
        };
      }

      const exists = this.GAME_STATE.pendingBets.some((bet) => bet.playerID === this.user.id);

      if (exists) {
        logger.debug('exist');

        return {
          success: false,
          error: 'Already joined this game',
          formattedBetAmount: null,
        };
      }
      // Duplicate bet validation
      if (this.GAME_STATE.players[this.user.id] || this.isBetting) {
        logger.debug('exist');
        return {
          success: false,
          error: 'Already joined this game',
          formattedBetAmount: null,
        };
      }

      const user = await User.findById(this.user.id);
      if (!(await user.hasSufficientBalance(formattedBetAmount))) {
        return {
          success: false,
          error: 'Have not enough game token!',
          formattedBetAmount,
        };
      }
      // Game state validation
      if (this.GAME_STATE.status !== this.GAME_STATUS.Starting) {
        return {
          success: false,
          error: 'Game is in progress',
          formattedBetAmount: null,
        };
      }

      // All validations passed
      return {
        success: true,
        error: null,
        formattedBetAmount,
      };
    } catch (error) {
      return {
        success: false,
        error: `Validation error: ${error.message || error}`,
        formattedBetAmount: null,
      };
    }
  }

  async handleBetCashout(userId) {
    const CONSTANTS = {
      MIN_CASHOUT_MULTIPLIER: 1.01,
      MULTIPLIER_PRECISION: 100,
    };

    try {
      // Early validation of critical conditions
      if (!this.validateUserAndGameState(userId)) {
        throw new Error('Invalid user or game state');
      }

      // Get current game state once to avoid multiple calculations
      const currentMultiplier = this.calculateGamePayout();
      const bet = this.GAME_STATE.players[userId];

      // Validate cashout conditions
      this.validateCashoutConditions(currentMultiplier, bet, CONSTANTS);

      // Process auto cashout if applicable
      const finalMultiplier = this.calculateFinalMultiplier(
        currentMultiplier,
        bet.autoCashoutAt,
        CONSTANTS.MULTIPLIER_PRECISION
      );

      // Execute cashout
      const callback = (err, result) => {
        if (err) {
          this.cashoutErrorHandler(err);
        }
        this.cashoutSuccessHandler({ msg: 'Successfully cashout!', ...result });
      };
      await this.doCashOut(bet.playerId, finalMultiplier, true, callback);
    } catch (error) {
      logger.error('Cashout error:', {
        userId: this.user?.id,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      this.cashoutErrorHandler({ msg: error.message });
    }
  }

  async generateNewBet({ autoCashoutAt, betAmount }) {
    if (!this.user) throw new Error('Authentication Required!');

    const { currentLevel, currentTier } = await VipUser.getVipStatistics(this.user.id);

    const newBet = {
      autoCashoutAt,
      betAmount,
      createdAt: new Date(),
      playerId: this.user.id,
      username: this.user.username,
      avatar: this.user.avatar,
      rank: currentTier,
      level: currentLevel,
      status: this.BET_STATES.Playing,
      forcedCashout: false,
    };
    return newBet;
  }

  // Helper methods for better organization and reusability
  validateUserAndGameState(userId) {
    if (this.user.id !== userId) {
      throw new Error('Unauthorized: Account mismatch in socket');
    }

    if (!userId || !this.GAME_STATE.players[userId]) {
      throw new Error('Player not found in current game');
    }

    if (!this.GAME_STATE?.status || this.GAME_STATE.status !== this.GAME_STATUS.InProgress) {
      throw new Error('The current game was not started yet.');
    }

    if (!this.GAME_STATE.startedAt || isNaN(new Date(this.GAME_STATE.startedAt))) {
      throw new Error('Invalid game start time');
    }

    return true;
  }

  validateCashoutConditions(currentMultiplier, bet, constants) {
    if (currentMultiplier < constants.MIN_CASHOUT_MULTIPLIER * constants.MULTIPLIER_PRECISION) {
      throw new Error(`Minimum cashout is ${constants.MIN_CASHOUT_MULTIPLIER}x`);
    }

    if (!this.GAME_STATE.crashPoint || currentMultiplier > this.GAME_STATE.crashPoint) {
      throw new Error('Game has already ended');
    }

    if (!this.BET_STATES || bet.status !== this.BET_STATES.Playing) {
      throw new Error('Already cashed out');
    }
  }

  calculateFinalMultiplier(currentMultiplier, autoCashoutAt, multiplierPrecision) {
    // Handle auto cashout logic
    if (autoCashoutAt > multiplierPrecision && autoCashoutAt <= currentMultiplier) {
      return autoCashoutAt;
    }
    return currentMultiplier;
  }

  async changeAutoCashOut(newAutoCashOut) {
    if (!this.user || !this.GAME_STATE.players[this.user._id]) {
      throw new Error('You are not in current game!');
    }

    if (this.GAME_STATE.status !== this.GAME_STATUS.InProgress) {
      return;
    }

    if (this.GAME_STATE.players[this.user._id].status === this.BET_STATES.CashedOut) {
      return;
    }

    this.GAME_STATE.players[this.user._id].autoCashoutAt = newAutoCashOut * 100;
  }

  async handleGetHistories(_data, callback) {
    try {
      logger.debug('handleGetHistories');

      const histories = await this.gameController.getRecentHistories();

      return callback({ success: true, data: histories });
    } catch (error) {
      // Handle the error (e.g., log it or return a friendly message)
      logger.error('Error fetching crash game histories:', error);

      // Optionally, you can return a custom error message or throw an error
      throw new Error('Failed to fetch crash game histories. Please try again later.');
    }
  }
}

export default UserSocketHandler;
