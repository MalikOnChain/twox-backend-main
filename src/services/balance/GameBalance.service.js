import User from '@/models/users/User';
import UserBonusBalance from '@/models/users/UserBonusBalance';
import UserCashbackBalance from '@/models/users/UserCashbackBalance';
import UserFreeSpinBalance from '@/models/users/UserFreeSpinBalance';
import UserReferBonusBalance from '@/models/users/UserReferBonusBalance';
import UserWagerRaceBalance from '@/models/users/UserWagerRaceBalance';
import VipUser from '@/models/vip/VipUser';
import WagerRace from '@/models/wagerRace/WagerRace';
import BonusManagementService from '@/services/balance/BonusManagement.service';
import CoreBalanceService from '@/services/balance/CoreBalance.service';
import { BALANCE_UPDATE_TYPES } from '@/types/balance/balance';
import { WITHDRAWAL_TYPES } from '@/types/crypto/crypto';
import { logger } from '@/utils/logger';

export class GameBalanceService {
  static instance = null;

  constructor() {
    if (GameBalanceService.instance) {
      return GameBalanceService.instance;
    }

    GameBalanceService.instance = this;
  }

  static initialize() {
    if (!GameBalanceService.instance) {
      GameBalanceService.instance = new GameBalanceService();
    }
    return GameBalanceService.instance;
  }

  static getInstance() {
    if (!GameBalanceService.instance) {
      throw new Error('GameBalanceService has not been initialized. Call initialize() first.');
    }
    return GameBalanceService.instance;
  }

