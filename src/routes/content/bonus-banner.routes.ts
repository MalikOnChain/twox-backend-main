import express from 'express';
import BonusBannerController from '@/controllers/ContentController/BonusBanner.controller';
import { requireAuth, requireAdmin } from '@/middleware/auth';

const router = express.Router();

// Public routes
router.get('/active', BonusBannerController.getActiveBanners);

// Admin routes
router.get('/all', requireAuth, requireAdmin, BonusBannerController.getAllBanners);
router.get('/:id', requireAuth, requireAdmin, BonusBannerController.getBannerById);
router.post('/', requireAuth, requireAdmin, BonusBannerController.createBanner);
router.put('/:id', requireAuth, requireAdmin, BonusBannerController.updateBanner);
router.delete('/:id', requireAuth, requireAdmin, BonusBannerController.deleteBanner);
router.patch('/:id/toggle', requireAuth, requireAdmin, BonusBannerController.toggleBannerStatus);

export default router;

