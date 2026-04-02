import _ from 'lodash';

import config from '../../config';
import betHistorySocketController from '../../controllers/SocketControllers/bet-history-socket';
import BetHistory from '../../models/gameHistory/BetHistory';
import CrashGame from '../../models/gameHistory/CrashGame';
import { GAME_CATEGORIES } from '../../types/game/game';
import { logger } from '../../utils/logger';
import BotUserControllerForCrash from '../BotControllers/BotUserControllerForCrash';
import { crashGameGenerator } from '../GameLogicCenter';

import { CrashGameBase } from './crashGameBase';

const ROOM_PREFIX = {
  USER: 'user:',
};

export class CrashGameController extends CrashGameBase {
  constructor(namespace) {
    super();
    this.namespace = namespace;

    this.emitPlayerBets = _.throttle(this._emitPendingBets, 600);
    this.preStartGame = this.preStartGame.bind(this);
    this.onStartGame = this.onStartGame.bind(this);
    this.readyGame = this.readyGame.bind(this);
    this.runTick = this.runTick.bind(this);
    this.tickLoopFlag = true;
    this.CrashGameModel = CrashGame;
    this.botUserController = BotUserControllerForCrash;
    this.setupSocketHandlers();
    this.startGameSetup();
  }

  setupSocketHandlers() {
    //broadcast
    this.gameStartingEmit = (data) => this.namespace.emit('game-starting', data);
    this.gameReadyEmit = (data) => this.namespace.emit('game-ready', data);
    this.gameStartEmit = (data) => this.namespace.emit('game-start', data);
    this.gameTickEmit = (data) => this.namespace.emit('game-tick', data);
    this.gameErrorEmit = (data) => this.namespace.emit('game-error', data);
    this.gameEndEmit = (data) => this.namespace.emit('game-end', data);
    this.gameBetCashoutEmit = (data) => this.namespace.emit('bet-cashout', data);
    this.gamePendingBetsEmit = (data) => this.namespace.emit('game-bets', data);

    this.gameHistoryEmit = (data) => this.namespace.emit('game-histories', data);
    this.gameTopWinnersEmit = (data) => this.namespace.emit('game-top-winners', data);

    //individual
    this.cashoutErrorHandler = (userId, data) =>
      this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit('bet-cashout-error', data);
    this.cashoutSuccessHandler = (userId, data) =>
      this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit('bet-cashout-success', data);
  }

  async startGameSetup() {
    try {
      await this.CrashGameModel.refundGame();
      await this.runGame();
    } catch (error) {
      logger.error('Error during game setup', { error });
    }
  }

  restartGameLoop() {
    logger.info('🔄 Restarting game loop...');
    try {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = setTimeout(() => {
        this.runGame();
      }, 5000);
    } catch (error) {
      logger.error('Failed to restart game loop', { error });
      setTimeout(() => this.restartGameLoop(), 10000);
    }
  }

  async runGame() {
    try {
      this.GAME_STATE.status = this.GAME_STATUS.NotStarted;
      const { privateSeed, publicSeed, crashPoint, gameHash } = await crashGameGenerator.generateCrashRandom();

      if (!privateSeed || !publicSeed || !crashPoint || !gameHash) {
        throw new Error('Missing required game parameters');
      }

      const newGame = await this.CrashGameModel.createNewGame({
        privateSeed,
        publicSeed,
        crashPoint,
        gameHash,
      });

      this.GAME_STATE.currentGameModel = newGame;
      this.GAME_STATE.crashPoint = crashPoint;
      this.GAME_STATE._id = this.GAME_STATE.currentGameModel._id;
      this.GAME_STATE.privateSeed = privateSeed;
      this.GAME_STATE.publicSeed = publicSeed;
      this.GAME_STATE.startedAt = new Date(Date.now() + this.RESTART_WAIT_TIME);
      this.GAME_STATE.players = {};

      this.onInitGame();
    } catch (error) {
      logger.error('Error running game', { error });
      this.restartGameLoop();
    }
  }

