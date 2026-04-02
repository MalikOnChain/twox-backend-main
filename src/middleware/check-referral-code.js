import UserReferralService from '../services/affiliate/UserReferral.service';
import { logger } from '../utils/logger';

export const checkReferralCode = async (req, _res, next) => {
  try {
    const referralCode = req.headers['x-referral-code'];

    // If no referral code provided, continue without it
    if (!referralCode) {
      return next();
    }

    // Skip database lookup for health check and simple API endpoints
    if (req.path === '/' || req.path === '/api' || req.path === '/api/') {
      return next();
    }

    // Validate referral code format (8 characters, alphanumeric)
    if (!/^[A-Z0-9]{8}$/.test(referralCode)) {
      logger.warn(`Invalid referral code format: ${referralCode}`);
      return next();
    }

    // Check if referral code exists and get referrer details
    const referrer = await UserReferralService.getReferrer(referralCode);

    if (!referrer) {
      logger.warn(`Invalid referral code: ${referralCode}`);
      return next();
    }

    // Attach referral information to request object
    req.referralCode = referralCode;
    req.referrer = referrer;

    next();
  } catch (error) {
    logger.error(`Error checking referral code: ${error.message}`);
    next(error);
  }
};

export default checkReferralCode;
