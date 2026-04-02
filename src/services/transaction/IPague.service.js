import axios from 'axios';
import moment from 'moment';
import mongoose from 'mongoose';

import PixTransaction, {
  TRANSACTION_TYPES,
  TRANSACTION_METHODS,
  TRANSACTION_STATUSES,
} from '@/models/transactions/PixTransaction';
import User from '@/models/users/User';
import NotificationService from '@/services/notification/Notification.service';
import { BALANCE_UPDATE_TYPES } from '@/types/balance/balance';
import { WITHDRAWAL_TYPES } from '@/types/crypto/crypto';
import { logger } from '@/utils/logger';

export class IPagueService {
  static axiosInstance;
  static webhookUrl;

  constructor() {
    this.webhookUrl = `${process.env.BACKEND_URL}/api/transactions/webhook`;

    this.axiosInstance = axios.create({
      baseURL: process.env.IPAGUE_BASE_URL,
      headers: {
        Authorization: process.env.IPAGUE_API_KEY,
      },
    });

    this.notificationService = NotificationService;
  }

  async getPixTransactions(params) {
    try {
      const response = await this.axiosInstance.get('/transactions', { params });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get pix transactions: ${error.message}`);
      throw error;
    }
  }

  async getPixWithdrawals(params) {
    try {
      const response = await this.axiosInstance.get('/withdrawals', { params });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get pix withdrawals: ${error.message}`);
      throw error;
    }
  }

  async initiatePayment(userId, amount, currency, isTestMode = false) {
    return this.#withTransaction(async (session) => {
      try {
        const user = await this.#getUser(userId);

        const due = moment.tz(moment.utc(), 'Brazil/East').add(5, 'minutes').format('YYYY-MM-DDTHH:mm:ss');

        const [transaction] = await PixTransaction.create(
          [
            {
              userId: user._id,
              amount,
              currency,
              type: TRANSACTION_TYPES.TRANSACTION,
              method: TRANSACTION_METHODS.PIX,
              due,
              status: TRANSACTION_STATUSES.CREATED,
            },
          ],
          { session }
        );

        const payload = {
          transaction_id: transaction._id,
          currency,
          amount,
          due,
          // TODO: Make user.fullName as required
          name: user.fullName || user.username,
          document_type: 'CPF',
          document_number: user.CPFNumber,
          webhook: this.webhookUrl,
        };

        logger.debug('payload', payload);

        if (isTestMode) {
          return {
            transaction_id: transaction._id,
            status: TRANSACTION_STATUSES.CREATED,
          };
        }

        const response = await this.axiosInstance.post('/pix', payload);
        return response.data;
      } catch (error) {
        let errorMessage = axios.isAxiosError(error) ? error.response.data.message : error.message;
        logger.error(`Failed to initiate payment with status ${error.status}: ${errorMessage}`);

        if (errorMessage.includes('body.document_number')) {
          errorMessage = 'CPF number is invalid';
        }

        throw new Error(errorMessage);
      }
    });
  }

  async initiateWithdrawal(userId, amount, currency, pixKey) {
    return this.#withTransaction(async (session) => {
      try {
        const user = await this.#getUser(userId);

        const [transaction] = await PixTransaction.create(
          [
            {
              userId: user._id,
              amount,
              currency,
              type: TRANSACTION_TYPES.WITHDRAWAL,
              method: TRANSACTION_METHODS.PAYOUT_PIX,
              status: TRANSACTION_STATUSES.CREATED,
              pixKey,
            },
          ],
          { session }
        );

        return transaction;
      } catch (error) {
        let errorMessage = axios.isAxiosError(error) ? error.response.data.message : error.message;
        logger.error(`Failed to process withdrawal with status ${error.status}: ${errorMessage}`);

        if (errorMessage.includes('body.document_number')) {
          errorMessage = 'CPF number is invalid';
        }

        throw new Error(errorMessage);
      }
    });
  }

  async processWithdrawal(userId, transactionId, amount, currency, pixKey) {
    return this.#withTransaction(async (session) => {
      try {
        const user = await this.#getUser(userId);

        const payload = {
          transaction_id: transactionId,
          currency,
          amount,
          // TODO: Make user.fullName as required
          name: user.fullName || user.username,
          document_type: 'CPF',
          document_number: user.CPFNumber,
          pix_key: pixKey,
          webhook: this.webhookUrl,
        };

        const response = await this.axiosInstance.post('/payout/pix', payload);
        const responseData = response.data;

        await user.decreaseGameTokenBalance(
          amount,
          BALANCE_UPDATE_TYPES.WITHDRAWAL,
          {
            withdrawalType: WITHDRAWAL_TYPES.ALL,
          },
          session
        );

        return responseData;
      } catch (error) {
        let errorMessage = axios.isAxiosError(error) ? error.response.data.message : error.message;
        logger.error(`Failed to process withdrawal with status ${error}`);

        if (errorMessage.includes('body.document_number')) {
          errorMessage = 'CPF number is invalid';
        }

        throw new Error(errorMessage);
      }
    });
  }

  async webhookHandler(transactionId, type, isTestMode = false) {
    try {
      logger.debug('webhookHandler', transactionId, type, isTestMode);

      // Validate transaction from IPague
      let pixTransaction;
      if (!isTestMode) {
        const params = { transaction_id: transactionId };

        if (type === TRANSACTION_TYPES.TRANSACTION) {
          pixTransaction = await this.getPixTransactions(params);
        } else {
          pixTransaction = await this.getPixWithdrawals(params);
        }

        if (!pixTransaction) {
          logger.error(`PIX Transaction not found: ${transactionId}`);
          return { success: false };
        }

        if (pixTransaction.status !== TRANSACTION_STATUSES.PAID) {
          logger.error(`Transaction not paid: ${transactionId}`);
          return { success: false };
        }
      } else {
        pixTransaction = {
          status: TRANSACTION_STATUSES.PAID,
          paid_at: moment().toISOString(),
          amount: 100,
          type: TRANSACTION_TYPES.TRANSACTION,
          method: TRANSACTION_METHODS.PIX,
          userId: '664664664664664664664664',
        };
      }

      // Validate transaction from our database
      const transaction = await PixTransaction.findOne({ _id: transactionId });

      if (!transaction) {
        logger.error(`Transaction not found: ${transactionId}`);
        return { success: false };
      }

      if (transaction.status !== TRANSACTION_STATUSES.CREATED) {
        logger.error(`Transaction already paid: ${transactionId}`);
        return { success: false };
      }

      // Update transaction status and paidAt
      transaction.status = pixTransaction.status;
      transaction.paidAt = pixTransaction.paid_at;
      // Update transaction amount to the amount paid through PIX

      if (!isTestMode) {
        transaction.amount = pixTransaction.amount;
      }

      await transaction.save();

      const user = await this.#getUser(transaction.userId);
      const result = { success: true, type: pixTransaction.type, status: pixTransaction.status };

      logger.debug('pixTransaction', pixTransaction);

      // If transaction is a deposit and paid, update user balance
      if (type === TRANSACTION_TYPES.TRANSACTION && pixTransaction.status === TRANSACTION_STATUSES.PAID) {
        logger.debug('increasing balance', transaction.amount);
        const { balance } = await user.increaseGameTokenBalance(pixTransaction.amount, BALANCE_UPDATE_TYPES.DEPOSIT);
        logger.debug('balance', balance);

        // Send notification about deposit
        await this.notificationService.createNotification(
          transaction.userId,
          'DEPOSIT_SUCCESS',
          { amount: transaction.amount, currency: 'BRC', transactionId: transaction._id },
          { importance: 'HIGH' }
        );

        return { ...result, balance };
      }

      // If transaction is a withdrawal and failed to pay, restore user balance
      if (
        type === TRANSACTION_TYPES.WITHDRAWAL &&
        [TRANSACTION_STATUSES.MANUALLY_REJECTED, TRANSACTION_STATUSES.REJECTED].includes(pixTransaction.status)
      ) {
        const { balance } = await user.increaseGameTokenBalance(pixTransaction.amount);
        return { ...result, balance };
      }

      // If transaction is a withdrawal and paid, send notification about withdrawal
      if (type === TRANSACTION_TYPES.WITHDRAWAL && pixTransaction.status === TRANSACTION_STATUSES.PAID) {
        await this.notificationService.createNotification(
          transaction.userId,
          'WITHDRAWAL_SUCCESS',
          { amount: transaction.amount, currency: 'BRC', transactionId: transaction._id },
          { importance: 'HIGH' }
        );
      }

      return result;
    } catch (error) {
      logger.error(`Failed to handle iPague webhook: ${error.message}`);
      throw error;
    }
  }

  async #getUser(userId) {
    return await User.findById(userId);
  }

  async #withTransaction(operation) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await operation(session);

      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export default new IPagueService();
