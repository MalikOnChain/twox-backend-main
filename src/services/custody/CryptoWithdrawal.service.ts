import mongoose from 'mongoose';

import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import { getFystackSdk, isFystackConfigured } from '@/services/custody/FystackCustody.service';
import { CRYPTO_TRANSACTION_TYPES } from '@/types/crypto/crypto';
import { BLOCKCHAIN_PROTOCOL_NAME } from '@/types/vaultody/vaultody';
import { logger } from '@/utils/logger';
import { paymentDebugTrace } from '@/utils/paymentDebugTrace';

import { TRANSACTION_STATUS } from '@/controllers/TransactionControllers/BaseTransactionManager.js';

function parseAssetMap(): Record<string, string> {
  try {
    return JSON.parse(process.env.FYSTACK_WITHDRAW_ASSET_MAP || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Resolve Fystack asset UUID: prefer `USDT_ERC20`-style keys when present, else legacy flat `USDT`.
 */
export function resolveWithdrawAssetId(
  map: Record<string, string>,
  unit: string,
  network: string
): string | undefined {
  const u = unit.toUpperCase();
  const n = network.toUpperCase();
  const composite = `${u}_${n}`;
  if (map[composite]) return map[composite];
  if (map[u]) return map[u];
  return undefined;
}

const STABLE_UI_WITHDRAW_RAILS = new Set(['ERC20', 'TRC20', 'BSC']);

/**
 * When false, withdrawal UIs may list all rails from `FYSTACK_WITHDRAW_ASSET_MAP`.
 * Default: stable-only (USDT/USDC × ERC20 · TRC20 · BSC).
 */
export function isStablecoinsOnlyWithdrawUi(): boolean {
  return process.env.FYSTACK_UI_STABLECOINS_ONLY !== 'false';
}

/**
 * Full rail list from env map, use when `FYSTACK_UI_STABLECOINS_ONLY=false` (legacy / all chains).
 */
export function legacyListWithdrawNetworksForCurrency(currency: string): string[] {
  const map = parseAssetMap();
  const u = currency.toUpperCase();
  const prefix = `${u}_`;
  const keys = Object.keys(map).filter((k) => k.startsWith(prefix) && k.length > prefix.length);
  if (keys.length > 0) {
    return keys.map((k) => k.slice(prefix.length));
  }
  if (map[u]) {
    return ['ERC20', 'TRC20', 'BSC'];
  }
  return ['ERC20', 'TRC20', 'BSC'];
}

/** Networks implied by FYSTACK_WITHDRAW_ASSET_MAP, filtered to stable rails when stable UI is on. */
export function listWithdrawNetworksForCurrency(currency: string): string[] {
  const full = legacyListWithdrawNetworksForCurrency(currency);
  if (!isStablecoinsOnlyWithdrawUi()) {
    return full;
  }
  const filtered = full.filter((n) => STABLE_UI_WITHDRAW_RAILS.has(n.toUpperCase()));
  return filtered.length > 0 ? filtered : ['ERC20', 'TRC20', 'BSC'];
}

const NETWORK_LABELS: Record<string, string> = {
  ERC20: 'ERC20 (Ethereum)',
  TRC20: 'TRC20 (Tron)',
  BSC: 'BSC (BEP-20)',
  SOL: 'Solana (SPL)',
  SOLANA: 'Solana (SPL)',
  SPL: 'Solana (SPL)',
  POLYGON: 'Polygon',
  MATIC: 'Polygon',
  ARBITRUM: 'Arbitrum',
  ARB: 'Arbitrum',
  OPTIMISM: 'Optimism',
  OP: 'Optimism',
  BASE: 'Base',
  AVAX: 'Avalanche',
  AVALANCHE: 'Avalanche',
  FANTOM: 'Fantom',
  FTM: 'Fantom',
  LINEA: 'Linea',
};

export function withdrawNetworkOptionsForApi(currency: string): { value: string; label: string }[] {
  const values = listWithdrawNetworksForCurrency(currency);
  const sym = currency.toUpperCase();
  return values.map((value) => ({
    value,
    label: isStablecoinsOnlyWithdrawUi()
      ? `${NETWORK_LABELS[value.toUpperCase()] || value} · ${sym}`
      : NETWORK_LABELS[value.toUpperCase()] || value,
  }));
}

/** Combined USDT + USDC × ERC20 / TRC20 / BSC for stable-only withdraw pickers. */
export function stableWithdrawPayoutOptionsForApi(): {
  value: string;
  label: string;
  symbol: string;
  network: string;
}[] {
  const rails = ['ERC20', 'TRC20', 'BSC'] as const;
  const symbols = ['USDT', 'USDC'] as const;
  const out: { value: string; label: string; symbol: string; network: string }[] = [];
  for (const symbol of symbols) {
    for (const network of rails) {
      out.push({
        value: `${symbol}:${network}`,
        label: `${NETWORK_LABELS[network] || network} · ${symbol}`,
        symbol,
        network,
      });
    }
  }
  return out;
}

/** Map UI withdraw network token to ledger blockchain enum value. */
export function withdrawNetworkToBlockchain(network: string): string {
  const n = network.toUpperCase();
  if (n === 'ERC20' || n === 'ETH') return BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM;
  if (n === 'TRC20' || n === 'TRON' || n === 'TRX') return BLOCKCHAIN_PROTOCOL_NAME.TRON;
  if (n === 'BSC' || n === 'BEP20') return BLOCKCHAIN_PROTOCOL_NAME.BINANCE_SMART_CHAIN;
  if (n === 'SOL' || n === 'SOLANA' || n === 'SPL') return BLOCKCHAIN_PROTOCOL_NAME.SOLANA;
  if (n === 'POLYGON' || n === 'MATIC') return BLOCKCHAIN_PROTOCOL_NAME.POLYGON;
  if (n === 'ARBITRUM' || n === 'ARB') return BLOCKCHAIN_PROTOCOL_NAME.ARBITRUM;
  if (n === 'OPTIMISM' || n === 'OP') return BLOCKCHAIN_PROTOCOL_NAME.OPTIMISM;
  if (n === 'BASE') return BLOCKCHAIN_PROTOCOL_NAME.BASE;
  if (n === 'AVAX' || n === 'AVALANCHE') return BLOCKCHAIN_PROTOCOL_NAME.AVALANCHE;
  if (n === 'FANTOM' || n === 'FTM') return BLOCKCHAIN_PROTOCOL_NAME.FANTOM;
  if (n === 'LINEA') return BLOCKCHAIN_PROTOCOL_NAME.LINEA;
  return BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM;
}

/**
 * Submit a pending withdrawal to Fystack (hot / payout wallet).
 */
export async function submitFystackWithdrawal(cryptoTxId: string): Promise<{ ok: boolean; message?: string }> {
  const _cfg = isFystackConfigured();
  const _hot = Boolean(process.env.FYSTACK_HOT_WALLET_ID);
  // #region agent log
  paymentDebugTrace({
    flow: 'fystack_submit',
    step: 'entry',
    hypothesisId: 'H-B',
    data: { cryptoTxIdLen: String(cryptoTxId).length, configured: _cfg, hasHotWalletId: _hot },
  });
  // #endregion
  if (!_cfg) {
    return { ok: false, message: 'Fystack not configured' };
  }
  const hotWalletId = process.env.FYSTACK_HOT_WALLET_ID;
  if (!hotWalletId) {
    return { ok: false, message: 'FYSTACK_HOT_WALLET_ID not set' };
  }

  const session = await mongoose.startSession();
  try {
    let result: { ok: boolean; message?: string } = { ok: false };
    await session.withTransaction(async () => {
      const tx = await CryptoTransaction.findById(cryptoTxId).session(session);
      const typeOk = Boolean(tx && String(tx.type) === CRYPTO_TRANSACTION_TYPES.WITHDRAW);
      const statusOk = Boolean(
        tx && (tx.status === TRANSACTION_STATUS.PENDING || tx.status === TRANSACTION_STATUS.PROCESSING)
      );
      // #region agent log
      paymentDebugTrace({
        flow: 'fystack_submit',
        step: 'tx_loaded',
        hypothesisId: 'H-C',
        data: {
          hasTx: Boolean(tx),
          typeOk,
          statusOk,
          status: tx ? String(tx.status) : null,
          typeSample: tx ? String(tx.type).slice(0, 12) : null,
        },
      });
      // #endregion
      if (!tx || String(tx.type) !== CRYPTO_TRANSACTION_TYPES.WITHDRAW) {
        result = { ok: false, message: 'Withdrawal not found' };
        return;
      }
      if (tx.status !== TRANSACTION_STATUS.PENDING && tx.status !== TRANSACTION_STATUS.PROCESSING) {
        result = { ok: false, message: 'Invalid withdrawal status' };
        return;
      }

      const assetMap = parseAssetMap();
      const withdrawNetwork = String(tx.metadata?.withdrawNetwork || 'ERC20').toUpperCase();
      const assetId = resolveWithdrawAssetId(assetMap, tx.unit, withdrawNetwork);
      const mapKeyCount = Object.keys(assetMap).length;
      // #region agent log
      paymentDebugTrace({
        flow: 'fystack_submit',
        step: 'asset_resolve',
        hypothesisId: 'H-D',
        data: {
          unit: tx.unit ? String(tx.unit).toUpperCase() : null,
          withdrawNetwork,
          hasAssetId: Boolean(assetId),
          mapKeyCount,
        },
      });
      // #endregion
      if (!assetId) {
        result = {
          ok: false,
          message: `No Fystack asset id for ${tx.unit} on ${withdrawNetwork} (FYSTACK_WITHDRAW_ASSET_MAP: use ${String(tx.unit).toUpperCase()}_${withdrawNetwork} or flat ${String(tx.unit).toUpperCase()})`,
        };
        return;
      }

      const recipient = String(tx.metadata?.recipientAddress || '').trim();
      if (!recipient) {
        result = { ok: false, message: 'Missing recipient address on transaction' };
        return;
      }

      const sdk = getFystackSdk();
      const amountStr = String(tx.amount);

      const fystackRes = (await sdk.requestWithdrawal(hotWalletId, {
        assetId,
        amount: amountStr,
        recipientAddress: recipient,
        notes: `user:${tx.userId}`,
      })) as { id?: string; withdrawal_id?: string };

      const wid = fystackRes?.id || fystackRes?.withdrawal_id;
      // #region agent log
      paymentDebugTrace({
        flow: 'fystack_submit',
        step: 'after_requestWithdrawal',
        hypothesisId: 'H-E',
        data: {
          hasWid: Boolean(wid),
          resKeyCount: fystackRes && typeof fystackRes === 'object' ? Object.keys(fystackRes).length : 0,
        },
      });
      // #endregion

      tx.set('status', TRANSACTION_STATUS.PROCESSING);
      tx.metadata = {
        ...tx.metadata,
        fystackSubmittedAt: new Date().toISOString(),
        ...(wid ? { fystackWithdrawalId: wid } : {}),
        fystackWithdrawalResponse: fystackRes,
      };
      await tx.save({ session });
      result = { ok: true };
      logger.info(`Fystack withdrawal submitted for CryptoTransaction ${cryptoTxId}`);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
