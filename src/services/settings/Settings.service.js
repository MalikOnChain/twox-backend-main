import Settings from '@/models/settings/Settings';
import { logger } from '@/utils/logger';

class SettingsService {
  async getSettings() {
    try {
      const settings = await Settings.findOne({})
        .select('depositMinAmount withdrawMinAmount withdrawMaxAmount xpSetting socialMediaSetting termsCondition')
        .lean();
      return settings;
    } catch (error) {
      logger.error('Error in getSettings:', error);
      throw error;
    }
  }
}

export default new SettingsService();
