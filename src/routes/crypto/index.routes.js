import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';

import { requireAuth } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import User from '@/models/users/User';
import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import { TRANSACTION_STATUS } from '@/controllers/TransactionControllers/BaseTransactionManager.js';
import CryptoPriceService from '@/services/crypto/CryptoPrice.service';
import {
  submitFystackWithdrawal,
  withdrawNetworkOptionsForApi,
  withdrawNetworkToBlockchain,
  listWithdrawNetworksForCurrency,
  stableWithdrawPayoutOptionsForApi,
  isStablecoinsOnlyWithdrawUi,
} from '@/services/custody/CryptoWithdrawal.service';
import {
  isFystackConfigured,
  listFystackDepositBlockchains,
} from '@/services/custody/FystackCustody.service';
import UserWalletService from '@/services/user/Wallet.service';
import { ensureFystackDepositRowsForUser } from '@/models/crypto/WalletDepositAddresses';
import { WITHDRAWAL_TYPES, CRYPTO_TRANSACTION_TYPES } from '@/types/crypto/crypto';
import { GameBalanceService } from '@/services/balance/GameBalance.service';
import { v4 as uuidv4 } from 'uuid';
import priceRouter from './price.routes';
import { paymentDebugTrace } from '@/utils/paymentDebugTrace';

class CryptoRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Price routes (public)
    this.router.use('/', priceRouter);
    
    this.router.get('/price/usd', this.getPriceUSD.bind(this));
    this.router.get('/deposit-addresses', requireAuth, this.getDepositAddresses.bind(this));
    this.router.post('/withdraw', 
      requireAuth,
      [
        body('amount').isNumeric().withMessage('Amount must be a number'),
        body('currency').isString().withMessage('Currency is required'),
        body('address').isString().withMessage('Crypto address is required'),
        body('network').optional().isString().withMessage('Network must be a string'),
      ],
      this.withdrawCrypto.bind(this)
    );
    this.router.post('/withdraw/all', requireAuth, this.withdrawAll.bind(this));
    this.router.post('/withdraw/wager-race', requireAuth, this.withdrawWagerRace.bind(this));
    this.router.post('/withdraw/bonus', requireAuth, this.withdrawBonus.bind(this));
    this.router.post('/withdraw/cashback', requireAuth, this.withdrawCashback.bind(this));
    this.router.post('/withdraw/referral', requireAuth, this.withdrawReferral.bind(this));
    this.router.post('/validate-address', requireAuth, this.validateCryptoAddress.bind(this));
    this.router.get('/withdraw-config', requireAuth, this.getWithdrawConfig.bind(this));
    // this.router.use('/vaultody', vaultodyRouter);
  }

  async getDepositAddresses(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      if (isFystackConfigured()) {
        await ensureFystackDepositRowsForUser(user._id);
      }
      let addressesWithQR = await UserWalletService.getDepositAddressesWithQR(user);
      /* Deposit UI is Fystack-only when configured: hide legacy Vaultody / other rows and stale chains. */
      if (isFystackConfigured()) {
        const allowed = new Set(listFystackDepositBlockchains());
        addressesWithQR = addressesWithQR.filter(
          (row) => row.walletType === 'fystack' && allowed.has(row.blockchain)
        );
      }
      return res.json({ success: true, data: addressesWithQR });
    } catch (error) {
      logger.error('getDepositAddresses', error);
      return next(error);
    }
  }

  async getPriceUSD(req, res, next) {
    try {
      // TODO: Implement price fetching logic
      res.json({ success: true, price: 1.0 });
    } catch (error) {
      next(error);
    }
  }

  async withdrawCrypto(req, res, next) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { amount, currency, address, network: networkBody } = req.body;
      const userId = req.user.id;
      const currencyUpper = String(currency || 'USDT').toUpperCase();
      const allowedNets = listWithdrawNetworksForCurrency(currencyUpper);
      let withdrawNetwork = String(networkBody || 'ERC20').toUpperCase();
      if (!allowedNets.map((n) => n.toUpperCase()).includes(withdrawNetwork)) {
        withdrawNetwork = allowedNets[0].toUpperCase();
      }
      const ledgerBlockchain = withdrawNetworkToBlockchain(withdrawNetwork);

      // Validate amount
      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Withdrawal amount must be greater than 0',
        });
      }

      // Get user with current balance
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check if user has sufficient balance
      if (user.balance < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance. Current balance: ${user.balance}, Requested: ${amount}`,
        });
      }

      // Check if balance is 0
      if (user.balance === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot withdraw from zero balance',
        });
      }

      // #region agent log
      paymentDebugTrace({
        flow: 'withdraw',
        step: 'pre_session',
        hypothesisId: 'H-path',
        data: { currency: currencyUpper },
      });
      // #endregion

      const session = await mongoose.startSession();
      let responsePayload;
      let createdCryptoTxId = null;
      try {
        await session.withTransaction(async () => {
          const freshUser = await User.findById(userId).session(session);
          if (!freshUser || freshUser.balance < amount) {
            throw new Error('Insufficient balance');
          }

          const balanceBefore = freshUser.balance;
          freshUser.balance -= amount;
          await freshUser.save({ session });

          const rate = await CryptoPriceService.getPriceInUSD(currency.toUpperCase());
          const tokenAmount = rate > 0 ? amount / rate : amount;

          const [created] = await CryptoTransaction.create(
            [
              {
                userId: freshUser._id,
                blockchain: ledgerBlockchain,
                network: 'mainnet',
                type: CRYPTO_TRANSACTION_TYPES.WITHDRAW,
                userBalance: { before: balanceBefore, after: freshUser.balance },
                status: TRANSACTION_STATUS.PENDING,
                amount: tokenAmount,
                exchangeRate: rate,
                exchangedAmount: amount,
                unit: currency.toUpperCase(),
                transactionId: `withdraw-${uuidv4()}`,
                address,
                metadata: {
                  recipientAddress: address,
                  custodyProvider: 'fystack',
                  withdrawal_type: WITHDRAWAL_TYPES.REAL,
                  withdrawNetwork,
                },
              },
            ],
            { session }
          );

          createdCryptoTxId = created._id;

          logger.info('Crypto withdrawal queued (Fystack)', {
            userId,
            transactionId: created._id,
            amount,
            currency,
            address,
            withdrawNetwork,
            ledgerBlockchain,
            balanceBefore,
            balanceAfter: freshUser.balance,
          });

          responsePayload = {
            success: true,
            data: {
              transaction_id: created._id,
              amount,
              currency,
              address,
              balance_before: balanceBefore,
              balance_after: freshUser.balance,
              status: 'pending_approval',
            },
          };
        });

        /** Push payout to Fystack hot wallet when FYSTACK_AUTO_SUBMIT_WITHDRAW=true */
        // #region agent log
        paymentDebugTrace({
          flow: 'withdraw',
          step: 'fystack_auto_gate',
          hypothesisId: 'H-A',
          data: {
            envAuto: String(process.env.FYSTACK_AUTO_SUBMIT_WITHDRAW),
            envIsTrue: process.env.FYSTACK_AUTO_SUBMIT_WITHDRAW === 'true',
            hasCryptoTxId: Boolean(createdCryptoTxId),
            hasResponsePayload: Boolean(responsePayload?.data),
          },
        });
        // #endregion
        if (process.env.FYSTACK_AUTO_SUBMIT_WITHDRAW === 'true' && createdCryptoTxId) {
          try {
            const out = await submitFystackWithdrawal(String(createdCryptoTxId));
            // #region agent log
            paymentDebugTrace({
              flow: 'withdraw',
              step: 'fystack_auto_result',
              hypothesisId: 'H-B',
              data: {
                ok: Boolean(out.ok),
                messageLen: out.message ? String(out.message).length : 0,
              },
            });
            // #endregion
            if (responsePayload?.data) {
              responsePayload.data.fystack = {
                submitted: Boolean(out.ok),
                message: out.ok ? null : out.message || null,
              };
            }
            if (!out.ok) {
              logger.warn('Fystack auto-submit skipped or failed after withdraw request', {
                userId,
                message: out.message,
              });
            }
          } catch (e) {
            // #region agent log
            paymentDebugTrace({
              flow: 'withdraw',
              step: 'fystack_auto_throw',
              hypothesisId: 'H-E',
              data: { errName: e?.name, errMsgLen: e?.message ? String(e.message).length : 0 },
            });
            // #endregion
            if (responsePayload?.data) {
              responsePayload.data.fystack = {
                submitted: false,
                message: e?.message || 'Fystack submit error',
              };
            }
            logger.warn('Fystack auto-submit error (withdrawal remains PENDING for manual approve)', e);
          }
        }

        return res.status(201).json(responsePayload);
      } finally {
        await session.endSession();
      }
    } catch (error) {
      logger.error('Error processing crypto withdrawal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal',
      });
    }
  }

  async withdrawAll(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      if (user.balance === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot withdraw from zero balance',
        });
      }

      // Use GameBalanceService for complex withdrawal logic
      const gameBalanceService = GameBalanceService.getInstance();
      const availableAmount = await gameBalanceService.getWithdrawalAvailableAmount(
        user,
        user.balance,
        WITHDRAWAL_TYPES.ALL
      );

      if (availableAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'No funds available for withdrawal',
        });
      }

      const session = await mongoose.startSession();
      let withdrawAllPayload;
      try {
        await session.withTransaction(async () => {
          const balanceBefore = user.balance;
          await gameBalanceService.processWithdrawal(
            user,
            availableAmount,
            WITHDRAWAL_TYPES.ALL,
            session
          );

          const freshUser = await User.findById(userId).session(session);
          if (!freshUser) {
            throw new Error('User not found');
          }

          const exchangeRate = 1;

          const [created] = await CryptoTransaction.create(
            [
              {
                userId: freshUser._id,
                blockchain: 'ethereum',
                network: 'mainnet',
                type: CRYPTO_TRANSACTION_TYPES.WITHDRAW,
                userBalance: { before: balanceBefore, after: freshUser.balance },
                status: TRANSACTION_STATUS.PENDING,
                amount: availableAmount,
                exchangeRate,
                exchangedAmount: availableAmount,
                unit: 'USD',
                transactionId: `withdraw-all-${uuidv4()}`,
                address: 'ledger-withdraw-all',
                metadata: {
                  custodyProvider: 'ledger',
                  withdrawal_type: WITHDRAWAL_TYPES.ALL,
                  all_funds: true,
                },
              },
            ],
            { session }
          );

          logger.info('All funds withdrawal processed', {
            userId,
            transactionId: created._id,
            amount: availableAmount,
            balanceAfter: freshUser.balance,
          });

          withdrawAllPayload = {
            success: true,
            data: {
              transaction_id: created._id,
              amount: availableAmount,
              balance_after: freshUser.balance,
              status: 'processing',
            },
          };
        });
      } finally {
        await session.endSession();
      }

      if (!withdrawAllPayload) {
        return res.status(500).json({
          success: false,
          error: 'Withdraw-all transaction did not complete',
        });
      }

      return res.json(withdrawAllPayload);
    } catch (error) {
      logger.error('Error processing all funds withdrawal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal',
      });
    }
  }

  async withdrawWagerRace(req, res, next) {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const gameBalanceService = GameBalanceService.getInstance();
      const availableAmount = await gameBalanceService.getWithdrawalAvailableAmount(
        user,
        amount,
        WITHDRAWAL_TYPES.WAGER_RACE
      );

      if (availableAmount < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wager race balance. Available: ${availableAmount}, Requested: ${amount}`,
        });
      }

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        await gameBalanceService.processWithdrawal(
          user,
          amount,
          WITHDRAWAL_TYPES.WAGER_RACE,
          session
        );

        res.json({
          success: true,
          data: {
            amount: amount,
            balance_after: user.balance,
          },
        });
      });

      await session.endSession();
    } catch (error) {
      logger.error('Error processing wager race withdrawal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal',
      });
    }
  }

  async withdrawBonus(req, res, next) {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const gameBalanceService = GameBalanceService.getInstance();
      const availableAmount = await gameBalanceService.getWithdrawalAvailableAmount(
        user,
        amount,
        WITHDRAWAL_TYPES.BONUS
      );

      if (availableAmount < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient bonus balance. Available: ${availableAmount}, Requested: ${amount}`,
        });
      }

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        await gameBalanceService.processWithdrawal(
          user,
          amount,
          WITHDRAWAL_TYPES.BONUS,
          session
        );

        res.json({
          success: true,
          data: {
            amount: amount,
            balance_after: user.balance,
          },
        });
      });

      await session.endSession();
    } catch (error) {
      logger.error('Error processing bonus withdrawal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal',
      });
    }
  }

  async withdrawCashback(req, res, next) {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const gameBalanceService = GameBalanceService.getInstance();
      const availableAmount = await gameBalanceService.getWithdrawalAvailableAmount(
        user,
        amount,
        WITHDRAWAL_TYPES.CASHBACK
      );

      if (availableAmount < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient cashback balance. Available: ${availableAmount}, Requested: ${amount}`,
        });
      }

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        await gameBalanceService.processWithdrawal(
          user,
          amount,
          WITHDRAWAL_TYPES.CASHBACK,
          session
        );

        res.json({
          success: true,
          data: {
            amount: amount,
            balance_after: user.balance,
          },
        });
      });

      await session.endSession();
    } catch (error) {
      logger.error('Error processing cashback withdrawal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal',
      });
    }
  }

  async withdrawReferral(req, res, next) {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const gameBalanceService = GameBalanceService.getInstance();
      const availableAmount = await gameBalanceService.getWithdrawalAvailableAmount(
        user,
        amount,
        WITHDRAWAL_TYPES.REFERRAL
      );

      if (availableAmount < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient referral balance. Available: ${availableAmount}, Requested: ${amount}`,
        });
      }

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        await gameBalanceService.processWithdrawal(
          user,
          amount,
          WITHDRAWAL_TYPES.REFERRAL,
          session
        );

        res.json({
          success: true,
          data: {
            amount: amount,
            balance_after: user.balance,
          },
        });
      });

      await session.endSession();
    } catch (error) {
      logger.error('Error processing referral withdrawal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process withdrawal',
      });
    }
  }

  async validateCryptoAddress(req, res, next) {
    try {
      const { address, currency } = req.body;

      // TODO: Implement actual crypto address validation
      // This would typically use a service to validate the address format
      
      res.json({
        success: true,
        data: {
          valid: true,
          address: address,
          currency: currency,
        },
      });
    } catch (error) {
      logger.error('Error validating crypto address:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to validate address',
      });
    }
  }

  async getWithdrawConfig(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get withdrawal configuration
      const config = {
        minWithdrawal: 10, // Minimum withdrawal amount
        maxWithdrawal: user.balance, // Maximum withdrawal is current balance
        currentBalance: user.balance,
        availableCurrencies: ['BTC', 'ETH', 'USDT', 'USDC'],
        withdrawalFee: 0.01, // 1% fee
        /** Legacy per-currency rails when FYSTACK_UI_STABLECOINS_ONLY=false */
        withdrawNetworks: withdrawNetworkOptionsForApi('USDT'),
        /** USDT/USDC × ERC20·TRC20·BSC when stable UI is on (default) */
        ...(isStablecoinsOnlyWithdrawUi()
          ? { withdrawStablePayoutOptions: stableWithdrawPayoutOptionsForApi() }
          : {}),
      };

      // #region agent log
      paymentDebugTrace({
        flow: 'withdraw_ui',
        step: 'withdraw_config_served',
        data: { stableOnly: isStablecoinsOnlyWithdrawUi() },
      });
      // #endregion
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Error getting withdrawal config:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get withdrawal config',
      });
    }
  }
}

export default new CryptoRouter().router;
