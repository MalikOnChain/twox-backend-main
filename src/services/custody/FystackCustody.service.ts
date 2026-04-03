import { AddressType, Environment, FystackSDK, WalletPurpose, WalletType } from '@fystack/sdk';
import mongoose from 'mongoose';

import User from '@/models/users/User';
import { BLOCKCHAIN_PROTOCOL_NAME, NETWORK } from '@/types/vaultody/vaultody';
import { logger } from '@/utils/logger';
import { paymentDebugTrace } from '@/utils/paymentDebugTrace';

let sdkSingleton: FystackSDK | null = null;

/** Enterprise sandbox API host (Fystack: pass in SDK constructor with Environment.Sandbox). */
const FYSTACK_ENTERPRISE_SANDBOX_DOMAIN = 'api.enterprise-sandbox.fystack.io';

export function isFystackConfigured(): boolean {
  return Boolean(process.env.FYSTACK_API_KEY && process.env.FYSTACK_API_SECRET && process.env.FYSTACK_WORKSPACE_ID);
}

function resolveFystackSdkDomain(environment: Environment): string | undefined {
  const override = process.env.FYSTACK_API_DOMAIN?.trim();
  if (override) return override;
  if (environment === Environment.Sandbox) {
    return FYSTACK_ENTERPRISE_SANDBOX_DOMAIN;
  }
  return undefined;
}

export function getFystackSdk(): FystackSDK {
  if (!isFystackConfigured()) {
    throw new Error('Fystack is not configured (FYSTACK_API_KEY, FYSTACK_API_SECRET, FYSTACK_WORKSPACE_ID).');
  }
  if (!sdkSingleton) {
    const env =
      process.env.FYSTACK_ENV === 'production'
        ? Environment.Production
        : process.env.FYSTACK_ENV === 'sandbox'
          ? Environment.Sandbox
          : process.env.NODE_ENV === 'production'
            ? Environment.Production
            : Environment.Sandbox;
    sdkSingleton = new FystackSDK({
      credentials: {
        apiKey: process.env.FYSTACK_API_KEY as string,
        apiSecret: process.env.FYSTACK_API_SECRET as string,
      },
      workspaceId: process.env.FYSTACK_WORKSPACE_ID as string,
      environment: env,
      domain: resolveFystackSdkDomain(env),
      debug: process.env.FYSTACK_DEBUG === 'true',
    });
  }
  return sdkSingleton;
}

/** Default deposit chains = stable withdraw rails (ERC20 / TRC20 / BSC). Override with FYSTACK_DEPOSIT_BLOCKCHAINS. */
const DEFAULT_FYSTACK_DEPOSIT_BLOCKCHAINS = 'ethereum,tron,binance-smart-chain';

function depositBlockchains(): BLOCKCHAIN_PROTOCOL_NAME[] {
  const raw = process.env.FYSTACK_DEPOSIT_BLOCKCHAINS || DEFAULT_FYSTACK_DEPOSIT_BLOCKCHAINS;
  const keys = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: BLOCKCHAIN_PROTOCOL_NAME[] = [];
  for (const k of keys) {
    const v = Object.values(BLOCKCHAIN_PROTOCOL_NAME).find((b) => b === k);
    if (v) out.push(v);
  }
  return out.length
    ? out
    : [BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM, BLOCKCHAIN_PROTOCOL_NAME.TRON, BLOCKCHAIN_PROTOCOL_NAME.BINANCE_SMART_CHAIN];
}

