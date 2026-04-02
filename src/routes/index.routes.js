import { Router } from 'express';

import { authRateLimiter, standardRateLimiter } from '@/middleware/rate-limiter';
import authRoutes from '@/routes/auth/index.routes';
import waitingListAuthRoutes from '@/routes/auth/WaitingListAuth.routes';
import bannerRoutes from '@/routes/banner/index.routes';
import callbackRoutes from '@/routes/callback.routes';
import contentRoutes from '@/routes/content/index.routes';
import { isVaultodyLegacyEnabled } from '@/config/legacy-rails';
import cryptoRoutes from '@/routes/crypto/index.routes';
import vaultodyRoutes from '@/routes/crypto/vaultody.routes';
import giphyRoutes from '@/routes/giphy/index.routes';
import promotionRoutes from '@/routes/promotion/index.routes';
import rewardsRoutes from '@/routes/rewards/index.routes';
import settingsRoutes from '@/routes/settings/index.routes';
import siteRoutes from '@/routes/site/index.routes';
import skinsbackRoutes from '@/routes/skinsback/index.routes';
import slotsCasinoRoutes from '@/routes/slots-casino/index.routes';
import socketRoutes from '@/routes/socket.routes';
import sumsubRoutes from '@/routes/sumsub/index.routes';
import transactionRoutes from '@/routes/transactions/index.routes';
import paymentsRoutes from '@/routes/payments/index.routes';
import fystackWebhookRoutes from '@/routes/webhooks/fystack.routes.js';
import treasuryRoutes from '@/routes/admin/treasury.routes.js';
import feeAnalyticsRoutes from '@/routes/admin/fee-analytics.routes.js';
import userManagementAdminRoutes from '@/routes/admin/user-management.routes.js';
import blockchainRoutes from '@/routes/blockchain/balance.routes';
import userRoutes from '@/routes/user/index.routes';
import utmVisitorRoutes from '@/routes/utm-visitor/index.routes';
import vipRoutes from '@/routes/vip/vip.routes';
import wagerRaceRoutes from '@/routes/wagerRace/wagerRace.routes';

class APIRouter {
  constructor() {
    this.router = Router();
    this.router.get('/', async (req, res) => {
      const health = {
        service: 'BitStake API',
        status: 'operational',
        version: process.env.npm_package_version,
        environment: process.env.NODE_ENV,
        uptimeMinutes: Math.floor(process.uptime() / 60),
      };

      return res.json(health);
    });

    //auth and user
    this.router.use('/auth', authRateLimiter, authRoutes);
    this.router.use('/waiting-list/auth', authRateLimiter, waitingListAuthRoutes);
    this.router.use('/user', standardRateLimiter, userRoutes);
    this.router.use('/vip', standardRateLimiter, vipRoutes);

    //promotion
    this.router.use('/promotion', standardRateLimiter, promotionRoutes);
    this.router.use('/wager-race', standardRateLimiter, wagerRaceRoutes);

    //giphy
    this.router.use('/giphy', standardRateLimiter, giphyRoutes);

    //skinsback
    this.router.use('/skinsback', standardRateLimiter, skinsbackRoutes);

    //sumsub
    this.router.use('/sumsub', standardRateLimiter, sumsubRoutes);

    //casino
    this.router.use('/slots-casino', standardRateLimiter, slotsCasinoRoutes);

    //rewards
    this.router.use('/rewards', standardRateLimiter, rewardsRoutes);

    //crypto
    this.router.use('/crypto', standardRateLimiter, cryptoRoutes);
    if (isVaultodyLegacyEnabled()) {
      this.router.use('/vaultody', standardRateLimiter, vaultodyRoutes);
    }

    //transactions
    this.router.use('/transactions', standardRateLimiter, transactionRoutes);

    //payments
    this.router.use('/payments', standardRateLimiter, paymentsRoutes);

    // Fystack webhooks (no auth; signature verification inside route)
    this.router.use('/webhooks/fystack', fystackWebhookRoutes);

    // Admin treasury / fee analytics (stubs + role check on routes)
    this.router.use('/treasury', standardRateLimiter, treasuryRoutes);
    this.router.use('/fee-analytics', standardRateLimiter, feeAnalyticsRoutes);
    this.router.use('/user-management', standardRateLimiter, userManagementAdminRoutes);

    //blockchain
    this.router.use('/blockchain', standardRateLimiter, blockchainRoutes);

    //callback
    this.router.use('/callback', standardRateLimiter, callbackRoutes);

    //public
    this.router.use('/site', standardRateLimiter, siteRoutes);
    this.router.use('/socket', standardRateLimiter, socketRoutes);
    this.router.use('/settings', standardRateLimiter, settingsRoutes);
    this.router.use('/utm-visitor', standardRateLimiter, utmVisitorRoutes);
    this.router.use('/banner', standardRateLimiter, bannerRoutes);
    this.router.use('/content', standardRateLimiter, contentRoutes);
  }

  getRouter() {
    return this.router;
  }
}

const apiRouter = new APIRouter();

export default apiRouter;
