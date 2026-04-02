import SumsubService from '@/services/sumsub/Sumsub.service';
import { logger } from '@/utils/logger';

class SumsubController {
  async signupApi(req, res, next) {
    const { id: userId, email } = req.user;
    try {
      const applicant = await SumsubService.getSumsubAPIAccessToken(userId, email);
      return res.json({ success: true, token: applicant.token });
    } catch (error) {
      logger.error('Error in signupApi:', error);
      return next(error);
    }
  }

  async getKycStatus(req, res, next) {
    const userId = req.user.id;

    try {
      const verified = await SumsubService.isUserVerified(userId);
      return res.json({ success: true, status: verified });
    } catch (error) {
      logger.error('Error in getKycStatus:', error);
      return next(error);
    }
  }

  signupSdk = [
    async (req, res, next) => {
      const { id: userId, email } = req.user;
      try {
        const applicant = await SumsubService.getSumsubSDKAccessToken(userId, email);
        return res.json({ success: true, token: applicant.token });
      } catch (error) {
        logger.error('Error in signupSdk:', error);
        return next(error);
      }
    },
  ];

  async webhookHandler(req, res, next) {
    try {
      await SumsubService.webhookHandler(req, res);
    } catch (error) {
      logger.error('Error in webhookHandler:', error);
      if (!res.headersSent) {
        return next(error);
      }
    }
  }
}

export default new SumsubController();
