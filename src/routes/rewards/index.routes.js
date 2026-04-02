import express from 'express';

import BonusController from '../../controllers/BonusController/Bonus.controller';
import { requireAuth } from '../../middleware/auth';

export class RewardsRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/bonuses', BonusController.getAllActiveBonuses);
    this.router.get('/bonuses/eligible', requireAuth, BonusController.getEligibleBonusesByUser);
    this.router.post('/bonuses/claim', requireAuth, BonusController.claimBonus);
    this.router.get('/bonus/details', requireAuth, BonusController.getBonusDetails);
    this.router.get('/bonus/history', requireAuth, BonusController.getUserBonuses);

    // Promo code redemption
    this.router.post('/promo-code/redeem', requireAuth, BonusController.redeemPromoCode);

    this.router.post('/bonuses/create', requireAuth, BonusController.createBonus);
    this.router.delete('/bonuses/:bonusId', requireAuth, BonusController.removeBonus);

    // this.router.get('/referrals', BonusController.getAllReferralBonuses);
    // this.router.get('/referral/metrics', requireAuth, BonusController.getReferralMetrics);
  }
}

export default new RewardsRouter().router;
