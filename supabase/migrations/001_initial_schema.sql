-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create listings table
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ebay', 'craigslist')),
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,
  price_text TEXT,
  location TEXT,
  seller_name TEXT,
  seller_rating NUMERIC(3,2),
  image_urls TEXT[],
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_url ON listings(url);
CREATE INDEX idx_listings_source ON listings(source);
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view listings" ON listings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create search_results table
CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  search_query_text TEXT NOT NULL,
  parsed_params JSONB NOT NULL,
  total_listings_found INTEGER DEFAULT 0,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_results_user_id ON search_results(user_id);
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search results" ON search_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create search results" ON search_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create search_result_listings junction table
CREATE TABLE search_result_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(search_result_id, listing_id)
);

CREATE INDEX idx_srl_search_result ON search_result_listings(search_result_id);
ALTER TABLE search_result_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view listings from their searches" ON search_result_listings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM search_results
      WHERE search_results.id = search_result_listings.search_result_id
      AND search_results.user_id = auth.uid()
    )
  );

-- Create user_listing_actions table
CREATE TABLE user_listing_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('thumbs_up', 'thumbs_down')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_ula_user_listing ON user_listing_actions(user_id, listing_id);
ALTER TABLE user_listing_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own actions" ON user_listing_actions
  FOR ALL USING (auth.uid() = user_id);

-- Create trigger function for new user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
