const productService = require('../services/productService');
const searchService = require('../services/searchService');
const logger = require('../utils/logger');

/**
 * Product Controller
 * Handles all product-related HTTP requests
 */
class ProductController {
  /**
   * Get all products with filtering and pagination
   * GET /api/products
   */
  async getProducts(req, res) {
    try {
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 50,
        sortBy: req.query.sort_by || 'created_at',
        sortOrder: req.query.sort_order || 'desc',
        brand_id: req.query.brand_id,
        category_id: req.query.category_id,
        is_featured: req.query.is_featured ? req.query.is_featured === 'true' : undefined,
        is_bestseller: req.query.is_bestseller ? req.query.is_bestseller === 'true' : undefined,
        in_stock: req.query.in_stock ? req.query.in_stock === 'true' : undefined
      };

      const result = await productService.getProducts(options);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to fetch products'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
        message: `Found ${result.data.length} products`
      });

    } catch (error) {
      logger.error('ProductController.getProducts error', { 
        error: error.message, 
        query: req.query 
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch products'
      });
    }
  }

  /**
   * Search products using advanced search algorithm
   * GET /api/products/search
   */
  async searchProducts(req, res) {
    try {
      const searchParams = {
        query: req.query.query || req.query.q,
        brand: req.query.brand,
        category: req.query.category,
        minPrice: parseFloat(req.query.min_price) || 0,
        maxPrice: req.query.max_price ? parseFloat(req.query.max_price) : undefined,
        inStock: req.query.in_stock === 'true',
        sortBy: req.query.sort_by || 'relevance',
        sortOrder: req.query.sort_order || 'desc',
        limit: Math.min(parseInt(req.query.limit) || 50, 100),
        offset: parseInt(req.query.offset) || 0
      };

      const result = await searchService.searchProducts(searchParams);

      res.status(200).json({
        status: 'success',
        data: result.results,
        metadata: result.metadata,
        message: `Found ${result.metadata.total} products`
      });

    } catch (error) {
      logger.error('ProductController.searchProducts error', { 
        error: error.message, 
        searchParams: req.query 
      });

      res.status(500).json({
        status: 'error',
        message: 'Search failed. Please try again.'
      });
    }
  }

  /**
   * Get search suggestions
   * GET /api/products/search/suggestions
   */
  async getSearchSuggestions(req, res) {
    try {
      const { query, limit = 10 } = req.query;

      const suggestions = await searchService.getSearchSuggestions(query, parseInt(limit));

      res.status(200).json({
        status: 'success',
        data: suggestions,
        message: `Found ${suggestions.length} suggestions`
      });

    } catch (error) {
      logger.error('ProductController.getSearchSuggestions error', { 
        error: error.message, 
        query: req.query.query 
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to get suggestions'
      });
    }
  }

  /**
   * Get popular search terms
   * GET /api/products/search/popular
   */
  async getPopularSearches(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const popularSearches = searchService.getPopularSearches(limit);

      res.status(200).json({
        status: 'success',
        data: popularSearches,
        message: `Found ${popularSearches.length} popular searches`
      });

    } catch (error) {
      logger.error('ProductController.getPopularSearches error', { error: error.message });

      res.status(500).json({
        status: 'error',
        message: 'Failed to get popular searches'
      });
    }
  }

  /**
   * Get search filters (categories, brands, price ranges)
   * GET /api/products/search/filters
   */
  async getSearchFilters(req, res) {
    try {
      const filters = await searchService.getSearchFilters();

      res.status(200).json({
        status: 'success',
        data: filters,
        message: 'Search filters retrieved successfully'
      });

    } catch (error) {
      logger.error('ProductController.getSearchFilters error', { error: error.message });

      res.status(500).json({
        status: 'error',
        message: 'Failed to get search filters'
      });
    }
  }

  /**
   * Get featured products
   * GET /api/products/featured
   */
  async getFeaturedProducts(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const result = await productService.getFeaturedProducts(limit);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to fetch featured products'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: `Found ${result.data.length} featured products`
      });

    } catch (error) {
      logger.error('ProductController.getFeaturedProducts error', { error: error.message });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch featured products'
      });
    }
  }

  /**
   * Get bestseller products
   * GET /api/products/bestsellers
   */
  async getBestsellerProducts(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const result = await productService.getBestsellerProducts(limit);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to fetch bestseller products'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: `Found ${result.data.length} bestseller products`
      });

    } catch (error) {
      logger.error('ProductController.getBestsellerProducts error', { error: error.message });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch bestseller products'
      });
    }
  }

  /**
   * Get new products
   * GET /api/products/new
   */
  async getNewProducts(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const result = await productService.getNewProducts(limit);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to fetch new products'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: `Found ${result.data.length} new products`
      });

    } catch (error) {
      logger.error('ProductController.getNewProducts error', { error: error.message });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch new products'
      });
    }
  }

  /**
   * Get single product by ID
   * GET /api/products/:id
   */
  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const result = await productService.getProductById(id);

      if (!result.success) {
        return res.status(404).json({
          status: 'error',
          message: result.message || 'Product not found'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Product retrieved successfully'
      });

    } catch (error) {
      logger.error('ProductController.getProductById error', { 
        error: error.message, 
        productId: req.params.id 
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch product'
      });
    }
  }

  /**
   * Get products by category
   * GET /api/products/category/:categoryId
   */
  async getProductsByCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 50,
        sortBy: req.query.sort_by || 'created_at',
        sortOrder: req.query.sort_order || 'desc'
      };

      const result = await productService.getProductsByCategory(categoryId, options);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to fetch products'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
        message: `Found ${result.data.length} products in category`
      });

    } catch (error) {
      logger.error('ProductController.getProductsByCategory error', { 
        error: error.message, 
        categoryId: req.params.categoryId 
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch products'
      });
    }
  }

  /**
   * Get products by brand
   * GET /api/products/brand/:brandId
   */
  async getProductsByBrand(req, res) {
    try {
      const { brandId } = req.params;
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 50,
        sortBy: req.query.sort_by || 'created_at',
        sortOrder: req.query.sort_order || 'desc'
      };

      const result = await productService.getProductsByBrand(brandId, options);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to fetch products'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
        message: `Found ${result.data.length} products by brand`
      });

    } catch (error) {
      logger.error('ProductController.getProductsByBrand error', { 
        error: error.message, 
        brandId: req.params.brandId 
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch products'
      });
    }
  }

  // ===============================
  // ADMIN-ONLY ENDPOINTS
  // ===============================

  /**
   * Create new product (Admin only)
   * POST /api/products
   */
  async createProduct(req, res) {
    try {
      const productData = req.body;
      const result = await productService.createProduct(productData);

      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          message: result.message || 'Failed to create product'
        });
      }

      logger.info('Product created via API', { 
        productId: result.data.id, 
        adminId: req.user.id 
      });

      res.status(201).json({
        status: 'success',
        data: result.data,
        message: result.message
      });

    } catch (error) {
      logger.error('ProductController.createProduct error', { 
        error: error.message, 
        productData: req.body,
        adminId: req.user?.id
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to create product'
      });
    }
  }

  /**
   * Update existing product (Admin only)
   * PUT /api/products/:id
   */
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await productService.updateProduct(id, updateData);

      if (!result.success) {
        return res.status(result.message === 'Product not found' ? 404 : 400).json({
          status: 'error',
          message: result.message || 'Failed to update product'
        });
      }

      logger.info('Product updated via API', { 
        productId: id, 
        adminId: req.user.id 
      });

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: result.message
      });

    } catch (error) {
      logger.error('ProductController.updateProduct error', { 
        error: error.message, 
        productId: req.params.id,
        updateData: req.body,
        adminId: req.user?.id
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to update product'
      });
    }
  }

  /**
   * Delete product (Admin only)
   * DELETE /api/products/:id
   */
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const result = await productService.deleteProduct(id);

      if (!result.success) {
        return res.status(result.message === 'Product not found' ? 404 : 400).json({
          status: 'error',
          message: result.message || 'Failed to delete product'
        });
      }

      logger.info('Product deleted via API', { 
        productId: id, 
        adminId: req.user.id 
      });

      res.status(200).json({
        status: 'success',
        message: result.message
      });

    } catch (error) {
      logger.error('ProductController.deleteProduct error', { 
        error: error.message, 
        productId: req.params.id,
        adminId: req.user?.id
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to delete product'
      });
    }
  }

  /**
   * Update product stock (Admin only)
   * PATCH /api/products/:id/stock
   */
  async updateProductStock(req, res) {
    try {
      const { id } = req.params;
      const { stock_quantity } = req.body;

      if (stock_quantity === undefined || stock_quantity === null) {
        return res.status(400).json({
          status: 'error',
          message: 'Stock quantity is required'
        });
      }

      const result = await productService.updateProductStock(id, stock_quantity);

      if (!result.success) {
        return res.status(result.message === 'Product not found' ? 404 : 400).json({
          status: 'error',
          message: result.message || 'Failed to update stock'
        });
      }

      logger.info('Product stock updated via API', { 
        productId: id, 
        newStock: stock_quantity,
        adminId: req.user.id 
      });

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Stock updated successfully'
      });

    } catch (error) {
      logger.error('ProductController.updateProductStock error', { 
        error: error.message, 
        productId: req.params.id,
        stock_quantity: req.body.stock_quantity,
        adminId: req.user?.id
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to update stock'
      });
    }
  }

  /**
   * Get product statistics (Admin only)
   * GET /api/products/admin/statistics
   */
  async getProductStatistics(req, res) {
    try {
      const result = await productService.getProductStatistics();

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch statistics'
        });
      }

      res.status(200).json({
        status: 'success',
        data: result.data,
        message: 'Statistics retrieved successfully'
      });

    } catch (error) {
      logger.error('ProductController.getProductStatistics error', { 
        error: error.message,
        adminId: req.user?.id
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch statistics'
      });
    }
  }
}

module.exports = new ProductController();
