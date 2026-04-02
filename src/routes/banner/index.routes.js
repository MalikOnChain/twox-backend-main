import express from 'express';

import BannerController from '@/controllers/BannerController/Banner.controller';

class BannerRoutes {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/', this.getBanners.bind(this));
  }

  async getBanners(_req, res, next) {
    try {
      const banners = await BannerController.getBanners();
      return res.json({ banners });
    } catch (error) {
      next(error);
    }
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const bannerRouter = new BannerRoutes();
export default bannerRouter.getRouter();