  async processBet(user, betAmount, metadata, session) {
    try {
      const gameType = metadata.gameType || 'default';
      const activeBonuses = await BonusManagementService.getActiveBonuses(user, session);
      const totalBonusBalance = await CoreBalanceService.getTotalBonusBalance(user._id, session);
      const realBalance = user.balance || 0;
      const totalLockedWinnings = await CoreBalanceService.getTotalLockedWinnings(user._id, session);
      const freeSpinBalance = await CoreBalanceService.getFreeSpinBalance(user._id, session);
      const totalAvailable = Number(
        (realBalance + totalBonusBalance + totalLockedWinnings + freeSpinBalance).toFixed(2)
      );

      if (totalAvailable < betAmount) {
        throw new Error(`You have insufficient balance to place this bet`);
      }

      const betDetails = {
        totalAmount: betAmount,
        fromBonusesLockedWinnings: [],
        fromBonuses: [],
        fromCashback: 0,
        fromCashbackLockedWinnings: 0,
        fromReferBonus: 0,
        fromReferBonusLockedWinnings: 0,
        fromWagerRace: 0,
        fromWagerRaceLockedWinnings: 0,
        fromRealBalance: 0,
        remainingAmount: Number(betAmount.toFixed(2)),
        fromFreeSpinBalance: 0,
        fromFreeSpinLockedWinnings: 0,
        gameType,
      };

      const contributionRate = CoreBalanceService.getGameContribution(gameType);

      if (betDetails.remainingAmount > 0) {
        const freeSpinBalance = await UserFreeSpinBalance.findOne({ userId: user._id }).session(session);
        if (freeSpinBalance && freeSpinBalance.freeSpinBalance > 0) {
          const freeSpinDeduction = Math.min(
            betDetails.remainingAmount,
            freeSpinBalance.freeSpinBalance * freeSpinBalance.originalValue
          );
          if (freeSpinDeduction > 0) {
            betDetails.fromFreeSpinBalance = freeSpinDeduction;
            const spinsToDeduct = freeSpinDeduction / freeSpinBalance.originalValue;
            freeSpinBalance.freeSpinBalance -= spinsToDeduct;
            await freeSpinBalance.save({ session });

            betDetails.remainingAmount -= freeSpinDeduction;
          }
        }
      }

      for (const bonus of activeBonuses) {
        if (betDetails.remainingAmount <= 0) break;

        const bonusDeduction = Math.min(bonus.bonusBalance, betDetails.remainingAmount);
        if (bonusDeduction > 0) {
          betDetails.fromBonuses.push({
            bonusId: bonus.bonusId.toString(),
            amount: bonusDeduction,
            contributionRate,
            originalBalance: bonus.bonusBalance,
          });

          bonus.bonusBalance -= bonusDeduction;
          await bonus.save({ session });

          betDetails.remainingAmount -= bonusDeduction;
        }
      }

      if (betDetails.remainingAmount > 0) {
        const cashbackBalance = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
        if (cashbackBalance && cashbackBalance.cashbackBalance > 0) {
          const cashbackDeduction = Math.min(betDetails.remainingAmount, cashbackBalance.cashbackBalance);
          if (cashbackDeduction > 0) {
            betDetails.fromCashback = cashbackDeduction;
            cashbackBalance.cashbackBalance -= cashbackDeduction;
            await cashbackBalance.save({ session });
            betDetails.remainingAmount -= cashbackDeduction;
          }
        }
      }

      if (betDetails.remainingAmount > 0) {
        const referBonus = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
        if (referBonus && referBonus.referBonusBalance > 0) {
          const referDeduction = Math.min(betDetails.remainingAmount, referBonus.referBonusBalance);
          if (referDeduction > 0) {
            betDetails.fromReferBonus = referDeduction;
            referBonus.referBonusBalance -= referDeduction;
            await referBonus.save({ session });
            betDetails.remainingAmount -= referDeduction;
          }
        }
      }

      if (betDetails.remainingAmount > 0) {
        const wagerRace = await UserWagerRaceBalance.findOne({ userId: user._id }).session(session);
        if (wagerRace && wagerRace.wagerRaceBalance > 0) {
          const wagerRaceDeduction = Math.min(betDetails.remainingAmount, wagerRace.wagerRaceBalance);
          if (wagerRaceDeduction > 0) {
            betDetails.fromWagerRace = wagerRaceDeduction;
            wagerRace.wagerRaceBalance -= wagerRaceDeduction;
            await wagerRace.save({ session });
            betDetails.remainingAmount -= wagerRaceDeduction;
          }
        }
      }

      if (betDetails.remainingAmount > 0) {
        const deduction = Math.min(betDetails.remainingAmount, user.balance);
        if (deduction > 0) {
          betDetails.fromRealBalance = deduction;
          user.balance -= deduction;
          await user.save({ session });
          betDetails.remainingAmount -= deduction;
        }
      }

      if (betDetails.remainingAmount > 0) {
        const freeSpinBalance = await UserFreeSpinBalance.findOne({ userId: user._id }).session(session);
        if (freeSpinBalance && freeSpinBalance.lockedWinnings > 0) {
          const freeSpinDeduction = Math.min(betDetails.remainingAmount, freeSpinBalance.lockedWinnings);
          if (freeSpinDeduction > 0) {
            betDetails.fromFreeSpinLockedWinnings = freeSpinDeduction;
            freeSpinBalance.lockedWinnings -= freeSpinDeduction;
            await freeSpinBalance.save({ session });
            betDetails.remainingAmount -= freeSpinDeduction;
          }
        }
      }

      for (const bonus of activeBonuses) {
        if (betDetails.remainingAmount <= 0) break;

        if (bonus.lockedWinnings > 0) {
          const bonusDeduction = Math.min(bonus.lockedWinnings, betDetails.remainingAmount);

          if (bonusDeduction > 0) {
            if (!betDetails.fromLockedWinnings) {
              betDetails.fromLockedWinnings = [];
            }

            betDetails.fromLockedWinnings.push({
              bonusId: bonus.bonusId.toString(),
              amount: bonusDeduction,
              originalLockedWinnings: bonus.lockedWinnings,
            });
            bonus.lockedWinnings -= bonusDeduction;
            await bonus.save({ session });

            betDetails.remainingAmount -= bonusDeduction;
          }
        }
      }

      if (betDetails.remainingAmount > 0) {
        const cashbackBalance = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
        if (cashbackBalance && cashbackBalance.lockedWinnings > 0) {
          const cashbackDeduction = Math.min(betDetails.remainingAmount, cashbackBalance.lockedWinnings);
          if (cashbackDeduction > 0) {
            betDetails.fromCashbackLockedWinnings = cashbackDeduction;
            cashbackBalance.lockedWinnings -= cashbackDeduction;
            await cashbackBalance.save({ session });
            betDetails.remainingAmount -= cashbackDeduction;
          }
        }
      }

      if (betDetails.remainingAmount > 0) {
        const referBonus = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
        if (referBonus && referBonus.lockedWinnings > 0) {
          const referDeduction = Math.min(betDetails.remainingAmount, referBonus.lockedWinnings);
          if (referDeduction > 0) {
            betDetails.fromReferBonusLockedWinnings = referDeduction;
            referBonus.lockedWinnings -= referDeduction;
            await referBonus.save({ session });
            betDetails.remainingAmount -= referDeduction;
          }
        }
      }

      if (betDetails.remainingAmount > 0) {
        const wagerRace = await UserWagerRaceBalance.findOne({ userId: user._id }).session(session);
        if (wagerRace && wagerRace.lockedWinnings > 0) {
          const wagerRaceDeduction = Math.min(betDetails.remainingAmount, wagerRace.lockedWinnings);
          if (wagerRaceDeduction > 0) {
            betDetails.fromWagerRaceLockedWinnings = wagerRaceDeduction;
            wagerRace.lockedWinnings -= wagerRaceDeduction;
            await wagerRace.save({ session });
            betDetails.remainingAmount -= wagerRaceDeduction;
          }
        }
      }

      try {
        await VipUser.updateVipStatus(user._id, betAmount, BALANCE_UPDATE_TYPES.GAME, gameType);
      } catch (error) {
        logger.error(`Failed to update VIP status: ${error.message}`);
      }

      await BonusManagementService.updateWageringProgress(user, session);

      await CoreBalanceService._emitBalanceUpdate(user, BALANCE_UPDATE_TYPES.GAME, metadata, session);

      return {
        user,
        betDetails,
      };
    } catch (error) {
      logger.error(`Failed to process bet: ${error.message}`);
      throw error;
    }
  }

