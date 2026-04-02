import express from 'express';

import NexusController from '@/controllers/Casino/Nexus.controller';

class ExternalRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/provider/list', NexusController.getProviderList);
    this.router.get('/game/list', NexusController.getGameList);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const externalRouter = new ExternalRouter();
export default externalRouter.getRouter();
