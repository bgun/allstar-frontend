import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.join(__dirname, '..', '..', 'logs')
const LOG_FILE = path.join(LOG_DIR, 'search.log')

export function logSearch({ email, query, ebayUrl, craigslistUrl, ebayCount, craigslistCount }) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }

    const entry = [
      `[${new Date().toISOString()}]`,
      `user=${email || 'anonymous'}`,
      `query="${query}"`,
      `ebay_url=${ebayUrl || 'N/A'}`,
      `craigslist_url=${craigslistUrl || 'N/A'}`,
      `ebay_results=${ebayCount ?? 0}`,
      `craigslist_results=${craigslistCount ?? 0}`,
    ].join(' | ')

    fs.appendFileSync(LOG_FILE, entry + '\n')
  } catch (err) {
    console.error('Failed to write search log:', err.message)
  }
}
