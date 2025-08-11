const logger = require('../utils/logger');

/**
 * Check if user has admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  const adminRoles = ['admin', 'super_admin'];
  if (!adminRoles.includes(req.user.role)) {
    logger.warn('Unauthorized admin access attempt', {
      userId: req.user.id,
      userRole: req.user.role,
      endpoint: req.originalUrl,
      ip: req.ip
    });

    return res.status(403).json({
      status: 'error',
      message: 'Admin access required'
    });
  }

  next();
};

/**
 * Check if user has super admin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'super_admin') {
    logger.warn('Unauthorized super admin access attempt', {
      userId: req.user.id,
      userRole: req.user.role,
      endpoint: req.originalUrl,
      ip: req.ip
    });

    return res.status(403).json({
      status: 'error',
      message: 'Super admin access required'
    });
  }

  next();
};

/**
 * Check specific permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has specific permission
    const userPermissions = req.user.permissions || {};
    if (!userPermissions[permission]) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredPermission: permission,
        endpoint: req.originalUrl,
        ip: req.ip
      });

      return res.status(403).json({
        status: 'error',
        message: `Permission required: ${permission}`
      });
    }

    next();
  };
};

/**
 * Log admin actions for audit trail
 */
const logAdminAction = (action, entityType = null) => {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send;

    res.send = function(data) {
      // Log action after successful response
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const { getSupabaseAdmin } = require('../config/database');
        const supabase = getSupabaseAdmin();

        const logData = {
          admin_id: req.user?.id,
          action,
          entity_type: entityType,
          entity_id: req.params.id || null,
          changes: req.body || {},
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created_at: new Date().toISOString()
        };

        supabase.from('activity_logs').insert([logData]).then(({ error }) => {
          if (error) {
            logger.error('Failed to log admin action', { error: error.message, logData });
          }
        });
      }

      // Call original send method
      return originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  logAdminAction
};
