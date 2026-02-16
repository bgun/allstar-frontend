import axios from 'axios'

const SANDBOX_BASE = 'https://api.sandbox.ebay.com'
const PRODUCTION_BASE = 'https://api.ebay.com'

const DEFAULT_PREFERENCES = {
  category_id: '33710',
  condition_ids: ['3000'],
  excluded_keywords: ['parting out', 'whole car', 'complete vehicle'],
  buying_options: ['FIXED_PRICE', 'BEST_OFFER', 'AUCTION'],
  vehicle_year: null,
  vehicle_make: null,
  vehicle_model: null,
  sort: 'newlyListed',
  max_price: '500',
  brand_type_oem: true,
  origin_us: true,
}

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

function buildFilterString(prefs) {
  const filters = []

  if (prefs.condition_ids?.length) {
    filters.push(`conditionIds:{${prefs.condition_ids.join('|')}}`)
  }

  if (prefs.buying_options?.length) {
    filters.push(`buyingOptions:{${prefs.buying_options.join('|')}}`)
  }

  if (prefs.max_price) {
    filters.push(`price:[..${prefs.max_price}],priceCurrency:USD`)
  }

  return filters.length ? filters.join(',') : undefined
}

function buildQuery(baseQuery, prefs) {
  let q = baseQuery
  if (prefs.excluded_keywords?.length) {
    const exclusions = prefs.excluded_keywords
      .map((kw) => `-"${kw}"`)
      .join(' ')
    q = `${q} ${exclusions}`
  }
  return q
}

function buildCompatibilityFilter(prefs) {
  const parts = []
  if (prefs.vehicle_year) parts.push(`Year:${prefs.vehicle_year}`)
  if (prefs.vehicle_make) parts.push(`Make:${prefs.vehicle_make}`)
  if (prefs.vehicle_model) parts.push(`Model:${prefs.vehicle_model}`)
  return parts.length ? parts.join(',') : undefined
}

function buildAspectFilter(prefs) {
  if (!prefs.category_id) return undefined
  const aspects = []
  if (prefs.brand_type_oem) {
    aspects.push('Brand Type:{Genuine OEM}')
  }
  if (prefs.origin_us) {
    aspects.push('Country/Region of Manufacture:{United States}')
  }
  if (!aspects.length) return undefined
  return `categoryId:${prefs.category_id},${aspects.join(',')}`
}

function formatPriceUsd(priceObj) {
  if (!priceObj?.value) return null
  const dollars = Math.round(parseFloat(priceObj.value))
  return `$${dollars}`
}

export async function searchEbay(query, preferences = {}) {
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences }
  const token = await getOAuthToken()
  const baseUrl = getBaseUrl()

  const params = {
    q: buildQuery(query, prefs),
    limit: 25,
    sort: prefs.sort || 'newlyListed',
  }

  if (prefs.category_id) {
    params.category_ids = prefs.category_id
  }

  const filter = buildFilterString(prefs)
  if (filter) {
    params.filter = filter
  }

  const compatibility = buildCompatibilityFilter(prefs)
  if (compatibility) {
    params.compatibility_filter = compatibility
  }

  const aspectFilter = buildAspectFilter(prefs)
  if (aspectFilter) {
    params.aspect_filter = aspectFilter
  }

  const url = `${baseUrl}/buy/browse/v1/item_summary/search`

  const { data } = await axios.get(url, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  })

  const constructedUrl = axios.getUri({ url, params })

  if (!data.itemSummaries) return { items: [], url: constructedUrl }

  const items = data.itemSummaries.map((item) => ({
    title: item.title,
    price: formatPriceUsd(item.price),
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

  return { items, url: constructedUrl }
}
