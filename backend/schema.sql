-- ═══════════════════════════════════════════════════════════════════════
-- TAVUSHA — Complete Database Schema (Supabase Postgres)
-- Run this file in Supabase SQL Editor to set up all tables.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. STAFF TABLE
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  login_id TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  permissions JSONB DEFAULT '{"canUpload": true, "canEdit": true, "canDelete": false, "canUpdateStock": true}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────
-- 2. PRODUCTS TABLE
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL,
  colour TEXT DEFAULT '',
  size TEXT DEFAULT '',
  category TEXT DEFAULT 'other' CHECK (category IN ('party', 'ethnic', 'casual', 'maxi', 'coord', 'other')),
  stock INTEGER DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  images TEXT[] DEFAULT '{}',
  videos TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT DEFAULT '',
  created_by UUID REFERENCES staff(id) ON DELETE CASCADE,
  last_edited_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────
-- 3. CMS BANNERS (hero, festival, category, etc.)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'hero' CHECK (type IN ('hero', 'festival', 'category', 'sale', 'custom')),
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  badge_text TEXT DEFAULT '',
  cta_text TEXT DEFAULT 'Shop Now',
  cta_url TEXT DEFAULT '#',
  image_url TEXT DEFAULT '',
  mobile_image_url TEXT DEFAULT '',
  bg_color TEXT DEFAULT '',
  text_color TEXT DEFAULT '',
  visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  schedule_start TIMESTAMPTZ,   -- auto-show from this date/time
  schedule_end TIMESTAMPTZ,     -- auto-hide after this date/time
  festival_tag TEXT DEFAULT '',  -- e.g. 'Diwali', 'Rakhi', 'Eid', 'Sale'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────
-- 4. HOMEPAGE SECTIONS (toggle visibility + reorder)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,   -- 'hero', 'featured', 'categories', 'new_arrivals', 'testimonials', 'marquee'
  label TEXT NOT NULL,
  visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',  -- section-specific settings (title text, product count, etc.)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default sections
INSERT INTO cms_sections (key, label, visible, sort_order, config) VALUES
  ('announcement', 'Announcement Bar', true, 0, '{"text": "✦  Free Shipping on Orders Above ₹2,499  ·  Code TAVUSHA10 — 10% Off First Order  ·  New Arrivals Every Friday  ✦"}'),
  ('hero', 'Hero Banner', true, 1, '{"headline": "Style Every Moment", "tagline": "Step into a world where fashion speaks your language."}'),
  ('marquee_top', 'Marquee Tape (Top)', true, 2, '{}'),
  ('poster_spread', 'Campaign Poster Spread', true, 3, '{"eyebrow": "Editorial Campaign 2026", "title": "The Couture & Cocktail Edit", "main_image": "assets/images/party_wear.jpg", "main_badge": "Limited Run — 250 Pieces", "main_title": "Ivory Silk Evening Gown", "main_desc": "Fluid cowl neckline and open back draped in pure mulberry silk. A masterclass in quiet luxury.", "main_link": "1", "side1_image": "assets/images/ethnic.jpg", "side1_badge": "Heritage Couture", "side1_title": "Gold Embroidered Anarkali", "side1_quote": "Ceremonial splendour crafted for modern celebrations.", "side1_link": "9", "side2_image": "assets/images/workwear.jpg", "side2_badge": "Power Tailoring", "side2_title": "Ivory Oversized Blazer", "side2_quote": "Boardroom precision meets effortless evening allure.", "side2_link": "7", "quote_text": "Fashion is not something that exists in dresses only. Fashion is in the sky, in the street; fashion has to do with ideas.", "quote_author": "— TAVUSHA EDITORIAL DIRECTORY"}'),
  ('featured', 'Featured / Split Section', true, 4, '{"title": "Dress for Every Story"}'),
  ('categories', 'Category Grid', true, 5, '{"title": "Shop by Category"}'),
  ('new_arrivals', 'New Arrivals Grid', true, 6, '{"title": "New Arrivals"}'),
  ('marquee_mid', 'Marquee Tape (Middle)', true, 7, '{}'),
  ('testimonials', 'Testimonials', true, 8, '{"title": "What Our Customers Say"}'),
  ('footer', 'Footer', true, 9, '{}')
