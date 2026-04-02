import express from 'express';

import MainAuthController from '@/controllers/auth/MainAuth.controller';

class MainAuthRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post('/login', MainAuthController.login);
    this.router.post('/forgot-password', MainAuthController.forgotPassword);
    this.router.post('/verify-code', MainAuthController.verifyCode);
    this.router.post('/new-password', MainAuthController.newPassword);
    this.router.post('/register', MainAuthController.register);
    this.router.post('/verify-email', MainAuthController.verifyEmail);
    this.router.post('/resend-verification-email', MainAuthController.resendVerificationEmail);
    this.router.post('/update-users', MainAuthController.updateUsers);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const mainAuthRouter = new MainAuthRouter();
export default mainAuthRouter.getRouter();
