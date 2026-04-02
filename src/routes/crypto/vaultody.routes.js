import express from 'express';

import { isVaultodyLegacyEnabled } from '@/config/legacy-rails';
import { requireAuth } from '@/middleware/auth';
import { createBlockchainAddress } from '@/models/crypto/WalletDepositAddresses';
import VaultodySingleton from '@/services/crypto/Vaultody.service';

// import {
//   getBalancesForDepositAddresses,
//   transferFundsToAdminWallet,
// } from '@/controllers/CryptoControllers/VaultodyController';

class VaultodyRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post('/generate/deposit-address', requireAuth, this.generateDepositAddress);
    this.router.get('/assets/:address', requireAuth, this.getAssets);
    this.router.get('/all-assets', requireAuth, this.getAllAssets);
    this.router.get('/transfer-admin', requireAuth, this.transferToAdmin);
  }

  async generateDepositAddress(req, res, next) {
    const { blockchain, network, label } = req.body;
    try {
      if (!isVaultodyLegacyEnabled()) {
        return res.status(410).json({
          error: 'Vaultody legacy API is disabled. Set ENABLE_VAULTODY_LEGACY=true to enable.',
          code: 'VAULTODY_LEGACY_DISABLED',
        });
      }
      if (!blockchain) return res.status(400).json({ error: 'blockchain is required' });
      if (!network) return res.status(400).json({ error: 'network is required' });
      if (!label) return res.status(400).json({ error: 'label is required' });
      const testMode = req.isTestMode;

      const result = await createBlockchainAddress(req.user.id, blockchain, testMode, 'vaultody');

      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAssets(req, res, next) {
    const { blockchain } = req.query;
    const { address } = req.params;

    if (!blockchain) return res.status(400).json({ error: 'blockchain is required' });
    if (!address) return res.status(400).json({ error: 'address is required' });

    try {
      if (!isVaultodyLegacyEnabled()) {
        return res.status(410).json({
          error: 'Vaultody legacy API is disabled.',
          code: 'VAULTODY_LEGACY_DISABLED',
        });
      }
      const response = await VaultodySingleton.getAssetsByAddress(address, blockchain);
      return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getAllAssets(req, res, next) {
    // TODO: update admin validation
    const { is_admin } = req.query;

    try {
      if (!is_admin) {
        return res.status(403).json({ error: 'You are not a admin' });
      }

      // const response = await getBalancesForDepositAddresses();
      // return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async transferToAdmin(req, res, next) {
    // TODO: update admin validation
    const { is_admin } = req.query;

    try {
      if (!is_admin) {
        return res.status(403).json({ error: 'You are not a admin' });
      }

      // const response = await transferFundsToAdminWallet();
      // return res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

const vaultodyRouter = new VaultodyRouter();
export default vaultodyRouter.router;