function addressTypeForBlockchain(blockchain: BLOCKCHAIN_PROTOCOL_NAME): AddressType | null {
  if (blockchain === BLOCKCHAIN_PROTOCOL_NAME.TRON) return AddressType.Tron;
  if (blockchain === BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM) return AddressType.Evm;
  /* Fystack deposit-address API currently exposes evm | sol | tron, map other EVM-family chains to EVM. */
  const evmFamily = new Set([
    BLOCKCHAIN_PROTOCOL_NAME.BINANCE_SMART_CHAIN,
    BLOCKCHAIN_PROTOCOL_NAME.POLYGON,
    BLOCKCHAIN_PROTOCOL_NAME.ARBITRUM,
    BLOCKCHAIN_PROTOCOL_NAME.OPTIMISM,
    BLOCKCHAIN_PROTOCOL_NAME.BASE,
    BLOCKCHAIN_PROTOCOL_NAME.LINEA,
    BLOCKCHAIN_PROTOCOL_NAME.AVALANCHE,
    BLOCKCHAIN_PROTOCOL_NAME.FANTOM,
  ]);
  if (evmFamily.has(blockchain)) return AddressType.Evm;
  return null;
}

/**
 * Ensure the user has a dedicated Fystack MPC wallet for deposits; returns wallet UUID.
 *
 * Pass `userDocument` from User `pre('save')` for new users — `findById` cannot see the row until after insert.
 */
export async function ensureUserFystackDepositWallet(
  userId: mongoose.Types.ObjectId,
  userDocument?: mongoose.Document | null
): Promise<string> {
  const user = userDocument ?? (await User.findById(userId));
  if (!user) throw new Error('User not found');
  const existing = (user as unknown as { fystackDepositWalletId?: string }).fystackDepositWalletId;
  if (existing) {
    // #region agent log
    paymentDebugTrace({
      flow: 'fystack_wallet',
      step: 'deposit_wallet_reuse',
      data: { userIdLen: String(userId).length },
    });
    // #endregion
    return existing;
  }

  const sdk = getFystackSdk();
  const name = `user-${userId.toString()}`;
  const created = await sdk.createWallet(
    {
      name,
      walletType: WalletType.MPC,
      walletPurpose: WalletPurpose.User,
    },
    true
  );
  const walletId = (created as { wallet_id?: string }).wallet_id;
  if (!walletId) {
    throw new Error('Fystack createWallet did not return wallet_id');
  }
  if (user.isNew) {
    user.set('fystackDepositWalletId', walletId);
  } else {
    await User.updateOne({ _id: userId }, { $set: { fystackDepositWalletId: walletId } });
  }
  // #region agent log
  paymentDebugTrace({
    flow: 'fystack_wallet',
    step: 'deposit_wallet_created',
    data: { userIdLen: String(userId).length, walletIdLen: String(walletId).length },
  });
  // #endregion
  logger.info(`Fystack deposit wallet created for user ${userId}: ${walletId}`);
  return walletId;
}

export interface GeneratedDepositAddress {
  address: string;
  label: string;
}

/**
 * Fetch on-chain deposit address from Fystack for a user's wallet.
 */
export async function fetchFystackDepositAddress(
  userId: mongoose.Types.ObjectId,
  blockchain: BLOCKCHAIN_PROTOCOL_NAME,
  network: NETWORK,
  userDocument?: mongoose.Document | null
): Promise<GeneratedDepositAddress> {
  const addressType = addressTypeForBlockchain(blockchain);
  if (!addressType) {
    throw new Error(`Fystack deposit address not supported for blockchain: ${blockchain}`);
  }
  const walletId = await ensureUserFystackDepositWallet(userId, userDocument);
  const sdk = getFystackSdk();
  const data = (await sdk.getDepositAddress(walletId, addressType)) as { address?: string };
  if (!data?.address) {
    throw new Error('Fystack getDepositAddress returned no address');
  }
  // #region agent log
  paymentDebugTrace({
    flow: 'fystack_deposit_address',
    step: 'fetched',
    data: { blockchain: String(blockchain), network: String(network), addrLen: data.address.length },
  });
  // #endregion
  return {
    address: data.address,
    /** Human-readable for admin/UI; avoid `${userId}` (ObjectId hex was shown as "crypto name"). */
    label: `Fystack · ${blockchain} · ${network}`,
  };
}

export function listFystackDepositBlockchains(): BLOCKCHAIN_PROTOCOL_NAME[] {
  return depositBlockchains();
}