  async processWin(user, winAmount, metadata, session) {
    try {
      const betDetails = metadata.betDetails;
      const profit = Number((winAmount - betDetails.totalAmount).toFixed(2));

      if (betDetails.fromFreeSpinBalance > 0) {
        const freeSpinBalance = await UserFreeSpinBalance.findOne({ userId: user._id }).session(session);

        if (!freeSpinBalance) {
          throw new Error(`Free spin balance not found for user ${user._id}`);
        }

        const freeSpinProfitRatio = Number((betDetails.fromFreeSpinBalance / betDetails.totalAmount).toFixed(4));
        const freeSpinProfit = Number((profit * freeSpinProfitRatio).toFixed(2));

        if (profit > 0) {
          const spinsToReturn = Number((betDetails.fromFreeSpinBalance / freeSpinBalance.originalValue).toFixed(2));
          freeSpinBalance.freeSpinBalance += spinsToReturn;
          freeSpinBalance.lockedWinnings += freeSpinProfit;
        } else {
          const freeSpinReturnAmount = Number((winAmount * freeSpinProfitRatio).toFixed(2));
          const spinsToReturn = Number((freeSpinReturnAmount / freeSpinBalance.originalValue).toFixed(2));
          freeSpinBalance.freeSpinBalance += spinsToReturn;
        }

        await freeSpinBalance.save({ session });
      }

      for (const bonusItem of betDetails.fromBonuses) {
        const bonus = await UserBonusBalance.findOne({
          userId: user._id.toString(),
          bonusId: bonusItem.bonusId,
        }).session(session);
        if (!bonus) {
          logger.error(`Bonus ${bonusItem.bonusId} not found for user ${user._id}`);
          continue;
        }

        if (profit > 0) {
          const profitRatio = bonusItem.amount / betDetails.totalAmount;
          const bonusProfit = profit * profitRatio;

          bonus.bonusBalance += bonusItem.amount;
          bonus.lockedWinnings += bonusProfit;

          await bonus.save({ session });
        } else {
          const bonusReturnAmount = (winAmount * bonusItem.amount) / betDetails.totalAmount;
          bonus.bonusBalance += bonusReturnAmount;
          await bonus.save({ session });
        }
      }

      if (betDetails.fromCashback > 0) {
        const cashbackProfitRatio = betDetails.fromCashback / betDetails.totalAmount;
        const cashbackProfit = profit * cashbackProfitRatio;

        let cashbackBalance = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
        if (!cashbackBalance) {
          throw new Error(`Cashback balance not found for user ${user._id}`);
        }

        if (profit > 0) {
          cashbackBalance.cashbackBalance += betDetails.fromCashback;
          cashbackBalance.lockedWinnings += cashbackProfit;
        } else {
          const cashbackReturnAmount = winAmount * cashbackProfitRatio;
          cashbackBalance.cashbackBalance += cashbackReturnAmount;
        }

        await cashbackBalance.save({ session });
      }

      if (betDetails.fromReferBonus > 0) {
        const referProfitRatio = betDetails.fromReferBonus / betDetails.totalAmount;
        const referProfit = profit * referProfitRatio;

        let referBonus = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
        if (!referBonus) {
          throw new Error(`Refer bonus not found for user ${user._id}`);
        }

        if (profit > 0) {
          referBonus.referBonusBalance += betDetails.fromReferBonus;
          referBonus.lockedWinnings += referProfit;
        } else {
          const referReturnAmount = winAmount * referProfitRatio;
          referBonus.referBonusBalance += referReturnAmount;
        }

        await referBonus.save({ session });
      }

      if (betDetails.fromWagerRace > 0) {
        const wagerRaceProfitRatio = betDetails.fromWagerRace / betDetails.totalAmount;
        const wagerRaceProfit = profit * wagerRaceProfitRatio;

        let wagerRace = await UserWagerRaceBalance.findOne({ userId: user._id }).session(session);
        if (!wagerRace) {
          throw new Error(`Wager race not found for user ${user._id}`);
        }

        if (profit > 0) {
          wagerRace.wagerRaceBalance += betDetails.fromWagerRace;
          wagerRace.lockedWinnings += wagerRaceProfit;
        } else {
          const wagerRaceReturnAmount = winAmount * wagerRaceProfitRatio;
          wagerRace.wagerRaceBalance += wagerRaceReturnAmount;
        }

        await wagerRace.save({ session });
      }

      if (betDetails.fromRealBalance > 0) {
        const realProfitRatio = betDetails.fromRealBalance / betDetails.totalAmount;
        const realProfit = profit * realProfitRatio;

        if (profit > 0) {
          user.balance += betDetails.fromRealBalance;
          user.balance += realProfit;
        } else {
          user.balance += (winAmount * betDetails.fromRealBalance) / betDetails.totalAmount;
        }

        await user.save({ session });

        const wagerRaces = await WagerRace.getActiveRacesByUserId(user._id);
        for (const wagerRace of wagerRaces) {
          const userIndex = wagerRace.participants.users.findIndex(
            (participant) => participant.userId.toString() === user._id.toString()
          );

          if (userIndex !== -1) {
            const wagerIndex = wagerRace.participants.users[userIndex].wagers.findIndex(
              (wager) => wager.transactionId === betDetails.transactionId
            );

            if (wagerIndex !== -1) {
              wagerRace.participants.users[userIndex].wagers[wagerIndex].status = 'completed';
              wagerRace.participants.users[userIndex].wagers[wagerIndex].winAmount = winAmount;
              await wagerRace.save({ session });
            }
          }
        }
      }

      if (betDetails.fromFreeSpinLockedWinnings > 0) {
        const freeSpinBalance = await UserFreeSpinBalance.findOne({ userId: user._id }).session(session);
        if (!freeSpinBalance) {
          throw new Error(`Free spin balance not found for user ${user._id}`);
        }

        const freeSpinProfitRatio = betDetails.fromFreeSpinLockedWinnings / betDetails.totalAmount;
        const freeSpinProfit = profit * freeSpinProfitRatio;

        if (profit > 0) {
          freeSpinBalance.lockedWinnings += freeSpinProfit;
        } else {
          const lossAmount = (winAmount * betDetails.fromFreeSpinLockedWinnings) / betDetails.totalAmount;
          freeSpinBalance.lockedWinnings += lossAmount;
        }

        await freeSpinBalance.save({ session });
      }

      if (betDetails.fromLockedWinnings && betDetails.fromLockedWinnings.length > 0) {
        for (const bonusItem of betDetails.fromLockedWinnings) {
          const bonus = await UserBonusBalance.findOne({
            userId: user._id.toString(),
            bonusId: bonusItem.bonusId,
          }).session(session);
          if (!bonus) {
            logger.error(`Bonus ${bonusItem.bonusId} not found for user ${user._id}`);
            continue;
          }

          const bonusProfitRatio = bonusItem.amount / betDetails.totalAmount;
          const bonusProfit = profit * bonusProfitRatio;

          if (profit > 0) {
            bonus.lockedWinnings += bonusItem.amount;
            bonus.lockedWinnings += bonusProfit;
          } else {
            bonus.bonusBalance += (winAmount * bonusItem.amount) / betDetails.totalAmount;
          }

          await bonus.save({ session });
        }
      }

      if (betDetails.fromCashbackLockedWinnings > 0) {
        const cashbackBalance = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
        if (!cashbackBalance) {
          throw new Error(`Cashback balance not found for user ${user._id}`);
        }

        const cashbackProfitRatio = betDetails.fromCashbackLockedWinnings / betDetails.totalAmount;
        const cashbackProfit = profit * cashbackProfitRatio;

        if (profit > 0) {
          cashbackBalance.lockedWinnings += betDetails.fromCashbackLockedWinnings;
          cashbackBalance.lockedWinnings += cashbackProfit;
        } else {
          cashbackBalance.cashbackBalance +=
            (winAmount * betDetails.fromCashbackLockedWinnings) / betDetails.totalAmount;
        }

        await cashbackBalance.save({ session });
      }

      if (betDetails.fromReferBonusLockedWinnings > 0) {
        const referBonus = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
        if (!referBonus) {
          throw new Error(`Refer bonus not found for user ${user._id}`);
        }

        const referProfitRatio = betDetails.fromReferBonusLockedWinnings / betDetails.totalAmount;
        const referProfit = profit * referProfitRatio;

        if (profit > 0) {
          referBonus.lockedWinnings += betDetails.fromReferBonusLockedWinnings;
          referBonus.lockedWinnings += referProfit;
        } else {
          referBonus.referBonusBalance +=
            (winAmount * betDetails.fromReferBonusLockedWinnings) / betDetails.totalAmount;
        }

        await referBonus.save({ session });
      }

      if (betDetails.fromWagerRaceLockedWinnings > 0) {
        const wagerRace = await UserWagerRaceBalance.findOne({ userId: user._id }).session(session);
        if (!wagerRace) {
          throw new Error(`Wager race not found for user ${user._id}`);
        }

        const wagerRaceProfitRatio = betDetails.fromWagerRaceLockedWinnings / betDetails.totalAmount;
        const wagerRaceProfit = profit * wagerRaceProfitRatio;

        if (profit > 0) {
          wagerRace.lockedWinnings += betDetails.fromWagerRaceLockedWinnings;
          wagerRace.lockedWinnings += wagerRaceProfit;
        } else {
          wagerRace.wagerRaceBalance += (winAmount * betDetails.fromWagerRaceLockedWinnings) / betDetails.totalAmount;
        }

        await wagerRace.save({ session });
      }

      await BonusManagementService.checkAndUnlockWinnings(user, session);

      await CoreBalanceService._emitBalanceUpdate(user, BALANCE_UPDATE_TYPES.GAME, metadata, session);

      return user;
    } catch (error) {
      logger.error(`Failed to process win: ${error.message}`);
      throw error;
    }
  }

