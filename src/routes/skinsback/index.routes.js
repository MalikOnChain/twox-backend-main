import express from 'express';

import SkinsbackController from '../../controllers/Skinback/Skinsback.controller';
import { requireAuth } from '../../middleware/auth';

export class SkinsbackRoutes {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post('/create-order', requireAuth, SkinsbackController.createOrder);
    this.router.get('/status', SkinsbackController.getServerStatus);
    this.router.get('/items/:gameType', requireAuth, SkinsbackController.getGameItems);
  }
}

const skinsbackRoutes = new SkinsbackRoutes();
export default skinsbackRoutes.router;
