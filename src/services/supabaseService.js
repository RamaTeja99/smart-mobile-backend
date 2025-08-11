const { getSupabaseClient, getSupabaseAdmin } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Supabase Database Service
 * Handles all database operations with error handling and logging
 */
class SupabaseService {
  constructor() {
    this.client = getSupabaseClient();
    this.adminClient = getSupabaseAdmin();
  }

  /**
   * Execute database operation with error handling and logging
   * @param {Function} operation - Database operation function
   * @param {String} operationName - Name of the operation for logging
   * @returns {Object} Operation result
   */
  async executeOperation(operation, operationName) {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      logger.logDatabaseOperation(operationName, 'unknown', duration, true);

      if (result.error) {
        throw new Error(result.error.message);
      }

      return {
        success: true,
        data: result.data,
        count: result.count
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabaseOperation(operationName, 'unknown', duration, false, error);

      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  // ===============================
  // PRODUCT OPERATIONS
  // ===============================

  /**
   * Get all products with optional filtering and pagination
   */
  async getProducts(filters = {}, pagination = {}) {
    const {
      status = 'active',
      brand_id,
      category_id,
      is_featured,
      is_bestseller,
      in_stock
    } = filters;

    const {
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = pagination;

    const offset = (page - 1) * limit;

    return await this.executeOperation(async () => {
      let query = this.client
        .from('products')
        .select(`
          *,
          brand:brands(*),
          category:categories(*)
        `);

      // Apply filters
      if (status) query = query.eq('status', status);
      if (brand_id) query = query.eq('brand_id', brand_id);
      if (category_id) query = query.eq('category_id', category_id);
      if (is_featured !== undefined) query = query.eq('is_featured', is_featured);
      if (is_bestseller !== undefined) query = query.eq('is_bestseller', is_bestseller);
      if (in_stock) query = query.gt('stock_quantity', 0);

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      return await query;
    }, 'getProducts');
  }

  /**
   * Get product by ID
   */
  async getProductById(id) {
    return await this.executeOperation(async () => {
      return await this.client
        .from('products')
        .select(`
          *,
          brand:brands(*),
          category:categories(*)
        `)
        .eq('id', id)
        .single();
    }, 'getProductById');
  }

  /**
   * Create new product
   */
  async createProduct(productData) {
    return await this.executeOperation(async () => {
      // Generate slug from name
      if (!productData.slug && productData.name) {
        productData.slug = this.generateSlug(productData.name);
      }

      // Set timestamps
      productData.created_at = new Date().toISOString();
      productData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('products')
        .insert([productData])
        .select()
        .single();
    }, 'createProduct');
  }

  /**
   * Update product
   */
  async updateProduct(id, updateData) {
    return await this.executeOperation(async () => {
      updateData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    }, 'updateProduct');
  }

  /**
   * Delete product
   */
  async deleteProduct(id) {
    return await this.executeOperation(async () => {
      return await this.adminClient
        .from('products')
        .delete()
        .eq('id', id);
    }, 'deleteProduct');
  }

  /**
   * Search products using full-text search
   */
  async searchProducts(query, filters = {}) {
    return await this.executeOperation(async () => {
      let dbQuery = this.client
        .from('products')
        .select(`
          *,
          brand:brands(*),
          category:categories(*)
        `);

      // Full-text search
      if (query) {
        dbQuery = dbQuery.textSearch('fts', query);
      }

      // Apply filters
      if (filters.brand_id) dbQuery = dbQuery.eq('brand_id', filters.brand_id);
      if (filters.category_id) dbQuery = dbQuery.eq('category_id', filters.category_id);
      if (filters.status) dbQuery = dbQuery.eq('status', filters.status);

      return await dbQuery.order('created_at', { ascending: false });
    }, 'searchProducts');
  }

  // ===============================
  // CATEGORY OPERATIONS
  // ===============================

  /**
   * Get all categories
   */
  async getCategories(includeInactive = false) {
    return await this.executeOperation(async () => {
      let query = this.client
        .from('categories')
        .select('*');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      return await query.order('sort_order', { ascending: true });
    }, 'getCategories');
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id) {
    return await this.executeOperation(async () => {
      return await this.client
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();
    }, 'getCategoryById');
  }

  /**
   * Create category
   */
  async createCategory(categoryData) {
    return await this.executeOperation(async () => {
      if (!categoryData.slug && categoryData.name) {
        categoryData.slug = this.generateSlug(categoryData.name);
      }

      categoryData.created_at = new Date().toISOString();
      categoryData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('categories')
        .insert([categoryData])
        .select()
        .single();
    }, 'createCategory');
  }

  /**
   * Update category
   */
  async updateCategory(id, updateData) {
    return await this.executeOperation(async () => {
      updateData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    }, 'updateCategory');
  }

  /**
   * Delete category
   */
  async deleteCategory(id) {
    return await this.executeOperation(async () => {
      return await this.adminClient
        .from('categories')
        .delete()
        .eq('id', id);
    }, 'deleteCategory');
  }

  // ===============================
  // BRAND OPERATIONS
  // ===============================

  /**
   * Get all brands
   */
  async getBrands(includeInactive = false) {
    return await this.executeOperation(async () => {
      let query = this.client
        .from('brands')
        .select('*');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      return await query.order('sort_order', { ascending: true });
    }, 'getBrands');
  }

  /**
   * Get brand by ID
   */
  async getBrandById(id) {
    return await this.executeOperation(async () => {
      return await this.client
        .from('brands')
        .select('*')
        .eq('id', id)
        .single();
    }, 'getBrandById');
  }

  /**
   * Create brand
   */
  async createBrand(brandData) {
    return await this.executeOperation(async () => {
      if (!brandData.slug && brandData.name) {
        brandData.slug = this.generateSlug(brandData.name);
      }

      brandData.created_at = new Date().toISOString();
      brandData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('brands')
        .insert([brandData])
        .select()
        .single();
    }, 'createBrand');
  }

  /**
   * Update brand
   */
  async updateBrand(id, updateData) {
    return await this.executeOperation(async () => {
      updateData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('brands')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    }, 'updateBrand');
  }

  /**
   * Delete brand
   */
  async deleteBrand(id) {
    return await this.executeOperation(async () => {
      return await this.adminClient
        .from('brands')
        .delete()
        .eq('id', id);
    }, 'deleteBrand');
  }

  // ===============================
  // ADMIN OPERATIONS
  // ===============================

  /**
   * Get admin by email
   */
  async getAdminByEmail(email) {
    return await this.executeOperation(async () => {
      return await this.adminClient
        .from('admins')
        .select('*')
        .eq('email', email)
        .single();
    }, 'getAdminByEmail');
  }

  /**
   * Get admin by ID
   */
  async getAdminById(id) {
    return await this.executeOperation(async () => {
      return await this.adminClient
        .from('admins')
        .select('*')
        .eq('id', id)
        .single();
    }, 'getAdminById');
  }

  /**
   * Create admin
   */
  async createAdmin(adminData) {
    return await this.executeOperation(async () => {
      adminData.created_at = new Date().toISOString();
      adminData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('admins')
        .insert([adminData])
        .select()
        .single();
    }, 'createAdmin');
  }

  /**
   * Update admin
   */
  async updateAdmin(id, updateData) {
    return await this.executeOperation(async () => {
      updateData.updated_at = new Date().toISOString();

      return await this.adminClient
        .from('admins')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    }, 'updateAdmin');
  }

  /**
   * Update admin login attempts
   */
  async updateAdminLoginAttempts(id, attempts, lockedUntil = null) {
    return await this.executeOperation(async () => {
      const updateData = {
        login_attempts: attempts,
        updated_at: new Date().toISOString()
      };

      if (lockedUntil) {
        updateData.locked_until = lockedUntil.toISOString();
      }

      return await this.adminClient
        .from('admins')
        .update(updateData)
        .eq('id', id);
    }, 'updateAdminLoginAttempts');
  }

  /**
   * Reset admin login attempts
   */
  async resetAdminLoginAttempts(id) {
    return await this.executeOperation(async () => {
      return await this.adminClient
        .from('admins')
        .update({
          login_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    }, 'resetAdminLoginAttempts');
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Generate URL-friendly slug from text
   */
  generateSlug(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Get database statistics
   */
  async getStatistics() {
    return await this.executeOperation(async () => {
      const [products, categories, brands] = await Promise.all([
        this.client.from('products').select('*', { count: 'exact', head: true }),
        this.client.from('categories').select('*', { count: 'exact', head: true }),
        this.client.from('brands').select('*', { count: 'exact', head: true })
      ]);

      return {
        data: {
          total_products: products.count,
          total_categories: categories.count,
          total_brands: brands.count
        }
      };
    }, 'getStatistics');
  }

  /**
   * Health check
   */
  async healthCheck() {
    return await this.executeOperation(async () => {
      return await this.client
        .from('health_check')
        .select('*')
        .limit(1);
    }, 'healthCheck');
  }
}

module.exports = new SupabaseService();
