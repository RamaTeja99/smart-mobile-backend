const supabaseService = require('../services/supabaseService');
const logger = require('../utils/logger');

/**
 * Category Controller
 * Handles category management
 */
class CategoryController {
  /**
   * Get all categories
   * GET /api/categories
   */
  async getCategories(req, res) {
    try {
      const includeInactive = req.user?.role === 'super_admin' && req.query.include_inactive === 'true';

      const result = await supabaseService.getCategories(includeInactive);

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch categories'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: `Found ${result.data.length} categories`
      });

    } catch (error) {
      logger.error('CategoryController.getCategories error', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch categories'
      });
    }
  }

  /**
   * Get category by ID
   * GET /api/categories/:id
   */
  async getCategoryById(req, res) {
    try {
      const { id } = req.params;
      const result = await supabaseService.getCategoryById(id);

      if (!result.success || !result.data) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Category retrieved successfully'
      });

    } catch (error) {
      logger.error('CategoryController.getCategoryById error', { 
        error: error.message, 
        categoryId: req.params.id 
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch category'
      });
    }
  }

  /**
   * Create new category (Admin only)
   * POST /api/categories
   */
  async createCategory(req, res) {
    try {
      const categoryData = req.body;
      const result = await supabaseService.createCategory(categoryData);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to create category'
        });
      }

      logger.info('Category created', { 
        categoryId: result.data.id, 
        adminId: req.user.id 
      });

      res.status(201).json({
        status: 'success',
        data: result.data,
        message: 'Category created successfully'
      });

    } catch (error) {
      logger.error('CategoryController.createCategory error', { 
        error: error.message, 
        categoryData: req.body,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to create category'
      });
    }
  }

  /**
   * Update category (Admin only)
   * PUT /api/categories/:id
   */
  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await supabaseService.updateCategory(id, updateData);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to update category'
        });
      }

      logger.info('Category updated', { 
        categoryId: id, 
        adminId: req.user.id 
      });

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Category updated successfully'
      });

    } catch (error) {
      logger.error('CategoryController.updateCategory error', { 
        error: error.message, 
        categoryId: req.params.id,
        updateData: req.body,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to update category'
      });
    }
  }

  /**
   * Delete category (Admin only)
   * DELETE /api/categories/:id
   */
  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const result = await supabaseService.deleteCategory(id);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to delete category'
        });
      }

      logger.info('Category deleted', { 
        categoryId: id, 
        adminId: req.user.id 
      });

      res.status(200).json({
        status: 'success',
        message: 'Category deleted successfully'
      });

    } catch (error) {
      logger.error('CategoryController.deleteCategory error', { 
        error: error.message, 
        categoryId: req.params.id,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete category'
      });
    }
  }
}

module.exports = new CategoryController();
