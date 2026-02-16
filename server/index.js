import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { searchEbay } from './scrapers/ebay.js'
import { searchCraigslist } from './scrapers/craigslist.js'
import { storeListings } from './lib/supabase.js'
import ebayDeletionRouter from './routes/ebay-deletion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// Parse JSON for most routes, but the eBay deletion POST needs raw body
// for signature verification. We use express.raw() specifically for that path.
app.use('/api/ebay-deletion', express.raw({ type: 'application/json' }))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Search endpoint - searches eBay and Craigslist simultaneously
app.get('/api/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' })

  try {
    const [ebayResult, craigslistResult] = await Promise.allSettled([
      searchEbay(q),
      searchCraigslist(q),
    ])

    const ebayResults =
      ebayResult.status === 'fulfilled' ? ebayResult.value : []
    const craigslistResults =
      craigslistResult.status === 'fulfilled' ? craigslistResult.value : []

    if (ebayResult.status === 'rejected') {
      console.error('eBay search failed:', ebayResult.reason?.message)
    }
    if (craigslistResult.status === 'rejected') {
      console.error('Craigslist search failed:', craigslistResult.reason?.message)
    }

    // Merge results, sorted by listing_date (newest first), undated at end
    const allResults = [...ebayResults, ...craigslistResults].sort((a, b) => {
      if (a.listing_date && b.listing_date) {
        return new Date(b.listing_date) - new Date(a.listing_date)
      }
      if (a.listing_date) return -1
      if (b.listing_date) return 1
      return 0
    })

    // Store in database (fire-and-forget, don't block response)
    storeListings(allResults).catch((err) =>
      console.error('Failed to store listings:', err.message)
    )

    res.json({
      results: allResults,
      query: q,
      sources: {
        ebay: { count: ebayResults.length, status: ebayResult.status },
        craigslist: { count: craigslistResults.length, status: craigslistResult.status },
      },
    })
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ error: `Search failed: ${err.message}` })
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
