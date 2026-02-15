import express from 'express'
import cors from 'cors'
import { scrapeEbay } from './scrapers/ebay.js'
import { scrapeCraigslist } from './scrapers/craigslist.js'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    console.log(`Searching for: ${query}`)

    // Run scrapers in parallel
    const [ebayResults, craigslistResults] = await Promise.allSettled([
      scrapeEbay(query),
      scrapeCraigslist(query)
    ])

    // Combine results
    const listings = []

    if (ebayResults.status === 'fulfilled') {
      listings.push(...ebayResults.value)
    } else {
      console.error('eBay scraper error:', ebayResults.reason)
    }

    if (craigslistResults.status === 'fulfilled') {
      listings.push(...craigslistResults.value)
    } else {
      console.error('Craigslist scraper error:', craigslistResults.reason)
    }

    res.json({ listings })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Failed to perform search' })
  }
})

app.listen(PORT, () => {
  console.log(`Scraper server running on http://localhost:${PORT}`)
})
