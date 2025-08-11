const supabaseService = require('../services/supabaseService');
const logger = require('../utils/logger');

/**
 * Brand Controller
 * Handles brand management
 */
class BrandController {
  /**
   * Get all brands
   * GET /api/brands
   */
  async getBrands(req, res) {
    try {
      const includeInactive = req.user?.role === 'super_admin' && req.query.include_inactive === 'true';

      const result = await supabaseService.getBrands(includeInactive);

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch brands'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: `Found ${result.data.length} brands`
      });

    } catch (error) {
      logger.error('BrandController.getBrands error', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch brands'
      });
    }
  }

  /**
   * Get brand by ID
   * GET /api/brands/:id
   */
  async getBrandById(req, res) {
    try {
      const { id } = req.params;
      const result = await supabaseService.getBrandById(id);

      if (!result.success || !result.data) {
        return res.status(404).json({
          status: 'error',
          message: 'Brand not found'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Brand retrieved successfully'
      });

    } catch (error) {
      logger.error('BrandController.getBrandById error', { 
        error: error.message, 
        brandId: req.params.id 
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch brand'
      });
    }
  }

  /**
   * Create new brand (Admin only)
   * POST /api/brands
   */
  async createBrand(req, res) {
    try {
      const brandData = req.body;
      const result = await supabaseService.createBrand(brandData);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to create brand'
        });
      }

      logger.info('Brand created', { 
        brandId: result.data.id, 
        adminId: req.user.id 
      });

      res.status(201).json({
        status: 'success',
        data: result.data,
        message: 'Brand created successfully'
      });

    } catch (error) {
      logger.error('BrandController.createBrand error', { 
        error: error.message, 
        brandData: req.body,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to create brand'
      });
    }
  }

  /**
   * Update brand (Admin only)
   * PUT /api/brands/:id
   */
  async updateBrand(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await supabaseService.updateBrand(id, updateData);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to update brand'
        });
      }

      logger.info('Brand updated', { 
        brandId: id, 
        adminId: req.user.id 
      });

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Brand updated successfully'
      });

    } catch (error) {
      logger.error('BrandController.updateBrand error', { 
        error: error.message, 
        brandId: req.params.id,
        updateData: req.body,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to update brand'
      });
    }
  }

  /**
   * Delete brand (Admin only)
   * DELETE /api/brands/:id
   */
  async deleteBrand(req, res) {
    try {
      const { id } = req.params;
      const result = await supabaseService.deleteBrand(id);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to delete brand'
        });
      }

      logger.info('Brand deleted', { 
        brandId: id, 
        adminId: req.user.id 
      });

      res.status(200).json({
        status: 'success',
        message: 'Brand deleted successfully'
      });

    } catch (error) {
      logger.error('BrandController.deleteBrand error', { 
        error: error.message, 
        brandId: req.params.id,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete brand'
      });
    }
  }
}

module.exports = new BrandController();
