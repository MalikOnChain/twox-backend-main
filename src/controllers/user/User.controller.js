import { body, query } from 'express-validator';

import handleValidationErrors from '@/middleware/validation-error';
import User from '@/models/users/User';
import VipUser from '@/models/vip/VipUser';
import UserReferralService from '@/services/affiliate/UserReferral.service';
import BalanceManagerService from '@/services/balance/BalanceManager.service';
import UserTransactionService from '@/services/user/Transaction.service';
import UserService from '@/services/user/User.service';
import UserWalletService from '@/services/user/Wallet.service';
import { isFystackConfigured } from '@/services/custody/FystackCustody.service';
import { ensureFystackDepositRowsForUser } from '@/models/crypto/WalletDepositAddresses';
import { BALANCE_UPDATE_TYPES } from '@/types/balance/balance';
import { logger } from '@/utils/logger';

export class UserController {
  async getUser(req, res, next) {
    try {
      const user = await UserService.getUserById(req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.status = 404;
        return next(error);
      }

      let addressesWithQR = [];
      if (process.env.CREATE_DEPOSIT_ADDRESS_DISABLE !== 'true') {
        if (isFystackConfigured()) {
          await ensureFystackDepositRowsForUser(user._id);
        }
        addressesWithQR = await UserWalletService.getDepositAddressesWithQR(user);
      }

      const balanceDetails = await BalanceManagerService.getBalanceDetails(user);

      return res.json({
        user,
        balance: balanceDetails,
        token: req.authToken,
        depositAddresses: addressesWithQR,
      });
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await UserService.getUserById(req.user.id);
      if (!user) {
        return next(new Error('User not found'));
      }

      const profileData = await UserService.getProfileData(user);
      return res.json(profileData);
    } catch (error) {
      return next(error);
    }
  }

  async getKYCStatus(req, res, next) {
    try {
      const user = await UserService.getUserById(req.user.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      const kycStatus = await UserService.getKYCStatus(req.user.id);
      return res.json(kycStatus);
    } catch (error) {
      return next(error);
    }
  }

  async getReferredUsers(req, res, next) {
    try {
      const userId = req.user.id;
      if (!userId) {
        return next(new Error('User not found'));
      }

      const referredUsers = await UserReferralService.getReferredUsers(userId);
      return res.json({ users: referredUsers });
    } catch (error) {
      return next(error);
    }
  }

  async getUserReferralMetrics(req, res, next) {
    try {
      const userId = req.user.id;
      if (!userId) {
        return next(new Error('User not found'));
      }

      const metrics = await UserReferralService.getUserReferralMetrics(userId);
      return res.json(metrics);
    } catch (error) {
      logger.error('Failed to get referral metrics:', error);
      return next(error);
    }
  }

  async getUserStatistics(req, res, next) {
    try {
      const user = await UserService.getUserById(req.user.id);
      if (!user) {
        return next(new Error('User not found'));
      }

      const totalDepositAmount = await user.getTotalDepositAmount();
      const vipUser = await VipUser.findOne({ userId: req.user.id });
      const totalWageredAmount = vipUser?.totalWagered || 0;

      return res.json({ statistics: { totalDepositAmount, totalWageredAmount } });
    } catch (error) {
      return next(error);
    }
  }

  updateProfile = [
    body('username')
      .optional()
      .isLength({ min: 3, max: 16 })
      .withMessage('Username must be between 3 and 16 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .custom((value) => {
        if (!value) return true; // Skip validation if value is not provided
        const restrictedWords = ['admin', 'root', 'system', 'null', 'undefined'];
        if (restrictedWords.some((word) => value.toLowerCase().includes(word))) {
          throw new Error('Username contains restricted words');
        }
        return true;
      }),
    body('fullName')
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage('Full name must be between 3 and 30 characters'),
    body('password')
      .optional()
      .isLength({ min: 8, max: 30 })
      .withMessage('Password must be between 8 and 30 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('CPFNumber').optional().isLength({ min: 11, max: 14 }).withMessage('CPF must be valid'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Valid phone number is required'),
    body('address')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Address must be between 3 and 100 characters'),
    body('city').optional().isLength({ min: 3, max: 50 }).withMessage('City must be between 3 and 50 characters'),
    body('state').optional().isLength({ min: 2, max: 2 }).withMessage('State must be 2 characters'),
    body('zipCode').optional().isString().withMessage('Zip code must be a number'),

    handleValidationErrors,
    async (req, res, next) => {
      const { username, fullName, phoneNumber, CPFNumber, address, city, state, zipCode } = req.body;
      try {
        const user = await UserService.getUserById(req.user.id);
        if (!user) {
          return next(new Error('User not found'));
        }
        const response = await UserService.updateProfile({
          userId: req.user.id,
          username,
          fullName,
          phoneNumber,
          CPFNumber,
          address,
          city,
          state,
          zipCode,
        });
        return res.json(response);
      } catch (error) {
        return next(error);
      }
    },
  ];

