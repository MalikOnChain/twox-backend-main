import PixTransaction from '@/models/transactions/PixTransaction';
import User from '@/models/users/User';
import balanceManagerService from '@/services/balance/BalanceManager.service';
import IPagueService from '@/services/transaction/IPague.service';
import { WITHDRAWAL_TYPES } from '@/types/crypto/crypto';
import { logger } from '@/utils/logger';

export class PixTransactionController {
  static ipagueService;

  constructor() {
    this.ipagueService = IPagueService;
  }

  async getTransactions(req, res) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const filter = req.query.filter || {};

      const query = { userId };
      if (filter?.type && filter.type !== 'ALL') {
        query.type = { $regex: filter.type, $options: 'i' };
      }

      if (filter?.date_from || filter?.date_to) {
        query.createdAt = {};
        if (filter.date_from) {
          const startDate = new Date(filter.date_from);
          startDate.setHours(0, 0, 0, 0);
          query.createdAt.$gte = startDate;
        }
        if (filter.date_to) {
          const endDate = new Date(filter.date_to);
          endDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = endDate;
        }
      }

      let total = 0;
      const transactions = await PixTransaction.find(query).sort({ createdAt: -1 }).limit(limit).skip(skip).exec();
      total = await PixTransaction.countDocuments(query);

      res.status(200).json({
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: page,
        },
        rows: transactions,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async initiatePayment(req, res) {
    try {
      const { amount, currency } = req.body;

      const isTestMode = req.isTestMode;

      const transaction = await this.ipagueService.initiatePayment(req.user.id, amount, currency, isTestMode);
      res.status(200).json(transaction);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async initiateWithdrawal(req, res) {
    try {
      const { amount, currency, pix_key, pix_key_type, withdrawalType = WITHDRAWAL_TYPES.ALL } = req.body;

      const pixKey = pix_key_type === 'phone' ? `+55${pix_key}` : pix_key;

      const user = await User.findById(req.user.id);

      if (!user) {
        throw new Error('User not found');
      }

      if (!Object.values(WITHDRAWAL_TYPES).includes(withdrawalType)) {
        throw new Error('Invalid withdrawal type');
      }

      const availableAmount = await balanceManagerService.getWithdrawalAvailableAmount(user, amount, withdrawalType);

      if (availableAmount < amount) {
        throw new Error('Insufficient balance');
      }

      await this.ipagueService.initiateWithdrawal(user._id, amount, currency, pixKey);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async processWithdrawal(req, res) {
    try {
      const { transactionId } = req.body;

      const transaction = await PixTransaction.findById(transactionId);

      logger.debug(transaction, 'transaction');

      const user = await User.findById(transaction.userId);

      logger.debug(user, 'user');

      if (user) {
        req.user = user;
      }

      const availableAmount = await balanceManagerService.getWithdrawalAvailableAmount(
        user,
        transaction.amount,
        WITHDRAWAL_TYPES.ALL
      );

      logger.debug(availableAmount, 'availableAmount');

      if (availableAmount < transaction.amount) {
        throw new Error('Insufficient balance');
      }

      await this.ipagueService.processWithdrawal(
        user._id,
        transaction._id,
        transaction.amount,
        transaction.currency,
        transaction.pixKey
      );
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getTotalAvailableWithdrawalAmount(req, res) {
    try {
      const balanceDetails = await balanceManagerService.getTotalAvaliableWithdrawalAmount(req.user.id);
      res.status(200).json({
        success: true,
        data: {
          totalAvailableWithdrawalAmount: balanceDetails.totalAvailableWithdrawalAmount,
          bonusDetails: balanceDetails.bonusDetails,
          cashbackDetails: balanceDetails.cashbackDetails,
          referBonusDetails: balanceDetails.referBonusDetails,
          wagerRaceDetails: balanceDetails.wagerRaceDetails,
          freeSpinDetails: balanceDetails.freeSpinDetails,
        },
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async webhookHandler(req, res) {
    const { transaction_id, type } = req.body;

    try {
      await this.ipagueService.webhookHandler(transaction_id, type, req.isTestMode);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.debug('PIX webhookHandler error', error);
    }
  }
}

export default new PixTransactionController();
