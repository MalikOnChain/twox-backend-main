import mongoose from 'mongoose';

import DepositWalletAddress from '@/models/crypto/WalletDepositAddresses';
import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import User from '@/models/users/User';
import CryptoPriceService from '@/services/crypto/CryptoPrice.service';
import { FYSTACK_WEBHOOK_EVENTS, type InboundDepositTransfer } from '@/types/custody/fystack';
import { CRYPTO_TRANSACTION_TYPES } from '@/types/crypto/crypto';
import { BLOCKCHAIN_PROTOCOL_NAME, NETWORK } from '@/types/vaultody/vaultody';
import { logger } from '@/utils/logger';
import { paymentDebugTrace } from '@/utils/paymentDebugTrace';

import { TRANSACTION_STATUS } from '@/controllers/TransactionControllers/BaseTransactionManager.js';

/**
 * Parse Fystack deposit webhook inner payload (event.payload from HTTP body).
 */
export function parseFystackDepositPayload(inner: Record<string, unknown>): InboundDepositTransfer {
  const amountRaw = BigInt(String(inner.amount ?? '0'));
  const asset = (inner.asset as Record<string, unknown>) || {};
  const decimals = Number(asset.decimals ?? 8);
  const human = Number(amountRaw) / 10 ** decimals;
  const unit = String(asset.symbol || 'UNKNOWN').toUpperCase();
  const toAddress = String(inner.to_address || '').trim();
  const txHash = inner.tx_hash ? String(inner.tx_hash) : null;
  const providerTxId = String(inner.id || inner.resource_id || txHash || `${toAddress}-${inner.created_at}`);
  return {
    providerTxId,
    txHash,
    toAddress,
    amountHuman: human,
    unit,
    assetId: inner.asset_id ? String(inner.asset_id) : undefined,
    rawPayload: inner as unknown as Record<string, unknown>,
  };
}

function normalizeAddr(a: string): string {
  return a.startsWith('0x') ? a.toLowerCase() : a;
}

/**
 * Idempotent deposit credit: insert/update CryptoTransaction and increase user balance once.
 *
 * Balance model: credits go to the user's single `user.balance` (USD-equivalent), regardless of
 * which deposit address / blockchain received the funds. Withdrawals choose a payout network
 * independently (see crypto withdraw + FYSTACK_WITHDRAW_ASSET_MAP). Per-chain silo balances are
 * not implemented unless product adds explicit `balanceByBlockchain` (and bet allocation).
 */
export async function processFystackDepositConfirmed(transfer: InboundDepositTransfer): Promise<{ credited: boolean }> {
  const session = await mongoose.startSession();
  let credited = false;
  try {
    await session.withTransaction(async () => {
      const esc = normalizeAddr(transfer.toAddress).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wallet = await DepositWalletAddress.findOne({
        address: new RegExp(`^${esc}$`, 'i'),
      }).session(session);

      if (!wallet) {
        logger.warn(`Fystack deposit: no WalletDepositAddresses for to_address=${transfer.toAddress}`);
        throw new Error('Unknown deposit address');
      }

      const user = await User.findById(wallet.userId).session(session);
      if (!user) {
        throw new Error('User not found for deposit address');
      }

      const txKey = transfer.txHash || transfer.providerTxId;
      const existing = await CryptoTransaction.findOne({ transactionId: txKey }).session(session);
      if (existing && existing.status === TRANSACTION_STATUS.COMPLETED) {
        return;
      }

      const exchangeRate = await CryptoPriceService.getPriceInUSD(transfer.unit as any);
      const exchangedAmount = transfer.amountHuman * exchangeRate;

      const balanceBefore = user.balance || 0;
      user.balance = balanceBefore + exchangedAmount;
      await user.save({ session });

      const doc = {
        userId: wallet.userId,
        blockchain: wallet.blockchain as BLOCKCHAIN_PROTOCOL_NAME,
        network: wallet.network as NETWORK,
        type: CRYPTO_TRANSACTION_TYPES.DEPOSIT,
        userBalance: { before: balanceBefore, after: user.balance },
        status: TRANSACTION_STATUS.COMPLETED,
        amount: transfer.amountHuman,
        exchangeRate,
        exchangedAmount,
        unit: transfer.unit,
        transactionId: txKey,
        address: wallet.address,
        metadata: {
          custodyProvider: 'fystack',
          fystackPayload: transfer.rawPayload,
          txHash: transfer.txHash,
        },
        currentConfirmations: 1,
        targetConfirmations: 1,
      };

      if (existing) {
        Object.assign(existing, doc);
        await existing.save({ session });
      } else {
        await CryptoTransaction.create([doc], { session });
      }
      credited = true;
      logger.info(`Fystack deposit credited user=${wallet.userId} amountUSD≈${exchangedAmount} tx=${txKey}`);
    });
  } finally {
    await session.endSession();
  }
  // #region agent log
  paymentDebugTrace({
    flow: 'deposit',
    step: 'confirmed_process_finished',
    data: { credited },
  });
  // #endregion
  return { credited };
}

