import Fingerprint from '@/models/security/Fingerprint';
import User from '@/models/users/User';
import { logger } from '@/utils/logger';
import { getClientIP, getClientUserAgent } from '@/utils/helpers/auth';

export class FingerprintService {
  /**
   * Save fingerprint data
   */
  async saveFingerprint(data) {
    try {
      const {
        visitorId,
        fingerprintData,
        userId,
        action,
        metadata = {},
        ipAddress,
        userAgent,
      } = data;

      if (!visitorId || !fingerprintData) {
        throw new Error('Visitor ID and fingerprint data are required');
      }

      const fingerprint = new Fingerprint({
        visitorId,
        fingerprintData,
        userId: userId || undefined,
        action: action || 'other',
        metadata,
        ipAddress,
        userAgent,
      });

      await fingerprint.save();

      logger.info('Fingerprint saved', {
        visitorId,
        userId,
        action,
      });

      return fingerprint;
    } catch (error) {
      logger.error('Failed to save fingerprint', error);
      throw error;
    }
  }

  /**
   * Check if fingerprint is suspicious
   */
  async checkFingerprintRisk(visitorId, userId = null) {
    try {
      // Check if visitor ID is associated with multiple users
      const usersWithSameFingerprint = await Fingerprint.getUsersByVisitorId(visitorId);
      
      // If user is provided, check if user has multiple visitor IDs
      let visitorIdsForUser = [];
      if (userId) {
        visitorIdsForUser = await Fingerprint.getVisitorIdsByUserId(userId.toString());
      }

      // Calculate risk score
      let riskScore = 0;
      const flags = [];

      // Multiple users with same fingerprint = high risk
      if (usersWithSameFingerprint.length > 1) {
        riskScore += 50;
        flags.push('multiple_users_same_device');
      }

      // Multiple devices for same user = medium risk (could be legitimate)
      if (visitorIdsForUser.length > 3) {
        riskScore += 20;
        flags.push('multiple_devices');
      }

      // Check for suspicious patterns
      const recentFingerprints = await Fingerprint.find({
        visitorId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      }).sort({ createdAt: -1 }).limit(10);

      // Too many actions in short time = suspicious
      if (recentFingerprints.length > 20) {
        riskScore += 30;
        flags.push('excessive_activity');
      }

      const isSuspicious = riskScore >= 50;

      return {
        riskScore: Math.min(riskScore, 100),
        isSuspicious,
        flags,
        usersWithSameFingerprint: usersWithSameFingerprint.length,
        visitorIdsForUser: visitorIdsForUser.length,
      };
    } catch (error) {
      logger.error('Failed to check fingerprint risk', error);
      return {
        riskScore: 0,
        isSuspicious: false,
        flags: [],
        usersWithSameFingerprint: 0,
        visitorIdsForUser: 0,
      };
    }
  }

  /**
   * Get fingerprint history for a user
   */
  async getUserFingerprintHistory(userId, limit = 50) {
    try {
      return await Fingerprint.getFingerprintsByUserId(userId, limit);
    } catch (error) {
      logger.error('Failed to get user fingerprint history', error);
      throw error;
    }
  }

  /**
   * Get fingerprint history for a visitor ID
   */
  async getVisitorFingerprintHistory(visitorId, limit = 50) {
    try {
      return await Fingerprint.getFingerprintsByVisitorId(visitorId, limit);
    } catch (error) {
      logger.error('Failed to get visitor fingerprint history', error);
      throw error;
    }
  }

  /**
   * Extract fingerprint from request
   */
  extractFingerprintFromRequest(req) {
    const fingerprint = req.body?.fingerprint;
    if (!fingerprint) {
      return null;
    }

    return {
      visitorId: fingerprint.visitorId,
      fingerprintData: fingerprint.data || fingerprint.fingerprintData || {},
      ipAddress: getClientIP(req),
      userAgent: getClientUserAgent(req),
    };
  }
}

export default new FingerprintService();

