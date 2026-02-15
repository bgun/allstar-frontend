import * as cheerio from 'cheerio'
import { v4 as uuidv4 } from 'uuid'

// Major metro areas to search
const regions = [
  'sfbay',
  'newyork',
  'losangeles',
  'chicago',
  'seattle',
  'boston',
  'atlanta',
  'phoenix'
]

export async function scrapeCraigslist(query) {
  try {
    const searchQuery = encodeURIComponent(query + ' headlight')

    // Search multiple regions in parallel
    const searchPromises = regions.map(region =>
      scrapeCraigslistRegion(region, searchQuery)
    )

    const results = await Promise.allSettled(searchPromises)

    // Combine all successful results
    const allListings = []
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allListings.push(...result.value)
      } else {
        console.error(`Craigslist ${regions[index]} error:`, result.reason)
      }
    })

    console.log(`Found ${allListings.length} Craigslist listings across all regions`)
    return allListings

  } catch (error) {
    console.error('Craigslist scraping error:', error)
    return []
  }
}

async function scrapeCraigslistRegion(region, searchQuery) {
  const searchUrl = `https://${region}.craigslist.org/search/pta?query=${searchQuery}&sort=rel`

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`Craigslist ${region} returned status ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const listings = []

  console.log(`Craigslist ${region} HTML length: ${html.length}`)
  console.log(`Found ${$('.cl-static-search-result').length} .cl-static-search-result elements`)

  // Craigslist uses <li class="cl-static-search-result"> for each listing
  $('.cl-static-search-result').each((index, element) => {
    const $item = $(element)

    const titleLink = $item.find('a').first()
    const title = $item.find('.title').text().trim()
    const url = titleLink.attr('href')
    const priceText = $item.find('.price').text().trim()
    const location = $item.find('.location').text().trim()
    const imageUrl = $item.find('img').attr('src')

    // Skip if no title or URL
    if (!title || !url) return

    // Parse price
    let priceCents = null
    const priceMatch = priceText.match(/\$([0-9,]+)/)
    if (priceMatch) {
      const priceValue = parseInt(priceMatch[1].replace(',', ''))
      priceCents = priceValue * 100
    }

    // Generate a deterministic ID
    const listingId = uuidv4()

    listings.push({
      id: listingId,
      url: url.startsWith('http') ? url : `https://${region}.craigslist.org${url}`,
      source: 'craigslist',
      title,
      description: null,
      price_cents: priceCents,
      price_text: priceText || 'Price not listed',
      location: location || `${region} area`,
      seller_name: null,
      seller_rating: null,
      image_urls: imageUrl ? [imageUrl] : []
    })
  })

  return listings
}
