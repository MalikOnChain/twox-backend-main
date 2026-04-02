import express from 'express';

import externalRouter from './external.routes';
import gameRouter from './game.routes';

class NexusGGRRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Mount the sub-routers with their respective prefixes
    this.router.use('/external', externalRouter);
    this.router.use('/game', gameRouter);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const nexusGGRRouter = new NexusGGRRouter();
export default nexusGGRRouter.getRouter();
