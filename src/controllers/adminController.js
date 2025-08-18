const supabaseService = require('../services/supabaseService');
const authConfig = require('../config/auth');
const searchService = require('../services/searchService');
const logger = require('../utils/logger');

/**
 * Admin Controller
 * Handles admin-specific operations and dashboard functionality
 */
class AdminController {
   async submitFeedback(req, res) {
    try {
      const data = req.body;
      if (!data.message) {
        return res.status(400).json({ status: 'error', message: 'Message is required' });
      }
      const result = await supabaseService.createFeedback(data);
      if (!result.success) {
        return res.status(500).json({ status: 'error', message: 'Failed to save feedback' });
      }
      res.status(201).json({ status: 'success', data: result.data, message: 'Feedback submitted' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Failed to submit feedback' });
    }
  }

  // GET /api/admin/feedback (Admin only)
  async getAllFeedback(req, res) {
    try {
      const page = parseInt(req.query.page || '1');
      const limit = parseInt(req.query.limit || '50');
      const result = await supabaseService.getFeedbackList({ page, limit });
      if (!result.success) {
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve feedback' });
      }
      res.status(200).json({ status: 'success', data: result.data, message: 'Feedback list' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Failed to retrieve feedback' });
    }
  }
  /**
   * Get admin dashboard statistics
   * GET /api/admin/dashboard
   */
  async getDashboardStats(req, res) {
    try {
      const stats = await supabaseService.getStatistics();

      if (!stats.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch dashboard statistics'
        });
      }

      // Add search cache stats
      const cacheStats = searchService.getCacheStats();
      const popularSearches = searchService.getPopularSearches(10);

      const dashboardData = {
        ...stats.data,
        cache_stats: cacheStats,
        popular_searches: popularSearches,
        last_updated: new Date().toISOString()
      };

      res.status(200).json({
        status: 'success',
        data: dashboardData,
        message: 'Dashboard statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('AdminController.getDashboardStats error', { 
        error: error.message,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch dashboard statistics'
      });
    }
  }

  /**
   * Create new admin (Super Admin only)
   * POST /api/admin/admins
   */
  async createAdmin(req, res) {
    try {
      const adminData = req.body;

      // Hash password
      adminData.password = await authConfig.hashPassword(adminData.password);

      // Set default role if not provided
      if (!adminData.role) {
        adminData.role = 'admin';
      }

      // Ensure only super admin can create other super admins
      if (adminData.role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Only super admin can create super admin accounts'
        });
      }

      const result = await supabaseService.createAdmin(adminData);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to create admin'
        });
      }

      // Remove password from response
      delete result.data.password;

      logger.info('Admin created', { 
        newAdminId: result.data.id,
        createdByAdminId: req.user.id 
      });

      res.status(201).json({
        status: 'success',
        data: result.data,
        message: 'Admin created successfully'
      });

    } catch (error) {
      logger.error('AdminController.createAdmin error', { 
        error: error.message, 
        adminData: { ...req.body, password: '[HIDDEN]' },
        createdByAdminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to create admin'
      });
    }
  }

  /**
   * Clear search cache (Admin only)
   * POST /api/admin/cache/clear
   */
  async clearSearchCache(req, res) {
    try {
      searchService.clearCache();

      logger.info('Search cache cleared', { adminId: req.user.id });

      res.status(200).json({
        status: 'success',
        message: 'Search cache cleared successfully'
      });

    } catch (error) {
      logger.error('AdminController.clearSearchCache error', { 
        error: error.message,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to clear cache'
      });
    }
  }

  /**
   * Get search cache statistics (Admin only)
   * GET /api/admin/cache/stats
   */
  async getSearchCacheStats(req, res) {
    try {
      const cacheStats = searchService.getCacheStats();

      res.status(200).json({
        status: 'success',
        data: cacheStats,
        message: 'Cache statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('AdminController.getSearchCacheStats error', { 
        error: error.message,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get cache statistics'
      });
    }
  }

  /**
   * Test database health (Admin only)
   * GET /api/admin/health/database
   */
  async testDatabaseHealth(req, res) {
    try {
      const healthResult = await supabaseService.healthCheck();

      if (!healthResult.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Database health check failed'
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          database: 'healthy',
          timestamp: new Date().toISOString()
        },
        message: 'Database health check passed'
      });

    } catch (error) {
      logger.error('AdminController.testDatabaseHealth error', { 
        error: error.message,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Database health check failed'
      });
    }
  }

  /**
   * Get system information (Super Admin only)
   * GET /api/admin/system/info
   */
  async getSystemInfo(req, res) {
    try {
      const systemInfo = {
        node_version: process.version,
        platform: process.platform,
        uptime: Math.floor(process.uptime()),
        memory_usage: process.memoryUsage(),
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      };

      res.status(200).json({
        status: 'success',
        data: systemInfo,
        message: 'System information retrieved successfully'
      });

    } catch (error) {
      logger.error('AdminController.getSystemInfo error', { 
        error: error.message,
        adminId: req.user?.id
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get system information'
      });
    }
  }
}

module.exports = new AdminController();
