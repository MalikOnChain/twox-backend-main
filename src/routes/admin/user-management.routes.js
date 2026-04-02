import express from 'express';
import { body, param } from 'express-validator';

import { requireAuth } from '@/middleware/auth';
import { handleValidationErrors } from '@/middleware/validation-error';
import User from '@/models/users/User';
import MainAuthService from '@/services/auth/MainAuth.service';

const router = express.Router();

function requireAdminUser(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  return next();
}

/**
 * Admin panel: set a new password for a player (non-admin) account.
 */
router.post(
  '/player-profile/:userId/password',
  requireAuth,
  requireAdminUser,
  param('userId').isMongoId().withMessage('Valid user id is required'),
  body('password')
    .isLength({ min: 8, max: 30 })
    .withMessage('Password must be between 8 and 30 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const target = await User.findById(req.params.userId);
      if (!target) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      if (target.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin passwords cannot be changed from the member profile',
        });
      }

      const hash = await MainAuthService.hashPassword(req.body.password);
      target.password = hash;
      await target.save();

      return res.json({ success: true, message: 'Password updated' });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to update password',
      });
    }
  }
);

export default router;