  async onInitGame() {
    logger.info('🔄 Initializing game...');

    this.GAME_STATE.currentGameModel.updateStatus(this.GAME_STATUS.Starting);
    this.GAME_STATE.status = this.GAME_STATUS.Starting;
    this.gameStartingEmit({
      _id: this.GAME_STATE._id,
      publicSeed: this.GAME_STATE.publicSeed,
      timeUntilStart: this.RESTART_WAIT_TIME,
    });

    const addBotWithDelay = async (bet) => {
      try {
        this.GAME_STATE.players[bet.playerId] = bet;

        const result = await this.GAME_STATE.currentGameModel.addBotPlayer(bet.playerId, bet);
        if (!result) {
          return false;
        }

        setTimeout(
          () => {
            const formattedBet = this.formatPlayerBet(bet);
            this.GAME_STATE.pendingBets.push(formattedBet);
            this.emitPlayerBets();
          },
          1000 + Math.random() * 5000
        ); // More consistent delay between 1-6 seconds

        return true;
      } catch (error) {
        logger.error('Error adding bot player', { error, playerId: bet.playerId });
        return false;
      }
    };

    this.botUserController.generateCrashRandomBets(this.BET_STATES).then(async (fakeBets) => {
      // Process bets one at a time with delay between each
      if (fakeBets.length === 0) return;

      for (const bet of fakeBets) {
        this.updatePendingCount(1);
        addBotWithDelay(bet)
          .then(() => {
            this.updatePendingCount(-1);
          })
          .catch(() => {
            this.updatePendingCount(-1);
          });
      }
    });

    setTimeout(this.readyGame, this.RESTART_WAIT_TIME - 2000);
    setTimeout(this.preStartGame, this.RESTART_WAIT_TIME);
  }

  readyGame() {
    this.gameReadyEmit();
  }

  async preStartGame() {
    this.GAME_STATE.status = this.GAME_STATUS.Blocking;
    await this.GAME_STATE.currentGameModel.updateStatus(this.GAME_STATUS.Blocking);

    const loop = () => {
      if (this.GAME_STATE.pendingCount > 0) {
        return setTimeout(loop, 50);
      }
      this.onStartGame();
    };

    loop();
  }

  async onStartGame() {
    try {
      this.GAME_STATE.status = this.GAME_STATUS.InProgress;
      this.GAME_STATE.startedAt = new Date();
      this.GAME_STATE.duration = Math.ceil(this.inverseGrowth(this.GAME_STATE.crashPoint + 1));
      this.GAME_STATE.pendingCount = 0;

      await this.GAME_STATE.currentGameModel.updateStatus(this.GAME_STATUS.InProgress, {
        startedAt: this.GAME_STATE.startedAt,
      });
      this.gameStartEmit();
      this.callTick();

      logger.info('🚀 Game started', {
        gameId: this.GAME_STATE._id,
        crashPoint: this.GAME_STATE.crashPoint / 100,
      });
    } catch (error) {
      logger.error('Error starting game', { error });
      this.gameErrorEmit(`Server has problem:${error.message || error.msg}`);
      this.restartGameLoop();
    }
  }

  async onEndGame() {
    const crashTime = Date.now();

    this.GAME_STATE.status = this.GAME_STATUS.Over;
    this.GAME_STATE.endedAt = crashTime;

    await this.GAME_STATE.currentGameModel.updateStatus(this.GAME_STATUS.Over, {
      endedAt: crashTime,
    });

    this.gameEndEmit({ game: this.formatGameHistory(this.GAME_STATE) });

    this.gameHistoryEmit({ success: true, data: await this.getRecentHistories() });

    this.CrashGameModel.getTopWinners(this.GAME_STATUS).then((topWinners) => {
      this.gameTopWinnersEmit({ success: true, data: topWinners });
    });

    logger.info('🏁 Game ended', {
      crashPoint: this.GAME_STATE.crashPoint / 100,
      duration: Date.now() - this.GAME_STATE.startedAt,
    });

    setTimeout(
      () => {
        logger.info('🔄 Restarting game loop...');
        this.runGame();
      },
      crashTime + this.START_WAIT_TIME - Date.now()
    );
  }

  callTick = () => {
    const elapsed = new Date() - this.GAME_STATE.startedAt;
    const left = this.GAME_STATE.duration - elapsed;
    const nextTick = Math.max(0, Math.min(left, this.TICK_RATE));
    setTimeout(this.runTick, nextTick);
  };

