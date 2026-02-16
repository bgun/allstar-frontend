import axios from 'axios'

const SANDBOX_BASE = 'https://api.sandbox.ebay.com'
const PRODUCTION_BASE = 'https://api.ebay.com'

let cachedToken = null
let tokenExpiresAt = 0

function getBaseUrl() {
  const isSandbox = (process.env.EBAY_APP_ID || '').includes('SBX')
  return isSandbox ? SANDBOX_BASE : PRODUCTION_BASE
}

async function getOAuthToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const baseUrl = getBaseUrl()
  const credentials = Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`
  ).toString('base64')

  const { data } = await axios.post(
    `${baseUrl}/identity/v1/oauth2/token`,
    'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    }
  )

  cachedToken = data.access_token
  // Expire 5 minutes early to avoid edge cases
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000
  return cachedToken
}

export async function searchEbay(query) {
  const token = await getOAuthToken()
  const baseUrl = getBaseUrl()

  const { data } = await axios.get(
    `${baseUrl}/buy/browse/v1/item_summary/search`,
    {
      params: {
        q: query,
        limit: 25,
        sort: 'newlyListed',
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    }
  )

  if (!data.itemSummaries) return []

  return data.itemSummaries.map((item) => ({
    title: item.title,
    price: item.price
      ? `${item.price.currency} ${item.price.value}`
      : null,
    price_cents: item.price
      ? Math.round(parseFloat(item.price.value) * 100)
      : null,
    link: item.itemWebUrl,
    image: item.image?.imageUrl || null,
    source: 'ebay',
    external_id: item.itemId,
    condition: item.condition || null,
    listing_date: item.itemCreationDate || null,
    location: item.itemLocation
      ? [item.itemLocation.city, item.itemLocation.stateOrProvince]
          .filter(Boolean)
          .join(', ')
      : null,
    seller_name: item.seller?.username || null,
  }))
}
