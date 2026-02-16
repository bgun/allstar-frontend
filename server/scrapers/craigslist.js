import axios from 'axios'
import * as cheerio from 'cheerio'

export async function searchCraigslist(query, opts = {}) {
  const city = opts.city || 'denver'
  const lat = opts.lat || 39.6654
  const lon = opts.lon || -105.1062
  const search_distance = opts.search_distance || 1000

  const params = new URLSearchParams({
    query,
    lat: String(lat),
    lon: String(lon),
    search_distance: String(search_distance),
  })
  const url = `https://${city}.craigslist.org/search/${city}-co/pta?${params}`

  const { data } = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  const $ = cheerio.load(data)

  // Parse structured data for images and prices
  const structuredData = {}
  try {
    const ldJson = $('#ld_searchpage_results').html()
    if (ldJson) {
      const parsed = JSON.parse(ldJson)
      const items = parsed.itemListElement || []
      items.forEach((entry) => {
        const product = entry.item
        if (product?.name) {
          structuredData[product.name] = {
            image: Array.isArray(product.image)
              ? product.image[0]
              : product.image || null,
            price_cents: product.offers?.price
              ? Math.round(parseFloat(product.offers.price) * 100)
              : null,
            location: product.offers?.availableAtOrFrom?.address
              ? [
                  product.offers.availableAtOrFrom.address.addressLocality,
                  product.offers.availableAtOrFrom.address.addressRegion,
                ]
                  .filter(Boolean)
                  .join(', ')
              : null,
          }
        }
      })
    }
  } catch {
    // structured data parsing is best-effort
  }

  const results = []

  $('li.cl-static-search-result').each((_i, el) => {
    const title = $(el).find('.title').text().trim()
    const price = $(el).find('.price').text().trim()
    const link = $(el).find('a').attr('href')
    const locationText = $(el).find('.location').text().trim()

    if (title) {
      const sd = structuredData[title] || {}
      results.push({
        title,
        price: price || null,
        price_cents: sd.price_cents || parsePriceCents(price),
        link,
        image: sd.image || null,
        source: 'craigslist',
        external_id: link ? extractCraigslistId(link) : null,
        condition: null,
        listing_date: null, // not available from search results
        location: locationText || sd.location || null,
        seller_name: null,
      })
    }
  })

  return { items: results.slice(0, 25), url }
}

function parsePriceCents(priceStr) {
  if (!priceStr) return null
  const match = priceStr.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  return match ? Math.round(parseFloat(match[1]) * 100) : null
}

function extractCraigslistId(url) {
  const match = url.match(/\/(\d+)\.html/)
  return match ? match[1] : null
}
