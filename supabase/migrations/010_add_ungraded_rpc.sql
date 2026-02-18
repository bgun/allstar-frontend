-- RPC function to get ungraded listings efficiently (avoids URL length limits)
CREATE OR REPLACE FUNCTION get_ungraded_listings(p_prompt_version TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  price TEXT,
  price_cents INTEGER,
  link TEXT,
  image TEXT,
  source TEXT,
  external_id TEXT,
  condition TEXT,
  listing_date TIMESTAMPTZ,
  location TEXT,
  seller_name TEXT,
  description TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    l.id,
    l.title,
    l.price_text AS price,
    l.price_cents,
    l.url AS link,
    l.image_urls[1] AS image,
    l.source,
    l.external_id,
    l.condition,
    l.listing_date,
    l.location,
    l.seller_name,
    l.description
  FROM listings l
  WHERE NOT EXISTS (
    SELECT 1 FROM grades g
    WHERE g.listing_id = l.id
    AND g.prompt_version = p_prompt_version
  );
$$;
