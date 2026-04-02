import express from 'express';
import { check } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import WaitingListAuthController from '@/controllers/auth/WaitingListAuth.controller';
import WaitingListOAuthController from '@/controllers/auth/WaitingListOAuth.controller';
import { takeTokenStateByIdentifier } from '@/services/auth/TokenState';
import { setRefreshTokenCookie } from '@/utils/helpers/auth.js';

class WaitingListAuthRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Token exchange endpoint
    this.router.post(
      '/exchange-token',
      check('identifier', 'Authentication identifier is required').notEmpty().isString(),
      handleValidationErrors,
      this.handleTokenExchange.bind(this)
    );

    // Main auth routes
    this.router.post('/login', WaitingListAuthController.login);
    this.router.post('/register', WaitingListAuthController.register);

    // OAuth routes
    // Google OAuth
    this.router.get('/google', WaitingListOAuthController.googleAuth);
    this.router.get('/google/callback', WaitingListOAuthController.googleCallback);

    // Discord OAuth
    this.router.get('/discord', WaitingListOAuthController.discordAuth);
    this.router.get('/discord/callback', WaitingListOAuthController.discordCallback);

    // Telegram OAuth
    this.router.get('/telegram', WaitingListOAuthController.telegramAuth);
    this.router.post('/telegram/callback', express.json(), WaitingListOAuthController.telegramCallback);
  }

  async handleTokenExchange(req, res, next) {
    const { identifier } = req.body;

    try {
      const searchResult = await takeTokenStateByIdentifier(identifier);

      if (!searchResult) {
        res.status(400);
        return next(new Error('Invalid token'));
      }

      const accessToken = searchResult.accessToken;
      const refreshToken = searchResult.refreshToken;

      setRefreshTokenCookie(res, refreshToken);

      // Return JWT
      return res.json({
        success: true,
        token: accessToken,
        message: 'Token exchange successful',
      });
    } catch (error) {
      return next(error);
    }
  }

  getRouter() {
    return this.router;
  }
}

const waitingListAuthRouter = new WaitingListAuthRouter();
export default waitingListAuthRouter.getRouter();

