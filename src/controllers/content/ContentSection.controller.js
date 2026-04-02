import ContentSection from '@/models/content/ContentSection';
import logger from '@/utils/logger';

export class ContentSectionController {
  /**
   * Get all active content sections
   */
  async getContentSections(req, res, next) {
    try {
      const sections = await ContentSection.find({ isActive: true })
        .sort({ order: 1 })
        .select('-__v');

      return res.json({
        success: true,
        data: sections,
      });
    } catch (error) {
      logger.error('Failed to fetch content sections:', error);
      return next(error);
    }
  }

  /**
   * Get a single content section by ID
   */
  async getContentSection(req, res, next) {
    try {
      const { id } = req.params;

      const section = await ContentSection.findById(id);

      if (!section) {
        return res.status(404).json({
          success: false,
          message: 'Content section not found',
        });
      }

      return res.json({
        success: true,
        data: section,
      });
    } catch (error) {
      logger.error('Failed to fetch content section:', error);
      return next(error);
    }
  }

  /**
   * Create a new content section (Admin only)
   */
  async createContentSection(req, res, next) {
    try {
      const { title, content, listItems, isActive, order } = req.body;

      const section = await ContentSection.create({
        title,
        content,
        listItems: listItems || [],
        isActive: isActive !== undefined ? isActive : true,
        order: order || 0,
      });

      return res.status(201).json({
        success: true,
        data: section,
        message: 'Content section created successfully',
      });
    } catch (error) {
      logger.error('Failed to create content section:', error);
      return next(error);
    }
  }

  /**
   * Update a content section (Admin only)
   */
  async updateContentSection(req, res, next) {
    try {
      const { id } = req.params;
      const { title, content, listItems, isActive, order } = req.body;

      const section = await ContentSection.findByIdAndUpdate(
        id,
        {
          ...(title && { title }),
          ...(content && { content }),
          ...(listItems && { listItems }),
          ...(isActive !== undefined && { isActive }),
          ...(order !== undefined && { order }),
        },
        { new: true, runValidators: true }
      );

      if (!section) {
        return res.status(404).json({
          success: false,
          message: 'Content section not found',
        });
      }

      return res.json({
        success: true,
        data: section,
        message: 'Content section updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update content section:', error);
      return next(error);
    }
  }

  /**
   * Delete a content section (Admin only)
   */
  async deleteContentSection(req, res, next) {
    try {
      const { id } = req.params;

      const section = await ContentSection.findByIdAndDelete(id);

      if (!section) {
        return res.status(404).json({
          success: false,
          message: 'Content section not found',
        });
      }

      return res.json({
        success: true,
        message: 'Content section deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete content section:', error);
      return next(error);
    }
  }
}

export default new ContentSectionController();

