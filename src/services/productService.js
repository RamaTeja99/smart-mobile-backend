const supabaseService = require('./supabaseService');
const logger = require('../utils/logger');

/**
 * Product Service
 * Handles business logic for product operations
 */
class ProductService {
  constructor() {
    this.defaultImageUrl = '/images/placeholder-product.jpg';
  }

  /**
   * Get all products with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Products with pagination metadata
   */
  async getProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc',
        status = 'active',
        brand_id,
        category_id,
        is_featured,
        is_bestseller,
        in_stock
      } = options;

      const filters = {
        status,
        brand_id,
        category_id,
        is_featured,
        is_bestseller,
        in_stock
      };

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // Max 100 items per page
        sortBy,
        sortOrder
      };

      const result = await supabaseService.getProducts(filters, pagination);

      if (!result.success) {
        throw new Error('Failed to fetch products');
      }

      // Process products for display
      const processedProducts = result.data.map(product => this.processProductForDisplay(product));

      return {
        success: true,
        data: processedProducts,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: result.count || processedProducts.length,
          totalPages: Math.ceil((result.count || processedProducts.length) / pagination.limit)
        }
      };

    } catch (error) {
      logger.error('ProductService.getProducts error', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Get featured products
   * @param {Number} limit - Maximum number of products to return
   * @returns {Object} Featured products
   */
  async getFeaturedProducts(limit = 10) {
    try {
      const options = {
        page: 1,
        limit,
        is_featured: true,
        status: 'active',
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      return await this.getProducts(options);

    } catch (error) {
      logger.error('ProductService.getFeaturedProducts error', { error: error.message, limit });
      throw error;
    }
  }

  /**
   * Get bestseller products
   * @param {Number} limit - Maximum number of products to return
   * @returns {Object} Bestseller products
   */
  async getBestsellerProducts(limit = 10) {
    try {
      const options = {
        page: 1,
        limit,
        is_bestseller: true,
        status: 'active',
        sortBy: 'average_rating',
        sortOrder: 'desc'
      };

      return await this.getProducts(options);

    } catch (error) {
      logger.error('ProductService.getBestsellerProducts error', { error: error.message, limit });
      throw error;
    }
  }

  /**
   * Get new products
   * @param {Number} limit - Maximum number of products to return
   * @returns {Object} New products
   */
  async getNewProducts(limit = 10) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const options = {
        page: 1,
        limit,
        status: 'active',
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      const result = await this.getProducts(options);

      if (result.success) {
        // Filter products created in the last 30 days
        result.data = result.data.filter(product => 
          new Date(product.created_at) >= thirtyDaysAgo
        );
      }

      return result;

    } catch (error) {
      logger.error('ProductService.getNewProducts error', { error: error.message, limit });
      throw error;
    }
  }

  /**
   * Get product by ID
   * @param {String} id - Product ID
   * @returns {Object} Product details
   */
  async getProductById(id) {
    try {
      const result = await supabaseService.getProductById(id);

      if (!result.success || !result.data) {
        return {
          success: false,
          message: 'Product not found'
        };
      }

      const processedProduct = this.processProductForDisplay(result.data);

      return {
        success: true,
        data: processedProduct
      };

    } catch (error) {
      logger.error('ProductService.getProductById error', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Get products by category
   * @param {String} categoryId - Category ID
   * @param {Object} options - Query options
   * @returns {Object} Products in category
   */
  async getProductsByCategory(categoryId, options = {}) {
    try {
      const updatedOptions = {
        ...options,
        category_id: categoryId,
        status: 'active'
      };

      return await this.getProducts(updatedOptions);

    } catch (error) {
      logger.error('ProductService.getProductsByCategory error', { 
        error: error.message, 
        categoryId, 
        options 
      });
      throw error;
    }
  }

  /**
   * Get products by brand
   * @param {String} brandId - Brand ID
   * @param {Object} options - Query options
   * @returns {Object} Products by brand
   */
  async getProductsByBrand(brandId, options = {}) {
    try {
      const updatedOptions = {
        ...options,
        brand_id: brandId,
        status: 'active'
      };

      return await this.getProducts(updatedOptions);

    } catch (error) {
      logger.error('ProductService.getProductsByBrand error', { 
        error: error.message, 
        brandId, 
        options 
      });
      throw error;
    }
  }

  /**
   * Create new product (Admin only)
   * @param {Object} productData - Product data
   * @returns {Object} Created product
   */
  async createProduct(productData) {
    try {
      // Validate required fields
      this.validateProductData(productData);

      // Process product data
      const processedData = await this.preprocessProductData(productData);

      const result = await supabaseService.createProduct(processedData);

      if (!result.success) {
        throw new Error('Failed to create product');
      }

      logger.info('Product created', { productId: result.data.id });

      return {
        success: true,
        data: this.processProductForDisplay(result.data),
        message: 'Product created successfully'
      };

    } catch (error) {
      logger.error('ProductService.createProduct error', { error: error.message, productData });
      throw error;
    }
  }

  /**
   * Update existing product (Admin only)
   * @param {String} id - Product ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated product
   */
  async updateProduct(id, updateData) {
    try {
      // Check if product exists
      const existingProduct = await supabaseService.getProductById(id);
      if (!existingProduct.success || !existingProduct.data) {
        return {
          success: false,
          message: 'Product not found'
        };
      }

      // Process update data
      const processedData = await this.preprocessProductData(updateData, true);

      const result = await supabaseService.updateProduct(id, processedData);

      if (!result.success) {
        throw new Error('Failed to update product');
      }

      logger.info('Product updated', { productId: id });

      return {
        success: true,
        data: this.processProductForDisplay(result.data),
        message: 'Product updated successfully'
      };

    } catch (error) {
      logger.error('ProductService.updateProduct error', { error: error.message, id, updateData });
      throw error;
    }
  }

  /**
   * Delete product (Admin only)
   * @param {String} id - Product ID
   * @returns {Object} Deletion result
   */
  async deleteProduct(id) {
    try {
      // Check if product exists
      const existingProduct = await supabaseService.getProductById(id);
      if (!existingProduct.success || !existingProduct.data) {
        return {
          success: false,
          message: 'Product not found'
        };
      }

      const result = await supabaseService.deleteProduct(id);

      if (!result.success) {
        throw new Error('Failed to delete product');
      }

      logger.info('Product deleted', { productId: id });

      return {
        success: true,
        message: 'Product deleted successfully'
      };

    } catch (error) {
      logger.error('ProductService.deleteProduct error', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Update product stock (Admin only)
   * @param {String} id - Product ID
   * @param {Number} quantity - New stock quantity
   * @returns {Object} Update result
   */
  async updateProductStock(id, quantity) {
    try {
      const updateData = {
        stock_quantity: Math.max(0, parseInt(quantity)),
        updated_at: new Date().toISOString()
      };

      // Update status based on stock
      if (updateData.stock_quantity === 0) {
        updateData.status = 'out_of_stock';
      } else if (updateData.stock_quantity > 0) {
        updateData.status = 'active';
      }

      return await this.updateProduct(id, updateData);

    } catch (error) {
      logger.error('ProductService.updateProductStock error', { error: error.message, id, quantity });
      throw error;
    }
  }

  /**
   * Process product data before saving
   * @param {Object} data - Raw product data
   * @param {Boolean} isUpdate - Whether this is an update operation
   * @returns {Object} Processed data
   */
  async preprocessProductData(data, isUpdate = false) {
    const processed = { ...data };

    // Generate slug if not provided and name is available
    if (processed.name && !processed.slug) {
      processed.slug = this.generateSlug(processed.name);
    }

    // Process specifications if provided as string
    if (processed.specifications && typeof processed.specifications === 'string') {
      try {
        processed.specifications = JSON.parse(processed.specifications);
      } catch (error) {
        logger.warn('Invalid specifications JSON', { specifications: processed.specifications });
        processed.specifications = {};
      }
    }

    // Ensure specifications is an object
    if (!processed.specifications) {
      processed.specifications = {};
    }

    // Process images array
    if (processed.images && !Array.isArray(processed.images)) {
      processed.images = [];
    }

    // Set featured image from first image if not provided
    if (!processed.featured_image && processed.images && processed.images.length > 0) {
      processed.featured_image = processed.images[0];
    }

    // Convert numeric strings to numbers
    if (processed.price) processed.price = parseFloat(processed.price);
    if (processed.original_price) processed.original_price = parseFloat(processed.original_price);
    if (processed.stock_quantity) processed.stock_quantity = parseInt(processed.stock_quantity);

    // Set publish date for new products
    if (!isUpdate && !processed.published_at) {
      processed.published_at = new Date().toISOString();
    }

    return processed;
  }

  /**
   * Validate product data
   * @param {Object} data - Product data to validate
   */
  validateProductData(data) {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Product name is required');
    }

    if (data.price === undefined || data.price === null || data.price < 0) {
      throw new Error('Product price is required and must be non-negative');
    }
  }

  /**
   * Process product for display (add computed fields)
   * @param {Object} product - Raw product from database
   * @returns {Object} Processed product
   */
  processProductForDisplay(product) {
    const processed = { ...product };

    // Add computed fields
    processed.in_stock = processed.stock_quantity > 0;
    processed.stock_status = this.getStockStatus(processed.stock_quantity);
    processed.price_display = this.formatPrice(processed.price);
    processed.discount_amount = processed.original_price ? 
      (parseFloat(processed.original_price) - parseFloat(processed.price)).toFixed(2) : 0;
    processed.savings_percentage = processed.original_price && processed.original_price > processed.price ?
      Math.round(((processed.original_price - processed.price) / processed.original_price) * 100) : 0;

    // Ensure images array exists
    if (!processed.images || !Array.isArray(processed.images)) {
      processed.images = [];
    }

    // Add default image if no images
    if (processed.images.length === 0) {
      processed.images = [this.defaultImageUrl];
    }

    // Ensure featured image exists
    if (!processed.featured_image) {
      processed.featured_image = processed.images[0] || this.defaultImageUrl;
    }

    // Process rating display
    processed.rating_display = this.formatRating(processed.average_rating);

    return processed;
  }

  /**
   * Get stock status text
   * @param {Number} quantity - Stock quantity
   * @returns {String} Stock status
   */
  getStockStatus(quantity) {
    if (quantity <= 0) return 'Out of Stock';
    if (quantity <= 5) return 'Low Stock';
    if (quantity <= 20) return 'Limited Stock';
    return 'In Stock';
  }

  /**
   * Format price for display
   * @param {Number|String} price - Price value
   * @returns {String} Formatted price
   */
  formatPrice(price) {
    const numPrice = parseFloat(price) || 0;
    return `$${numPrice.toFixed(2)}`;
  }

  /**
   * Format rating for display
   * @param {Number|String} rating - Rating value
   * @returns {Number} Formatted rating
   */
  formatRating(rating) {
    const numRating = parseFloat(rating) || 0;
    return Math.round(numRating * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Generate URL-friendly slug
   * @param {String} text - Text to slugify
   * @returns {String} Slug
   */
  generateSlug(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get product statistics (Admin only)
   * @returns {Object} Product statistics
   */
  async getProductStatistics() {
    try {
      const result = await supabaseService.getStatistics();

      if (!result.success) {
        throw new Error('Failed to fetch statistics');
      }

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      logger.error('ProductService.getProductStatistics error', { error: error.message });
      throw error;
    }
  }
}

module.exports = new ProductService();
