import * as cheerio from 'cheerio'
import fs from 'fs'

async function debugEbay() {
  const searchUrl = 'https://www.ebay.com/sch/i.html?_nkw=ford+f150+headlight&_ipg=50'

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })

  const html = await response.text()
  fs.writeFileSync('/tmp/ebay-debug.html', html)

  const $ = cheerio.load(html)

  console.log('\n=== eBay Debug ===')
  console.log(`HTML length: ${html.length}`)
  console.log(`Title: ${$('title').text()}`)

  // Try different possible selectors
  const selectors = [
    '.s-item',
    '.srp-results .s-item',
    'li.s-item',
    '[data-view="mi:1686|iid:1"]',
    'li[class*="s-item"]',
    '.srp-results li'
  ]

  for (const selector of selectors) {
    const count = $(selector).length
    console.log(`${selector}: ${count} elements`)
    if (count > 0) {
      const first = $(selector).first()
      console.log(`  First element classes: ${first.attr('class')}`)
      console.log(`  First element HTML (first 200 chars): ${first.html()?.substring(0, 200)}`)
    }
  }
}

async function debugCraigslist() {
  const searchUrl = 'https://sfbay.craigslist.org/search/pta?query=ford+f150+headlight&sort=rel'

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })

  const html = await response.text()
  fs.writeFileSync('/tmp/craigslist-debug.html', html)

  const $ = cheerio.load(html)

  console.log('\n=== Craigslist Debug ===')
  console.log(`HTML length: ${html.length}`)
  console.log(`Title: ${$('title').text()}`)

  // Try different possible selectors
  const selectors = [
    '.cl-search-result',
    '.result-row',
    'li.result-row',
    'li[class*="result"]',
    '.cl-static-search-result',
    'ol li',
    '[data-pid]'
  ]

  for (const selector of selectors) {
    const count = $(selector).length
    console.log(`${selector}: ${count} elements`)
    if (count > 0) {
      const first = $(selector).first()
      console.log(`  First element classes: ${first.attr('class')}`)
      console.log(`  First element HTML (first 200 chars): ${first.html()?.substring(0, 200)}`)
    }
  }
}

debugEbay().then(() => debugCraigslist()).catch(console.error)