  updateCPFNumber = [
    body('CPFNumber').optional().isLength({ min: 11, max: 14 }).withMessage('CPF must be valid'),
    handleValidationErrors,
    async (req, res, next) => {
      const { CPFNumber } = req.body;

      if (!CPFNumber) {
        return next(new Error('CPF number is required'));
      }

      try {
        const user = await UserService.getUserById(req.user.id);
        if (!user) {
          return next(new Error('User not found'));
        }
        const response = await UserService.updateCPFNumber(req.user.id, CPFNumber);
        return res.json(response);
      } catch (error) {
        return next(error);
      }
    },
  ];

  updatePhoneNumber = [
    body('phoneNumber')
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Valid phone number is required (e.g., +1234567890)'),
    handleValidationErrors,
    async (req, res, next) => {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return next(new Error('Phone number is required'));
      }

      try {
        const user = await UserService.getUserById(req.user.id);
        if (!user) {
          return next(new Error('User not found'));
        }
        
        user.phoneNumber = phoneNumber;
        await user.save();
        
        return res.json({ 
          success: true, 
          message: 'Phone number updated successfully',
          phoneNumber: user.phoneNumber 
        });
      } catch (error) {
        return next(error);
      }
    },
  ];

  sendEmailChangeCode = [
    body('newEmail').isEmail().withMessage('Invalid email address'),
    handleValidationErrors,
    async (req, res, next) => {
      const { newEmail } = req.body;
      try {
        const user = await UserService.getUserById(req.user.id);
        if (!user) {
          return next(new Error('User not found'));
        }
        const message = await UserService.sendEmailChangeCode(req.user.email, newEmail);
        return res.json({ success: true, message });
      } catch (error) {
        return next(error);
      }
    },
  ];

  changeEmail = [
    body('newEmail').isEmail().withMessage('Invalid email address'),
    body('code').isLength({ min: 4, max: 10 }).isAlphanumeric().withMessage('Valid security code is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { newEmail, code } = req.body;
        const oldEmail = req.user.email;

        const message = await UserService.verifySecurityCodeAndChangeEmail(oldEmail, newEmail, code);
        return res.json({ success: true, message });
      } catch (error) {
        return next(error);
      }
    },
  ];

  changePassword = [
    body('currentPass')
      .isLength({ min: 8, max: 30 })
      .withMessage('Current password must be between 8 and 30 characters'),
    body('newPass')
      .isLength({ min: 8, max: 30 })
      .withMessage('New password must be between 8 and 30 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const result = await UserService.updatePassword(req.user.id, req.body.currentPass, req.body.newPass);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  ];

  async updateUserAvatar(req, res, next) {
    try {
      const result = await UserService.updateUserAvatar(req.user.id, req.uploadedImageUrl);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  getGameTransactions = [
    query('page').optional().isInt({ min: 0 }).withMessage('Page must be a non-negative integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const transactions = await UserTransactionService.getGameTransactions(
          req.user.id,
          req.query.page || 0,
          req.query.limit || 20
        );
        return res.json({ transactions });
      } catch (error) {
        return next(error);
      }
    },
  ];

  getCryptoTransactions = [
    query('page').optional().isInt({ min: 0 }).withMessage('Page must be a non-negative integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const transactions = await UserTransactionService.getCryptoTransactions(
          req.user.id,
          req.query.page || 0,
          req.query.limit || 20
        );
        return res.json({ transactions });
      } catch (error) {
        return next(error);
      }
    },
  ];

  getServiceTransactions = [
    query('page').optional().isInt({ min: 0 }).withMessage('Page must be a non-negative integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const transactions = await UserTransactionService.getServiceTransactions(
          req.user.id,
          req.query.page || 0,
          req.query.limit || 20
        );
        return res.json({ transactions });
      } catch (error) {
        return next(error);
      }
    },
  ];

  depositTest = [
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const user = await User.findById(req.user.id);
        user.increaseGameTokenBalance(50, BALANCE_UPDATE_TYPES.DEPOSIT);
        return res.json({ success: true });
      } catch (error) {
        return next(error);
      }
    },
  ];

  toggleFavoriteGame = [
    body('gameId').isString().isLength({ min: 1 }).withMessage('Game ID is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { gameId } = req.body;
        const user = req.user;

        const result = await UserService.toggleFavoriteGame(user.id, gameId);

        return res.json(result);
      } catch (error) {
        return next(error);
      }
    },
  ];

  getFavoriteGameIds = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const favoriteGames = await UserService.getFavoriteGameIds(req.user.id);
        return res.json({ favoriteGames });
      } catch (error) {
        return next(error);
      }
    },
  ];

  async generate2FA(req, res, next) {
    try {
      const result = await this.authService.setup2FA(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  enable2FA = [
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be a 6-digit number'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { otp } = req.body;
        const success = await this.authService.verify2FA(req.user.id, otp);
        if (success) {
          res.json({ message: 'OTP is valid!' });
        } else {
          res.status(400).json({ message: 'Invalid OTP code.' });
        }
      } catch (error) {
        next(error);
      }
    },
  ];

  async disable2FA(req, res, next) {
    try {
      await this.authService.disable2FA(req.user.id);
      res.json({ message: 'OTP disabled!' });
    } catch (error) {
      next(error);
    }
  }

  setPassword = [
    body('pass')
      .isLength({ min: 8, max: 30 })
      .withMessage('Password must be between 8 and 30 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const result = await UserService.setPassword(req.user.id, req.body.pass);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  ];

  getGameHistory = [
    query('page').optional().isInt({ min: 0 }).withMessage('Page must be a non-negative integer'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const history = await this.gameService.getGameHistory(req.user.id, req.query.page || 0);
        res.json({ gameHistory: history });
      } catch (error) {
        next(error);
      }
    },
  ];

  async getAffiliates(req, res, next) {
    try {
      const affiliateData = await UserService.getAffiliateData(req.user.id);
      res.json(affiliateData);
    } catch (error) {
      next(error);
    }
  }

  updateAffiliateCode = [
    body('code')
      .isString()
      .isLength({ min: 3, max: 20 })
      .withMessage('Affiliate code must be between 3 and 20 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Affiliate code can only contain letters, numbers, underscores and hyphens'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const result = await UserService.updateAffiliateCode(req.user.id, req.body.code);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  ];

  redeemAffiliateCode = [
    body('code')
      .isString()
      .isLength({ min: 3, max: 20 })
      .withMessage('Affiliate code must be between 3 and 20 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Affiliate code can only contain letters, numbers, underscores and hyphens'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const result = await UserService.redeemAffiliateCode(req.user.id, req.body.code);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  ];

  async claimAffiliateEarnings(req, res, next) {
    try {
      const result = await UserService.claimAffiliateEarnings(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getVerificationStatus(req, res, next) {
    try {
      const status = await this.verificationService.getVerificationStatus(req.user.id);
      res.json(status);
    } catch (error) {
      next(error);
    }
  }

  sendVerificationCode = [
    body('number').isMobilePhone().withMessage('Valid phone number is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const result = await this.verificationService.sendVerificationCode(req.user.id, req.body.number);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  ];

  submitVerificationCode = [
    body('code').isLength({ min: 4, max: 10 }).isAlphanumeric().withMessage('Valid verification code is required'),
    handleValidationErrors,
    async (req, res, _next) => {
      try {
        const result = await this.verificationService.verifyCode(req.user.id, req.body.code);
        res.json(result);
      } catch (error) {
        res.json({ success: false, msg: error.message });
      }
    },
  ];

  async togglePrivateProfile(req, res, next) {
    try {
      const user = await UserService.togglePrivateProfile(req.user.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async signoutEverywhere(req, res) {
    try {
      await this.authService.invalidateAllTokens(req.user.id);
      res.status(200).send({ message: 'Signed out everywhere successfully.' });
    } catch (error) {
      res.status(500).send({ error: 'Internal Server Error' });
    }
  }

  async getBiggestWinners(req, res, next) {
    try {
      const winners = await UserService.getBiggestWinners();
      res.json({ data: winners });
    } catch (error) {
      next(error);
    }
  }

  // Wallet Connection Methods
  async connectWallet(req, res, next) {
    try {
      const { address, blockchain, network, chainId, label, walletType } = req.body;
      const userId = req.user.id;

      if (!address) {
        return res.status(400).json({ success: false, error: 'Wallet address is required' });
      }

      // Save wallet address to walletdepositaddresses
      const walletAddress = await UserWalletService.saveConnectedWallet({
        userId,
        address,
        blockchain: blockchain || 'ethereum',
        network: network || 'mainnet',
        label: label || `Connected Wallet - ${chainId || 'unknown'}`,
        walletType: walletType || 'manual',
      });

      return res.json({
        success: true,
        message: 'Wallet connected successfully',
        data: walletAddress,
      });
    } catch (error) {
      logger.error('Failed to connect wallet:', error);
      next(error);
    }
  }

  async getWalletAddresses(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const addresses = await user.getWalletDepositAddresses();
      
      // Group addresses by wallet type
      const groupedAddresses = {
        metamask: addresses.filter(addr => addr.walletType === 'metamask'),
        phantom: addresses.filter(addr => addr.walletType === 'phantom'),
        vaultody: addresses.filter(addr => addr.walletType === 'vaultody'),
        fystack: addresses.filter(addr => addr.walletType === 'fystack'),
        manual: addresses.filter(
          addr =>
            addr.walletType === 'manual' ||
            !addr.walletType ||
            (addr.walletType !== 'metamask' &&
              addr.walletType !== 'phantom' &&
              addr.walletType !== 'vaultody' &&
              addr.walletType !== 'fystack')
        ),
      };
      
      return res.json({
        success: true,
        data: addresses,
        grouped: groupedAddresses,
      });
    } catch (error) {
      logger.error('Failed to get wallet addresses:', error);
      next(error);
    }
  }

  async disconnectWallet(req, res, next) {
    try {
      const { address, blockchain } = req.body;
      const userId = req.user.id;

      if (!address) {
        return res.status(400).json({ success: false, error: 'Wallet address is required' });
      }

      // Delete the wallet address from the database
      const DepositWalletAddress = (await import('@/models/crypto/WalletDepositAddresses')).default;
      
      const deleted = await DepositWalletAddress.deleteOne({
        userId,
        address,
        ...(blockchain && { blockchain }), // Optional: filter by blockchain
      });

      if (deleted.deletedCount === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Wallet address not found' 
        });
      }

      logger.info(`Wallet address deleted: ${address} for user: ${userId}`);

      return res.json({
        success: true,
        message: 'Wallet disconnected and removed successfully',
        deletedCount: deleted.deletedCount,
      });
    } catch (error) {
      logger.error('Failed to disconnect wallet:', error);
      next(error);
    }
  }

  async getUserPreferences(req, res, next) {
    try {
      const userId = req.user.id;
      
      const [UserPreferences, NotificationPreferences] = await Promise.all([
        import('@/models/users/UserPreferences'),
        import('@/models/notification/NotificationPreference'),
      ]);

      const [userPrefs, notifPrefs] = await Promise.all([
        UserPreferences.default.getOrCreatePreferences(userId),
        NotificationPreferences.default.findOne({ userId }) || 
          NotificationPreferences.default.create({ userId }),
      ]);

      return res.json({
        success: true,
        preferences: {
          language: userPrefs.language,
          timezone: userPrefs.timezone,
          currency: userPrefs.currency,
          notifications: {
            email: notifPrefs.preferences.email.enabled,
            push: notifPrefs.preferences.push.enabled,
            inApp: notifPrefs.preferences.inApp.enabled,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get user preferences:', error);
      next(error);
    }
  }

  updateUserPreferences = [
    body('language').optional().isString(),
    body('timezone').optional().isString(),
    body('currency').optional().isString(),
    body('notifications').optional().isObject(),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        const { language, timezone, currency, notifications } = req.body;

        const [UserPreferences, NotificationPreferences] = await Promise.all([
          import('@/models/users/UserPreferences'),
          import('@/models/notification/NotificationPreference'),
        ]);

        // Update user preferences
        const userPrefs = await UserPreferences.default.getOrCreatePreferences(userId);
        
        if (language) userPrefs.language = language;
        if (timezone) userPrefs.timezone = timezone;
        if (currency) userPrefs.currency = currency;
        
        await userPrefs.save();

        // Update notification preferences
        if (notifications) {
          let notifPrefs = await NotificationPreferences.default.findOne({ userId });
          
          if (!notifPrefs) {
            notifPrefs = await NotificationPreferences.default.create({ userId });
          }

          if (notifications.email !== undefined) {
            notifPrefs.preferences.email.enabled = notifications.email;
          }
          if (notifications.push !== undefined) {
            notifPrefs.preferences.push.enabled = notifications.push;
          }
          if (notifications.inApp !== undefined) {
            notifPrefs.preferences.inApp.enabled = notifications.inApp;
          }

          await notifPrefs.save();
        }

        return res.json({
          success: true,
          message: 'Preferences updated successfully',
          preferences: {
            language: userPrefs.language,
            timezone: userPrefs.timezone,
            currency: userPrefs.currency,
          },
        });
      } catch (error) {
        logger.error('Failed to update user preferences:', error);
        next(error);
      }
    },
  ];

  getUserSessions = [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        
        const UserLogin = (await import('@/models/users/UserLogin')).default;
        const sessions = await UserLogin.getUserLoginHistory(userId, limit);
        
        return res.json({
          success: true,
          sessions: sessions,
        });
      } catch (error) {
        logger.error('Failed to get user sessions:', error);
        next(error);
      }
    },
  ];

  removeSession = [
    body('sessionId').isMongoId().withMessage('Valid session ID is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        const { sessionId } = req.body;
        
        const UserLogin = (await import('@/models/users/UserLogin')).default;
        
        // Verify the session belongs to the user before deleting
        const session = await UserLogin.findOne({ _id: sessionId, userId });
        
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found or does not belong to you',
          });
        }
        
        await UserLogin.deleteOne({ _id: sessionId, userId });
        
        return res.json({
          success: true,
          message: 'Session removed successfully',
        });
      } catch (error) {
        logger.error('Failed to remove session:', error);
        next(error);
      }
    },
  ];

  removeAllSessions = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        
        const UserLogin = (await import('@/models/users/UserLogin')).default;
        const result = await UserLogin.deleteMany({ userId });
        
        return res.json({
          success: true,
          message: `Removed ${result.deletedCount} sessions successfully`,
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        logger.error('Failed to remove all sessions:', error);
        next(error);
      }
    },
  ];

  requestSelfExclusion = [
    body('email').isEmail().withMessage('Valid email is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { email } = req.body;
        const userId = req.user.id;

        // Verify email matches user's email
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.email.toLowerCase() !== email.toLowerCase()) {
          return res.status(400).json({ 
            success: false, 
            error: 'Email does not match your account email' 
          });
        }

        // Generate security code
        const { generateSecurityCode } = await import('@/utils/helpers/index');
        const securityCode = generateSecurityCode();

        // Store security code in user record
        user.resetPasswordToken = securityCode;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save();

        // Send email with security code
        const { sendEmail } = await import('@/utils/helpers/index');
        const emailContent = `
          <div style="font-size: 18px;">
            <div>You have requested to self-exclude your account from TWOX.</div>
            <br/>
            <div>Your <span style="font-weight: bold;">Confirmation Code</span> is:</div>
            <div style="font-weight: bold; font-size: 24px;">${securityCode}</div>
            <br/>
            <div>This code will expire in 15 minutes.</div>
            <br/>
            <div><strong>Warning:</strong> Once confirmed, your account will be immediately locked and you will be logged out from all devices.</div>
            <br/>
            <div>If you did not request this, please ignore this email and your account will remain active.</div>
          </div>
        `;

        await sendEmail(email, 'Self-Exclusion Confirmation Code', emailContent);

        return res.json({
          success: true,
          message: 'Confirmation code sent to your email',
        });
      } catch (error) {
        logger.error('Failed to request self-exclusion:', error);
        next(error);
      }
    },
  ];

  confirmSelfExclusion = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('code').isLength({ min: 4, max: 10 }).isAlphanumeric().withMessage('Valid code is required'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const { email, code } = req.body;
        const userId = req.user.id;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Verify email
        if (user.email.toLowerCase() !== email.toLowerCase()) {
          return res.status(400).json({ 
            success: false, 
            error: 'Email does not match your account email' 
          });
        }

        // Verify code
        if (user.resetPasswordToken !== code) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid confirmation code' 
          });
        }

        // Check if code expired
        if (user.resetPasswordExpires < Date.now()) {
          return res.status(400).json({ 
            success: false, 
            error: 'Confirmation code has expired. Please request a new one.' 
          });
        }

        // Lock the account
        user.locked = true;
        user.isBanned = true;
        user.resetPasswordToken = '';
        user.resetPasswordExpires = Date.now();
        await user.save();

        logger.info(`User ${user.username} (${user._id}) has self-excluded their account`);

        return res.json({
          success: true,
          message: 'Self-exclusion activated successfully. Your account has been locked.',
        });
      } catch (error) {
        logger.error('Failed to confirm self-exclusion:', error);
        next(error);
      }
    },
  ];

  submitKYCInfo = [
    body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('dateOfBirth').isString().withMessage('Date of birth is required'),
    body('address').trim().isLength({ min: 10 }).withMessage('Address must be at least 10 characters'),
    body('city').trim().isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
    body('postalCode').trim().isLength({ min: 3 }).withMessage('Postal code must be at least 3 characters'),
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        const { firstName, lastName, dateOfBirth, address, city, postalCode } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Update user profile with KYC information
        user.fullName = `${firstName} ${lastName}`;
        user.address = address;
        user.city = city;
        user.zipCode = postalCode;
        
        // Store additional KYC data in KYC record
        const KYC = (await import('@/models/users/KYC')).default;
        
        let kycRecord = await KYC.findOne({ userId: userId.toString() });
        if (!kycRecord) {
          kycRecord = new KYC({ userId: userId.toString() });
        }
        
        // Update personal info
        kycRecord.personalInfo = {
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
        };
        
        // Update address info
        kycRecord.address = {
          street: address,
          city,
          postalCode,
        };
        
        kycRecord.status = 'pending';
        kycRecord.submittedAt = new Date();
        
        await Promise.all([user.save(), kycRecord.save()]);
        
        return res.json({
          success: true,
          message: 'Verification information submitted successfully',
          data: {
            firstName,
            lastName,
            dateOfBirth,
            address,
            city,
            postalCode,
          },
        });
      } catch (error) {
        logger.error('Failed to submit KYC info:', error);
        next(error);
      }
    },
  ];

  getKYCInfo = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        
        // Get user data for fallback
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const KYC = (await import('@/models/users/KYC')).default;
        const kycRecord = await KYC.findOne({ userId: userId.toString() });
        
        // If KYC record exists, use it as primary source
        if (kycRecord && kycRecord.personalInfo) {
          return res.json({
            success: true,
            data: {
              firstName: kycRecord.personalInfo?.firstName || '',
              lastName: kycRecord.personalInfo?.lastName || '',
              dateOfBirth: kycRecord.personalInfo?.dateOfBirth || null,
              address: kycRecord.address?.street || user.address || '',
              city: kycRecord.address?.city || user.city || '',
              postalCode: kycRecord.address?.postalCode || user.zipCode || '',
              status: kycRecord.status,
            },
          });
        }
        
        // Fall back to User model data if KYC record doesn't exist
        // Parse fullName into firstName and lastName
        const nameParts = user.fullName ? user.fullName.split(' ') : ['', ''];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return res.json({
          success: true,
          data: {
            firstName,
            lastName,
            dateOfBirth: null,
            address: user.address || '',
            city: user.city || '',
            postalCode: user.zipCode || '',
            status: null,
          },
        });
      } catch (error) {
        logger.error('Failed to get KYC info:', error);
        next(error);
      }
    },
  ];
}

export default new UserController();
