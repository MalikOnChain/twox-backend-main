// src/controllers/BonusController/BonusController.js
import { body, query, param } from 'express-validator';

import { handleValidationErrors } from '@/middleware/validation-error';

import User from '../../models/users/User';
import UserBonusBalance from '../../models/users/UserBonusBalance';
import BonusService from '../../services/bonus/BonusService.service';
import FingerprintService from '../../services/security/Fingerprint.service';
import { getClientIP, getClientUserAgent } from '../../utils/helpers/auth';
import { logger } from '../../utils/logger';

export class BonusController {
  getAllActiveBonuses = [
    query('category').optional().isString().trim().escape(),
    query('type').optional().isString().trim().escape(),
    query('includeConfig').optional().isBoolean().toBoolean(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { category, type, includeConfig = false } = req.query;

        let bonuses = await BonusService.getAllActive({
          category,
          type,
          includeConfig,
        });

        // If user is authenticated, filter out already claimed bonuses
        if (req.user) {
          const claimedBonusIds = await UserBonusBalance.find({
            userId: req.user._id,
            status: { $in: ['active', 'completed'] },
          }).distinct('bonusId');

          bonuses = bonuses.filter(
            bonus => !claimedBonusIds.some(id => id.toString() === bonus._id.toString())
          );
        }

        res.status(200).json({
          success: true,
          bonuses,
          total: bonuses.length,
        });
      } catch (error) {
        logger.error('Error getting active bonuses:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch bonuses',
        });
      }
    },
  ];

  getEligibleBonusesByUser = [
    query('category').optional().isString().trim().escape(),
    query('type').optional().isString().trim().escape(),
    query('includeProgress').optional().isBoolean().toBoolean(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { category, type, includeProgress = true } = req.query;

        const bonuses = await BonusService.getClaimableBonuses(req.user, {
          category,
          type,
          includeProgress,
        });

        res.status(200).json({
          success: true,
          bonuses,
          total: bonuses.length,
        });
      } catch (error) {
        logger.error('Error getting eligible bonuses:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch eligible bonuses',
        });
      }
    },
  ];

  redeemPromoCode = [
    body('code')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Promo code is required')
      .toUpperCase(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { code } = req.body;
        
        logger.info('🎟️ Promo code redemption request:', {
          code,
          userId: req.user?._id,
          username: req.user?.username,
        });

        // Find bonus by code
        const Bonus = (await import('../../models/bonus/Bonuses')).default;
        const bonus = await Bonus.findOne({ 
          code: code,
          status: 'active',
        });

        if (!bonus) {
          return res.status(404).json({
            success: false,
            message: 'Invalid promo code',
          });
        }

        // Check if bonus is expired
        const now = new Date();
        if (bonus.validTo && bonus.validTo < now) {
          return res.status(400).json({
            success: false,
            message: 'This promo code has expired',
          });
        }

        if (bonus.validFrom && bonus.validFrom > now) {
          return res.status(400).json({
            success: false,
            message: 'This promo code is not yet active',
          });
        }

        // Check if user has already claimed this bonus
        const existingClaim = await UserBonusBalance.findOne({
          userId: req.user._id,
          bonusId: bonus._id,
          status: { $in: ['active', 'completed'] },
        });

        if (existingClaim) {
          return res.status(400).json({
            success: false,
            message: 'You have already claimed this promo code',
          });
        }

        // Attempt to claim the bonus
        const result = await BonusService.claimBonus(req.user, bonus._id, { code });
        
        // Save fingerprint if provided
        if (req.body.fingerprint && req.body.fingerprint.visitorId && req.user) {
          try {
            await FingerprintService.saveFingerprint({
              visitorId: req.body.fingerprint.visitorId,
              fingerprintData: req.body.fingerprint.data || {},
              userId: req.user._id,
              action: 'promo_redeem',
              metadata: { bonusId: bonus._id.toString(), code },
              ipAddress: getClientIP(req),
              userAgent: getClientUserAgent(req),
            });
          } catch (fpError) {
            logger.error('Failed to save fingerprint on promo code redemption', fpError);
          }
        }
        
        logger.info('🎟️ Promo code redemption result:', result);

        if (result.success) {
          return res.status(200).json({
            success: true,
            message: result.message || 'Promo code redeemed successfully!',
            bonus: {
              name: bonus.name,
              description: bonus.description,
              amount: result.bonusBalance?.bonusBalance || result.bonusBalance?.initialAmount,
            },
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message || 'Failed to redeem promo code',
          });
        }
      } catch (error) {
        logger.error('Error redeeming promo code:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to redeem promo code',
        });
      }
    },
  ];

  claimBonus = [
    body('id').isMongoId().withMessage('Invalid bonus ID format'),
    body('code').optional().isString().trim().escape(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { id: bonusId, code, fingerprint } = req.body;
        
        logger.info('🎁 Bonus claim request received:', {
          bonusId,
          userId: req.user?._id,
          username: req.user?.username,
        });

        const result = await BonusService.claimBonus(req.user, bonusId, { code });
        
        // Save fingerprint if provided
        if (fingerprint && fingerprint.visitorId && req.user) {
          try {
            await FingerprintService.saveFingerprint({
              visitorId: fingerprint.visitorId,
              fingerprintData: fingerprint.data || {},
              userId: req.user._id,
              action: 'bonus_claim',
              metadata: { bonusId: bonusId.toString(), code },
              ipAddress: getClientIP(req),
              userAgent: getClientUserAgent(req),
            });
          } catch (fpError) {
            logger.error('Failed to save fingerprint on bonus claim', fpError);
          }
        }
        
        logger.info('🎁 Bonus claim result:', result);

        if (result.success) {
          res.json({
            success: true,
            message: result.message,
            data: {
              bonus: result.bonus,
              reward: result.reward,
            },
          });
        } else {
          res.status(400).json({
            success: false,
            message: result.message,
            whenCanClaim: result.whenCanClaim,
          });
        }
      } catch (error) {
        logger.error('Error claiming bonus:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to claim bonus',
        });
      }
    },
  ];

  getBonusDetails = [
    param('bonusId').isMongoId().withMessage('Invalid bonus ID format'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const userId = req.user?.id;
        const { bonusId } = req.params;

        const config = await BonusService.configService.getBonusConfiguration(bonusId);

        if (!config.bonus) {
          return res.status(404).json({
            success: false,
            message: 'Bonus not found',
          });
        }

        let userReward = config.bonus.defaultReward;
        let claimStatus = null;

        if (userId) {
          const user = await User.findById(userId);

          if (user) {
            userReward = await BonusService.configService.getRewardForUser(bonusId, user);
            const validation = await BonusService.validationService.validateBonusClaim(bonusId, user);
            claimStatus = {
              status: validation.status,
              message: validation.message,
              whenCanClaim: validation.whenCanClaim,
              progress: validation.progress,
            };
          }
        }

        res.json({
          success: true,
          data: {
            bonus: config.bonus,
            userReward,
            claimStatus,
            eligibility: config.eligibility,
            settings: config.settings,
            tierRewards: config.tierRewards,
          },
        });
      } catch (error) {
        logger.error('Error getting bonus details:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch bonus details',
        });
      }
    },
  ];

  getUserBonuses = [
    query('status').optional().isIn(['active', 'claimed', 'expired']).withMessage('Invalid status value'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const userId = req.user.id;
        const { status = 'active', page = 1, limit = 20 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [bonuses, total] = await Promise.all([
          UserBonusBalance.find({ userId, status })
            .populate('bonusId')
            .sort({ claimedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
          UserBonusBalance.countDocuments({ userId, status }),
        ]);

        res.json({
          success: true,
          data: bonuses,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        });
      } catch (error) {
        logger.error('Error getting user bonuses:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch user bonuses',
        });
      }
    },
  ];

  createBonus = [
    body('bonusData').isObject().withMessage('Invalid bonus data'),
    body('configuration').isObject().withMessage('Invalid configuration'),
    body('createdBy').optional().isMongoId().withMessage('Invalid created by ID format'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { bonusData, configuration = {}, createdBy = null } = req.body;
        const bonus = await BonusService.createBonus(bonusData, configuration, createdBy);
        res.json({ success: true, bonus });
      } catch (error) {
        logger.error('Error creating bonus:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to create bonus',
        });
      }
    },
  ];

  removeBonus = [
    param('bonusId').isMongoId().withMessage('Invalid bonus ID format'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { bonusId } = req.params;
        await BonusService.removeBonus(bonusId);
        res.json({
          success: true,
          message: 'Bonus removed successfully',
        });
      } catch (error) {
        logger.error('Error removing bonus:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to remove bonus',
        });
      }
    },
  ];
}

export default new BonusController();
