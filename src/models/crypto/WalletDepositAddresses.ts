import mongoose from 'mongoose';

import { isVaultodyLegacyEnabled } from '@/config/legacy-rails';
import { logger } from '@/utils/logger';
import {
  fetchFystackDepositAddress,
  isFystackConfigured,
  listFystackDepositBlockchains,
} from '@/services/custody/FystackCustody.service';
import { BLOCKCHAIN_PROTOCOL_NAME, getNetworkForBlockchain, NETWORK } from '@/types/vaultody/vaultody';

const { Schema } = mongoose;

// Wallet Address Schema
const WalletDepositAddressesSchema = new Schema<IWalletDepositAddresses>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  blockchain: {
    type: String,
    required: true,
    enum: Object.values(BLOCKCHAIN_PROTOCOL_NAME),
  },
  network: {
    type: String,
    required: true,
    enum: Object.values(NETWORK),
  },
  label: {
    type: String,
    required: true,
  },
  walletType: {
    type: String,
    enum: ['metamask', 'phantom', 'vaultody', 'fystack', 'manual'],
    default: 'manual',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes
WalletDepositAddressesSchema.index({ userId: 1, blockchain: 1, network: 1 });

const generateRandomAddress = (): string => {
  return (
    '0x' +
    Array(40)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')
  );
};

// In development, generate mock addresses so registration works without a custodian.
const useMockDepositAddresses =
  process.env.NODE_ENV !== 'production' ||
  process.env.VAULTODY_MOCK_DEPOSIT_ADDRESSES === 'true';

/** `vaultody` = legacy Vaultody API only (skips Fystack even if configured). */
export type DepositAddressProvisioningMode = 'auto' | 'vaultody';

async function createVaultodyDepositRow(
  userId: mongoose.Types.ObjectId,
  blockchain: BLOCKCHAIN_PROTOCOL_NAME,
  network: NETWORK
) {
  const vaultodyClient = (await import('@/services/crypto/Vaultody.service')).default;
  const response = await vaultodyClient.generateDepositAddress({
    blockchain,
    network,
    label: `${userId}`,
    context: `User creation - ${userId}`,
  });
  return WalletDepositAddresses.create({
    userId,
    address: response.data.item.address,
    label: response.data.item.label,
    blockchain,
    network,
    walletType: 'vaultody' as const,
  });
}

// Helper function to create address for a specific blockchain
const createBlockchainAddress = async (
  userId: mongoose.Types.ObjectId,
  blockchain: BLOCKCHAIN_PROTOCOL_NAME,
  testMode: boolean = false,
  provisioningMode: DepositAddressProvisioningMode = 'auto'
): Promise<any> => {
  const network = getNetworkForBlockchain(blockchain);

  if (provisioningMode === 'vaultody') {
    if (!isVaultodyLegacyEnabled()) {
      throw new Error('Vaultody provisioning requires ENABLE_VAULTODY_LEGACY=true');
    }
    if (testMode) {
      return WalletDepositAddresses.create({
        userId,
        address: generateRandomAddress(),
        blockchain,
        network,
        label: `${userId}`,
        walletType: 'vaultody',
      });
    }
    return createVaultodyDepositRow(userId, blockchain, network);
  }

  let address: string;
  let label: string;
  let walletType: 'vaultody' | 'fystack' | 'manual' = 'manual';

  if (testMode) {
    address = generateRandomAddress();
    label = `${userId}`;
  } else if (isFystackConfigured() && listFystackDepositBlockchains().includes(blockchain)) {
    const res = await fetchFystackDepositAddress(userId, blockchain, network);
    address = res.address;
    label = res.label;
    walletType = 'fystack';
  } else if (isVaultodyLegacyEnabled()) {
    return createVaultodyDepositRow(userId, blockchain, network);
  } else if (useMockDepositAddresses) {
    address = generateRandomAddress();
    label = `${userId}`;
  } else {
    throw new Error(
      `Cannot provision ${blockchain} deposit address: configure Fystack, set ENABLE_VAULTODY_LEGACY=true, or enable mock addresses for non-production.`
    );
  }

  return await WalletDepositAddresses.create({
    userId,
    address,
    blockchain,
    network,
    label,
    walletType,
  });
};

// Middleware function to create deposit addresses
const createDepositAddressMiddleware = async function (this: any, next: (error?: any) => void): Promise<void> {
  try {
    // Only create addresses for new users
    if (!this.isNew) {
      return next();
    }

    const createdAddresses: any[] = [];

    const blockchainsToProvision = isFystackConfigured()
      ? listFystackDepositBlockchains()
      : Object.values(BLOCKCHAIN_PROTOCOL_NAME);

    for (const blockchain of blockchainsToProvision) {
      try {
        const address = await createBlockchainAddress(this._id, blockchain, useMockDepositAddresses, 'auto');
        createdAddresses.push(address);
      } catch (error) {
        console.error(`Failed to create ${blockchain} address:`, error);
        // Continue creating other addresses even if one fails
      }
    }

    if (createdAddresses.length === 0) {
      const err = new Error('Failed to create any deposit addresses');
      if (useMockDepositAddresses) {
        console.error(err);
        return next(err);
      }
      throw err;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Static method to get user's addresses
WalletDepositAddressesSchema.statics.getUserAddresses = async function (userId: mongoose.Types.ObjectId) {
  return this.find({
    userId,
  })
    .select('blockchain network address label walletType createdAt')
    .lean();
};

// Static method to get address by blockchain
WalletDepositAddressesSchema.statics.getAddressByBlockchain = async function (
  userId: mongoose.Types.ObjectId,
  blockchain: string
) {
  return this.findOne({
    userId,
    blockchain,
  }).select('blockchain network address label createdAt');
};

// Method to get all addresses grouped by blockchain
WalletDepositAddressesSchema.statics.getAddressesGroupedByBlockchain = async function (
  userId: mongoose.Types.ObjectId
) {
  const addresses = await this.find({ userId });
  return addresses.reduce((acc: any, addr: any) => {
    acc[addr.blockchain] = {
      address: addr.address,
      network: addr.network,
      label: addr.label,
      createdAt: addr.createdAt,
    };
    return acc;
  }, {});
};

const WalletDepositAddresses = mongoose.model<IWalletDepositAddresses, IWalletDepositAddressesModel>(
  'WalletDepositAddresses',
  WalletDepositAddressesSchema
);

/**
 * Lazily create or migrate deposit rows so GET /crypto/deposit-addresses can return Fystack chains
 * for users who registered before Fystack or when provisioning failed at signup.
 * Unique key is (userId, blockchain, network); legacy vaultody/manual rows are upgraded in place.
 */
export async function ensureFystackDepositRowsForUser(userId: mongoose.Types.ObjectId): Promise<void> {
  if (!isFystackConfigured()) return;

  for (const blockchain of listFystackDepositBlockchains()) {
    const network = getNetworkForBlockchain(blockchain);
    try {
      const doc = await WalletDepositAddresses.findOne({ userId, blockchain, network });
      if (doc?.walletType === 'fystack') continue;

      if (doc) {
        const res = await fetchFystackDepositAddress(userId, blockchain, network);
        doc.set({ address: res.address, label: res.label, walletType: 'fystack' });
        await doc.save();
        logger.info(`Deposit row migrated to Fystack: user=${userId} chain=${blockchain}`);
        continue;
      }

      await createBlockchainAddress(userId, blockchain, useMockDepositAddresses, 'auto');
    } catch (error) {
      logger.error(`ensureFystackDepositRowsForUser: failed for ${blockchain}`, error);
    }
  }
}

export default WalletDepositAddresses;

export { createBlockchainAddress, createDepositAddressMiddleware };