  processLoss(user, betDetails) {
    logger.info(`Loss recorded for user ${user._id}: ${betDetails.totalAmount}`);
    return user;
  }

  async getWithdrawalDetails(userId, session = null) {
    const user = await User.findOne({ _id: userId }).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    const vipUser = await VipUser.findOne({ userId: userId }).session(session);
    if (!vipUser) {
      throw new Error('Vip user not found');
    }

    let totalAvailableWithdrawalAmount = 0;
    const realBalance = user.balance || 0;

    if (user.balance > 0) {
      totalAvailableWithdrawalAmount += realBalance;
    }

    const activeBonuses = await UserBonusBalance.find({
      userId: userId,
      status: 'active',
    }).session(session);

    let result = {
      bonusDetails: [],
      cashbackDetails: [],
      referBonusDetails: [],
      wagerRaceDetails: [],
      freeSpinDetails: [],
      totalAvailableWithdrawalAmount,
    };

    for (const bonus of activeBonuses) {
      let wageringProgress = 0;

      if (bonus.initialAmount > 0 && bonus.wageringMultiplier > 0) {
        wageringProgress = (vipUser.totalWagered / (bonus.wageringMultiplier * bonus.initialAmount)) * 100;
      }

      bonus.wageringProgress = Math.min(wageringProgress, 100);

      await bonus.save({ session });

      if (wageringProgress < 100) {
        continue;
      }

      if (bonus.lockedWinnings <= 0) {
        continue;
      }

      totalAvailableWithdrawalAmount += bonus.lockedWinnings;

      result.bonusDetails.push({
        bonusId: bonus.bonusId,
        bonusBalance: bonus.bonusBalance,
        lockedWinnings: bonus.lockedWinnings,
        wageringProgress: bonus.wageringProgress,
        avaliableWithdrawalAmount: bonus.wageringProgress >= 100 ? bonus.lockedWinnings : 0,
      });
    }

    const cashbackBalance = await UserCashbackBalance.findOne({ userId: userId }).session(session);
    if (cashbackBalance) {
      let wageringProgress = 0;

      if (cashbackBalance.initialAmount > 0 && cashbackBalance.wageringMultiplier > 0) {
        wageringProgress =
          (vipUser.totalWagered / (cashbackBalance.wageringMultiplier * cashbackBalance.initialAmount)) * 100;
      }

      cashbackBalance.wageringProgress = Math.min(wageringProgress, 100);

      await cashbackBalance.save({ session });

      if (wageringProgress >= 100 && cashbackBalance.lockedWinnings > 0) {
        totalAvailableWithdrawalAmount += cashbackBalance.lockedWinnings;
      }

      result.cashbackDetails = {
        bonusBalance: cashbackBalance.bonusBalance,
        lockedWinnings: cashbackBalance.lockedWinnings,
        wageringProgress: cashbackBalance.wageringProgress,
        avaliableWithdrawalAmount: cashbackBalance.wageringProgress >= 100 ? cashbackBalance.lockedWinnings : 0,
      };
    }

    const referBonus = await UserReferBonusBalance.findOne({ userId: userId }).session(session);
    if (referBonus) {
      let wageringProgress = 0;

      if (referBonus.initialAmount > 0 && referBonus.wageringMultiplier > 0) {
        wageringProgress = (vipUser.totalWagered / (referBonus.wageringMultiplier * referBonus.initialAmount)) * 100;
      }

      referBonus.wageringProgress = Math.min(wageringProgress, 100);

      await referBonus.save({ session });

      if (wageringProgress >= 100 && referBonus.lockedWinnings > 0) {
        totalAvailableWithdrawalAmount += referBonus.lockedWinnings;
      }

      result.referBonusDetails = {
        bonusBalance: referBonus.bonusBalance,
        lockedWinnings: referBonus.lockedWinnings,
        wageringProgress: referBonus.wageringProgress,
        avaliableWithdrawalAmount: referBonus.wageringProgress >= 100 ? referBonus.lockedWinnings : 0,
      };
    }

    const wagerRace = await UserWagerRaceBalance.findOne({ userId: userId }).session(session);
    if (wagerRace) {
      let wageringProgress = 0;

      if (wagerRace.initialAmount > 0 && wagerRace.wageringMultiplier > 0) {
        wageringProgress = (vipUser.totalWagered / (wagerRace.wageringMultiplier * wagerRace.initialAmount)) * 100;
      }

      wagerRace.wageringProgress = Math.min(wageringProgress, 100);

      await wagerRace.save({ session });

      if (wageringProgress >= 100 && wagerRace.lockedWinnings > 0) {
        totalAvailableWithdrawalAmount += wagerRace.lockedWinnings;
      }

      result.wagerRaceDetails = {
        bonusBalance: wagerRace.bonusBalance,
        lockedWinnings: wagerRace.lockedWinnings,
        wageringProgress: wagerRace.wageringProgress,
        avaliableWithdrawalAmount: wagerRace.wageringProgress >= 100 ? wagerRace.lockedWinnings : 0,
      };
    }

    const freeSpin = await UserFreeSpinBalance.findOne({ userId: userId }).session(session);
    if (freeSpin) {
      let wageringProgress = 0;

      if (freeSpin.initialAmount > 0 && freeSpin.wageringMultiplier > 0) {
        wageringProgress = (vipUser.totalWagered / (freeSpin.wageringMultiplier * freeSpin.initialAmount)) * 100;
      }

      freeSpin.wageringProgress = Math.min(wageringProgress, 100);

      await freeSpin.save({ session });

      if (wageringProgress >= 100 && freeSpin.lockedWinnings > 0) {
        totalAvailableWithdrawalAmount += freeSpin.lockedWinnings;
      }

      result.freeSpinDetails = {
        bonusBalance: freeSpin.bonusBalance,
        lockedWinnings: freeSpin.lockedWinnings,
        wageringProgress: freeSpin.wageringProgress,
        avaliableWithdrawalAmount: freeSpin.wageringProgress >= 100 ? freeSpin.lockedWinnings : 0,
      };
    }

    result.totalAvailableWithdrawalAmount = totalAvailableWithdrawalAmount;

    return result;
  }

