import express from 'express';

import { requireAuth } from '@/middleware/auth';

const router = express.Router();

function requireAdminUser(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  return next();
}

router.get('/wallets', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: {
      hot: [],
      warm: [],
      cold: [],
      fiat: {
        BRL: { totalUserBalance: 0, pendingDeposits: 0, pendingWithdrawals: 0 },
      },
      crypto: [],
    },
  });
});

router.get('/liquidity-trend', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: {
      labels: [],
      deposits: [],
      withdrawals: [],
      netLiquidity: [],
    },
  });
});

router.get('/currency-exposure', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: {
      exposure: [],
      total: 0,
    },
  });
});

router.post('/transfer', requireAuth, requireAdminUser, (_req, res) => {
  res.status(501).json({ success: false, message: 'Treasury transfer not implemented; use Fystack dashboard.' });
});

router.get('/settlement-report', requireAuth, requireAdminUser, (_req, res) => {
  res.json({
    success: true,
    data: {
      period: { start: '', end: '' },
      walletBalances: {},
      transactions: { fiat: [], crypto: [] },
      generatedAt: new Date().toISOString(),
    },
  });
});

export default router;
