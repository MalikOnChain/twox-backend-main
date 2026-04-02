import express from 'express';

import WagerRaceController from '@/controllers/WagerRaceController/WagerRace.controller';

import { requireAuth } from '../../middleware/auth';

class WagerRaceRoutes {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/list', WagerRaceController.getActiveRaces);
    this.router.post('/entry/:id', requireAuth, WagerRaceController.entryRace);
    this.router.get('/me/:id', requireAuth, WagerRaceController.getUserRaceMetrics);
    this.router.get('/:id', WagerRaceController.getWagerRaceRankingById);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const wagerRaceRouter = new WagerRaceRoutes();
export default wagerRaceRouter.getRouter();