  async checkPossibleWithdrawal(user, amount, session = null) {
    const userBalanceDetails = await this.getWithdrawalDetails(user._id, session);

    if (userBalanceDetails.totalAvailableWithdrawalAmount < amount) {
      return false;
    }

    return true;
  }

  async getWithdrawalAvailableAmount(user, amount, withdrawalType = WITHDRAWAL_TYPES.ALL, session = null) {
    try {
      const userBalanceDetails = await this.getWithdrawalDetails(user._id, session);

      if (!userBalanceDetails || typeof userBalanceDetails.totalAvailableWithdrawalAmount !== 'number') {
        return 0;
      }

      if (userBalanceDetails.totalAvailableWithdrawalAmount < amount) {
        return 0;
      }

      switch (withdrawalType) {
        case WITHDRAWAL_TYPES.BONUS: {
          const amounts = userBalanceDetails.bonusDetails.map((bonus) => bonus.avaliableWithdrawalAmount || 0);
          return Number(amounts.reduce((acc, curr) => acc + curr, 0).toFixed(2));
        }
        case WITHDRAWAL_TYPES.CASHBACK: {
          return Number((userBalanceDetails.cashbackDetails?.avaliableWithdrawalAmount || 0).toFixed(2));
        }
        case WITHDRAWAL_TYPES.REFER_BONUS: {
          return Number((userBalanceDetails.referBonusDetails?.avaliableWithdrawalAmount || 0).toFixed(2));
        }
        case WITHDRAWAL_TYPES.WAGER_RACE: {
          return Number((userBalanceDetails.wagerRaceDetails?.avaliableWithdrawalAmount || 0).toFixed(2));
        }
        case WITHDRAWAL_TYPES.FREE_SPINS: {
          return Number((userBalanceDetails.freeSpinDetails?.avaliableWithdrawalAmount || 0).toFixed(2));
        }
        default:
          return Number(userBalanceDetails.totalAvailableWithdrawalAmount.toFixed(2));
      }
    } catch (error) {
      logger.error(`Error getting withdrawal available amount: ${error.message}`);
      return 0;
    }
  }

