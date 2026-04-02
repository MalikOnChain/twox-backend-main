import express from 'express';
import BlueOceanStatsController from '@/controllers/BlueoceanController/BlueOceanStats.controller';

const router = express.Router();

// Get latest winners
router.get('/latest-winners', BlueOceanStatsController.getLatestWinners.bind(BlueOceanStatsController));

// Get high rollers
router.get('/high-rollers', BlueOceanStatsController.getHighRollers.bind(BlueOceanStatsController));

// Get best multipliers
router.get('/best-multipliers', BlueOceanStatsController.getBestMultipliers.bind(BlueOceanStatsController));

// Get top winners (winners of day/month)
router.get('/top-winners', BlueOceanStatsController.getTopWinners.bind(BlueOceanStatsController));

export default router;