export async function handleFystackWithdrawalFinalized(
  eventName: string,
  inner: Record<string, unknown>
): Promise<void> {
  const witId = inner.id != null ? String(inner.id) : '';
  const txHash = inner.tx_hash != null ? String(inner.tx_hash) : '';
  const failed = eventName === FYSTACK_WEBHOOK_EVENTS.WITHDRAWAL_FAILED;
  const or: Record<string, string>[] = [];
  if (witId) or.push({ 'metadata.fystackWithdrawalId': witId });
  if (txHash) or.push({ transactionId: txHash });
  if (!or.length) {
    logger.warn('Fystack withdrawal webhook missing id and tx_hash');
    return;
  }
  const status = failed ? TRANSACTION_STATUS.FAILED : TRANSACTION_STATUS.COMPLETED;
  const updated = await CryptoTransaction.findOneAndUpdate(
    { $or: or },
    {
      $set: {
        status,
        'metadata.fystackWithdrawalPayload': inner,
        ...(txHash ? { 'metadata.completedTxHash': txHash } : {}),
      },
    }
  );
  // #region agent log
  paymentDebugTrace({
    flow: 'webhook',
    step: 'withdrawal_finalized_db',
    data: {
      eventName,
      failed,
      matchedDoc: Boolean(updated),
      hasWitId: Boolean(witId),
      hasTxHash: Boolean(txHash),
    },
  });
  // #endregion
}

export async function handleFystackWebhookEvent(eventName: string, body: Record<string, unknown>): Promise<void> {
  const inner = (body.payload as Record<string, unknown>) || body;
  // #region agent log
  paymentDebugTrace({
    flow: 'webhook',
    step: 'dispatch',
    data: { eventName },
  });
  // #endregion
  if (eventName === FYSTACK_WEBHOOK_EVENTS.DEPOSIT_CONFIRMED) {
    const transfer = parseFystackDepositPayload(inner);
    await processFystackDepositConfirmed(transfer);
    return;
  }
  if (eventName === FYSTACK_WEBHOOK_EVENTS.DEPOSIT_PENDING) {
    // #region agent log
    paymentDebugTrace({ flow: 'webhook', step: 'deposit_pending_noop', data: {} });
    // #endregion
    logger.info('Fystack deposit.pending received (no ledger credit until confirmed)');
    return;
  }
  if (
    eventName === FYSTACK_WEBHOOK_EVENTS.WITHDRAWAL_CONFIRMED ||
    eventName === FYSTACK_WEBHOOK_EVENTS.WITHDRAWAL_FAILED
  ) {
    await handleFystackWithdrawalFinalized(eventName, inner);
    return;
  }
  // #region agent log
  paymentDebugTrace({ flow: 'webhook', step: 'event_ignored', data: { eventName } });
  // #endregion
  logger.info(`Fystack webhook event ignored: ${eventName}`);
}
