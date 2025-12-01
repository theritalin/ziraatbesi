-- Enable RLS on tables
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;

-- Users Policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Farms Policies
CREATE POLICY "Users can view own farm" ON farms
  FOR SELECT USING (id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can insert farm" ON farms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own farm" ON farms
  FOR UPDATE USING (id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

-- Animals Policies
CREATE POLICY "Users can view their farm's animals" ON animals
  FOR SELECT USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can insert animals to their farm" ON animals
  FOR INSERT WITH CHECK (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can update their farm's animals" ON animals
  FOR UPDATE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can delete their farm's animals" ON animals
  FOR DELETE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

-- Feeds Policies
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their farm's feeds" ON feeds
  FOR SELECT USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can insert feeds to their farm" ON feeds
  FOR INSERT WITH CHECK (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can update their farm's feeds" ON feeds
  FOR UPDATE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can delete their farm's feeds" ON feeds
  FOR DELETE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

-- Rations Policies
ALTER TABLE rations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their farm's rations" ON rations
  FOR SELECT USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can insert rations to their farm" ON rations
  FOR INSERT WITH CHECK (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can update their farm's rations" ON rations
  FOR UPDATE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can delete their farm's rations" ON rations
  FOR DELETE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

-- DailyLogs Policies
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their farm's logs" ON daily_logs
  FOR SELECT USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can insert logs to their farm" ON daily_logs
  FOR INSERT WITH CHECK (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

-- Schema Updates for Ration Management (Run this if you haven't already)
ALTER TABLE rations ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE rations ADD COLUMN IF NOT EXISTS group_id BIGINT;

-- Schema Updates for Advanced Logic (Run this!)
ALTER TABLE rations ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS bag_weight NUMERIC DEFAULT 50;

-- Schema Updates for Manual Stock Update System (Run this!)
ALTER TABLE rations ADD COLUMN IF NOT EXISTS last_stock_update TIMESTAMP;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS initial_stock_kg NUMERIC DEFAULT 0;

-- Schema Updates for Weighing System (Run this!)
CREATE TABLE IF NOT EXISTS weighings (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT REFERENCES farms(id) ON DELETE CASCADE,
  animal_id BIGINT REFERENCES animals(id) ON DELETE CASCADE,
  weight_kg NUMERIC NOT NULL,
  weigh_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on weighings
ALTER TABLE weighings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weighings
CREATE POLICY "Users can view their farm's weighings" ON weighings
  FOR SELECT USING (
    farm_id IN (SELECT farm_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert weighings for their farm" ON weighings
  FOR INSERT WITH CHECK (
    farm_id IN (SELECT farm_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their farm's weighings" ON weighings
  FOR UPDATE USING (
    farm_id IN (SELECT farm_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete their farm's weighings" ON weighings
  FOR DELETE USING (
    farm_id IN (SELECT farm_id FROM users WHERE id = auth.uid())
  );

-- Add weight tracking columns to animals
ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_weight_kg NUMERIC;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_weigh_date DATE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS initial_weight NUMERIC;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;

-- Veterinary Records Table
CREATE TABLE IF NOT EXISTS veterinary_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  farm_id INT8 REFERENCES farms(id) NOT NULL,
  animal_id INT8 REFERENCES animals(id),
  procedure_name TEXT NOT NULL,
  cost NUMERIC DEFAULT 0,
  process_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Veterinary Records Policies
ALTER TABLE veterinary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their farm's veterinary records" ON veterinary_records
  FOR SELECT USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can insert veterinary records to their farm" ON veterinary_records
  FOR INSERT WITH CHECK (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can update their farm's veterinary records" ON veterinary_records
  FOR UPDATE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

CREATE POLICY "Users can delete their farm's veterinary records" ON veterinary_records
  FOR DELETE USING (farm_id IN (
    SELECT farm_id FROM users WHERE users.id = auth.uid()
  ));

-- General Expenses Table
CREATE TABLE IF NOT EXISTS general_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  farm_id INT8 REFERENCES farms(id) NOT NULL,
  category TEXT NOT NULL, -- 'Market', 'Fatura', 'Personel', etc.
  amount NUMERIC DEFAULT 0,
  expense_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- General Expenses Policies
ALTER TABLE general_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their farm's expenses" ON general_expenses
  FOR SELECT USING (farm_id IN (SELECT farm_id FROM users WHERE users.id = auth.uid()));

CREATE POLICY "Users can insert expenses to their farm" ON general_expenses
  FOR INSERT WITH CHECK (farm_id IN (SELECT farm_id FROM users WHERE users.id = auth.uid()));

CREATE POLICY "Users can update their farm's expenses" ON general_expenses
  FOR UPDATE USING (farm_id IN (SELECT farm_id FROM users WHERE users.id = auth.uid()));

CREATE POLICY "Users can delete their farm's expenses" ON general_expenses
  FOR DELETE USING (farm_id IN (SELECT farm_id FROM users WHERE users.id = auth.uid()));

-- Authorization & Multi-Farm Support

-- Farm Users Table (Manages access and permissions)
CREATE TABLE IF NOT EXISTS farm_users (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT REFERENCES farms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for invited users not yet registered
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user', -- 'admin', 'user'
  permissions JSONB DEFAULT '{}', -- e.g., {"animals": "edit", "reports": "view"}
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(farm_id, email)
);

-- Enable RLS on farm_users
ALTER TABLE farm_users ENABLE ROW LEVEL SECURITY;

-- Policies for farm_users
-- Admins can view all users in their farm
CREATE POLICY "Admins can view farm users" ON farm_users
  FOR SELECT USING (
    farm_id IN (
      SELECT farm_id FROM farm_users WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR user_id = auth.uid() -- Users can view themselves
  );

-- Admins can insert new users (invites)
CREATE POLICY "Admins can insert farm users" ON farm_users
  FOR INSERT WITH CHECK (
    farm_id IN (
      SELECT farm_id FROM farm_users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update users in their farm
CREATE POLICY "Admins can update farm users" ON farm_users
  FOR UPDATE USING (
    farm_id IN (
      SELECT farm_id FROM farm_users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete users from their farm
CREATE POLICY "Admins can delete farm users" ON farm_users
  FOR DELETE USING (
    farm_id IN (
      SELECT farm_id FROM farm_users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Initial Setup Helper (Run manually or via migration script if needed)
-- This ensures the farm owner is added as an admin in farm_users
-- FIX: Infinite Recursion in farm_users policies
-- We use a SECURITY DEFINER function to bypass RLS when checking permissions
CREATE OR REPLACE FUNCTION get_my_admin_farms()
RETURNS SETOF BIGINT AS $$
BEGIN
  -- 1. Farms where I am explicitly an admin in farm_users
  RETURN QUERY
  SELECT farm_id FROM farm_users
  WHERE user_id = auth.uid() AND role = 'admin';

  -- 2. My farm if I am a legacy admin in users table
  RETURN QUERY
  SELECT farm_id FROM users
  WHERE id = auth.uid() AND role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing recursive policies
DROP POLICY IF EXISTS "Admins can view farm users" ON farm_users;
DROP POLICY IF EXISTS "Admins can insert farm users" ON farm_users;
DROP POLICY IF EXISTS "Admins can update farm users" ON farm_users;
DROP POLICY IF EXISTS "Admins can delete farm users" ON farm_users;

-- Re-create policies using the safe function
CREATE POLICY "Admins can view farm users" ON farm_users
  FOR SELECT USING (
    farm_id IN (SELECT get_my_admin_farms())
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can insert farm users" ON farm_users
  FOR INSERT WITH CHECK (
    farm_id IN (SELECT get_my_admin_farms())
  );

CREATE POLICY "Admins can update farm users" ON farm_users
  FOR UPDATE USING (
    farm_id IN (SELECT get_my_admin_farms())
  );

CREATE POLICY "Admins can delete farm users" ON farm_users
  FOR DELETE USING (
    farm_id IN (SELECT get_my_admin_farms())
  );



-- FIX: Allow users to claim their email invites
-- This function links the current user to any farm_users rows matching their email
CREATE OR REPLACE FUNCTION claim_my_invites()
RETURNS VOID AS $$
DECLARE
  current_email TEXT;
BEGIN
  -- Get current user's email from auth.users
  SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
  
  IF current_email IS NOT NULL THEN
    UPDATE farm_users
    SET user_id = auth.uid()
    WHERE email = current_email AND user_id IS NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FIX: Data Visibility for Farm Users
-- Create a helper function to get all farms a user has access to (via farm_users OR legacy users table)
CREATE OR REPLACE FUNCTION get_my_allowed_farms()
RETURNS SETOF BIGINT AS $$
BEGIN
  -- 1. Farms where I am a member in farm_users (any role)
  RETURN QUERY
  SELECT farm_id FROM farm_users
  WHERE user_id = auth.uid();

  -- 2. My farm if I am a legacy admin in users table
  RETURN QUERY
  SELECT farm_id FROM users
  WHERE id = auth.uid() AND role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Animals Policies to use get_my_allowed_farms()
DROP POLICY IF EXISTS "Users can view their farm's animals" ON animals;
DROP POLICY IF EXISTS "Users can insert animals to their farm" ON animals;
DROP POLICY IF EXISTS "Users can update their farm's animals" ON animals;
DROP POLICY IF EXISTS "Users can delete their farm's animals" ON animals;

CREATE POLICY "Users can view their farm's animals" ON animals
  FOR SELECT USING (farm_id IN (SELECT get_my_allowed_farms()));

CREATE POLICY "Users can insert animals to their farm" ON animals
  FOR INSERT WITH CHECK (farm_id IN (SELECT get_my_allowed_farms()));

CREATE POLICY "Users can update their farm's animals" ON animals
  FOR UPDATE USING (farm_id IN (SELECT get_my_allowed_farms()));

CREATE POLICY "Users can delete their farm's animals" ON animals
  FOR DELETE USING (farm_id IN (SELECT get_my_allowed_farms()));

-- Update Weighings Policies to use get_my_allowed_farms()
DROP POLICY IF EXISTS "Users can view their farm's weighings" ON weighings;
DROP POLICY IF EXISTS "Users can insert weighings for their farm" ON weighings;
DROP POLICY IF EXISTS "Users can update their farm's weighings" ON weighings;
DROP POLICY IF EXISTS "Users can delete their farm's weighings" ON weighings;

CREATE POLICY "Users can view their farm's weighings" ON weighings
  FOR SELECT USING (farm_id IN (SELECT get_my_allowed_farms()));

CREATE POLICY "Users can insert weighings for their farm" ON weighings
  FOR INSERT WITH CHECK (farm_id IN (SELECT get_my_allowed_farms()));

CREATE POLICY "Users can update their farm's weighings" ON weighings
  FOR UPDATE USING (farm_id IN (SELECT get_my_allowed_farms()));

CREATE POLICY "Users can delete their farm's weighings" ON weighings
  FOR DELETE USING (farm_id IN (SELECT get_my_allowed_farms()));
