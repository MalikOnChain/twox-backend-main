import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import BonusBanner from '@/models/content/BonusBanner';
import { logger } from '@/utils/logger';

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

export class BonusBannerController {
  /**
   * Get all active bonus banners
   */
  public getActiveBanners = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const banners = await BonusBanner.find({ isActive: true })
        .sort({ order: 1 })
        .lean()
        .exec();

      return res.json({
        success: true,
        data: banners,
      });
    } catch (error) {
      logger.error('Failed to get bonus banners:', error);
      next(error);
    }
  };

  /**
   * Get all bonus banners (including inactive) - Admin only
   */
  public getAllBanners = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const banners = await BonusBanner.find()
        .sort({ order: 1 })
        .lean()
        .exec();

      return res.json({
        success: true,
        data: banners,
      });
    } catch (error) {
      logger.error('Failed to get all bonus banners:', error);
      next(error);
    }
  };

  /**
   * Get single bonus banner by ID
   */
  public getBannerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const banner = await BonusBanner.findById(id).lean().exec();

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Bonus banner not found',
        });
      }

      return res.json({
        success: true,
        data: banner,
      });
    } catch (error) {
      logger.error('Failed to get bonus banner:', error);
      next(error);
    }
  };

  /**
   * Create new bonus banner - Admin only
   */
  public createBanner = [
    body('title').isString().trim().notEmpty().withMessage('Title is required'),
    body('subtitle').isString().trim().notEmpty().withMessage('Subtitle is required'),
    body('highlight').isString().trim().notEmpty().withMessage('Highlight is required'),
    body('image').isString().trim().notEmpty().withMessage('Image is required'),
    body('features').optional().isArray().withMessage('Features must be an array'),
    body('buttonText').optional().isString().trim().withMessage('Button text must be a string'),
    body('order').optional().isInt().withMessage('Order must be an integer'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    handleValidationErrors,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bannerData = req.body;

        const newBanner = new BonusBanner(bannerData);
        await newBanner.save();

        logger.info(`Bonus banner created: ${newBanner._id}`);

        return res.status(201).json({
          success: true,
          data: newBanner,
          message: 'Bonus banner created successfully',
        });
      } catch (error) {
        logger.error('Failed to create bonus banner:', error);
        next(error);
      }
    },
  ];

  /**
   * Update bonus banner - Admin only
   */
  public updateBanner = [
    body('title').optional().isString().trim().withMessage('Title must be a string'),
    body('subtitle').optional().isString().trim().withMessage('Subtitle must be a string'),
    body('highlight').optional().isString().trim().withMessage('Highlight must be a string'),
    body('image').optional().isString().trim().withMessage('Image must be a string'),
    body('features').optional().isArray().withMessage('Features must be an array'),
    body('buttonText').optional().isString().trim().withMessage('Button text must be a string'),
    body('order').optional().isInt().withMessage('Order must be an integer'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    handleValidationErrors,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        const updatedBanner = await BonusBanner.findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true, runValidators: true }
        ).exec();

        if (!updatedBanner) {
          return res.status(404).json({
            success: false,
            message: 'Bonus banner not found',
          });
        }

        logger.info(`Bonus banner updated: ${id}`);

        return res.json({
          success: true,
          data: updatedBanner,
          message: 'Bonus banner updated successfully',
        });
      } catch (error) {
        logger.error('Failed to update bonus banner:', error);
        next(error);
      }
    },
  ];

  /**
   * Delete bonus banner - Admin only
   */
  public deleteBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const deletedBanner = await BonusBanner.findByIdAndDelete(id).exec();

      if (!deletedBanner) {
        return res.status(404).json({
          success: false,
          message: 'Bonus banner not found',
        });
      }

      logger.info(`Bonus banner deleted: ${id}`);

      return res.json({
        success: true,
        message: 'Bonus banner deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete bonus banner:', error);
      next(error);
    }
  };

  /**
   * Toggle banner active status - Admin only
   */
  public toggleBannerStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const banner = await BonusBanner.findById(id).exec();

      if (!banner) {
        return res.status(404).json({
          success: false,
          message: 'Bonus banner not found',
        });
      }

      banner.isActive = !banner.isActive;
      await banner.save();

      logger.info(`Bonus banner status toggled: ${id} - isActive: ${banner.isActive}`);

      return res.json({
        success: true,
        data: banner,
        message: `Bonus banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      logger.error('Failed to toggle bonus banner status:', error);
      next(error);
    }
  };
}

export default new BonusBannerController();

