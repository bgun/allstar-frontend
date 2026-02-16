import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || process.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function storeListings(listings) {
  if (!listings.length) return []

  // Upsert listings by URL to avoid duplicates
  const rows = listings
    .filter((l) => l.link)
    .map((l) => ({
      url: l.link,
      source: l.source,
      external_id: l.external_id || null,
      title: l.title,
      price_cents: l.price_cents || null,
      price_text: l.price || null,
      location: l.location || null,
      seller_name: l.seller_name || null,
      image_urls: l.image ? [l.image] : null,
      condition: l.condition || null,
      listing_date: l.listing_date || null,
      scraped_at: new Date().toISOString(),
    }))

  const { data, error } = await supabase
    .from('listings')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: false })
    .select('id, url')

  if (error) {
    console.error('Error storing listings:', error.message)
    return []
  }

  return data || []
}
