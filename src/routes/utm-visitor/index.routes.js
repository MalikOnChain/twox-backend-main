import express from 'express';

import UTMVisitorController from '@/controllers/UTMVisitorController/UTMVisitor.controller';

class UTMVisitorRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post('/', UTMVisitorController.trackVisitor);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const utmVisitorRouter = new UTMVisitorRouter();
export default utmVisitorRouter.getRouter();
