import { body } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';
import MainAuthService from '@/services/auth/MainAuth.service';
import { generateIdentifier, getClientIP, getClientUserAgent } from '@/utils/helpers/auth';
import { logger } from '@/utils/logger';

/**
 * Permission keys must stay in sync with frontend-admin `src/types/permission.ts` (enum values).
 */
const ALL_ADMIN_PANEL_PERMISSIONS = [
  'viewDashboard',
  'manageUsers',
  'manageRoles',
  'manageAdmins',
  'manageCrypto',
  'manageCasino',
  'manageSettings',
  'manageBonuses',
  'manageRoyaltyTiers',
  'manageCashbacks',
  'manageReferralRewards',
  'manageTierAffiliates',
  'manageWagerRaces',
  'manageGames',
  'manageTrivia',
  'manageOperatingProviders',
  'managePromotions',
  'managePayments',
];

function toAdminPanelMePayload(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject({ getters: true }) : { ...userDoc };
  const now = new Date();
  return {
    _id: String(user._id),
    username: user.username,
    email: user.email,
    roles: [
      {
        _id: 'super-admin',
        name: 'Super Admin',
        permissions: ALL_ADMIN_PANEL_PERMISSIONS,
        createdAt: now,
        updatedAt: now,
      },
    ],
    permissions: ALL_ADMIN_PANEL_PERMISSIONS,
    password: '',
    isOTPEnabled: false,
    otpData: '',
    isTwoFAEnabled: false,
    twoFASecret: '',
    notes: '',
    lastAdminLogin: null,
    isActive: true,
    actionLogs: [],
    grantedAt: now,
    createdAt: user.createdAt || now,
    updatedAt: user.updatedAt || now,
    googleId: null,
    gmail: null,
    googleUsername: null,
    avatar: user.avatar || null,
    __v: 0,
  };
}

export class AdminPanelAuthController {
  signin = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8, max: 30 })
      .withMessage('Password must be between 8 and 30 characters'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, password } = req.body;
        const clientIP = getClientIP(req);
        const userAgent = getClientUserAgent(req);

        const dbUser = await MainAuthService.loginUser(email, password);

        if (dbUser.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Admin access only',
          });
        }

        const identifier = await generateIdentifier(dbUser, clientIP, userAgent);

        return res.status(200).json({
          success: true,
          identifier,
        });
      } catch (error) {
        logger.error('Admin panel signin error:', {
          error: error.message,
          email: req.body?.email,
        });
        return res.status(401).json({
          success: false,
          error: error.message || 'Invalid email or password',
        });
      }
    },
  ];

  me = async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      return res.status(200).json(toAdminPanelMePayload(req.user));
    } catch (error) {
      logger.error('Admin panel /auth/me error:', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export default new AdminPanelAuthController();
