import moment from 'moment';
import mongoose from 'mongoose';
import cron from 'node-cron';

import { ServiceTransactionHandler } from '@/controllers/TransactionControllers/ServiceTransactionManager';
import UserWagerRaceBalance from '@/models/users/UserWagerRaceBalance';
import VipUser from '@/models/vip/VipUser';
import WagerRace from '@/models/wagerRace/WagerRace';
import { SERVICE_TRANSACTION_TYPES } from '@/types/bonus/service';
import {
  WAGER_RACE_STATUS,
  PAYMENT_STATUS,
  PAYOUT_TYPE,
  PRIZE_TYPE,
  PARTICIPANT_TYPE,
} from '@/types/wager-race/wager-race';
import { logger } from '@/utils/logger';

export class WagerRaceService {
  static instance = null;

  constructor() {
    if (WagerRaceService.instance) {
      return WagerRaceService.instance;
    }

    WagerRaceService.instance = this;
    this.initSchedules();
  }

  static initialize() {
    if (!WagerRaceService.instance) {
      WagerRaceService.instance = new WagerRaceService();
    }
    return WagerRaceService.instance;
  }

  static getInstance() {
    if (!WagerRaceService.instance) {
      throw new Error('WagerRaceService has not been initialized. Call initialize() first.');
    }
    return WagerRaceService.instance;
  }

