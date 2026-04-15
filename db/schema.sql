-- Expense Tracker Schema (app_a401)
-- All tables prefixed with app_a401_

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS app_a401_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE app_a401_profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON app_a401_profiles;
CREATE POLICY "Users can view own profile"
  ON app_a401_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON app_a401_profiles;
CREATE POLICY "Users can insert own profile"
  ON app_a401_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON app_a401_profiles;
CREATE POLICY "Users can update own profile"
  ON app_a401_profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON app_a401_profiles;
CREATE POLICY "Users can delete own profile"
  ON app_a401_profiles FOR DELETE
  USING (auth.uid() = id);

-- Expense categories table
CREATE TABLE IF NOT EXISTS app_a401_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS on categories
ALTER TABLE app_a401_categories ENABLE ROW LEVEL SECURITY;

-- Categories RLS policies
DROP POLICY IF EXISTS "Users can view own categories" ON app_a401_categories;
CREATE POLICY "Users can view own categories"
  ON app_a401_categories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON app_a401_categories;
CREATE POLICY "Users can insert own categories"
  ON app_a401_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON app_a401_categories;
CREATE POLICY "Users can update own categories"
  ON app_a401_categories FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own categories" ON app_a401_categories;
CREATE POLICY "Users can delete own categories"
  ON app_a401_categories FOR DELETE
  USING (auth.uid() = user_id);

-- Expenses table
CREATE TABLE IF NOT EXISTS app_a401_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES app_a401_categories(id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on expenses
ALTER TABLE app_a401_expenses ENABLE ROW LEVEL SECURITY;

-- Expenses RLS policies
DROP POLICY IF EXISTS "Users can view own expenses" ON app_a401_expenses;
CREATE POLICY "Users can view own expenses"
  ON app_a401_expenses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own expenses" ON app_a401_expenses;
CREATE POLICY "Users can insert own expenses"
  ON app_a401_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own expenses" ON app_a401_expenses;
CREATE POLICY "Users can update own expenses"
  ON app_a401_expenses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own expenses" ON app_a401_expenses;
CREATE POLICY "Users can delete own expenses"
  ON app_a401_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_a401_profiles_email ON app_a401_profiles(email);
CREATE INDEX IF NOT EXISTS idx_app_a401_categories_user_id ON app_a401_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_app_a401_expenses_user_id ON app_a401_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_app_a401_expenses_category_id ON app_a401_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_app_a401_expenses_date ON app_a401_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_app_a401_expenses_user_date ON app_a401_expenses(user_id, expense_date);

-- Enable realtime for live expense updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_a401_expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_a401_expenses;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_a401_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_a401_categories;
  END IF;
END $$;

-- Trigger to auto-update updated_at timestamp
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_a401_profiles_updated_at ON app_a401_profiles;
CREATE TRIGGER update_app_a401_profiles_updated_at
  BEFORE UPDATE ON app_a401_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_a401_categories_updated_at ON app_a401_categories;
CREATE TRIGGER update_app_a401_categories_updated_at
  BEFORE UPDATE ON app_a401_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_a401_expenses_updated_at ON app_a401_expenses;
CREATE TRIGGER update_app_a401_expenses_updated_at
  BEFORE UPDATE ON app_a401_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create default categories for new users
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_a401_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Insert default categories
  INSERT INTO public.app_a401_categories (user_id, name, color)
  VALUES
    (NEW.id, 'Food & Dining', '#ef4444'),
    (NEW.id, 'Transportation', '#f59e0b'),
    (NEW.id, 'Shopping', '#8b5cf6'),
    (NEW.id, 'Entertainment', '#ec4899'),
    (NEW.id, 'Bills & Utilities', '#3b82f6'),
    (NEW.id, 'Healthcare', '#10b981'),
    (NEW.id, 'Personal', '#6366f1'),
    (NEW.id, 'Other', '#6b7280');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users to create profile and default categories
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();