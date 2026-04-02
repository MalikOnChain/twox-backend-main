import express from 'express';
import CryptoPriceService from '@/services/crypto/CryptoPrice.service';
import { logger } from '@/utils/logger';

const router = express.Router();

/**
 * Get all cryptocurrency prices
 * GET /api/crypto/prices
 */
router.get('/prices', async (req, res, next) => {
  try {
    const prices = await CryptoPriceService.getAllPricesInUSD();
    
    return res.json({
      success: true,
      data: prices,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get crypto prices:', error);
    next(error);
  }
});

/**
 * Get single cryptocurrency price
 * GET /api/crypto/price/:currency
 */
router.get('/price/:currency', async (req, res, next) => {
  try {
    const { currency } = req.params;
    const price = await CryptoPriceService.getPriceInUSD(currency.toUpperCase() as CRYPTO_CURRENCY);
    
    return res.json({
      success: true,
      data: {
        currency: currency.toUpperCase(),
        price,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error(`Failed to get price for ${req.params.currency}:`, error);
    next(error);
  }
});

export default router;

