import express from 'express';

import BlueOceanWalletController from '@/controllers/BlueoceanController/BlueOceanWallet.controller';

class BlueOceanWalletRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // BlueOcean Wallet Endpoints
    // These endpoints will be called by BlueOcean's servers
    this.router.get('/balance', BlueOceanWalletController.getBalance);
    this.router.get('/debit', BlueOceanWalletController.debitBalance);
    this.router.get('/credit', BlueOceanWalletController.creditBalance);
    this.router.get('/rollback', BlueOceanWalletController.rollbackTransaction);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const blueOceanWalletRouter = new BlueOceanWalletRouter();
export default blueOceanWalletRouter.getRouter();

