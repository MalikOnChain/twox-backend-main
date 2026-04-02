import { handleValidationErrors } from '@/middleware/validation-error';
import SettingsService from '@/services/settings/Settings.service';
import { logger } from '@/utils/logger';

class SettingController {
  getSettings = [
    handleValidationErrors,
    async (req, res, next) => {
      try {
        const settings = await SettingsService.getSettings();
        return res.status(200).json({
          success: true,
          settings,
        });
      } catch (error) {
        logger.error('Error getting settings:', error);
        next(error);
      }
    },
  ];
}

export default new SettingController();
