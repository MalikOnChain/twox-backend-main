import cron from 'node-cron';

import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import { CRYPTO_TRANSACTION_TYPES } from '@/types/crypto/crypto';
import { TRANSACTION_STATUS } from '@/controllers/TransactionControllers/BaseTransactionManager.js';
import { logger } from '@/utils/logger';
import { paymentDebugTrace } from '@/utils/paymentDebugTrace';

/**
 * Nightly stub: log pending crypto withdrawals for ops review.
 * Extend with Fystack API vs Mongo reconciliation when treasury endpoints are built.
 */
export function scheduleLiquidityReconciliation() {
  cron.schedule('0 3 * * *', async () => {
    try {
      const pending = await CryptoTransaction.countDocuments({
        type: CRYPTO_TRANSACTION_TYPES.WITHDRAW,
        status: { $in: [TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.PROCESSING] },
      });
      // #region agent log
      paymentDebugTrace({
        flow: 'reconciliation',
        step: 'pending_withdraw_count',
        data: { pending },
      });
      // #endregion
      logger.info(`[liquidity-reconciliation] pending crypto withdrawals: ${pending}`);
    } catch (e) {
      logger.error('[liquidity-reconciliation] job failed', e);
    }
  });
  logger.info('[liquidity-reconciliation] cron scheduled (03:00 daily)');
}
