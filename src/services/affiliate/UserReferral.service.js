import mongoose from 'mongoose';

import TierAffiliate from '@/models/tier-affiliate/TierAffiliate';
import User from '@/models/users/User';
import { logger } from '@/utils/logger';

export class UserReferralService {
  constructor() {}

  /**
   * Validate a referral code format
   * @param {string} referralCode - The referral code to validate
   * @returns {boolean} Whether the referral code format is valid
   */
  validateReferralCodeFormat(referralCode) {
    return /^[A-Z0-9]{8}$/.test(referralCode);
  }

  /**
   * Get the referred users for a given user
   * @param {string} userId - The user id to get the referred users for
   * @returns {Promise<Array>} The referred users
   */
  async getReferredUsers(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);
      const referredUsers = await User.aggregate([
        { $match: { referredByUser: userObjectId } },
        {
          $lookup: {
            from: 'vipusers',
            localField: '_id',
            foreignField: 'userId',
            as: 'vipData',
          },
        },
        {
          $lookup: {
            from: 'cryptotransactions',
            localField: '_id',
            foreignField: 'userId',
            as: 'cryptoTransactions',
          },
        },
        {
          $project: {
            username: 1,
            avatar: 1,
            createdAt: 1,
            wager: 1,
            totalWagered: { $ifNull: [{ $arrayElemAt: ['$vipData.totalWagered', 0] }, 0] },
            depositStatus: { $gt: [{ $size: '$cryptoTransactions' }, 0] },
          },
        },
      ]);

      return referredUsers;
    } catch (error) {
      logger.error(`Error getting referred users: ${error.message}`);
      throw error;
    }
  }

  async getReferredUsersCount(userId) {
    const referredUsers = await this.getReferredUsers(userId);
    return referredUsers.length;
  }

  /**
   * Get the referrer for a given referral code
   * @param {string} referralCode - The referral code to get the referrer for
   * @returns {Promise<Object | null>} The referrer object with id and type
   */
  async getReferrer(referralCode) {
    try {
      if (!referralCode || typeof referralCode !== 'string') {
        throw new Error('Invalid referral code');
      }

      // Validate format
      if (!this.validateReferralCodeFormat(referralCode)) {
        throw new Error('Invalid referral code format');
      }

      // Check tier affiliate first
      const tierAffiliateReferrer = await TierAffiliate.findOne({ referralCode }).select('_id').lean();
      if (tierAffiliateReferrer) {
        return { id: tierAffiliateReferrer._id, type: 'tier' };
      }

      // Then check user referrals
      const userReferrer = await User.findOne({ referralCode }).select('_id').lean();
      if (userReferrer) {
        return { id: userReferrer._id, type: 'user' };
      }

      return null;
    } catch (error) {
      logger.error(`Error getting referrer: ${error.message}`);
      return null;
    }
  }

  /**
   * Process a referral for a new user
   * @param {string} referralCode - The referral code to process
   * @param {Object} newUser - The new user object
   * @returns {Promise<Object>} The processed referral result
   */
  async processReferral(referralCode, newUser) {
    try {
      if (!referralCode || !newUser) {
        return { success: false, message: 'Invalid referral code or user' };
      }

      const referrer = await this.getReferrer(referralCode);
      if (!referrer) {
        return { success: false, message: 'Invalid referral code' };
      }

      // Update new user with referrer information
      if (referrer.type === 'tier') {
        newUser.referredByTier = referrer.id;
      } else {
        newUser.referredByUser = referrer.id;
      }

      await newUser.save();

      return {
        success: true,
        referrer,
        message: 'Referral processed successfully',
      };
    } catch (error) {
      logger.error(`Error processing referral: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get referral metrics for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} Referral metrics
   */
  async getUserReferralMetrics(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      // Get referred users
      const referredUsers = await this.getReferredUsers(userId);
      
      // Get users who made deposits (using CryptoTransactions or PixTransaction)
      const CryptoTransaction = (await import('@/models/transactions/CryptoTransactions')).default;
      const PixTransaction = (await import('@/models/transactions/PixTransaction')).default;
      
      const depositorIds = await User.find({
        referredByUser: userObjectId,
      }).distinct('_id');
      
      // Count users who made deposits
      const depositsData = await Promise.all([
        CryptoTransaction.aggregate([
          { $match: { userId: { $in: depositorIds }, type: 'deposit' } },
          { $group: { _id: '$userId', totalAmount: { $sum: '$amount' } } }
        ]),
        PixTransaction.aggregate([
          { $match: { userId: { $in: depositorIds }, type: 'deposit' } },
          { $group: { _id: '$userId', totalAmount: { $sum: '$amount' } } }
        ])
      ]);
      
      const uniqueDepositors = new Set([
        ...depositsData[0].map(d => d._id.toString()),
        ...depositsData[1].map(d => d._id.toString())
      ]);
      
      const totalDeposits = [
        ...depositsData[0],
        ...depositsData[1]
      ].reduce((sum, d) => sum + (d.totalAmount || 0), 0);
      
      // Get total wagered from VipUser
      const VipUser = (await import('@/models/vip/VipUser')).default;
      const vipData = await VipUser.find({
        userId: { $in: depositorIds }
      });
      
      const totalWagered = vipData.reduce((sum, vip) => sum + (vip.totalWagered || 0), 0);
      
      // Calculate earnings (example: 5% commission on wagers)
      const commissionRate = 0.05; // 5%
      const totalEarnings = totalWagered * commissionRate;
      
      return {
        totalReferrals: referredUsers.length,
        totalDepositors: uniqueDepositors.size,
        totalDeposits: Math.round(totalDeposits * 100) / 100,
        totalWagered: Math.round(totalWagered * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
      };
    } catch (error) {
      logger.error(`Error getting referral metrics: ${error.message}`);
      throw error;
    }
  }
}

export default new UserReferralService();
