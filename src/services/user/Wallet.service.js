import cryptoTransactionManager from '@/controllers/TransactionControllers/CryptoTransactionManager';
import DepositWalletAddress from '@/models/crypto/WalletDepositAddresses';
import User from '@/models/users/User';
import { generateCryptoQr } from '@/utils/helpers/qrcode';

export class WalletService {
  constructor() {
    this.cryptoTransactionManager = cryptoTransactionManager;
  }

  async getDepositAddressesWithQR(user) {
    try {
      const depositAddresses = await user.getWalletDepositAddresses();

      return Promise.all(
        depositAddresses.map(async (addr) => {
          try {
            const qrCode = await generateCryptoQr(addr.address);
            return { ...addr, qrCode };
          } catch (err) {
            console.error(`Failed to generate QR code for address: ${addr.address}`, err);
            return { ...addr, qrCode: null };
          }
        })
      );
    } catch (error) {
      console.error('Error getting deposit addresses:', error);
      throw error;
    }
  }

  async getCryptoAmountStatus(userId) {
    const { totalDepositAmount } = await this.cryptoTransactionManager.getDepositAmountByUserId(userId);
    return { totalDepositAmount };
  }

  async generateDepositAddress(userId, blockchain, network, address) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const existingAddress = await DepositWalletAddress.findOne({
      where: {
        blockchain: blockchain,
        network: network,
        address: address,
      },
    });

    if (existingAddress) {
      return existingAddress;
    }

    const depositWalletAddress = await DepositWalletAddress.create({
      user_id: userId,
      blockchain,
      network,
      address,
    });

    return depositWalletAddress;
  }

  async saveConnectedWallet({ userId, address, blockchain, network, label, walletType }) {
    try {
      // Normalize address case based on blockchain
      // Solana, Bitcoin, Sui addresses are case-sensitive - preserve original case
      // EVM addresses are case-insensitive - lowercase for consistency
      const caseSensitiveBlockchains = ['solana', 'bitcoin', 'bitcoin-cash', 'sui'];
      const normalizedAddress = caseSensitiveBlockchains.includes(blockchain.toLowerCase()) 
        ? address 
        : address.toLowerCase();

      // Check if this address already exists for the user
      const existingAddress = await DepositWalletAddress.findOne({
        userId,
        address: normalizedAddress,
        blockchain,
      });

      if (existingAddress) {
        // Update wallet type if provided
        if (walletType && existingAddress.walletType !== walletType) {
          existingAddress.walletType = walletType;
          await existingAddress.save();
        }
        return existingAddress;
      }

      // Create new wallet deposit address
      const walletAddress = await DepositWalletAddress.create({
        userId,
        address: normalizedAddress,
        blockchain,
        network,
        label,
        walletType: walletType || 'manual',
      });

      return walletAddress;
    } catch (error) {
      logger.error('Failed to save connected wallet:', error);
      throw error;
    }
  }
}

export default new WalletService();
