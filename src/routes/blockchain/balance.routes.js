import express from 'express';
import BlockchainBalanceController from '@/controllers/blockchain/BlockchainBalance.controller';
import { requireAuth } from '@/middleware/auth';

const router = express.Router();

// Get single address balance
router.get('/balance', requireAuth, BlockchainBalanceController.getBalance.bind(BlockchainBalanceController));

// Get multiple addresses balances
router.post('/balances', requireAuth, BlockchainBalanceController.getMultipleBalances.bind(BlockchainBalanceController));

export default router;
