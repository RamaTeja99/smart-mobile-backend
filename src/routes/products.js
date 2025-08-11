const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin, logAdminAction } = require('../middleware/adminMiddleware');
const { 
  validateProduct, 
  validateUUID, 
  validateProductSearch, 
  validatePagination 
} = require('../middleware/validation');

/**
 * Product Routes
 * Base path: /api/products
 */

// Public routes (no authentication required)
router.get('/', validatePagination, productController.getProducts);
router.get('/search', validateProductSearch, productController.searchProducts);
router.get('/search/suggestions', productController.getSearchSuggestions);
router.get('/search/popular', productController.getPopularSearches);
router.get('/search/filters', productController.getSearchFilters);
router.get('/featured', productController.getFeaturedProducts);
router.get('/bestsellers', productController.getBestsellerProducts);
router.get('/new', productController.getNewProducts);
router.get('/category/:categoryId', validateUUID('categoryId'), validatePagination, productController.getProductsByCategory);
router.get('/brand/:brandId', validateUUID('brandId'), validatePagination, productController.getProductsByBrand);
router.get('/:id', validateUUID(), productController.getProductById);

// Admin routes (require authentication and admin role)
router.post('/', 
  authenticateToken, 
  requireAdmin, 
  validateProduct, 
  logAdminAction('create_product', 'product'),
  productController.createProduct
);

router.put('/:id', 
  authenticateToken, 
  requireAdmin, 
  validateUUID(), 
  validateProduct, 
  logAdminAction('update_product', 'product'),
  productController.updateProduct
);

router.delete('/:id', 
  authenticateToken, 
  requireAdmin, 
  validateUUID(), 
  logAdminAction('delete_product', 'product'),
  productController.deleteProduct
);

router.patch('/:id/stock', 
  authenticateToken, 
  requireAdmin, 
  validateUUID(), 
  logAdminAction('update_product_stock', 'product'),
  productController.updateProductStock
);

router.get('/admin/statistics', 
  authenticateToken, 
  requireAdmin, 
  productController.getProductStatistics
);

module.exports = router;
