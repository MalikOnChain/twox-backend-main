// Require Dependencies
import { EventEmitter } from 'events';

import colors from 'colors';
import _ from 'lodash';

import CrashGame from '@/models/gameHistory/CrashGame';

export class CrashGameBase {
  constructor() {
    this.eventEmitter = new EventEmitter();
    this.TICK_RATE = 100;
    this.START_WAIT_TIME = 4000;
    this.RESTART_WAIT_TIME = 9000;
    this.GAME_STATUS = {
      NotStarted: 1,
      Starting: 2,
      InProgress: 3,
      Over: 4,
      Blocking: 5,
      Refunded: 6,
    };

    this.BET_STATES = {
      Playing: 1,
      CashedOut: 2,
    };

    this.GAME_STATE = {
      _id: null,
      status: this.GAME_STATUS.NotStarted,
      crashPoint: null,
      startedAt: null,
      duration: null,
      players: {},
      pendingCount: 0,
      pendingBets: [],
      privateSeed: null,
      publicSeed: null,
      currentGameModel: null,
    };

    // this.formatCrashGame();
    // console.log(colors.bgRed("create crash Game Base"));
    // Initialize crash game count
  }

  async formatCrashGame() {
    try {
      await CrashGame.deleteMany({});
      // console.log(colors.bgBlue.white("🎮 CRASH") + colors.cyan(` Total CrashGame documents: ${count}`));
    } catch (error) {
      console.error(colors.bgRed.white('❌ ERROR') + colors.red(` Error fetching CrashGame count: ${error}`));
      throw error;
    }
  }

  growthFunc(ms) {
    return Math.floor(100 * Math.pow(Math.E, 0.00006 * 1.2 * ms));
  }

  calculateGamePayout() {
    if (!this.GAME_STATE.startedAt) {
      throw new Error("There's no game starting");
    }

    const elapsed = new Date() - this.GAME_STATE.startedAt;

    const gamePayout = Math.floor(100 * this.growthFunc(elapsed)) / 100;
    // 100 <= gamePayout <= 150000

    return Math.max(gamePayout, 100);
  }

  inverseGrowth(result) {
    return 16666.666667 * Math.log(0.01 * result);
  }

  getCurrentGame() {
    return this.formatGame(this.GAME_STATE);
  }

  getPrivateSeed() {
    return this.GAME_STATE.privateSeed;
  }

  formatGame(game) {
    const formatted = {
      _id: game._id,
      status: game.status,
      startedAt: game.startedAt,
      elapsed: Date.now() - game.startedAt,
      players: _.map(game.players, (p) => this.formatPlayerBet(p)),
      privateSeed: game.privateSeed,
      publicSeed: game.publicSeed,
    };

    if (game.status === this.GAME_STATUS.Over) {
      formatted.crashPoint = game.crashPoint;
    }

    return formatted;
  }

  formatGameHistory(game) {
    return {
      _id: game._id,
      createdAt: game.createdAt,
      privateSeed: game.privateSeed,
      publicSeed: game.publicSeed,
      crashPoint: game.crashPoint / 100,
    };
  }

  formatPlayerBet(bet) {
    const formatted = {
      playerId: bet.playerId,
      username: bet.username,
      avatar: bet.avatar,
      userRank: bet.rank,
      betAmount: bet.betAmount,
      status: bet.status,
      level: bet.level,
      autoCashoutAt: bet.autoCashoutAt || null,
    };

    if (bet.status !== this.BET_STATES.Playing) {
      formatted.stoppedAt = bet.stoppedAt;
      formatted.winningAmount = bet.winningAmount;
    }

    return formatted;
  }

  updatePendingCount(change) {
    // console.log(colors.bgRed(this.GAME_STATE.pendingCount, 'updatePendingCount'))
    this.GAME_STATE.pendingCount = Math.max(0, this.GAME_STATE.pendingCount + change);

    if (this.GAME_STATE.pendingCount === 0) {
      // console.log(colors.yellow("Crash>>> allBetsResolved"));
      this.gameEvents.emit('allBetsResolved');
    }
  }
}

export default CrashGameBase;