  async processWithdrawal(user, amount, withdrawalType = WITHDRAWAL_TYPES.ALL, session = null) {
    try {
      const activeBonuses = await UserBonusBalance.find({
        userId: user._id,
        status: 'active',
      }).session(session);

      let remainingAmount = amount;

      const possibleAmount = await this.getWithdrawalAvailableAmount(user, amount, withdrawalType, session);
      if (possibleAmount < amount) {
        throw new Error('Insufficient balance');
      }

      switch (withdrawalType) {
        case WITHDRAWAL_TYPES.ALL: {
          logger.debug('remainingAmount', remainingAmount);
          const freeSpinBalance = await UserFreeSpinBalance.findOne({ userId: user._id }).session(session);
          if (freeSpinBalance) {
            if (freeSpinBalance.lockedWinnings > 0) {
              const amountToWithdraw = Math.min(freeSpinBalance.lockedWinnings, remainingAmount);
              freeSpinBalance.lockedWinnings -= amountToWithdraw;
              remainingAmount -= amountToWithdraw;
            }
          }

          logger.debug('remainingAmount', remainingAmount);

          for (const bonus of activeBonuses) {
            if (bonus.lockedWinnings > 0) {
              const amountToWithdraw = Math.min(bonus.lockedWinnings, remainingAmount);
              bonus.lockedWinnings -= amountToWithdraw;
              remainingAmount -= amountToWithdraw;
              await bonus.save({ session });
            }
          }
          logger.debug('remainingAmount', remainingAmount);

          const cashbackBalance = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
          if (cashbackBalance) {
            if (cashbackBalance.lockedWinnings > 0) {
              const amountToWithdraw = Math.min(cashbackBalance.lockedWinnings, remainingAmount);
              cashbackBalance.lockedWinnings -= amountToWithdraw;
              remainingAmount -= amountToWithdraw;
              await cashbackBalance.save({ session });
            }
          }
          const wagerRaceBalance = await UserWagerRaceBalance.findOne({ userId: user._id }).session(session);
          logger.debug('remainingAmount', remainingAmount);

          if (wagerRaceBalance) {
            if (wagerRaceBalance.lockedWinnings > 0) {
              const amountToWithdraw = Math.min(wagerRaceBalance.lockedWinnings, remainingAmount);
              wagerRaceBalance.lockedWinnings -= amountToWithdraw;
              remainingAmount -= amountToWithdraw;
              await wagerRaceBalance.save({ session });
            }
          }
          logger.debug('remainingAmount', remainingAmount);

          const referBonusBalance = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
          if (referBonusBalance) {
            if (referBonusBalance.lockedWinnings > 0) {
              const amountToWithdraw = Math.min(referBonusBalance.lockedWinnings, remainingAmount);
              referBonusBalance.lockedWinnings -= amountToWithdraw;
              remainingAmount -= amountToWithdraw;
            }
          }
          logger.debug('remainingAmount', remainingAmount);

          if (remainingAmount > 0) {
            let deductionAmount = Math.min(user.balance, remainingAmount);
            user.balance -= deductionAmount;
          }
          break;
        }
        case WITHDRAWAL_TYPES.CASHBACK: {
          const cashbackBalance = await UserCashbackBalance.findOne({ userId: user._id }).session(session);
          if (cashbackBalance) {
            if (cashbackBalance.lockedWinnings > 0) {
              const amountToWithdraw = Math.min(cashbackBalance.lockedWinnings, remainingAmount);
              cashbackBalance.lockedWinnings -= amountToWithdraw;
              remainingAmount -= amountToWithdraw;
              await cashbackBalance.save({ session });
            }
          }
          break;
        }

        case WITHDRAWAL_TYPES.REFERRAL: {
          const referBonusBalance = await UserReferBonusBalance.findOne({ userId: user._id }).session(session);
          if (referBonusBalance) {
            if (referBonusBalance.lockedWinnings > 0) {
              const amountToWithdraw = Math.min(referBonusBalance.lockedWinnings, remainingAmount);
              referBonusBalance.lockedWinnings -= amountToWithdraw;
              remainingAmount -= amountToWithdraw;
              await referBonusBalance.save({ session });
            }
          }
          break;
        }
      }

      await user.save({ session });

      return { success: true };
    } catch (error) {
      logger.debug('processWithdrawal error', error);
      throw error;
    }
  }
}

GameBalanceService.initialize();

export default new GameBalanceService();
