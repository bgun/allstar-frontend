import { v4 as uuidv4 } from 'uuid'
import { ebayClient } from '../lib/ebayClient.js'

export async function scrapeEbay(query) {
  try {
    console.log('Searching eBay via API...')

    const searchQuery = query + ' headlight'
    const items = await ebayClient.searchItems(searchQuery)

    const listings = items.map(item => {
      // Parse price
      let priceCents = null
      let priceText = 'Price not listed'

      if (item.price) {
        const priceValue = parseFloat(item.price.value)
        priceCents = Math.round(priceValue * 100)
        priceText = `$${item.price.value} ${item.price.currency}`
      }

      // Get image URL
      const imageUrl = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || ''

      return {
        id: uuidv4(),
        url: item.itemWebUrl || item.itemAffiliateWebUrl || '',
        source: 'ebay',
        title: item.title || 'Untitled',
        description: item.shortDescription || null,
        price_cents: priceCents,
        price_text: priceText,
        location: item.itemLocation?.city || item.itemLocation?.country || null,
        seller_name: item.seller?.username || null,
        seller_rating: item.seller?.feedbackPercentage || null,
        image_urls: imageUrl ? [imageUrl] : []
      }
    })

    console.log(`Found ${listings.length} eBay listings via API`)
    return listings

  } catch (error) {
    console.error('eBay API error:', error.message)
    return []
  }
}