ON CONFLICT (key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────
-- 5. POPUPS
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  cta_text TEXT DEFAULT '',
  cta_url TEXT DEFAULT '',
  visible BOOLEAN DEFAULT false,
  trigger_delay_seconds INTEGER DEFAULT 5,
  show_once BOOLEAN DEFAULT true,  -- if true, don't show again once dismissed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────
-- 6. SHIPPING ZONES
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,            -- e.g. 'North India', 'South India', 'North East'
  rate_per_piece NUMERIC NOT NULL DEFAULT 60,
  states TEXT[] DEFAULT '{}',    -- state names in this zone
  pincode_prefixes TEXT[] DEFAULT '{}',  -- 2-6 digit prefixes matching this zone
  is_active BOOLEAN DEFAULT true,
  free_shipping_above NUMERIC,   -- if order subtotal > this, shipping is free
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default shipping zones
INSERT INTO shipping_zones (name, rate_per_piece, states, pincode_prefixes) VALUES
  ('North India', 60,
    ARRAY['Delhi','Uttar Pradesh','Punjab','Haryana','Himachal Pradesh','Uttarakhand','Jammu and Kashmir','Ladakh','Chandigarh'],
    ARRAY['11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26']
  ),
  ('Central & West India', 100,
    ARRAY['Rajasthan','Madhya Pradesh','Maharashtra','Gujarat','Goa','Chhattisgarh','Dadra and Nagar Haveli','Daman and Diu'],
    ARRAY['30','31','32','33','34','36','37','38','39','40','41','42','43','44','45','46','47','48','49']
  ),
  ('South India', 100,
    ARRAY['Karnataka','Tamil Nadu','Andhra Pradesh','Telangana','Kerala','Puducherry','Lakshadweep'],
    ARRAY['50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69']
  ),
  ('East India (WB & Assam)', 100,
    ARRAY['West Bengal','Assam','Bihar','Jharkhand','Odisha'],
    ARRAY['70','71','72','73','74','75','76','77','78','80','81','82','83','84','85','86']
  ),
  ('North East India', 150,
    ARRAY['Manipur','Meghalaya','Mizoram','Nagaland','Arunachal Pradesh','Sikkim','Tripura'],
    ARRAY['79','793','794','795','796','797','798','799']
  )
ON CONFLICT DO NOTHING;

-- Per-order shipping overrides (admin can manually change shipping for any order)
CREATE TABLE IF NOT EXISTS shipping_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  pincode TEXT,
  override_amount NUMERIC NOT NULL,
  reason TEXT DEFAULT '',
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────
-- 7. ORDERS
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,       -- TAV-2026-XXXX
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  delivery_address JSONB NOT NULL,         -- {line1, city, state, pincode}
  pincode TEXT NOT NULL,
  shipping_zone TEXT DEFAULT '',
  shipping_charge NUMERIC DEFAULT 0,
  items JSONB NOT NULL,                    -- [{productId, title, price, qty, size, colour, image}]
  item_count INTEGER DEFAULT 1,
  subtotal NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  payment_type TEXT DEFAULT 'cod' CHECK (payment_type IN ('cod', 'prepaid')),
  advance_required NUMERIC DEFAULT 0,      -- 20% of total for COD
  advance_paid NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'advance_paid', 'paid', 'failed')),
  razorpay_order_id TEXT DEFAULT '',
  razorpay_payment_id TEXT DEFAULT '',
  razorpay_signature TEXT DEFAULT '',
  order_status TEXT DEFAULT 'confirmed' CHECK (order_status IN ('confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned')),
  tracking_number TEXT DEFAULT '',
  tracking_url TEXT DEFAULT '',
  tracking_courier TEXT DEFAULT '',
  special_instructions TEXT DEFAULT '',
  whatsapp_sent BOOLEAN DEFAULT false,
  whatsapp_log JSONB DEFAULT '[]',         -- log of all WA messages sent
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Public can read approved products (storefront)
CREATE POLICY "Public read approved products" ON products
  FOR SELECT TO anon, authenticated USING (status = 'approved' AND is_deleted = false);

-- Public can read visible banners
CREATE POLICY "Public read active banners" ON cms_banners
  FOR SELECT TO anon, authenticated USING (visible = true);

-- Public can read cms_sections
CREATE POLICY "Public read cms_sections" ON cms_sections
  FOR SELECT TO anon, authenticated USING (true);

-- Public can read active popup
CREATE POLICY "Public read active popups" ON cms_popups
  FOR SELECT TO anon, authenticated USING (visible = true);

-- Public can read active shipping zones
CREATE POLICY "Public read shipping zones" ON shipping_zones
  FOR SELECT TO anon, authenticated USING (is_active = true);
