-- SQL Schema for Tavusha Staff Upload Panel (Supabase Postgres)

-- 1. Staff Table
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

-- 2. Products Table
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

-- RLS Policies (Defense in depth)
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow all service operations from backend (if using service role or anon key with backend logic)
CREATE POLICY "Allow public read of approved non-deleted products" ON products
  FOR SELECT TO anon, authenticated USING (status = 'approved' AND is_deleted = false);
