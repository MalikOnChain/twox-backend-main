import express from 'express';
import contentSectionController from '@/controllers/content/ContentSection.controller';
import bonusBannerRouter from './bonus-banner.routes';
import { requireAuth, requireAdmin } from '@/middleware/auth';

class ContentRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Content sections routes
    this.router.get('/sections', contentSectionController.getContentSections.bind(contentSectionController));
    this.router.get('/sections/:id', contentSectionController.getContentSection.bind(contentSectionController));

    // Admin routes for content sections
    this.router.post('/sections', requireAuth, requireAdmin, contentSectionController.createContentSection.bind(contentSectionController));
    this.router.put('/sections/:id', requireAuth, requireAdmin, contentSectionController.updateContentSection.bind(contentSectionController));
    this.router.delete('/sections/:id', requireAuth, requireAdmin, contentSectionController.deleteContentSection.bind(contentSectionController));

    // Bonus banner routes
    this.router.use('/bonus-banners', bonusBannerRouter);
  }

  getRouter() {
    return this.router;
  }
}

const contentRouter = new ContentRouter();
export default contentRouter.getRouter();

