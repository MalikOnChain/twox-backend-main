import express from 'express';

import SettingController from '@/controllers/SettingController/Setting.controller';

class SettingsRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/', SettingController.getSettings);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const settingsRouter = new SettingsRouter();
export default settingsRouter.getRouter();
