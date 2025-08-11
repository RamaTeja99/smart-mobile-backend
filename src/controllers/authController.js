const authConfig = require('../config/auth');
const supabaseService = require('../services/supabaseService');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles admin authentication and authorization
 */
class AuthController {
  /**
   * Admin login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      logger.info('Admin login attempt', { 
        email: email.replace(/(.{3}).*(@.*)/, '$1***$2'), // Mask email for privacy
        ip: req.ip 
      });

      // Get admin by email
      const adminResult = await supabaseService.getAdminByEmail(email);

      if (!adminResult.success || !adminResult.data) {
        logger.warn('Admin login failed - user not found', { email });
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      const admin = adminResult.data;

      // Check if account is active
      if (!admin.is_active) {
        logger.warn('Admin login failed - account deactivated', { email, adminId: admin.id });
        return res.status(401).json({
          status: 'error',
          message: 'Account has been deactivated'
        });
      }

      // Check if account is locked
      if (authConfig.isAccountLocked(admin)) {
        logger.warn('Admin login failed - account locked', { email, adminId: admin.id });
        return res.status(423).json({
          status: 'error',
          message: 'Account temporarily locked due to too many failed attempts'
        });
      }

      // Verify password
      const passwordValid = await authConfig.comparePassword(password, admin.password);

      if (!passwordValid) {
        // Increment login attempts
        const newAttempts = (admin.login_attempts || 0) + 1;
        let lockedUntil = null;

        if (newAttempts >= authConfig.maxLoginAttempts) {
          lockedUntil = authConfig.calculateLockExpiry();
        }

        await supabaseService.updateAdminLoginAttempts(admin.id, newAttempts, lockedUntil);

        logger.warn('Admin login failed - invalid password', { 
          email, 
          adminId: admin.id, 
          attempts: newAttempts 
        });

        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Reset login attempts on successful login
      await supabaseService.resetAdminLoginAttempts(admin.id);

      // Generate tokens
      const tokenPair = authConfig.generateTokenPair(admin);

      logger.info('Admin login successful', { 
        adminId: admin.id, 
        email: admin.email,
        ip: req.ip 
      });

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          admin: {
            id: admin.id,
            email: admin.email,
            first_name: admin.first_name,
            last_name: admin.last_name,
            role: admin.role,
            avatar_url: admin.avatar_url
          },
          tokens: tokenPair
        }
      });

    } catch (error) {
      logger.error('Admin login error', { error: error.message, email: req.body.email });
      res.status(500).json({
        status: 'error',
        message: 'Login failed. Please try again.'
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = authConfig.verifyRefreshToken(refreshToken);

      // Get admin to verify token is still valid
      const adminResult = await supabaseService.getAdminById(decoded.id);

      if (!adminResult.success || !adminResult.data) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token'
        });
      }

      const admin = adminResult.data;

      // Check if account is still active
      if (!admin.is_active) {
        return res.status(401).json({
          status: 'error',
          message: 'Account has been deactivated'
        });
      }

      // Generate new token pair
      const tokenPair = authConfig.generateTokenPair(admin);

      logger.info('Token refreshed', { adminId: admin.id });

      res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: {
          tokens: tokenPair
        }
      });

    } catch (error) {
      logger.error('Token refresh error', { error: error.message });
      res.status(401).json({
        status: 'error',
        message: 'Invalid refresh token'
      });
    }
  }

  /**
   * Get current admin profile
   */
  async getProfile(req, res) {
    try {
      const adminId = req.user.id;

      const adminResult = await supabaseService.getAdminById(adminId);

      if (!adminResult.success || !adminResult.data) {
        return res.status(404).json({
          status: 'error',
          message: 'Admin not found'
        });
      }

      const admin = adminResult.data;

      // Remove sensitive information
      delete admin.password;
      delete admin.login_attempts;
      delete admin.locked_until;

      res.status(200).json({
        status: 'success',
        data: admin
      });

    } catch (error) {
      logger.error('Get admin profile error', { error: error.message, adminId: req.user?.id });
      res.status(500).json({
        status: 'error',
        message: 'Failed to get profile'
      });
    }
  }

  /**
   * Update admin profile
   */
  async updateProfile(req, res) {
    try {
      const adminId = req.user.id;
      const updateData = req.body;

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updateData.password;
      delete updateData.role;
      delete updateData.is_active;
      delete updateData.login_attempts;
      delete updateData.locked_until;

      const result = await supabaseService.updateAdmin(adminId, updateData);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to update profile'
        });
      }

      // Remove sensitive information from response
      const admin = result.data;
      delete admin.password;
      delete admin.login_attempts;
      delete admin.locked_until;

      logger.info('Admin profile updated', { adminId });

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: admin
      });

    } catch (error) {
      logger.error('Update admin profile error', { error: error.message, adminId: req.user?.id });
      res.status(500).json({
        status: 'error',
        message: 'Failed to update profile'
      });
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res) {
    try {
      const adminId = req.user.id;
      const { current_password, new_password } = req.body;

      // Get current admin data
      const adminResult = await supabaseService.getAdminById(adminId);

      if (!adminResult.success || !adminResult.data) {
        return res.status(404).json({
          status: 'error',
          message: 'Admin not found'
        });
      }

      const admin = adminResult.data;

      // Verify current password
      const passwordValid = await authConfig.comparePassword(current_password, admin.password);

      if (!passwordValid) {
        logger.warn('Password change failed - invalid current password', { adminId });
        return res.status(400).json({
          status: 'error',
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedPassword = await authConfig.hashPassword(new_password);

      // Update password
      const updateData = {
        password: hashedPassword,
        password_changed_at: new Date().toISOString()
      };

      const result = await supabaseService.updateAdmin(adminId, updateData);

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to change password'
        });
      }

      logger.info('Admin password changed', { adminId });

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error', { error: error.message, adminId: req.user?.id });
      res.status(500).json({
        status: 'error',
        message: 'Failed to change password'
      });
    }
  }

  /**
   * Admin logout (optional - mainly for logging)
   */
  async logout(req, res) {
    try {
      const adminId = req.user?.id;

      if (adminId) {
        logger.info('Admin logout', { adminId });
      }

      res.status(200).json({
        status: 'success',
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Admin logout error', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Logout failed'
      });
    }
  }

  /**
   * Verify token (for frontend to check if token is still valid)
   */
  async verifyToken(req, res) {
    try {
      // If we reach here, the token is valid (middleware verified it)
      res.status(200).json({
        status: 'success',
        message: 'Token is valid',
        data: {
          admin: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role
          }
        }
      });

    } catch (error) {
      logger.error('Token verification error', { error: error.message });
      res.status(401).json({
        status: 'error',
        message: 'Invalid token'
      });
    }
  }
}

module.exports = new AuthController();