  async getAllActiveWagerRaces() {
    try {
      const now = new Date().setHours(0, 0, 0, 0);
      const wagerRaces = await WagerRace.find({
        status: WAGER_RACE_STATUS.ACTIVE,
        'period.start': { $lte: now },
        'period.end': { $gte: now },
      }).lean();
      return {
        success: true,
        wagerRaces,
      };
    } catch (error) {
      logger.error('Error getting all active wager races:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getWagerRaceById(wagerRaceId) {
    try {
      const wagerRace = await WagerRace.findById(wagerRaceId);
      if (!wagerRace) {
        throw new Error('Wager race not found');
      }
      return wagerRace;
    } catch (error) {
      logger.error('Error getting wager race by ID:', error);
      throw error;
    }
  }

  async getWagerRaceByIdForUser(userId, wagerRaceId) {
    try {
      const wagerRace = await WagerRace.findById(wagerRaceId);
      if (!wagerRace) {
        throw new Error('Wager race not found');
      }

      const isEligibleUser = await this.isEligibleUser(userId, wagerRaceId);
      if (!isEligibleUser) {
        throw new Error('User is not eligible to participate in this wager race');
      }

      const isEligibleWagerRace = await this.isEligibleWagerRace(wagerRaceId);
      if (!isEligibleWagerRace) {
        throw new Error('This wager race is not eligible now');
      }

      return {
        success: true,
        wagerRace,
      };
    } catch (error) {
      logger.error('Error getting wager race by ID for user:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getRankingDataByWagerRaceId(wagerRaceId) {
    try {
      const wagerRace = await WagerRace.findById(wagerRaceId)
        .populate({
          path: 'participants.users.userId',
          select: 'username avatar',
        })
        .limit(20);

      if (!wagerRace) {
        throw new Error('Wager race not found');
      }

      const rankingData = {
        title: wagerRace.title,
        description: wagerRace.description,
        period: wagerRace.period,
        prize: wagerRace.prize,
        minWager: wagerRace.minWager,
        ranking: wagerRace.participants.users.sort((a, b) => b.totalWagered - a.totalWagered),
      };

      return {
        success: true,
        rankingData,
      };
    } catch (error) {
      logger.error('Error getting wager race by ID for user:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async isEligibleUser(userId, wagerRaceId) {
    try {
      const wagerRace = await this.getWagerRaceById(wagerRaceId);
      if (!wagerRace) {
        return false;
      }

      const userRank = await VipUser.findOne({ userId });
      switch (wagerRace.participants.type) {
        case PARTICIPANT_TYPE.ALL:
          return true;
        case PARTICIPANT_TYPE.RANK:
          return (
            wagerRace.participants.tiers.some((tier) => tier.equals(userRank.loyaltyTierId)) &&
            wagerRace.participants.users.some((user) => user.userId.equals(userId))
          );
        case PARTICIPANT_TYPE.INVITE:
          return wagerRace.participants.users.some((user) => user.userId.equals(userId));
        default:
          return false;
      }
    } catch (error) {
      logger.error('Error checking if user is eligible to participate in wager race:', error);
      return false;
    }
  }

  async isEligibleWagerRace(wagerRaceId) {
    try {
      const wagerRace = await this.getWagerRaceById(wagerRaceId);
      if (!wagerRace) {
        return false;
      }
      if (wagerRace.status !== WAGER_RACE_STATUS.ACTIVE) {
        return false;
      }

      if (wagerRace.period.start > new Date() || wagerRace.period.end < new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking if wager race is eligible:', error);
      return false;
    }
  }

  async updateTotalWageredAmount(userId, wagerAmount, gameData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wagerRaces = await WagerRace.getActiveRacesByUserId(userId);
      if (!wagerRaces || wagerRaces.length === 0) {
        throw new Error('No active wager races found for user');
      }

      for (const wagerRace of wagerRaces) {
        // Validate game eligibility
        if (!wagerRace.eligibleGames.includes(gameData.gameType)) {
          continue; // Skip if game type is not eligible
        }

        // Validate minimum wager
        // if (wagerAmount < wagerRace.minWager) {
        //   continue; // Skip if bet amount is below minimum
        // }

        const userIndex = wagerRace.participants.users.findIndex((user) => user.userId.toString() === userId);

        if (userIndex !== -1) {
          // Update total wagered amount
          wagerRace.participants.users[userIndex].totalWagered += wagerAmount;

          // Add individual wager record
          wagerRace.participants.users[userIndex].wagers.push({
            gameId: gameData.gameId,
            gameType: gameData.gameType,
            amount: wagerAmount,
            transactionId: gameData.transactionId,
            timestamp: new Date(),
            status: 'pending',
          });

          // Update last wager timestamp
          wagerRace.participants.users[userIndex].lastWagerAt = new Date();

          await wagerRace.save({ session });
        }
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error updating total wager amount for wager race:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async distributePrizes(wagerRace) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Sort participants by total wagered amount
      const sortedParticipants = wagerRace.participants.users.sort((a, b) => b.totalWagered - a.totalWagered);

      // Determine number of winners
      const numWinners = Math.min(wagerRace.prize.amounts.length, sortedParticipants.length);

      // Get winners
      const winners = sortedParticipants.slice(0, numWinners);

      // Update race with winners
      wagerRace.winners = winners.map((user) => user.userId);
      await wagerRace.save({ session });

      // Distribute prizes
      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        let prizeAmount =
          wagerRace.prize.type === PRIZE_TYPE.FIXED
            ? wagerRace.prize.amounts[i]
            : Math.ceil((winner.totalWagered * wagerRace.prize.amounts[i]) / 100);

        // check if winner is eligible for prize
        if (winner.totalWagered < wagerRace.minWager) {
          prizeAmount = 0;
        }

        // Get or create wager race balance for winner
        const wagerRaceBalance = await UserWagerRaceBalance.getOrCreate(winner.userId, session);

        // Add prize to wager race balance
        await wagerRaceBalance.addWagerRacePrize(wagerRace._id, i + 1, prizeAmount, winner.totalWagered, session);

        // Process transaction
        const transactionHandler = new ServiceTransactionHandler(SERVICE_TRANSACTION_TYPES.WAGER_RACE_PRIZE);
        const handler = await transactionHandler.startTransaction(winner.userId, prizeAmount, wagerRace._id, {
          wagerRaceId: wagerRace._id,
          position: i + 1,
          isReachedMinWager: winner.totalWagered >= wagerRace.minWager,
        });
        await handler.process();
        handler.reset();
      }

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error distributing prizes:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateUserBalance(wagerRaceId) {
    try {
      const wagerRace = await WagerRace.findById(wagerRaceId);
      if (!wagerRace) {
        throw new Error('Wager race not found');
      }

      if (wagerRace.status !== WAGER_RACE_STATUS.ACTIVE) {
        throw new Error('Wager race is not active');
      }

      if (wagerRace.paymentStatus === PAYMENT_STATUS.PAID) {
        throw new Error('Prizes have already been distributed');
      }

      const result = await this.distributePrizes(wagerRace);
      if (result) {
        wagerRace.paymentStatus = PAYMENT_STATUS.PAID;
        await wagerRace.save();
      }

      return result;
    } catch (error) {
      logger.error('Error updating user balance:', error);
      throw error;
    }
  }

  async checkWagerRace() {
    try {
      const wagerRaces = await WagerRace.find({
        status: { $in: [WAGER_RACE_STATUS.ACTIVE, WAGER_RACE_STATUS.SCHEDULED] },
      });

      const now = moment().format('YYYY-MM-DD');
      for (const wagerRace of wagerRaces) {
        if (wagerRace.status === WAGER_RACE_STATUS.SCHEDULED) {
          if (moment(wagerRace.period.start).format('YYYY-MM-DD') === now) {
            wagerRace.status = WAGER_RACE_STATUS.ACTIVE;
            await wagerRace.save();
          }
        } else {
          if (moment(wagerRace.period.end).format('YYYY-MM-DD') === now) {
            if (wagerRace.payoutType === PAYOUT_TYPE.AUTO) {
              const result = await this.updateUserBalance(wagerRace._id);
              if (result) {
                wagerRace.paymentStatus = PAYMENT_STATUS.PAID;
              }
            }
            wagerRace.status = WAGER_RACE_STATUS.COMPLETED;
            await wagerRace.save();
          }
        }
      }
    } catch (error) {
      logger.error('Error checking wager race:', error);
      throw error;
    }
  }

  async checkPayoutResults() {
    try {
      const wagerRaces = await WagerRace.find({
        status: WAGER_RACE_STATUS.COMPLETED,
        paymentStatus: PAYMENT_STATUS.UNPAID,
      });

      const now = moment();
      for (const wagerRace of wagerRaces) {
        if (wagerRace.payoutType === PAYOUT_TYPE.AUTO) {
          continue;
        }

        const delayedDate = moment(wagerRace.period.end).add(wagerRace.delay.value, wagerRace.delay.type);

        if (delayedDate <= now) {
          const result = await this.updateUserBalance(wagerRace._id);
          if (result) {
            wagerRace.paymentStatus = PAYMENT_STATUS.PAID;
            await wagerRace.save();
          }
        }
      }
    } catch (error) {
      logger.error('Error checking wager race results:', error);
      throw error;
    }
  }

  async getWagerHistory(userId, wagerRaceId) {
    try {
      const wagerRace = await WagerRace.findById(wagerRaceId);
      if (!wagerRace) {
        throw new Error('Wager race not found');
      }

      const participant = wagerRace.participants.users.find((user) => user.userId.toString() === userId);

      if (!participant) {
        throw new Error('User is not a participant in this wager race');
      }

      return {
        success: true,
        wagerHistory: participant.wagers,
        totalWagered: participant.totalWagered,
        status: participant.status,
      };
    } catch (error) {
      logger.error('Error getting wager history:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getUserRaceMetrics(userId, wagerRaceId) {
    try {
      const wagerRace = await WagerRace.findById(wagerRaceId);
      if (!wagerRace) {
        throw new Error('Wager race not found');
      }

      const participant = wagerRace.participants.users.findIndex((user) => user.userId.toString() === userId);

      return {
        isJoined: participant !== -1,
        rank: participant !== -1 ? participant + 1 : null,
      };
    } catch (error) {
      logger.error('Error getting user join status:', error);
      throw error;
    }
  }

  initSchedules() {
    logger.info('Wager Race Cron started', new Date().toString());

    // Check wager races every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.checkWagerRace();
      } catch (error) {
        logger.error('Error in wager race check schedule:', error);
      }
    });

    // Check payout results every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        await this.checkPayoutResults();
      } catch (error) {
        logger.error('Error in payout results check schedule:', error);
      }
    });
  }
}

export default new WagerRaceService();
