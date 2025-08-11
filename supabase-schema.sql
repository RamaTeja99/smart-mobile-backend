-- Mobile Store Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'out_of_stock');
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'moderator');

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    short_description TEXT,
    description TEXT,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Pricing
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    original_price DECIMAL(10,2),
    discount_percentage INTEGER DEFAULT 0,

    -- Product details
    model VARCHAR(100),
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),

    -- Stock management
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    track_stock BOOLEAN DEFAULT true,

    -- Product specifications (JSON field)
    specifications JSONB DEFAULT '{}',

    -- Images (array of image URLs)
    images TEXT[] DEFAULT ARRAY[]::TEXT[],
    featured_image TEXT,

    -- SEO and metadata
    meta_title VARCHAR(255),
    meta_description TEXT,
    keywords TEXT[],

    -- Status and visibility
    status product_status DEFAULT 'active',
    is_featured BOOLEAN DEFAULT false,
    is_bestseller BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,

    -- Ratings and reviews
    average_rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,

    -- Timestamps
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admins table for authentication
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role admin_role DEFAULT 'admin',
    avatar_url TEXT,

    -- Security and account management
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,

    -- Permissions (JSON field for flexible role management)
    permissions JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product search optimization table
CREATE TABLE IF NOT EXISTS product_search_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    search_vector TSVECTOR,
    keywords TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs table for admin actions
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health check table
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(10) DEFAULT 'ok',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_description ON products USING gin(to_tsvector('english', description));

CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_brands_is_active ON brands(is_active);
CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON brands(sort_order);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

CREATE INDEX IF NOT EXISTS idx_product_search_vector ON product_search_data USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_product_search_keywords ON product_search_data USING gin(keywords);

CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id ON activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_search_data_updated_at BEFORE UPDATE ON product_search_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update product search data
CREATE OR REPLACE FUNCTION update_product_search_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert search data for the product
    INSERT INTO product_search_data (product_id, search_vector, keywords)
    VALUES (
        NEW.id,
        to_tsvector('english', 
            COALESCE(NEW.name, '') || ' ' || 
            COALESCE(NEW.description, '') || ' ' ||
            COALESCE(NEW.short_description, '') || ' ' ||
            COALESCE(NEW.model, '')
        ),
        ARRAY[
            LOWER(NEW.name),
            LOWER(COALESCE(NEW.model, '')),
            LOWER(COALESCE(NEW.short_description, ''))
        ]
    )
    ON CONFLICT (product_id) 
    DO UPDATE SET 
        search_vector = EXCLUDED.search_vector,
        keywords = EXCLUDED.keywords,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply search update trigger
CREATE TRIGGER update_product_search_trigger 
    AFTER INSERT OR UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_product_search_data();

-- Function to calculate discount percentage
CREATE OR REPLACE FUNCTION calculate_discount_percentage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.original_price IS NOT NULL AND NEW.original_price > 0 AND NEW.price < NEW.original_price THEN
        NEW.discount_percentage = ROUND(((NEW.original_price - NEW.price) / NEW.original_price * 100)::numeric, 0);
    ELSE
        NEW.discount_percentage = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply discount calculation trigger
CREATE TRIGGER calculate_discount_trigger 
    BEFORE INSERT OR UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION calculate_discount_percentage();

-- Insert initial health check record
INSERT INTO health_check (status) VALUES ('ok') ON CONFLICT DO NOTHING;

-- Row Level Security (RLS) Policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for categories, brands, and active products
CREATE POLICY "Public read access for active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for active brands" ON brands FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for active products" ON products FOR SELECT USING (status = 'active');

-- Admin access policies (requires service role key)
CREATE POLICY "Admin full access to categories" ON categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to brands" ON brands FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to products" ON products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to admins" ON admins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin full access to activity_logs" ON activity_logs FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON categories, brands, products TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMENT ON TABLE categories IS 'Product categories for organization and filtering';
COMMENT ON TABLE brands IS 'Brand information for products';
COMMENT ON TABLE products IS 'Main products table with comprehensive product data';
COMMENT ON TABLE admins IS 'Admin users for backend management';
COMMENT ON TABLE product_search_data IS 'Optimized search data for products';
COMMENT ON TABLE activity_logs IS 'Audit trail for admin actions';
