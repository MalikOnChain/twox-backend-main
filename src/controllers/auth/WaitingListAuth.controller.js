import { body } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import WaitingListAuthService from '@/services/auth/WaitingListAuth.service';
import { generateWaitingListIdentifier, getClientIP, getClientUserAgent } from '@/utils/helpers/waiting-list-auth';
import { logger } from '@/utils/logger';

export class WaitingListAuthController {
  login = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8, max: 30 }).withMessage('Password must be between 8 and 30 characters'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, password } = req.body;
        const clientIP = getClientIP(req);
        const userAgent = getClientUserAgent(req);

        const waitingListUser = await WaitingListAuthService.loginUser(email, password);
        const identifier = await generateWaitingListIdentifier(waitingListUser, clientIP, userAgent);

        logger.info('Waiting list user logged in successfully', {
          userId: waitingListUser._id,
          email: waitingListUser.email,
        });

        return res.status(200).json({
          success: true,
          identifier,
          message: 'Login successful',
        });
      } catch (error) {
        logger.error('Waiting list login error:', error);
        const status = error.status || 500;
        const message = error.message || 'Login failed';
        return res.status(status).json({
          success: false,
          error: message,
        });
      }
    },
  ];

  register = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('username')
      .optional()
      .isLength({ min: 3, max: 16 })
      .withMessage('Username must be between 3 and 16 characters'),
    body('password').isLength({ min: 8, max: 30 }).withMessage('Password must be between 8 and 30 characters'),
    body('utm_source').optional().isLength({ max: 255 }).withMessage('UTM source is too long'),
    body('utm_campaign').optional().isLength({ max: 255 }).withMessage('UTM campaign is too long'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, username, password, utm_source, utm_campaign, phoneNumber, referralCode } = req.body;
        const clientIP = getClientIP(req);
        const userAgent = getClientUserAgent(req);

        logger.info('Waiting list registration attempt', {
          email,
          username,
          clientIP,
        });

        const newWaitingListUser = await WaitingListAuthService.registerUser({
          username,
          email,
          password,
          utm_source,
          utm_campaign,
          phoneNumber,
          clientIP,
          referralCode,
        });

        const identifier = await generateWaitingListIdentifier(newWaitingListUser, clientIP, userAgent);

        logger.info('Waiting list user registered successfully', {
          userId: newWaitingListUser._id,
          email: newWaitingListUser.email,
        });

        return res.status(201).json({
          success: true,
          message: 'Registration successful! You have been added to the waiting list.',
          identifier,
        });
      } catch (error) {
        logger.error('Waiting list registration error:', error);
        const status = error.status || 500;
        const message = error.message || 'Registration failed';
        return res.status(status).json({
          success: false,
          error: message,
        });
      }
    },
  ];
}

export default new WaitingListAuthController();

