import express from 'express';

import { requireAuth } from '@/middleware/auth';

const router = express.Router();

function requireAdminUser(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  return next();
}

router.get('/summary', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: {
      totalFees: 0,
      fiatFees: 0,
      cryptoFees: 0,
      avgFeePercent: 0,
      topCostlyMethod: 'fystack_crypto',
      totalVolume: 0,
    },
  });
});

router.get('/by-method', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: { labels: [], fees: [], volumes: [] },
  });
});

router.get('/by-currency', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: { labels: [], fees: [], volumes: [] },
  });
});

router.get('/fees-vs-volume', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: { labels: [], volumes: [], fees: [] },
  });
});

router.get('/breakdown', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: [],
  });
});

router.get('/threshold-alerts', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: [],
  });
});

export default router;
