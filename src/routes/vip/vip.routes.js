import express from 'express';

import VipController from '@/controllers/VipControllers/VIP.controller';
import rewardsRoutes from './rewards.routes';

class VipRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/', VipController.getVipStatus);
    this.router.get('/ranking-info', VipController.getRankingSystemInfo);
    
    // Tier rewards routes
    this.router.use('/', rewardsRoutes);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const vipRouter = new VipRouter();
export default vipRouter.getRouter();
