const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

/**
 * Authentication Configuration
 * Handles JWT tokens, password hashing, and auth security
 */

// Environment variables with defaults
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_refresh_token_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Security configurations
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCK_TIME = process.env.LOCK_TIME || '2h'; // 2 hours

/**
 * Convert lock time string to milliseconds
 * @param {string} lockTime - Time string (e.g., '2h', '30m', '1d')
 * @returns {number} Time in milliseconds
 */
const parseLockTime = (lockTime) => {
  const units = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };

  const match = lockTime.match(/^(\d+)([smhd])$/);
  if (!match) {
    logger.warn('Invalid lock time format, using default 2 hours', { lockTime });
    return 2 * 60 * 60 * 1000; // 2 hours default
  }

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
};

const LOCK_TIME_MS = parseLockTime(LOCK_TIME);

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    logger.error('Password hashing failed', { error: error.message });
    throw new Error('Password hashing failed');
  }
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
const comparePassword = async (password, hash) => {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    logger.error('Password comparison failed', { error: error.message });
    return false;
  }
};

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload (user data)
 * @returns {string} JWT token
 */
const generateAccessToken = (payload) => {
  try {
    const token = jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        type: 'access'
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'mobile-store-api',
        audience: 'mobile-store-admin'
      }
    );

    logger.debug('Access token generated', { userId: payload.id });
    return token;
  } catch (error) {
    logger.error('Access token generation failed', { error: error.message });
    throw new Error('Token generation failed');
  }
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload (user data)
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  try {
    const token = jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        type: 'refresh'
      },
      JWT_REFRESH_SECRET,
      {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'mobile-store-api',
        audience: 'mobile-store-admin'
      }
    );

    logger.debug('Refresh token generated', { userId: payload.id });
    return token;
  } catch (error) {
    logger.error('Refresh token generation failed', { error: error.message });
    throw new Error('Refresh token generation failed');
  }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Token pair with metadata
 */
const generateTokenPair = (user) => {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    logger.info('Token pair generated', { userId: user.id });

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN,
      tokenType: 'Bearer'
    };
  } catch (error) {
    logger.error('Token pair generation failed', { 
      error: error.message, 
      userId: user.id 
    });
    throw error;
  }
};

/**
 * Verify JWT access token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'mobile-store-api',
      audience: 'mobile-store-admin'
    });

    // Ensure it's an access token
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Access token expired');
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid access token', { error: error.message });
      throw new Error('Invalid token');
    } else {
      logger.error('Access token verification failed', { error: error.message });
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Verify JWT refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'mobile-store-api',
      audience: 'mobile-store-admin'
    });

    // Ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Refresh token expired');
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid refresh token', { error: error.message });
      throw new Error('Invalid refresh token');
    } else {
      logger.error('Refresh token verification failed', { error: error.message });
      throw new Error('Refresh token verification failed');
    }
  }
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Check if account is locked
 * @param {Object} admin - Admin user object
 * @returns {boolean} True if account is locked
 */
const isAccountLocked = (admin) => {
  if (!admin.locked_until) {
    return false;
  }

  const lockExpiry = new Date(admin.locked_until);
  const now = new Date();

  return now < lockExpiry;
};

/**
 * Calculate lock expiry time
 * @returns {Date} Lock expiry date
 */
const calculateLockExpiry = () => {
  return new Date(Date.now() + LOCK_TIME_MS);
};

/**
 * Get time remaining until account unlock
 * @param {Object} admin - Admin user object
 * @returns {number} Minutes remaining, 0 if not locked
 */
const getLockTimeRemaining = (admin) => {
  if (!admin.locked_until) {
    return 0;
  }

  const lockExpiry = new Date(admin.locked_until);
  const now = new Date();

  if (now >= lockExpiry) {
    return 0;
  }

  return Math.ceil((lockExpiry - now) / (1000 * 60)); // Minutes
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate secure random string
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
const generateSecureRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

/**
 * Create admin user with hashed password
 * @param {Object} adminData - Admin user data
 * @returns {Object} Admin user with hashed password
 */
const createAdminUser = async (adminData) => {
  try {
    // Validate password
    const passwordValidation = validatePasswordStrength(adminData.password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Hash password
    const hashedPassword = await hashPassword(adminData.password);

    // Generate unique ID if not provided
    const adminId = adminData.id || generateSecureRandomString(16);

    return {
      ...adminData,
      id: adminId,
      password: hashedPassword,
      login_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Admin user creation failed', { error: error.message });
    throw error;
  }
};

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token required'
      });
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;

    logger.debug('Token authenticated', { userId: decoded.id });
    next();
  } catch (error) {
    logger.warn('Token authentication failed', { 
      error: error.message,
      ip: req.ip 
    });

    return res.status(401).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Middleware for optional authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const optionalAuthentication = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      logger.debug('Optional token authenticated', { userId: decoded.id });
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    logger.debug('Optional authentication failed, continuing without auth', { 
      error: error.message 
    });
    next();
  }
};

/**
 * Get authentication configuration
 * @returns {Object} Auth configuration
 */
const getAuthConfig = () => {
  return {
    jwtExpiresIn: JWT_EXPIRES_IN,
    jwtRefreshExpiresIn: JWT_REFRESH_EXPIRES_IN,
    bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
    maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
    lockTimeMs: LOCK_TIME_MS,
    lockTimeString: LOCK_TIME
  };
};

/**
 * Validate authentication configuration
 * @returns {boolean} True if configuration is valid
 */
const validateAuthConfig = () => {
  const issues = [];

  if (!JWT_SECRET || JWT_SECRET === 'your_super_secret_jwt_key_change_in_production') {
    issues.push('JWT_SECRET must be set to a secure value in production');
  }

  if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === 'your_refresh_token_secret_change_in_production') {
    issues.push('JWT_REFRESH_SECRET must be set to a secure value in production');
  }

  if (JWT_SECRET === JWT_REFRESH_SECRET) {
    issues.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (BCRYPT_SALT_ROUNDS < 10) {
    issues.push('BCRYPT_SALT_ROUNDS should be at least 10 for security');
  }

  if (issues.length > 0) {
    logger.warn('Authentication configuration issues detected', { issues });

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Authentication configuration is not secure for production');
    }
  }

  return issues.length === 0;
};

// Validate configuration on module load
try {
  validateAuthConfig();
  logger.info('Authentication configuration validated', {
    jwtExpiresIn: JWT_EXPIRES_IN,
    maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
    lockTime: LOCK_TIME
  });
} catch (error) {
  logger.error('Authentication configuration validation failed', { 
    error: error.message 
  });

  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

module.exports = {
  // Password functions
  hashPassword,
  comparePassword,
  validatePasswordStrength,

  // Token functions
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,

  // Account locking functions
  isAccountLocked,
  calculateLockExpiry,
  getLockTimeRemaining,

  // Utility functions
  createAdminUser,
  generateSecureRandomString,

  // Middleware
  authenticateToken,
  optionalAuthentication,

  // Configuration
  getAuthConfig,
  validateAuthConfig,

  // Constants
  maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
  lockTimeMs: LOCK_TIME_MS
};
