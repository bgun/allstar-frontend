import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { searchEbay } from './scrapers/ebay.js'
import { searchCraigslist } from './scrapers/craigslist.js'
import { supabase, storeListings } from './lib/supabase.js'
import { logSearch } from './lib/logger.js'
import { filterByRelevance } from './lib/relevance.js'
import ebayDeletionRouter from './routes/ebay-deletion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Load user search preferences from Supabase
async function loadUserPreferences(userId) {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('search_preferences, email')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return { preferences: data.search_preferences, email: data.email }
  } catch {
    return null
  }
}

// Search endpoint - searches eBay and Craigslist simultaneously
app.get('/api/search', async (req, res) => {
  const { q, user_id } = req.query
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' })

  try {
    const userData = await loadUserPreferences(user_id)
    const prefs = userData?.preferences || {}

    const clEnabled = prefs.craigslist_enabled !== false

    const searches = [searchEbay(q, prefs)]
    if (clEnabled) {
      searches.push(
        searchCraigslist(q, {
          city: prefs.craigslist_city || 'denver',
          lat: prefs.craigslist_lat,
          lon: prefs.craigslist_lon,
          search_distance: prefs.craigslist_distance,
        })
      )
    }

    const [ebayResult, craigslistResult] = await Promise.allSettled(searches)

    const ebayData =
      ebayResult.status === 'fulfilled' ? ebayResult.value : { items: [], url: null }
    const craigslistData = clEnabled && craigslistResult
      ? (craigslistResult.status === 'fulfilled' ? craigslistResult.value : { items: [], url: null })
      : { items: [], url: null }

    const ebayResults = ebayData.items
    const craigslistResults = craigslistData.items

    if (ebayResult.status === 'rejected') {
      console.error('eBay search failed:', ebayResult.reason?.message)
    }
    if (craigslistResult.status === 'rejected') {
      console.error('Craigslist search failed:', craigslistResult.reason?.message)
    }

    // Log search for QA
    logSearch({
      email: userData?.email,
      query: q,
      ebayUrl: ebayData.url,
      craigslistUrl: craigslistData.url,
      ebayCount: ebayResults.length,
      craigslistCount: craigslistResults.length,
    })

    // Merge results, sorted by listing_date (newest first), undated at end
    const allResults = [...ebayResults, ...craigslistResults].sort((a, b) => {
      if (a.listing_date && b.listing_date) {
        return new Date(b.listing_date) - new Date(a.listing_date)
      }
      if (a.listing_date) return -1
      if (b.listing_date) return 1
      return 0
    })

    // Filter results for relevance using LLM
    const { results: filteredResults, filtered } = await filterByRelevance(allResults, q)

    // Store in database (fire-and-forget, don't block response)
    storeListings(filteredResults).catch((err) =>
      console.error('Failed to store listings:', err.message)
    )

    res.json({
      results: filteredResults,
      query: q,
      sources: {
        ebay: { count: ebayResults.length, status: ebayResult.status, url: ebayData.url },
        craigslist: { count: craigslistResults.length, status: craigslistResult.status, url: craigslistData.url },
      },
      ...(filtered && { filtered }),
    })
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ error: `Search failed: ${err.message}` })
  }
})

// User preferences endpoint
app.get('/api/preferences/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('search_preferences')
      .eq('id', req.params.userId)
      .single()
    if (error) return res.status(404).json({ error: 'Profile not found' })
    res.json(data.search_preferences || {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/preferences/:userId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ search_preferences: req.body })
      .eq('id', req.params.userId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// eBay Marketplace Account Deletion notifications
app.use('/api/ebay-deletion', ebayDeletionRouter)

// Serve React frontend in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
