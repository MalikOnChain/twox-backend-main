import express from 'express';

import UserController from '@/controllers/user/User.controller';
import { requireAuth } from '@/middleware/auth';
import { uploadImageMiddleware } from '@/middleware/image-upload';
import balanceManagerService from '@/services/balance/BalanceManager.service';
import userGamesRoutes from './games.routes';

export class UserRoutes {
  constructor() {
    this.router = express.Router();

    // Initialize Services
    this.balanceManagerService = balanceManagerService;
    this.initRoutes();
  }

  initRoutes() {
    // User Routes
    this.router.get('/', requireAuth, UserController.getUser);
    this.router.get('/profile', requireAuth, UserController.getProfile);
    this.router.get('/statistics', requireAuth, UserController.getUserStatistics);
    this.router.get('/referral/metrics', requireAuth, UserController.getUserReferralMetrics);
    this.router.post('/send_email_change_code', requireAuth, UserController.sendEmailChangeCode);
    this.router.post('/change_email', requireAuth, UserController.changeEmail);
    this.router.post('/update_password', requireAuth, UserController.changePassword);
    this.router.post('/update_profile', requireAuth, UserController.updateProfile);
    this.router.post('/update_cpf', requireAuth, UserController.updateCPFNumber);
    this.router.post('/update_phone', requireAuth, UserController.updatePhoneNumber);
    this.router.post('/profile/update_avatar', requireAuth, uploadImageMiddleware, UserController.updateUserAvatar);

    // Transaction Routes
    this.router.get('/transaction/game', requireAuth, UserController.getGameTransactions);
    this.router.get('/transaction/crypto', requireAuth, UserController.getCryptoTransactions);
    this.router.get('/transaction/service', requireAuth, UserController.getServiceTransactions);
    this.router.post('/favorite-game/toggle', requireAuth, UserController.toggleFavoriteGame);
    this.router.get('/favorite-game/list', requireAuth, UserController.getFavoriteGameIds);
    this.router.post('/deposit', requireAuth, UserController.depositTest);
    this.router.post('/friends', requireAuth, UserController.getReferredUsers);
    this.router.get('/kyc-status', requireAuth, UserController.getKYCStatus);

    // User Games Routes (favorites and recent)
    this.router.use('/games', userGamesRoutes);

    // Wallet Connection Routes
    this.router.post('/wallet/connect', requireAuth, UserController.connectWallet);
    this.router.get('/wallet/addresses', requireAuth, UserController.getWalletAddresses);
    this.router.post('/wallet/disconnect', requireAuth, UserController.disconnectWallet);

    // User Preferences Routes
    this.router.get('/preferences', requireAuth, UserController.getUserPreferences);
    this.router.post('/preferences', requireAuth, UserController.updateUserPreferences);

    // Session Management Routes
    this.router.get('/sessions', requireAuth, UserController.getUserSessions);
    this.router.post('/sessions/remove', requireAuth, UserController.removeSession);
    this.router.post('/sessions/remove-all', requireAuth, UserController.removeAllSessions);

    // KYC/Verification Routes
    this.router.get('/kyc-info', requireAuth, UserController.getKYCInfo);
    this.router.post('/kyc-info', requireAuth, UserController.submitKYCInfo);

    // Self-Exclusion (Responsible Gambling) Routes
    this.router.post('/self-exclusion/request', requireAuth, UserController.requestSelfExclusion);
    this.router.post('/self-exclusion/confirm', requireAuth, UserController.confirmSelfExclusion);
  }
}

export default new UserRoutes().router;
