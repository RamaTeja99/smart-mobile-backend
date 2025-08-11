const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

let supabaseClient = null;
let supabaseAdmin = null;

/**
 * Initialize Supabase client for regular operations
 */
const createSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_ANON_KEY.');
    }

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      }
    });

    logger.info('✅ Supabase client initialized');
  }

  return supabaseClient;
};

/**
 * Initialize Supabase admin client for administrative operations
 */
const createSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase admin configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    logger.info('✅ Supabase admin client initialized');
  }

  return supabaseAdmin;
};

/**
 * Test database connection
 */
const connectDatabase = async () => {
  try {
    const client = createSupabaseClient();

    // Test connection by querying a simple table or creating one if it doesn't exist
    const { data, error } = await client
      .from('health_check')
      .select('*')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, which is fine for first run
      logger.info('📊 Database connection successful (tables will be created)');
      return true;
    } else if (error) {
      throw error;
    }

    logger.info('📊 Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

/**
 * Initialize database tables and default data
 */
const initializeDatabase = async () => {
  try {
    const adminClient = createSupabaseAdmin();

    // Check if tables exist by trying to query them
    const tables = ['categories', 'brands', 'products', 'admins'];
    const tableChecks = await Promise.all(
      tables.map(async (table) => {
        const { data, error } = await adminClient
          .from(table)
          .select('*')
          .limit(1);
        return { table, exists: !error || error.code !== 'PGRST116' };
      })
    );

    const missingTables = tableChecks
      .filter(check => !check.exists)
      .map(check => check.table);

    if (missingTables.length > 0) {
      logger.warn(`⚠️  Some tables are missing: ${missingTables.join(', ')}`);
      logger.info('Please run the SQL migration script in Supabase dashboard');
    } else {
      logger.info('✅ All database tables exist');
    }

    // Initialize default admin user if not exists
    await initializeDefaultAdmin();

    // Initialize default categories and brands
    await initializeDefaultData();

    return true;
  } catch (error) {
    logger.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

/**
 * Initialize default admin user
 */
const initializeDefaultAdmin = async () => {
  try {
    const adminClient = createSupabaseAdmin();
    const bcrypt = require('bcryptjs');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mobilestore.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin already exists
    const { data: existingAdmin } = await adminClient
      .from('admins')
      .select('*')
      .eq('email', adminEmail)
      .single();

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

      const { error } = await adminClient
        .from('admins')
        .insert([
          {
            email: adminEmail,
            password: hashedPassword,
            role: 'super_admin',
            is_active: true,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        logger.error('❌ Failed to create default admin:', error.message);
      } else {
        logger.info(`✅ Default admin created: ${adminEmail}`);
      }
    } else {
      logger.info('👤 Default admin already exists');
    }
  } catch (error) {
    logger.warn('⚠️  Could not initialize default admin:', error.message);
  }
};

/**
 * Initialize default categories and brands
 */
const initializeDefaultData = async () => {
  try {
    const adminClient = createSupabaseAdmin();

    // Default categories
    const defaultCategories = [
      { name: 'Smartphone', slug: 'smartphone', description: 'Mobile phones and smartphones' },
      { name: 'Accessory', slug: 'accessory', description: 'Phone accessories and add-ons' },
      { name: 'Tablet', slug: 'tablet', description: 'Tablets and iPad devices' }
    ];

    // Default brands
    const defaultBrands = [
      { name: 'Apple', slug: 'apple', logo_url: null },
      { name: 'Samsung', slug: 'samsung', logo_url: null },
      { name: 'Google', slug: 'google', logo_url: null },
      { name: 'OnePlus', slug: 'oneplus', logo_url: null },
      { name: 'Xiaomi', slug: 'xiaomi', logo_url: null }
    ];

    // Insert categories if they don't exist
    for (const category of defaultCategories) {
      const { data: existing } = await adminClient
        .from('categories')
        .select('*')
        .eq('slug', category.slug)
        .single();

      if (!existing) {
        await adminClient
          .from('categories')
          .insert([{ ...category, created_at: new Date().toISOString() }]);
      }
    }

    // Insert brands if they don't exist
    for (const brand of defaultBrands) {
      const { data: existing } = await adminClient
        .from('brands')
        .select('*')
        .eq('slug', brand.slug)
        .single();

      if (!existing) {
        await adminClient
          .from('brands')
          .insert([{ ...brand, created_at: new Date().toISOString() }]);
      }
    }

    logger.info('✅ Default categories and brands initialized');
  } catch (error) {
    logger.warn('⚠️  Could not initialize default data:', error.message);
  }
};

/**
 * Get Supabase client instance
 */
const getSupabaseClient = () => {
  if (!supabaseClient) {
    return createSupabaseClient();
  }
  return supabaseClient;
};

/**
 * Get Supabase admin client instance
 */
const getSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    return createSupabaseAdmin();
  }
  return supabaseAdmin;
};

module.exports = {
  createSupabaseClient,
  createSupabaseAdmin,
  connectDatabase,
  initializeDatabase,
  getSupabaseClient,
  getSupabaseAdmin
};
