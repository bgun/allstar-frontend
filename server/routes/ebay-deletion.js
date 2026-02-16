import { createHash, createVerify } from 'crypto'
import axios from 'axios'
import { Router } from 'express'

const router = Router()

// Cache public keys for 1 hour
const keyCache = new Map()
const KEY_CACHE_TTL = 60 * 60 * 1000

async function getEbayPublicKey(kid) {
  const cached = keyCache.get(kid)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.key
  }

  // Get OAuth token to call the notification API
  const credentials = Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`
  ).toString('base64')

  const isSandbox = (process.env.EBAY_APP_ID || '').includes('SBX')
  const baseUrl = isSandbox
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com'

  const tokenRes = await axios.post(
    `${baseUrl}/identity/v1/oauth2/token`,
    'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    }
  )

  const { data } = await axios.get(
    `${baseUrl}/commerce/notification/v1/public_key/${kid}`,
    {
      headers: {
        Authorization: `Bearer ${tokenRes.data.access_token}`,
      },
    }
  )

  const publicKeyPem = Buffer.from(data.key, 'base64').toString('utf-8')

  keyCache.set(kid, {
    key: publicKeyPem,
    expiresAt: Date.now() + KEY_CACHE_TTL,
  })

  return publicKeyPem
}

// GET - Challenge validation
router.get('/', (req, res) => {
  const challengeCode = req.query.challenge_code
  if (!challengeCode) {
    return res.status(400).json({ error: 'Missing challenge_code' })
  }

  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN
  const endpoint = process.env.EBAY_DELETION_ENDPOINT

  if (!verificationToken || !endpoint) {
    console.error('Missing EBAY_VERIFICATION_TOKEN or EBAY_DELETION_ENDPOINT env vars')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const hash = createHash('sha256')
    .update(challengeCode + verificationToken + endpoint)
    .digest('hex')

  res.status(200).json({ challengeResponse: hash })
})

// POST - Account deletion notification
// Note: raw body parsing is configured in server/index.js for this route
router.post('/', async (req, res) => {
  const signatureHeader = req.headers['x-ebay-signature']
  if (!signatureHeader) {
    return res.status(412).json({ error: 'Missing signature header' })
  }

  try {
    // Decode the signature header (base64-encoded JSON)
    const sigData = JSON.parse(Buffer.from(signatureHeader, 'base64').toString('utf-8'))
    const { kid, signature } = sigData

    // Fetch the public key
    const publicKey = await getEbayPublicKey(kid)

    // Get the raw body for verification
    const rawBody = typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body)

    // Verify the signature using ECDSA with SHA1
    const verifier = createVerify('SHA1')
    verifier.update(rawBody)
    const isValid = verifier.verify(publicKey, Buffer.from(signature, 'base64'))

    if (!isValid) {
      console.error('eBay notification signature verification failed')
      return res.status(412).json({ error: 'Signature verification failed' })
    }

    // Parse the notification payload
    const payload = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? JSON.parse(req.body)
      : req.body

    const { notification } = payload
    console.log('eBay account deletion notification received:', {
      notificationId: notification?.notificationId,
      userId: notification?.data?.userId,
      username: notification?.data?.username,
      eventDate: notification?.eventDate,
    })

    // Process the deletion - remove any stored data for this eBay user
    // For now we log it; in the future this could clean up listings by seller
    res.status(200).json({ status: 'acknowledged' })
  } catch (err) {
    console.error('Error processing eBay deletion notification:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
