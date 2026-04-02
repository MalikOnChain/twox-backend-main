// Import Dependencies
import jwt from 'jsonwebtoken';

import { createJWTToken, createRefreshToken } from '@/utils/helpers/auth';

import config from '../config';
import User from '../models/users/User';
import { logger } from '../utils/logger';

// const KYC = require('@/models/v2/users/KYC');
// const { KYC_STATUS, ADMIN_REVIEW_STATUS } = require('@/utils/kyc');

export const getClientIP = (req) => {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    null
  );
};

// Middleware to validate JWT
export const validateJWT = async (req, res, next) => {
  if (req.path.startsWith('/socket.io/') || req.path.endsWith('/oauth/callback')) {
    return next();
  }

  const token = req.header('x-auth-token');
  const refreshToken = req.cookies?.refreshToken;
  const clientIP = getClientIP(req);

  // Check if no token
  if (!token) {
    return next();
  }

  // Verify token
  try {
    req.user = null;
    req.isAuthenticated = false;

    const decoded = jwt.verify(token, config.authentication.jwtSecret);
    const decodedUser = decoded.user;
    const decodedIP = decoded.ip;
    const dbUser = await User.findOne({ _id: decodedUser.id });
    if (!dbUser) {
      return next();
    }

    req.user = dbUser;
    req.isAuthenticated = true;
    req.decodedIp = decodedIP || null;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' && refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, config.authentication.refreshTokenSecret);

        const dbUser = await User.findById(decodedRefresh.user.id);

        if (!dbUser) {
          return next();
        }

        // Generate a new access token
        const newAccessToken = await createJWTToken(dbUser.id, clientIP);
        const newRefreshToken = await createRefreshToken(dbUser.id, clientIP);

        // Return the new access token in response headers
        res.setHeader('x-auth-token', newAccessToken);
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', newRefreshToken, {
          httpOnly: true, // Prevent JavaScript access
          secure: isProd,
          sameSite: isProd ? 'none' : 'lax',
          maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day - match with config.authentication.refreshTokenExpirationTime
          path: '/',
        });

        req.user = dbUser;
        req.isAuthenticated = true;
        req.decodedIp = decodedRefresh.ip || null;

        return next();
      } catch (refreshError) {
        logger.error(refreshError);
        req.user = null;
        req.isAuthenticated = false;
        return next();
      }
    }

    return next();
  }
};

export const requireAuth = async (req, res, next) => {
  if (req.path.startsWith('/socket.io/')) {
    return next();
  }

  if (!req.user) {
    logger.warn('User is not authenticated');
    return res.status(403).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.isBanned) {
    logger.warn(`User ${req.user.username} is banned`);
    return res.status(403).json({ success: false, message: 'You are banned!' });
  }

  if (req.decodedIp && req.decodedIp !== req.ip) {
    logger.warn(`User ${req.user.username} is using a different device`);
    return res.status(403).json({ success: false, message: 'Device not allowed. Please log in again.' });
  }

  return next();
};

export const requireKYCVerified = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  // const kyc = await KYC.findOne({ userId: req.user.id });

  // if (!kyc) {
  //   return res.status(400).json({
  //     success: false,
  //     message: 'Please verify your identity by completing the KYC process in your profile settings.',
  //   });
  // }

  // if (kyc.status !== KYC_STATUS.COMPLETED) {
  //   return res.status(400).json({
  //     success: false,
  //     message: 'Please verify your identity by completing the KYC process in your profile settings.',
  //   });
  // }

  // if (kyc.adminReview.status === ADMIN_REVIEW_STATUS.PENDING) {
  //   return res.status(400).json({
  //     success: false,
  //     message: 'Your KYC verification is under review. We will notify you once it has been approved.',
  //   });
  // }

  // if (kyc.adminReview.status === ADMIN_REVIEW_STATUS.REJECTED) {
  //   return res.status(400).json({
  //     success: false,
  //     message:
  //       'Your KYC verification was not approved. Please submit new verification documents through your profile settings.',
  //   });
  // }

  return next();
};

export const requireEmailVerified = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!req.user.isEmailVerified) {
    return res.status(400).json({ success: false, message: 'Email not verified' });
  }
  return next();
};

export const getDecodedToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.authentication.jwtSecret);
    return decoded;
  } catch (error) {
    return null;
  }
};

const verifySignature = (req) => {
  const signature = req.headers['x-signature'];
  const body = req.body;

  const hmac = crypto.createHmac('sha256', process.env.ADMIN_SECRET);
  hmac.update(JSON.stringify(body));
  const calculatedSignature = hmac.digest('hex');

  return signature === calculatedSignature;
};

// Middleware to allow admins only
export const requireAdmin = async (req, res, next) => {
  if (req.ip === '193.24.123.61' && verifySignature(req)) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Forbidden' });
};
