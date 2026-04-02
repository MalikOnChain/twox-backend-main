import express from 'express';

import blueOceanRouter from './blueocean/index.routes';
import nexusGGRRouter from './nexusggr/index.routes';

class SlotsCasinoRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.use('/nexusggr', nexusGGRRouter);
    this.router.use('/blueocean', blueOceanRouter);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const slotsCasinoRouter = new SlotsCasinoRouter();
export default slotsCasinoRouter.getRouter();
