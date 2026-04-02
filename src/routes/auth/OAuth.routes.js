import express from 'express';

import OAuthController from '@/controllers/auth/OAuth.controller';

class OAuthRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Google OAuth
    this.router.get('/google', OAuthController.googleAuth);
    this.router.get('/google/callback', OAuthController.googleCallback);

    // Discord OAuth
    this.router.get('/discord', OAuthController.discordAuth);
    this.router.get('/discord/callback', OAuthController.discordCallback);

    // Telegram OAuth
    this.router.get('/telegram', OAuthController.telegramAuth);
    this.router.post('/telegram/callback', express.json(), OAuthController.telegramCallback);
  }

  getRouter() {
    return this.router;
  }
}

const oAuthRouter = new OAuthRouter();
export default oAuthRouter.getRouter();

