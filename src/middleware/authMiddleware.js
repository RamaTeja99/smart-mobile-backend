const authConfig = require('../config/auth');
const { getSupabaseAdmin } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Authentication middleware to verify JWT tokens
 */
const authenticateToken = async (req, res, next) => {
  try {
    const token = authConfig.extractTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token required'
      });
    }

    // Verify the token
    const decoded = authConfig.verifyToken(token);

    // Get admin user from database to verify token is still valid
    const supabase = getSupabaseAdmin();
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', decoded.id)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    // Check if account is locked
    if (authConfig.isAccountLocked(admin)) {
      return res.status(423).json({
        status: 'error',
        message: 'Account temporarily locked due to too many failed login attempts'
      });
    }

    // Attach user info to request
    req.user = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions || {}
    };

    next();
  } catch (error) {
    logger.warn('Authentication failed', { 
      error: error.message, 
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error.message === 'Token expired') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuthentication = async (req, res, next) => {
  try {
    const token = authConfig.extractTokenFromHeader(req);

    if (token) {
      const decoded = authConfig.verifyToken(token);

      const supabase = getSupabaseAdmin();
      const { data: admin } = await supabase
        .from('admins')
        .select('*')
        .eq('id', decoded.id)
        .eq('is_active', true)
        .single();

      if (admin && !authConfig.isAccountLocked(admin)) {
        req.user = {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions || {}
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional middleware
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuthentication
};
