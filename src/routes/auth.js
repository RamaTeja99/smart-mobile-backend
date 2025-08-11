const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateAdminLogin, validatePasswordChange, validateAdminProfileUpdate } = require('../middleware/validation');

/**
 * Authentication Routes
 * Base path: /api/auth
 */

// Public routes
router.post('/login', validateAdminLogin, authController.login);
router.post('/refresh', authController.refreshToken);

// Protected routes (require authentication)
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, validateAdminProfileUpdate, authController.updateProfile);
router.post('/change-password', authenticateToken, validatePasswordChange, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);
router.get('/verify', authenticateToken, authController.verifyToken);

module.exports = router;
