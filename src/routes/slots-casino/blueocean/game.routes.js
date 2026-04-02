import express from 'express';

import BlueOceanController from '@/controllers/BlueoceanController/Blueocean.controller';

class GameProviderRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post('/sync', BlueOceanController.syncGames);
    this.router.post('/sync/providers', BlueOceanController.syncProviders);
    this.router.get('/games', BlueOceanController.getGames);
    this.router.get('/games/count', BlueOceanController.getGamesCount);
    this.router.get('/providers', BlueOceanController.getProviders);
    this.router.get('/categories', BlueOceanController.getCategories);
    this.router.get('/types', BlueOceanController.getGameTypes);
    this.router.get('/stats', BlueOceanController.getGameStats);
    this.router.get('/', BlueOceanController.getGame);
    this.router.post('/launch', BlueOceanController.launchGame);
    this.router.post('/gameplay', BlueOceanController.gameplay);
    this.router.post('/logout', BlueOceanController.logoutPlayer);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const gameProviderRouter = new GameProviderRouter();
export default gameProviderRouter.getRouter();
