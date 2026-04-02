import express from 'express';

import VipRewardsController from '../../controllers/vip/VipRewards.controller';
import { requireAuth } from '../../middleware/auth';

const router = express.Router();

// Get user's tier rewards
router.get('/tier-rewards', requireAuth, VipRewardsController.getUserTierRewards);

// Claim a tier reward
router.post('/tier-rewards/:rewardId/claim', requireAuth, VipRewardsController.claimTierReward);

export default router;

