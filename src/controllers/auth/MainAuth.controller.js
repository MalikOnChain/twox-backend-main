import { body } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import MainAuthService from '@/services/auth/MainAuth.service';
import FingerprintService from '@/services/security/Fingerprint.service';
import { generateIdentifier, getClientIP, getClientUserAgent } from '@/utils/helpers/auth';
import { logger } from '@/utils/logger';

export class MainAuthController {
  login = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8, max: 30 }).withMessage('Password must be between 8 and 30 characters'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, password, fingerprint } = req.body;
        const clientIP = getClientIP(req);
        const userAgent = getClientUserAgent(req);

        const dbUser = await MainAuthService.loginUser(email, password);
        const identifier = await generateIdentifier(dbUser, clientIP, userAgent);

        // Save fingerprint if provided
        if (fingerprint && fingerprint.visitorId) {
          try {
            await FingerprintService.saveFingerprint({
              visitorId: fingerprint.visitorId,
              fingerprintData: fingerprint.data || {},
              userId: dbUser._id,
              action: 'login',
              ipAddress: clientIP,
              userAgent: userAgent,
            });

            // Check for suspicious activity
            const riskCheck = await FingerprintService.checkFingerprintRisk(
              fingerprint.visitorId,
              dbUser._id.toString()
            );

            if (riskCheck.isSuspicious) {
              logger.warn('Suspicious login detected', {
                userId: dbUser._id,
                visitorId: fingerprint.visitorId,
                riskScore: riskCheck.riskScore,
                flags: riskCheck.flags,
              });
            }
          } catch (fpError) {
            logger.error('Failed to save fingerprint on login', fpError);
            // Don't fail login if fingerprint save fails
          }
        }

        logger.info('User logged in successfully', {
          userId: dbUser._id,
          email: dbUser.email,
          clientIP,
        });

        return res.status(200).json({
          success: true,
          identifier,
        });
      } catch (error) {
        logger.error('Login error:', { error: error.message, email: req.body.email, clientIP: getClientIP(req) });
        return res.status(401).json({
          success: false,
          error: error.message,
        });
      }
    },
  ];

  forgotPassword = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email } = req.body;
        const { message, verificationCode } = await MainAuthService.forgotPassword(email);

        logger.info('Forgot password request', { email });

        const response = { success: true, message };

        if (req.isTestMode) {
          response.verificationCode = verificationCode;
        }

        return res.status(200).json(response);
      } catch (error) {
        logger.error('Forgot password error:', { error: error.message, email: req.body.email });
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },
  ];

  verifyCode = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('code').isLength({ min: 4, max: 10 }).isAlphanumeric().withMessage('Valid security code is required'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, code } = req.body;
        const isValid = await MainAuthService.verifySecurityCode(email, code);

        if (!isValid) {
          throw new Error('Invalid security code');
        }

        logger.info('Security code verified', { email });

        return res.status(200).json({
          success: true,
          message: 'Security code is valid!',
        });
      } catch (error) {
        logger.error('Verify code error:', { error: error.message, email: req.body.email });
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },
  ];

  newPassword = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('code').isLength({ min: 4, max: 10 }).isAlphanumeric().withMessage('Valid security code is required'),
    body('password')
      .isLength({ min: 8, max: 30 })
      .withMessage('Password must be between 8 and 30 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, code, password } = req.body;
        const message = await MainAuthService.resetPassword(email, code, password);

        logger.info('Password reset successfully', { email });

        return res.status(200).json({
          success: true,
          message,
        });
      } catch (error) {
        logger.error('New password error:', { error: error.message, email: req.body.email });
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },
  ];

  register = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
      .isLength({ max: 254 })
      .withMessage('Email address is too long'),
    body('username')
      .isLength({ min: 3, max: 16 })
      .withMessage('Username must be between 3 and 16 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .custom((value) => {
        const restrictedWords = ['admin', 'root', 'system', 'null', 'undefined'];
        if (restrictedWords.some((word) => value.toLowerCase().includes(word))) {
          throw new Error('Username contains restricted words');
        }
        return true;
      }),
    body('password')
      .isLength({ min: 8, max: 30 })
      .withMessage('Password must be between 8 and 30 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('CPFNumber').optional().isLength({ min: 11, max: 14 }).withMessage('CPF must be valid'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Valid phone number is required'),
    body('utm_source')
      .optional()
      .isString()
      .trim()
      .escape()
      .isLength({ max: 50 })
      .withMessage('UTM source is too long'),
    body('utm_campaign')
      .optional()
      .isString()
      .trim()
      .escape()
      .isLength({ max: 50 })
      .withMessage('UTM campaign is too long'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, username, password, utm_source, utm_campaign, CPFNumber, phoneNumber, referralCode, fingerprint } = req.body;
        const clientIP = getClientIP(req);
        const userAgent = getClientUserAgent(req);

        logger.info('Registration attempt', {
          email,
          username,
          clientIP,
          isTestMode: req.isTestMode,
        });

        const newUser = await MainAuthService.registerUser({
          username,
          email,
          password,
          utm_source,
          utm_campaign,
          CPFNumber,
          phoneNumber,
          clientIP,
          referralCode,
        });

        const emailVerificationToken = await MainAuthService.generateEmailVerificationToken(newUser);
        await MainAuthService.sendVerificationEmail(newUser, emailVerificationToken);

        const identifier = await generateIdentifier(newUser, clientIP, userAgent);

        // Save fingerprint if provided
        if (fingerprint && fingerprint.visitorId) {
          try {
            await FingerprintService.saveFingerprint({
              visitorId: fingerprint.visitorId,
              fingerprintData: fingerprint.data || {},
              userId: newUser._id,
              action: 'register',
              ipAddress: clientIP,
              userAgent: userAgent,
            });
          } catch (fpError) {
            logger.error('Failed to save fingerprint on registration', fpError);
            // Don't fail registration if fingerprint save fails
          }
        }

        logger.info('User registered successfully', {
          userId: newUser._id,
          email: newUser.email,
        });

        const response = {
          success: true,
          message: 'Registration successful! Please check your email to verify your account.',
          identifier,
        };

        if (req.isTestMode) {
          response.emailVerificationToken = emailVerificationToken;
        }

        return res.status(201).json(response);
      } catch (error) {
        logger.error('Registration error:', {
          error: error.message,
          email: req.body.email,
          username: req.body.username,
          clientIP: getClientIP(req),
        });

        return res.status(error.status || 500).json({
          success: false,
          error: error.message || 'Internal Server Error',
        });
      }
    },
  ];

  verifyEmail = [
    body('emailVerificationToken')
      .isLength({ min: 32, max: 64 })
      .withMessage('Invalid verification token format')
      .isAlphanumeric()
      .withMessage('Verification token must be alphanumeric'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { emailVerificationToken } = req.body;
        const clientIP = getClientIP(req);
        const userAgent = getClientUserAgent(req);

        const user = await MainAuthService.verifyEmailUser(emailVerificationToken);
        const identifier = await generateIdentifier(user, clientIP, userAgent);

        logger.info('Email verified successfully', {
          userId: user._id,
          email: user.email,
        });

        return res.status(200).json({
          success: true,
          message: 'Email verified successfully.',
          identifier: identifier,
        });
      } catch (error) {
        logger.error('Email verification error:', {
          error: error.message,
          token: req.body.emailVerificationToken,
        });

        return res.status(error.status || 500).json({
          success: false,
          message: error.message,
        });
      }
    },
  ];

  resendVerificationEmail = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email } = req.body;
        const user = await MainAuthService.getUserByEmail(email);
        const emailVerificationToken = await MainAuthService.generateEmailVerificationToken(user);
        await MainAuthService.sendVerificationEmail(user, emailVerificationToken);

        logger.info('Verification email resent', { email });

        return res.status(200).json({
          success: true,
          message: 'Verification email sent.',
        });
      } catch (error) {
        logger.error('Resend verification email error:', {
          error: error.message,
          email: req.body.email,
        });

        return res.status(error.status || 500).json({
          success: false,
          message: error.message,
        });
      }
    },
  ];

  updateUsers = [
    // Add authentication middleware here if needed
    // requireAdminAuth,
    async (req, res) => {
      try {
        const users = await MainAuthService.updateUsers();

        logger.info('Users updated', { count: users.length });

        return res.status(200).json({
          success: true,
          users,
        });
      } catch (error) {
        logger.error('Update users error:', error);
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    },
  ];
}

export default new MainAuthController();
