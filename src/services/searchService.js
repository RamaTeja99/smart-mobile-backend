const SearchAlgorithm = require('../utils/searchAlgorithm');
const supabaseService = require('./supabaseService');
const logger = require('../utils/logger');

/**
 * Product Search Service
 * Integrates advanced search algorithms with database operations
 */
class SearchService {
  constructor() {
    this.searchAlgorithm = new SearchAlgorithm();
    this.searchCache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Main product search function
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Search results with metadata
   */
  async searchProducts(searchParams) {
    const startTime = Date.now();

    try {
      logger.debug('Product search initiated', searchParams);

      // Generate cache key
      const cacheKey = this.generateCacheKey(searchParams);

      // Check cache first
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        logger.info('Search result served from cache', { cacheKey });
        return cachedResult;
      }

      // Step 1: Get products from database with basic filters
      const products = await this.getProductsForSearch(searchParams);

      if (!products || products.length === 0) {
        const emptyResult = {
          results: [],
          metadata: {
            total: 0,
            limit: searchParams.limit || 50,
            offset: searchParams.offset || 0,
            hasNext: false,
            hasPrev: false,
            duration: Date.now() - startTime,
            query: searchParams.query || '',
            filters: this.extractFilters(searchParams)
          }
        };

        this.setCache(cacheKey, emptyResult);
        return emptyResult;
      }

      // Step 2: Apply advanced search algorithm
      const searchResult = await this.searchAlgorithm.search(products, searchParams);

      // Step 3: Enhance results with additional data
      const enhancedResult = await this.enhanceSearchResults(searchResult);

      // Step 4: Cache the result
      this.setCache(cacheKey, enhancedResult);

      const duration = Date.now() - startTime;
      logger.info('Product search completed', {
        query: searchParams.query,
        totalResults: enhancedResult.metadata.total,
        duration: `${duration}ms`,
        fromCache: false
      });

      return enhancedResult;

    } catch (error) {
      logger.error('Product search failed', {
        error: error.message,
        searchParams,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Get products from database for search
   * @param {Object} searchParams - Search parameters
   * @returns {Array} Products array
   */
  async getProductsForSearch(searchParams) {
    const filters = {
      status: 'active', // Only search active products
      brand_id: searchParams.brand ? await this.getBrandIdBySlug(searchParams.brand) : null,
      category_id: searchParams.category ? await this.getCategoryIdBySlug(searchParams.category) : null
    };

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null || filters[key] === undefined) {
        delete filters[key];
      }
    });

    // Get products with a higher limit for better search results
    const pagination = {
      page: 1,
      limit: 1000, // Get more products for comprehensive search
      sortBy: 'created_at',
      sortOrder: 'desc'
    };

    const result = await supabaseService.getProducts(filters, pagination);

    if (!result.success) {
      throw new Error('Failed to fetch products for search');
    }

    return result.data || [];
  }

  /**
   * Enhance search results with additional processing
   * @param {Object} searchResult - Search result from algorithm
   * @returns {Object} Enhanced search result
   */
  async enhanceSearchResults(searchResult) {
    // Add stock status to each product
    const enhancedResults = searchResult.results.map(product => ({
      ...product,
      in_stock: product.stock_quantity > 0,
      stock_status: this.getStockStatus(product.stock_quantity),
      price_display: this.formatPrice(product.price),
      discount_amount: product.original_price ? 
        (parseFloat(product.original_price) - parseFloat(product.price)).toFixed(2) : 0
    }));

    return {
      ...searchResult,
      results: enhancedResults
    };
  }

  /**
   * Get search suggestions
   * @param {String} query - Partial search query
   * @param {Number} limit - Maximum number of suggestions
   * @returns {Array} Search suggestions
   */
  async getSearchSuggestions(query, limit = 10) {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      // Get popular searches
      const popularSearches = this.searchAlgorithm.getPopularSearches(5);

      // Get product-based suggestions
      const products = await this.getProductsForSearch({ query });
      const productSuggestions = this.searchAlgorithm.getSuggestions(query, products);

      // Combine and deduplicate
      const allSuggestions = [
        ...popularSearches.filter(item => 
          item.query.toLowerCase().includes(query.toLowerCase())
        ).map(item => item.query),
        ...productSuggestions
      ];

      // Remove duplicates and limit
      const uniqueSuggestions = [...new Set(allSuggestions)];

      return uniqueSuggestions.slice(0, limit);

    } catch (error) {
      logger.error('Search suggestions failed', { error: error.message, query });
      return [];
    }
  }

  /**
   * Get popular search terms
   * @param {Number} limit - Number of popular terms to return
   * @returns {Array} Popular search terms
   */
  getPopularSearches(limit = 10) {
    return this.searchAlgorithm.getPopularSearches(limit);
  }

