import express from 'express';
import { check } from 'express-validator';

import AdminPanelAuthController from '@/controllers/auth/AdminPanelAuth.controller';
import { handleValidationErrors } from '@/middleware/validation-error';
import { takeTokenStateByIdentifier } from '@/services/auth/TokenState';
import { setRefreshTokenCookie } from '@/utils/helpers/auth.js';

import { requireAuth } from '../../middleware/auth.js';

import MainAuthRoutes from './MainAuth/index.routes.js';
import OAuthRoutes from './OAuth.routes.js';

class AuthRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post(
      '/exchange-token',
      check('identifier', 'Authentication identifier is required').notEmpty().isString(),
      handleValidationErrors,
      this.handleTokenExchange.bind(this)
    );

    this.router.get('/isAuthenticated', requireAuth, this.handleIsAuthenticated.bind(this));
    this.router.post('/validate-recaptcha', this.handleRecaptchaValidation.bind(this));

    // Admin panel (frontend-admin): email/password for users with role `admin`
    this.router.post('/signin', AdminPanelAuthController.signin);
    this.router.get('/me', requireAuth, AdminPanelAuthController.me);

    this.router.use('/registration', MainAuthRoutes);
    
    // OAuth routes
    this.router.use('/', OAuthRoutes);
  }

  async handleTokenExchange(req, res, next) {
    const { identifier } = req.body;

    try {
      const searchResult = await takeTokenStateByIdentifier(identifier);

      if (!searchResult) {
        return res.status(400).json({
          success: false,
          error:
            'Invalid or expired login session. Sign in again.',
        });
      }

      const accessToken = searchResult.accessToken;
      const refreshToken = searchResult.refreshToken;

      setRefreshTokenCookie(res, refreshToken);

      // Same header as refresh flow so clients can persist token from interceptors or body
      res.setHeader('x-auth-token', accessToken);

      return res.json({
        success: true,
        token: accessToken,
        message: 'Token exchange successful',
      });
    } catch (error) {
      return next(error);
    }
  }

  async handleIsAuthenticated(req, res) {
    return res.json({
      authenticated: true,
    });
  }

  async handleRecaptchaValidation(req, res) {
    try {
      // Note: reCAPTCHA validation is currently commented out in the original code
      // Uncomment and implement when needed
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error validating reCAPTCHA:', error.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const authRouter = new AuthRouter();
export default authRouter.getRouter();
