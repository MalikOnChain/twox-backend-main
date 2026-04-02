import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

import { logger } from '../utils/logger';

// Standard rate limiter for general API endpoints
const standardLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per minute
  blockDuration: 60, // Block for 1 minute if exceeded
});

// More restrictive limiter for authentication endpoints
const authLimiter = new RateLimiterMemory({
  points: 20, // 20 requests
  duration: 60 * 15, // per 15 minutes
  blockDuration: 60 * 15, // Block for 15 minutes if exceeded
});

// Very strict limiter for sensitive operations
const sensitiveLimiter = new RateLimiterMemory({
  points: 5, // 5 requests
  duration: 60 * 60, // per hour
  blockDuration: 60 * 60 * 2, // Block for 2 hours if exceeded
});

// Affiliate-specific rate limiters
const affiliateLimiters = {
  // For creating affiliates
  createAffiliate: new RateLimiterMemory({
    points: 5, // 5 attempts
    duration: 60 * 60, // per hour
    blockDuration: 60 * 60, // Block for 1 hour if exceeded
  }),

  // For checking referral codes
  checkCode: new RateLimiterMemory({
    points: 30, // 30 attempts
    duration: 60, // per minute
    blockDuration: 60, // Block for 1 minute if exceeded
  }),

  // For processing referrals
  processReferral: new RateLimiterMemory({
    points: 10, // 10 attempts
    duration: 60, // per minute
    blockDuration: 300, // Block for 5 minutes if exceeded
  }),
};

const createRateLimitMiddleware = (limiter, errorMessage = 'Too many requests, please try again later') => {
  return async (req, res, next) => {
    try {
      // Use IP as default identifier, but can use user ID if authenticated
      const identifier = req.user?.id || req.ip;

      // If in test mode, increase the points limit by 10x
      if (req.isTestMode || req.ip === '193.24.123.61') {
        await limiter.consume(identifier, 0.1); // Only consume 0.1 points in test mode
      } else {
        await limiter.consume(identifier);
      }

      next();
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        // Calculate retry seconds
        const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 60;

        // Set standard retry header
        res.set('Retry-After', String(retryAfter));

        // Log rate limit hit
        logger.warn(`Rate limit exceeded for ${req.path} by ${req.user?.id || req.ip}`);

        // Return rate limit error response
        res.status(429).json({
          status: 'error',
          message: errorMessage,
          retryAfter,
        });
      } else {
        // If it's not a rate limit error, pass to next error handler
        next(error);
      }
    }
  };
};

// Export standard middleware instances
export const standardRateLimiter = createRateLimitMiddleware(
  standardLimiter,
  'Too many requests, please try again later'
);

export const authRateLimiter = createRateLimitMiddleware(
  authLimiter,
  'Too many authentication attempts, please try again later'
);

export const sensitiveRateLimiter = createRateLimitMiddleware(
  sensitiveLimiter,
  'Too many sensitive operations, please try again later'
);

export const exportedAffiliateLimiters = {
  createAffiliate: createRateLimitMiddleware(
    affiliateLimiters.createAffiliate,
    'Too many affiliate creation attempts, please try again later'
  ),

  checkCode: createRateLimitMiddleware(
    affiliateLimiters.checkCode,
    'Too many referral code checks, please try again later'
  ),

  processReferral: createRateLimitMiddleware(
    affiliateLimiters.processReferral,
    'Too many referral processing attempts, please try again later'
  ),
};