  /**
   * Get search filters (categories and brands)
   * @returns {Object} Available filters
   */
  async getSearchFilters() {
    try {
      const [categoriesResult, brandsResult] = await Promise.all([
        supabaseService.getCategories(false),
        supabaseService.getBrands(false)
      ]);

      return {
        categories: categoriesResult.success ? categoriesResult.data : [],
        brands: brandsResult.success ? brandsResult.data : [],
        priceRanges: [
          { label: 'Under $100', min: 0, max: 100 },
          { label: '$100 - $500', min: 100, max: 500 },
          { label: '$500 - $1000', min: 500, max: 1000 },
          { label: '$1000 - $1500', min: 1000, max: 1500 },
          { label: 'Over $1500', min: 1500, max: null }
        ]
      };
    } catch (error) {
      logger.error('Failed to get search filters', { error: error.message });
      return { categories: [], brands: [], priceRanges: [] };
    }
  }

  /**
   * Get brand ID by slug
   * @param {String} slug - Brand slug
   * @returns {String|null} Brand ID
   */
  async getBrandIdBySlug(slug) {
    try {
      const brandsResult = await supabaseService.getBrands(false);
      if (brandsResult.success) {
        const brand = brandsResult.data.find(b => b.slug === slug);
        return brand ? brand.id : null;
      }
    } catch (error) {
      logger.warn('Failed to get brand ID by slug', { error: error.message, slug });
    }
    return null;
  }

  /**
   * Get category ID by slug
   * @param {String} slug - Category slug
   * @returns {String|null} Category ID
   */
  async getCategoryIdBySlug(slug) {
    try {
      const categoriesResult = await supabaseService.getCategories(false);
      if (categoriesResult.success) {
        const category = categoriesResult.data.find(c => c.slug === slug);
        return category ? category.id : null;
      }
    } catch (error) {
      logger.warn('Failed to get category ID by slug', { error: error.message, slug });
    }
    return null;
  }

  /**
   * Get stock status text
   * @param {Number} quantity - Stock quantity
   * @returns {String} Stock status
   */
  getStockStatus(quantity) {
    if (quantity <= 0) return 'out_of_stock';
    if (quantity <= 5) return 'low_stock';
    if (quantity <= 20) return 'medium_stock';
    return 'in_stock';
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
   * Extract filters from search parameters
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Extracted filters
   */
  extractFilters(searchParams) {
    const {
      brand,
      category,
      minPrice,
      maxPrice,
      inStock
    } = searchParams;

    return {
      brand: brand || null,
      category: category || null,
      minPrice: minPrice || 0,
      maxPrice: maxPrice || null,
      inStock: inStock || false
    };
  }

  // ===============================
  // CACHE MANAGEMENT
  // ===============================

  /**
   * Generate cache key from search parameters
   * @param {Object} searchParams - Search parameters
   * @returns {String} Cache key
   */
  generateCacheKey(searchParams) {
    const keyData = {
      query: searchParams.query || '',
      brand: searchParams.brand || '',
      category: searchParams.category || '',
      minPrice: searchParams.minPrice || 0,
      maxPrice: searchParams.maxPrice || '',
      inStock: searchParams.inStock || false,
      sortBy: searchParams.sortBy || 'relevance',
      sortOrder: searchParams.sortOrder || 'desc',
      limit: searchParams.limit || 50,
      offset: searchParams.offset || 0
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Get result from cache
   * @param {String} key - Cache key
   * @returns {Object|null} Cached result
   */
  getFromCache(key) {
    const cached = this.searchCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    if (Date.now() > cached.expiry) {
      this.searchCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set result in cache
   * @param {String} key - Cache key
   * @param {Object} data - Data to cache
   */
  setCache(key, data) {
    // Clean old entries if cache is getting too large
    if (this.searchCache.size > 100) {
      this.clearExpiredCache();
    }

    this.searchCache.set(key, {
      data,
      expiry: Date.now() + this.cacheExpiry
    });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();

    for (const [key, value] of this.searchCache.entries()) {
      if (now > value.expiry) {
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.searchCache.clear();
    logger.info('Search cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const totalEntries = this.searchCache.size;
    let expiredEntries = 0;
    const now = Date.now();

    for (const [key, value] of this.searchCache.entries()) {
      if (now > value.expiry) {
        expiredEntries++;
      }
    }

    return {
      totalEntries,
      activeEntries: totalEntries - expiredEntries,
      expiredEntries,
      cacheExpiry: this.cacheExpiry
    };
  }
}

module.exports = new SearchService();
