import express from 'express';

import { isPixLegacyEnabled } from '@/config/legacy-rails';
import * as cryptoTransactionsAdmin from '@/controllers/AdminControllers/CryptoTransactionsAdmin.controller.js';
import pixTransactionController from '@/controllers/TransactionControllers/PixTransactionController';
import { requireAuth } from '@/middleware/auth';
import { CURRENCIES } from '@/models/transactions/PixTransaction';

export class TransactionRoutes {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  #validateTransactionParams(req, res, next) {
    const { amount, currency } = req.body;
    if (req.isTestMode) {
      return next();
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0.' });
    }

    if (!CURRENCIES.includes(currency)) {
      return res.status(400).json({ message: 'Currency must be BRL or USD.' });
    }

    next();
  }

  #validateWithdrawalParams(req, res, next) {
    const { pix_key, pix_key_type } = req.body;
    if (req.isTestMode) {
      return next();
    }

    switch (pix_key_type) {
      case 'email':
        if (!pix_key.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          return res.status(400).json({ message: 'Email must be a valid email address.' });
        }
        break;
      case 'phone':
        if (!pix_key.match(/^\d{11}$/)) {
          return res.status(400).json({ message: 'Phone number is invalid.' });
        }
        break;
      case 'cpf':
        break;
      default:
        return res.status(400).json({ message: 'PIX key is invalid.' });
    }

    next();
  }

  initializeRoutes() {
    this.router.get('/', requireAuth, (req, res) => {
      if (req.user?.role === 'admin') {
        return cryptoTransactionsAdmin.listCryptoTransactions(req, res);
      }
      return cryptoTransactionsAdmin.listUserCryptoTransactions(req, res);
    });
    this.router.get('/seed', requireAuth, cryptoTransactionsAdmin.getSeedData);
    this.router.get('/charts', requireAuth, cryptoTransactionsAdmin.getCharts);
    this.router.post('/approve-withdrawal', requireAuth, cryptoTransactionsAdmin.approveWithdrawal);

    const pixLegacyDisabled = (req, res) =>
      res.status(410).json({
        success: false,
        error:
          'PIX/fiat legacy payments are disabled for this deployment. Use crypto deposit and withdrawal.',
        code: 'PIX_LEGACY_DISABLED',
      });

    if (isPixLegacyEnabled()) {
      this.router.post(
        '/payment',
        [requireAuth, this.#validateTransactionParams],
        pixTransactionController.initiatePayment.bind(pixTransactionController)
      );
      this.router.post(
        '/withdraw',
        [requireAuth, this.#validateTransactionParams, this.#validateWithdrawalParams],
        pixTransactionController.initiateWithdrawal.bind(pixTransactionController)
      );
      this.router.post('/admin/withdraw', pixTransactionController.processWithdrawal.bind(pixTransactionController));
      this.router.post('/webhook', pixTransactionController.webhookHandler.bind(pixTransactionController));
      this.router.get(
        '/available-withdrawal-amount',
        requireAuth,
        pixTransactionController.getTotalAvailableWithdrawalAmount.bind(pixTransactionController)
      );
    } else {
      this.router.post('/payment', requireAuth, pixLegacyDisabled);
      this.router.post('/withdraw', requireAuth, pixLegacyDisabled);
      this.router.post('/admin/withdraw', pixLegacyDisabled);
      this.router.post('/webhook', pixLegacyDisabled);
      this.router.get('/available-withdrawal-amount', requireAuth, pixLegacyDisabled);
    }
  }
}

const transactionRoutes = new TransactionRoutes();
export default transactionRoutes.router;
