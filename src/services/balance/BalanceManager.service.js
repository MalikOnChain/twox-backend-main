import BonusManagementService from '@/services/balance/BonusManagement.service';
import CoreBalanceService from '@/services/balance/CoreBalance.service';
import GameBalanceService from '@/services/balance/GameBalance.service';

export class BalanceManagerService {
  static instance = null;

  constructor() {
    if (BalanceManagerService.instance) {
      return BalanceManagerService.instance;
    }

    BalanceManagerService.instance = this;
  }

  static initialize() {
    if (!BalanceManagerService.instance) {
      BalanceManagerService.instance = new BalanceManagerService();
    }
    return BalanceManagerService.instance;
  }

  static getInstance() {
    if (!BalanceManagerService.instance) {
      throw new Error('BalanceManagerService has not been initialized. Call initialize() first.');
    }
    return BalanceManagerService.instance;
  }

  async getTotalBalance(user, session = null) {
    return CoreBalanceService.getTotalBalance(user, session);
  }

  async getTotalAvailableBalance(user, session = null) {
    return CoreBalanceService.getTotalAvailableBalance(user, session);
  }

  async getTotalBonusBalance(userId, session = null) {
    return CoreBalanceService.getTotalBonusBalance(userId, session);
  }

  async getTotalLockedWinnings(userId, session = null) {
    return CoreBalanceService.getTotalLockedWinnings(userId, session);
  }

  async getCashbackBalance(userId, session = null) {
    return CoreBalanceService.getCashbackBalance(userId, session);
  }

  async getFreeSpinBalance(userId, session = null) {
    return CoreBalanceService.getFreeSpinBalance(userId, session);
  }

  async getFreeSpinsBalanceDetails(userId, session = null) {
    return CoreBalanceService.getFreeSpinsBalanceDetails(userId, session);
  }

  async getCashbackLockedWinnings(userId, session = null) {
    return CoreBalanceService.getCashbackLockedWinnings(userId, session);
  }

  async getReferBonusBalance(userId, session = null) {
    return CoreBalanceService.getReferBonusBalance(userId, session);
  }

  async getReferBonusLockedWinnings(userId, session = null) {
    return CoreBalanceService.getReferBonusLockedWinnings(userId, session);
  }

  async getWagerRaceBalance(userId, session = null) {
    return CoreBalanceService.getWagerRaceBalance(userId, session);
  }

  async getWagerRaceLockedWinnings(userId, session = null) {
    return CoreBalanceService.getWagerRaceLockedWinnings(userId, session);
  }

  async hasEnoughBalance(user, amount, session = null) {
    return CoreBalanceService.hasEnoughBalance(user, amount, session);
  }

  async increaseRealBalance(user, amount, source, session, metadata = {}, isDeposit = false) {
    return CoreBalanceService.increaseRealBalance(user, amount, source, session, metadata, isDeposit);
  }

  async decreaseRealBalance(user, amount, source, session, metadata = {}) {
    return CoreBalanceService.decreaseRealBalance(user, amount, source, session, metadata);
  }

  async increaseCashbackBalance(user, amount, wageringMultiplier, session) {
    return BonusManagementService.increaseCashbackBalance(user, amount, wageringMultiplier, session);
  }

  async increaseFreeSpinsBalance(user, amount, session = null) {
    return BonusManagementService.increaseFreeSpinsBalance(user, amount, session);
  }

  async addBonus(user, bonusDetails, session = null) {
    return BonusManagementService.addBonus(user, bonusDetails, session);
  }

  async getActiveBonuses(user, session = null) {
    return BonusManagementService.getActiveBonuses(user, session);
  }

  async processBet(user, betAmount, metadata, session) {
    return GameBalanceService.processBet(user, betAmount, metadata, session);
  }

  async processWin(user, winAmount, metadata, session) {
    return GameBalanceService.processWin(user, winAmount, metadata, session);
  }

  async getFreeSpinLockedWinnings(userId, session = null) {
    return CoreBalanceService.getFreeSpinLockedWinnings(userId, session);
  }

  processLoss(user, betDetails) {
    return GameBalanceService.processLoss(user, betDetails);
  }

  async updateWageringProgress(user, session) {
    return BonusManagementService.updateWageringProgress(user, session);
  }

  async checkAndUnlockWinnings(user, session) {
    return BonusManagementService.checkAndUnlockWinnings(user, session);
  }

  getGameContribution(gameType = 'default') {
    return CoreBalanceService.getGameContribution(gameType);
  }

  async getBalanceDetails(user, session = null) {
    return CoreBalanceService.getBalanceDetails(user, session);
  }

  async getWithdrawalDetails(userId, session = null) {
    return GameBalanceService.getWithdrawalDetails(userId, session);
  }

  async checkPossibleWithdrawal(user, amount, session = null) {
    return GameBalanceService.checkPossibleWithdrawal(user, amount, session);
  }

  async getWithdrawalAvailableAmount(user, amount, withdrawalType, session = null) {
    return GameBalanceService.getWithdrawalAvailableAmount(user, amount, withdrawalType, session);
  }

  async processWithdrawal(user, amount, withdrawalType, session = null) {
    return GameBalanceService.processWithdrawal(user, amount, withdrawalType, session);
  }

  async getBonusBalanceDetails(user, session = null) {
    return CoreBalanceService.getBonusBalanceDetails(user, session);
  }

  async getCashbackBalanceDetails(user) {
    return CoreBalanceService.getCashbackBalanceDetails(user);
  }

  async getReferBonusBalanceDetails(user) {
    return CoreBalanceService.getReferBonusBalanceDetails(user);
  }

  async getWagerRaceBalanceDetails(user) {
    return CoreBalanceService.getWagerRaceBalanceDetails(user);
  }

  async getUserDepositStats(userId) {
    return CoreBalanceService.getUserDepositStats(userId);
  }

  async _emitBalanceUpdate(user, source, metadata = {}, session = null) {
    return CoreBalanceService._emitBalanceUpdate(user, source, metadata, session);
  }
}

BalanceManagerService.initialize();

export default new BalanceManagerService();
