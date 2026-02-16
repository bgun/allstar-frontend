-- Add listing_date column to track when the listing was originally posted
ALTER TABLE listings ADD COLUMN listing_date TIMESTAMPTZ;

-- Add condition column for item condition (New, Used, etc.)
ALTER TABLE listings ADD COLUMN condition TEXT;

-- Index on listing_date for sorting by recency
CREATE INDEX idx_listings_listing_date ON listings(listing_date DESC NULLS LAST);

-- Add INSERT policy so the server (service role) can insert listings
-- and authenticated users can also insert via the API
CREATE POLICY "Service role can insert listings" ON listings
  FOR INSERT WITH CHECK (true);

-- Add policy for inserting search_result_listings
CREATE POLICY "Users can create search result listings" ON search_result_listings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM search_results
      WHERE search_results.id = search_result_listings.search_result_id
      AND search_results.user_id = auth.uid()
    )
  );