  runTick = () => {
    const currentPoint = Math.min(this.calculateGamePayout(), this.GAME_STATE.crashPoint);

    this.runCashOuts(currentPoint);
    this.gameTickEmit(currentPoint / 100);

    if (currentPoint >= this.GAME_STATE.crashPoint) {
      this.tickLoopFlag = false;
      this.onEndGame();
      this.tickLoopFlag = true;
      return;
    }
    // loop
    this.callTick();
  };

  async doCashOut(playerId, cashout, forced, cb) {
    try {
      if (this.GAME_STATE.players[playerId].status !== this.BET_STATES.Playing) return;

      this.GAME_STATE.players[playerId].status = this.BET_STATES.CashedOut;
      this.GAME_STATE.players[playerId].stoppedAt = cashout;
      this.GAME_STATE.players[playerId].forcedCashout = forced;

      const bet = this.GAME_STATE.players[playerId];
      const { status, stoppedAt, username, avatar, forcedCashout, betAmount, botFlag } = bet;

      const winningAmount = parseFloat(((betAmount * stoppedAt) / 100).toFixed(2));

      this.GAME_STATE.players[playerId].winningAmount = winningAmount;

      if (cb && typeof cb === 'function') cb(null, this.GAME_STATE.players[playerId]);

      if (!botFlag) {
        await bet.transactionHandler.win(winningAmount);
        bet.transactionHandler.reset();
      }

      await this.GAME_STATE.currentGameModel.processPlayerCashout(playerId, {
        stoppedAt: Number(stoppedAt),
        winningAmount: Number(winningAmount),
        forcedCashout: Boolean(forcedCashout),
      });

      const betHistory = await BetHistory.createHistory({
        betAmount,
        username,
        avatar,
        playerId,
        payout: Number(winningAmount),
        category: GAME_CATEGORIES.CRASH,
      });

      betHistorySocketController.emitNewBet({
        id: betHistory._id,
        betAmount,
        username,
        avatar,
        playerId,
        payout: Number(winningAmount),
        category: GAME_CATEGORIES.CRASH,
        time: new Date(),
      });

      this.gameBetCashoutEmit({
        avatar,
        playerId,
        username,
        status,
        stoppedAt,
        betAmount,
        winningAmount,
      });
    } catch (error) {
      logger.error('Error processing cashout', { error, playerId });
    }
  }

  async getRecentHistories() {
    try {
      const histories = await CrashGame.find({ status: this.GAME_STATUS.Over })
        .sort({ _id: -1 }) // Sort by _id in descending order (most recent first)
        .limit(10) // Limit to the last 5 records
        .lean();

      if (histories && histories.length > 0) {
        histories.reverse();
      }

      return histories;
    } catch (error) {
      // Optionally, you can return a custom error message or throw an error
      throw new Error('Failed to fetch crash game histories. Please try again later.');
    }
  }

  runCashOuts(point) {
    _.each(this.GAME_STATE.players, (bet) => {
      if (bet.status !== this.BET_STATES.Playing) return;
      if (!bet.autoCashoutAt) return;

      const maxCashOut = (config.games.crash.maxProfit * 100) / bet.betAmount;

      if (bet.autoCashoutAt >= 101 && bet.autoCashoutAt <= point) {
        const callback = (err, result) => {
          if (err) {
            logger.error('Error during cashout', {
              error: err,
              playerId: bet.playerId,
            });
            this.cashoutErrorHandler(bet.playerId, err);
          } else if (result) {
            this.cashoutSuccessHandler(bet.playerId, err);
          }
        };

        this.doCashOut(bet.playerId, bet.autoCashoutAt, false, callback);
      } else if (bet.autoCashoutAt >= maxCashOut) {
        const callback = (err, result) => {
          if (err) {
            this.cashoutErrorHandler(bet.playerId, err);
          } else if (result) {
            this.cashoutSuccessHandler(bet.playerId, result);
          }
        };
        this.doCashOut(bet.playerId, maxCashOut, true, callback);
      }
    });
  }

  _emitPendingBets() {
    const bets = this.GAME_STATE.pendingBets;
    this.updatePendingCount(-bets.length);
    this.GAME_STATE.pendingBets = [];

    this.gamePendingBetsEmit(bets);
  }

  formatPlayerBet(bet) {
    return {
      playerId: bet.playerId,
      username: bet.username,
      avatar: bet.avatar,
      betAmount: bet.betAmount,
      level: bet.level,
      rank: bet.rank,
    };
  }
}

export default new CrashGameController();
