const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const { authenticateToken, optionalAuthentication } = require('../middleware/authMiddleware');
const { requireAdmin, logAdminAction } = require('../middleware/adminMiddleware');
const { validateCategory, validateUUID } = require('../middleware/validation');

/**
 * Category Routes
 * Base path: /api/categories
 */

// Public routes with optional authentication (for admin-specific features)
router.get('/', optionalAuthentication, categoryController.getCategories);
router.get('/:id', validateUUID(), categoryController.getCategoryById);

// Admin routes (require authentication and admin role)
router.post('/', 
  authenticateToken, 
  requireAdmin, 
  validateCategory, 
  logAdminAction('create_category', 'category'),
  categoryController.createCategory
);

router.put('/:id', 
  authenticateToken, 
  requireAdmin, 
  validateUUID(), 
  validateCategory, 
  logAdminAction('update_category', 'category'),
  categoryController.updateCategory
);

router.delete('/:id', 
  authenticateToken, 
  requireAdmin, 
  validateUUID(), 
  logAdminAction('delete_category', 'category'),
  categoryController.deleteCategory
);

module.exports = router;
