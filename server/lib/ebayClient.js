import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const EBAY_APP_ID = process.env.EBAY_APP_ID
const EBAY_CERT_ID = process.env.EBAY_CERT_ID
const EBAY_DEV_ID = process.env.EBAY_DEV_ID

// Using sandbox environment - change to production later
const OAUTH_BASE_URL = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
const API_BASE_URL = 'https://api.sandbox.ebay.com'

class EbayClient {
  constructor() {
    this.accessToken = null
    this.tokenExpiry = null
  }

  // Get OAuth access token using Client Credentials grant
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64')

      const response = await axios.post(
        OAUTH_BASE_URL,
        'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          }
        }
      )

      this.accessToken = response.data.access_token
      // Set expiry to 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000

      console.log('eBay OAuth token obtained successfully')
      return this.accessToken
    } catch (error) {
      console.error('eBay OAuth error:', error.response?.data || error.message)
      throw new Error('Failed to get eBay access token')
    }
  }

  // Search for items using the Browse API
  async searchItems(query) {
    try {
      const token = await this.getAccessToken()

      const searchUrl = `${API_BASE_URL}/buy/browse/v1/item_summary/search`

      const response = await axios.get(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        },
        params: {
          q: query,
          limit: 50,
          filter: 'categoryIds:6028' // Auto Parts & Accessories category
        }
      })

      return response.data.itemSummaries || []
    } catch (error) {
      console.error('eBay search error:', error.response?.data || error.message)
      return []
    }
  }
}

// Singleton instance
export const ebayClient = new EbayClient()
