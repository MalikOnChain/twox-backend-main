import express from 'express';

import NexusController from '@/controllers/Casino/Nexus.controller';

import { requireAuth } from '../../../middleware/auth';

class GameProviderRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/providers/list', NexusController.getProvidersList);
    this.router.post('/launch', requireAuth, NexusController.launchGame);
    this.router.post('/launch/demo', NexusController.launchDemoGame);
    this.router.get('/list', NexusController.getGamesHandler);
    this.router.get('/categories', NexusController.getGameCategories);
    this.router.get('/favorite/list', requireAuth, NexusController.getFavoriteGames);
    this.router.get('/', NexusController.getGameHandler);
    this.router.get('/call/list', NexusController.getCallList);
    this.router.post('/call/apply', NexusController.applyCall);
    this.router.get('/call/players', NexusController.getCallPlayers);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const gameProviderRouter = new GameProviderRouter();
export default gameProviderRouter.getRouter();
