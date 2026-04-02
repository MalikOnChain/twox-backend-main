import express from 'express';

import PromotionController from '@/controllers/PromotionController/Promotion.controller';

class PromotionRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/', PromotionController.getPromotions);
    this.router.get('/:id', PromotionController.getPromotionById);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const promotionRouter = new PromotionRouter();
export default promotionRouter.getRouter();
