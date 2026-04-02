import express from 'express';

import gameRouter from './game.routes';
import walletRouter from './wallet.routes';
import statsRouter from './stats.routes';

class BlueOceanRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.use('/game', gameRouter);
    this.router.use('/wallet', walletRouter);
    this.router.use('/stats', statsRouter);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const blueOceanRouter = new BlueOceanRouter();
export default blueOceanRouter.getRouter();
