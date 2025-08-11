const express = require('express');
const router = express.Router();

const brandController = require('../controllers/brandController');
const { authenticateToken, optionalAuthentication } = require('../middleware/authMiddleware');
const { requireAdmin, logAdminAction } = require('../middleware/adminMiddleware');
const { validateBrand, validateUUID } = require('../middleware/validation');

/**
 * Brand Routes
 * Base path: /api/brands
 */

// Public routes with optional authentication (for admin-specific features)
router.get('/', optionalAuthentication, brandController.getBrands);
router.get('/:id', validateUUID(), brandController.getBrandById);

// Admin routes (require authentication and admin role)
router.post('/', 
  authenticateToken, 
  requireAdmin, 
  validateBrand, 
  logAdminAction('create_brand', 'brand'),
  brandController.createBrand
);

router.put('/:id', 
  authenticateToken, 
  requireAdmin, 
  validateUUID(), 
  validateBrand, 
  logAdminAction('update_brand', 'brand'),
  brandController.updateBrand
);

router.delete('/:id', 
  authenticateToken, 
  requireAdmin, 
  validateUUID(), 
  logAdminAction('delete_brand', 'brand'),
  brandController.deleteBrand
);

module.exports = router;
